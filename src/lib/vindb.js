// Offline, full VIN decoding from the NHTSA vPIC pattern database shipped with the site
// (public/data/vin/wmi/<first 3 VIN chars>.json, built by scripts/vpic/build_data.py).
// No network service is involved: a decode reads one small static file for the manufacturer.
import { cleanVin, decodeOffline, modelYear } from './vin';
import { titleMake } from './nhtsa';

const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';

function parseTokens(part) {
  const out = [];
  for (let i = 0; i < part.length; ) {
    const ch = part[i];
    if (ch === '[') {
      const j = part.indexOf(']', i);
      const body = part.slice(i + 1, j);
      const set = new Set();
      for (let k = 0; k < body.length; ) {
        if (k + 2 < body.length && body[k + 1] === '-') {
          for (const c of VIN_CHARS) if (c >= body[k] && c <= body[k + 2]) set.add(c);
          k += 3;
        } else {
          set.add(body[k]);
          k += 1;
        }
      }
      out.push(set);
      i = j + 1;
    } else {
      out.push(ch === '*' ? null : new Set([ch]));
      i += 1;
    }
  }
  return out;
}

const specificityOf = (tokens) =>
  tokens.reduce((s, t) => (t === null ? s : s + (t.size === 1 ? 1 : Math.max(0.05, 1 - (t.size - 1) / VIN_CHARS.length))), 0);

const keyCache = new Map();
export function parseKey(key) {
  let k = keyCache.get(key);
  if (!k) {
    const [vds, vis = ''] = key.split('|');
    const t = { vds: parseTokens(vds), vis: parseTokens(vis) };
    t.spec = specificityOf(t.vds) + specificityOf(t.vis);
    keyCache.set(key, (k = t));
  }
  return k;
}

function tokensMatch(tokens, text) {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === null) continue;
    const ch = text[i];
    if (ch === undefined || !t.has(ch)) return false;
  }
  return true;
}

export const keyMatches = (key, vds, vis) => {
  const k = parseKey(key);
  return tokensMatch(k.vds, vds) && tokensMatch(k.vis, vis);
};

const shardCache = new Map();

/** Default loader: static JSON shipped in /public/data. */
export function fetchShard(prefix) {
  if (!shardCache.has(prefix)) {
    const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
    shardCache.set(
      prefix,
      fetch(`${base}data/vin/wmi/${prefix}.json`).then((r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`VIN data unavailable (${r.status})`);
        return r.json();
      }).catch((e) => {
        shardCache.delete(prefix);
        throw e;
      }),
    );
  }
  return shardCache.get(prefix);
}

/** Pick the WMI entry: six-character codes for small manufacturers (3rd char '9'). */
function wmiEntries(shard, vin) {
  const code6 = vin.slice(0, 3) + vin.slice(11, 14);
  if (vin[2] === '9' && shard.w[code6]) return { code: code6, entries: shard.w[code6] };
  if (shard.w[vin.slice(0, 3)]) return { code: vin.slice(0, 3), entries: shard.w[vin.slice(0, 3)] };
  return { code: null, entries: [] };
}

const schemasFor = (entries, year) => [...new Set(entries.flatMap((e) => e.s.filter(([, yf, yt]) => year >= yf && year <= yt).map(([sid]) => sid)))];

/**
 * Core matcher. Mirrors vPIC: every pattern of every schema valid for the WMI + model year is
 * tested against VIN positions 4-8 and 10-17. The best (most specific) Model match picks the
 * schema; other elements come from that schema or from model-agnostic schemas (e.g. plant
 * tables), most specific pattern first.
 */
export function decodeWithShard(vin, shard, year) {
  const { code, entries } = wmiEntries(shard, vin);
  const vds = vin.slice(3, 8);
  const vis = vin.slice(9, 17);
  const F = shard.f;
  const modelField = F.indexOf('model');
  const sids = schemasFor(entries, year);
  const candidates = [];
  const hasModel = new Set();
  for (const sid of sids) {
    const schema = shard.s[sid];
    if (!schema) continue;
    for (const row of schema.p) {
      for (let i = 1; i < row.length; i += 2) if (row[i] === modelField) hasModel.add(sid);
      if (!keyMatches(row[0], vds, vis)) continue;
      const { spec } = parseKey(row[0]);
      for (let i = 1; i < row.length; i += 2) candidates.push({ field: F[row[i]], value: shard.v[row[i + 1]], spec, sid, key: row[0] });
    }
  }
  const best = (list, preferSid) =>
    list.reduce((a, b) => (!a || b.spec > a.spec || (b.spec === a.spec && b.sid === preferSid && a.sid !== preferSid) ? b : a), null);

  const model = best(candidates.filter((c) => c.field === 'model'));
  const chosen = model?.sid ?? null;
  const allowed = (c) => c.sid === chosen || !hasModel.has(c.sid);
  const values = {};
  const keys = {};
  for (const field of F) {
    if (field === 'model') continue;
    const pick = best(candidates.filter((c) => c.field === field && allowed(c)), chosen);
    if (pick) {
      values[field] = pick.value;
      keys[field] = pick.key;
    }
  }
  if (model) {
    values.model = model.value[1];
    values.modelMake = model.value[2];
    keys.model = model.key;
  }
  return {
    wmiCode: code,
    wmi: entries[0] || null,
    schemaCount: sids.length,
    schemaName: chosen ? shard.s[chosen]?.n : null,
    values,
    keys,
  };
}

const LAYOUT = (cfg = '', cyl, make = '') => {
  if (!cyl) return null;
  if (/subaru/i.test(make) && (Number(cyl) === 4 || Number(cyl) === 6)) return `H${cyl}`;
  if (/^V/i.test(cfg)) return `V${cyl}`;
  if (/In-Line/i.test(cfg)) return `I${cyl}`;
  if (/Horizontal/i.test(cfg)) return `H${cyl}`;
  if (/^W/i.test(cfg)) return `W${cyl}`;
  if (/Rotary/i.test(cfg)) return 'Rotary';
  return `${cyl}-cyl`;
};

export function engineLabel(v, make = '') {
  const disp = parseFloat(v.dispL) || (parseFloat(v.dispCC) ? parseFloat(v.dispCC) / 1000 : null);
  const electric = /BEV/i.test(v.elec || '') || (v.fuel === 'Electric' && !v.cyl && !disp);
  if (electric) return v.evdu ? `Electric · ${v.evdu}` : 'Electric';
  const parts = [disp ? `${disp.toFixed(1)}L` : null, v.turbo === 'Yes' ? 'Turbo' : null, LAYOUT(v.engCfg, v.cyl, make)];
  if (/Diesel/i.test(v.fuel || '')) parts.push('Diesel');
  if (/HEV|Hybrid/i.test(v.elec || '')) parts.push(/PHEV|Plug/i.test(v.elec) ? 'Plug-in Hybrid' : 'Hybrid');
  return parts.filter(Boolean).join(' ') || null;
}

const tidyPlace = (s) => (s ? String(s).replace(/\s*\(.*\)$/, '') : null);

function normalize(vin, offline, decoded, year) {
  const v = decoded.values;
  const wmi = decoded.wmi;
  const make = v.modelMake || wmi?.make?.[0] || offline.make || null;
  const disp = parseFloat(v.dispL) || (parseFloat(v.dispCC) ? parseFloat(v.dispCC) / 1000 : null);
  const specs = [
    ['Body', v.body],
    ['Doors', v.doors],
    ['Drive', v.drive],
    ['Engine', engineLabel(v, make)],
    ['Engine code', v.eng],
    ['Displacement', disp ? `${disp.toFixed(1)} L` : null],
    ['Cylinders', v.cyl],
    ['Horsepower', v.hp ? `${Math.round(Number(v.hp))} hp` : null],
    ['Fuel', [v.fuel, v.fuel2].filter(Boolean).join(' / ') || null],
    ['Engine notes', v.engInfo],
    ['Electrification', v.elec],
    ['Battery', [v.batt, v.kwh ? `${v.kwh}${v.kwhTo ? `–${v.kwhTo}` : ''} kWh` : null].filter(Boolean).join(', ') || null],
    ['Drive motors', v.evdu],
    ['Transmission', v.trans],
    ['Brakes', v.brake],
    ['GVWR', v.gvwr],
    ['Vehicle type', wmi?.type],
    ['Manufacturer', wmi?.mfr],
    ['Engine manufacturer', v.engMfr],
    ['Plant', [v.plantCity, v.plantState, tidyPlace(v.plantCountry)].filter(Boolean).map((s) => titleCase(s)).join(', ') || null],
  ].filter(([, x]) => x);
  const complete = Boolean(v.model);
  return {
    vin,
    source: 'offline',
    year,
    make: make ? titleMake(make) : null,
    model: v.model || null,
    trim: [v.trim, v.series].filter(Boolean).join(' · ') || null,
    series: v.series || null,
    body: v.body || null,
    engine: engineLabel(v, make),
    engineCode: v.eng || null,
    drive: v.drive || null,
    transmission: v.trans || null,
    fuel: v.fuel || null,
    vehicleType: wmi?.type || null,
    specs,
    safety: [],
    values: v,
    keys: decoded.keys,
    wmiCode: decoded.wmiCode,
    schemaName: decoded.schemaName,
    complete,
    errorCodes: complete ? ['0'] : ['1'],
    errorText: complete
      ? null
      : decoded.wmi
        ? 'The manufacturer is known but this VIN’s model codes are not in the NHTSA pattern data — the VIN may be mistyped, very new, or from a low-volume builder.'
        : 'Manufacturer code not found in the NHTSA database.',
  };
}

const titleCase = (s) => (/[a-z]/.test(s) ? s : s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a, b) => a + b.toUpperCase()));

/** Full offline decode. `load` can be swapped for tests (Node). */
export async function decodeVinLocal(input, load = fetchShard) {
  const offline = decodeOffline(input);
  const vin = cleanVin(input);
  if (!offline.valid) throw new Error(offline.errors[0] || 'Invalid VIN');
  const shard = await load(vin.slice(0, 3));
  if (!shard) return normalize(vin, offline, { values: {}, keys: {}, wmi: null, schemaCount: 0 }, offline.year);
  // Position 7 disambiguates the 30-year model-year cycle for North American vehicles; when it
  // doesn't (or the schema data says otherwise), use whichever cycle has matching schemas.
  const primary = offline.year;
  const alt = primary ? (primary >= 2010 ? primary - 30 : primary + 30) : null;
  let decoded = decodeWithShard(vin, shard, primary);
  let year = primary;
  if (!decoded.values.model && alt && alt >= 1980 && alt <= new Date().getFullYear() + 1) {
    const other = decodeWithShard(vin, shard, alt);
    if (other.values.model) {
      decoded = other;
      year = alt;
    }
  }
  return normalize(vin, offline, decoded, year);
}

export { modelYear };
