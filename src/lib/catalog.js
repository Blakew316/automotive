// Offline vehicle catalog (every make/model/year in NHTSA vPIC: cars, SUVs/MPVs, trucks,
// incomplete chassis). Data lives in /public/data/vehicles and is loaded on demand per make.
import { engineLabel, parseKey } from './vindb';
import { inferEngineFromCode } from '../data/engines';

const base = () => (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
const getJSON = (path) =>
  fetch(`${base()}data/${path}`).then((r) => {
    if (!r.ok) throw new Error(`Vehicle data unavailable (${r.status})`);
    return r.json();
  });

let indexPromise = null;
export function loadIndex() {
  if (!indexPromise) indexPromise = getJSON('vehicles/index.json').catch((e) => ((indexPromise = null), Promise.reject(e)));
  return indexPromise;
}

const makeCache = new Map();
export function loadMake(slug) {
  if (!makeCache.has(slug)) {
    makeCache.set(
      slug,
      getJSON(`vehicles/${slug}.json`)
        .then(decodeMake)
        .catch((e) => {
          makeCache.delete(slug);
          throw e;
        }),
    );
  }
  return makeCache.get(slug);
}

export function decodeMake(raw) {
  const { f: F, v: V } = raw;
  const schema = (s) => ({
    id: s.id,
    name: s.name,
    y: s.y,
    wmi: s.wmi,
    rows: s.r.map((r) => {
      const values = {};
      for (let i = 1; i < r.length; i += 2) values[F[r[i]]] = V[r[i + 1]];
      return { key: r[0], values };
    }),
  });
  const make = {
    make: raw.make,
    slug: raw.slug,
    models: raw.models.map((m) => ({ ...m, schemas: m.schemas.map(schema) })),
    shared: (raw.shared || []).map(schema),
  };
  make.sizes = sizeTable(make);
  return make;
}

const dispOf = (v) => parseFloat(v.dispL) || (parseFloat(v.dispCC) ? Math.round(parseFloat(v.dispCC) / 100) / 10 : null);

/**
 * Within one make, which cylinder counts / layouts each displacement has ever been filed with.
 * When a model year files only "3.5 L", and every other 3.5 L engine this make filed is a V6,
 * the V6 is offered as the likely configuration (and labelled as inferred).
 */
function sizeTable(make) {
  const t = new Map();
  for (const m of make.models)
    for (const s of m.schemas)
      for (const { values: v } of s.rows) {
        const d = dispOf(v);
        if (!d || !v.cyl) continue;
        const k = d.toFixed(1);
        if (!t.has(k)) t.set(k, { cyl: new Set(), cfg: new Set() });
        t.get(k).cyl.add(String(v.cyl));
        if (v.engCfg) t.get(k).cfg.add(v.engCfg);
      }
  return t;
}

/** Fill `cylGuess` / `cfgGuess` for values that give a displacement but no cylinder count. */
export function guessSize(values, sizes) {
  const d = dispOf(values);
  if (values.cyl || !d || !sizes) return values;
  const hit = sizes.get(d.toFixed(1));
  if (!hit || hit.cyl.size !== 1) return values;
  const out = { ...values, cylGuess: [...hit.cyl][0] };
  if (!values.engCfg && hit.cfg.size === 1) out.cfgGuess = [...hit.cfg][0];
  return out;
}

/** For decoded VINs: add make-level size inferences (loads that make's catalog file). */
export async function enrichValues(values, makeName) {
  if (values.cyl || !dispOf(values) || !makeName) return values;
  try {
    const make = await loadMake(slugify(makeName));
    return guessSize(values, make.sizes);
  } catch {
    return values;
  }
}

export const MAKE_ALIASES = { chevy: 'chevrolet', vw: 'volkswagen', 'mercedes': 'mercedes-benz', benz: 'mercedes-benz', landrover: 'land-rover' };

/**
 * Rows (VIN code -> attributes) for one model in one model year, across all its VIN schemas, plus
 * the manufacturer-wide schemas (`shared`) filed for the same WMIs that year — flagged `shared`.
 */
export function modelYearRows(model, year, shared = []) {
  const rows = [];
  const wmis = new Set();
  for (const s of model.schemas) {
    if (year < s.y[0] || year > s.y[1]) continue;
    s.wmi.forEach((w) => wmis.add(w));
    for (const r of s.rows) rows.push({ ...r, wmi: s.wmi, schema: s.name });
  }
  for (const s of shared) {
    if (year < s.y[0] || year > s.y[1]) continue;
    const wmi = s.wmi.filter((w) => wmis.has(w));
    if (!wmi.length) continue;
    for (const r of s.rows) rows.push({ ...r, wmi, schema: s.name, shared: true });
  }
  return rows;
}

const ENGINE_FIELDS = ['dispL', 'dispCC', 'cyl', 'engCfg', 'eng', 'fuel', 'fuel2', 'turbo', 'elec', 'evdu', 'batt', 'kwh'];
const uniq = (arr) => [...new Set(arr.filter(Boolean).map(String))];

/** The VIN position-8 character(s) that select an engine, when its patterns key on position 8 alone. */
function engineDigit(keys) {
  const chars = new Set();
  for (const { key } of keys) {
    const slots = keyPositions(key);
    const vds = slots.slice(3, 8);
    if (vds.slice(0, 4).some(Boolean) || !vds[4]) return null;
    chars.add(vds[4]);
  }
  return chars.size ? [...chars].join(', ') : null;
}

/** "3.7L V6" from an engine code when the VIN data doesn't give the size (see data/engines.js). */
function codeLabel(v, make) {
  const g = v.eng && inferEngineFromCode({ make, code: v.eng.split(/\s+-\s+|,/)[0] });
  if (!g) return null;
  return [g.disp ? `${g.disp.toFixed(1)}L` : null, `${g.layout}${g.cyl}`, /diesel/i.test(v.fuel || '') ? 'Diesel' : null].filter(Boolean).join(' ');
}

const SECONDARY_FIELDS = ['fuel', 'fuel2', 'elec', 'turbo', 'batt', 'kwh', 'hp', 'engInfo', 'engMfr', 'engCfg'];

const tokensCompatible = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    if (x && y && ![...x].some((c) => y.has(c))) return false;
  }
  return true;
};
/** Could one VIN match both patterns? */
export const keysCompatible = (k1, k2) => {
  const a = parseKey(k1);
  const b = parseKey(k2);
  return tokensCompatible(a.vds, b.vds) && tokensCompatible(a.vis, b.vis);
};
const wmiOverlap = (a = [], b = []) => !a.length || !b.length || a.some((w) => b.includes(w));

/** Distinct real options for a model year, each tied to the VIN codes that select it. */
export function buildOptions(rows, make = '', sizes = null) {
  const engines = new Map();
  const absorb = (cur, r) => {
    const v = r.values;
    for (const f of ENGINE_FIELDS) if (v[f] && !cur.values[f]) cur.values[f] = v[f];
    if (v.hp) cur.hp.add(Math.round(Number(v.hp)));
    if (v.engInfo) cur.info.add(v.engInfo);
    if (v.engMfr && !cur.values.engMfr) cur.values.engMfr = v.engMfr;
  };
  const secondary = [];
  const codeOnly = [];
  for (const r of rows) {
    const v = r.values;
    const electricOnly = /BEV/i.test(v.elec || '') || (/electric/i.test(v.fuel || '') && !v.fuel2);
    const sized = v.cyl || v.dispL || v.dispCC || v.evdu || electricOnly;
    if (!sized) {
      // Engine model code, fuel, electrification, turbo or output filed on a separate pattern:
      // merged below into the engines it can co-occur with.
      if (v.eng) codeOnly.push(r);
      else if (SECONDARY_FIELDS.some((f) => v[f])) secondary.push(r);
      continue;
    }
    const disp = parseFloat(v.dispL) || (parseFloat(v.dispCC) ? Math.round(parseFloat(v.dispCC) / 100) / 10 : null);
    const sig = JSON.stringify([disp, v.cyl, (v.eng || '').split(/\s+-\s+|,/)[0].trim(), v.fuel, v.fuel2, v.elec, v.turbo, v.evdu]);
    const cur = engines.get(sig) || { values: {}, keys: [], hp: new Set(), info: new Set(), shared: true };
    absorb(cur, r);
    if (disp && !cur.values.dispL) cur.values.dispL = String(disp);
    cur.keys.push({ key: r.key, wmi: r.wmi });
    if (!r.shared) cur.shared = false;
    engines.set(sig, cur);
  }
  const compatibleWith = (r) => (e) => e.keys.some((k) => wmiOverlap(k.wmi, r.wmi) && keysCompatible(k.key, r.key));
  for (const r of codeOnly) {
    const code = r.values.eng;
    const targets = [...engines.values()].filter((e) => (!e.values.eng || e.values.eng === code) && compatibleWith(r)(e));
    // Only attach a code to an engine when it can't be ambiguous between different engines.
    if (targets.length === 1) {
      absorb(targets[0], r);
      targets[0].keys.push({ key: r.key, wmi: r.wmi });
      continue;
    }
    const sig = JSON.stringify(['code', code, r.values.fuel, r.values.elec, r.values.turbo]);
    const cur = engines.get(sig) || { values: {}, keys: [], hp: new Set(), info: new Set(), shared: true };
    absorb(cur, r);
    cur.keys.push({ key: r.key, wmi: r.wmi });
    if (!r.shared) cur.shared = false;
    engines.set(sig, cur);
  }
  for (const r of secondary) {
    const targets = [...engines.values()].filter(compatibleWith(r));
    if (targets.length) targets.forEach((e) => absorb(e, r));
    else if (!engines.size || r.values.elec) {
      const sig = JSON.stringify(['secondary', r.values.fuel, r.values.fuel2, r.values.elec, r.values.turbo]);
      const cur = engines.get(sig) || { values: {}, keys: [], hp: new Set(), info: new Set(), shared: true };
      absorb(cur, r);
      cur.keys.push({ key: r.key, wmi: r.wmi });
      if (!r.shared) cur.shared = false;
      engines.set(sig, cur);
    }
  }
  // A model's own engine filings win; the manufacturer-wide table is used only when there are none.
  const own = [...engines.values()].some((e) => !e.shared);
  const engineList = [...engines.values()]
    .filter((e) => !(own && e.shared))
    .filter((e) => ['dispL', 'cyl', 'eng', 'fuel', 'elec', 'evdu', 'engMfr', 'turbo'].some((f) => e.values[f]))
    .map((e, i) => {
      const hp = [...e.hp].sort((a, b) => a - b);
      const values = guessSize({ ...e.values, engInfo: [...e.info].join(' · ') || undefined }, sizes);
      return {
        id: `e${i}`,
        values,
        label: engineLabel({ ...values, engCfg: values.engCfg || values.cfgGuess }, make) || codeLabel(e.values, make) || [e.values.engMfr, e.values.eng?.split(/\s+-\s+/)[0]].filter(Boolean).join(' ') || (e.values.fuel ? `${e.values.fuel} engine` : 'Engine'),
        code: e.values.eng ? e.values.eng.split(/\s+-\s+/)[0] : null,
        detail: e.values.eng && e.values.eng.includes(' - ') ? e.values.eng.split(/\s+-\s+/).slice(1).join(' - ') : null,
        hp,
        keys: e.keys,
        shared: e.shared,
        vinDigit: engineDigit(e.keys),
      };
    })
    .sort((a, b) => (parseFloat(a.values.dispL) || 99) - (parseFloat(b.values.dispL) || 99));

  const pick = (f) => {
    const own = uniq(rows.filter((r) => !r.shared).map((r) => r.values[f]));
    return own.length ? own : uniq(rows.filter((r) => r.shared).map((r) => r.values[f]));
  };
  const plants = new Map();
  const ownPlants = rows.some((r) => !r.shared && (r.values.plantCity || r.values.plantCountry));
  for (const r of rows) {
    const v = r.values;
    if (!v.plantCity && !v.plantCountry) continue;
    if (ownPlants && r.shared) continue;
    const code = r.key.includes('|') ? r.key.split('|')[1].replace(/\*/g, '').slice(0, 1) || null : null;
    const k = `${v.plantCity}|${v.plantState}|${v.plantCountry}`;
    if (!plants.has(k)) plants.set(k, { code, city: v.plantCity, state: v.plantState, country: v.plantCountry, company: v.plantCo });
  }
  return {
    engines: engineList,
    trims: pick('trim'),
    series: pick('series'),
    bodies: pick('body'),
    drives: pick('drive'),
    trans: pick('trans'),
    brakes: pick('brake'),
    doors: pick('doors').sort(),
    gvwr: pick('gvwr'),
    plants: [...plants.values()],
    plantsShared: !ownPlants && plants.size > 0,
    enginesShared: engineList.length > 0 && engineList.every((e) => e.shared),
    wmi: uniq(rows.flatMap((r) => r.wmi)),
  };
}

/** VIN code table: one line per pattern that sets something other than plant data. */
export function vinCodeTable(rows) {
  const out = [];
  for (const r of rows) {
    const v = { ...r.values };
    for (const f of ['plantCity', 'plantState', 'plantCountry', 'plantCo']) delete v[f];
    if (!Object.keys(v).length) continue;
    out.push({ key: r.key, wmi: r.wmi, values: v, shared: Boolean(r.shared), schema: r.schema });
  }
  return out;
}

/** Render a pattern key as the 17 VIN positions it constrains. */
export function keyPositions(key) {
  const [vds, vis = ''] = key.split('|');
  const slots = Array(17).fill(null);
  const fill = (part, start) => {
    let pos = start;
    for (let i = 0; i < part.length; ) {
      if (part[i] === '[') {
        const j = part.indexOf(']', i);
        slots[pos] = part.slice(i, j + 1);
        i = j + 1;
      } else {
        slots[pos] = part[i] === '*' ? null : part[i];
        i += 1;
      }
      pos += 1;
    }
  };
  fill(vds, 3);
  fill(vis, 9);
  return slots;
}

export function searchIndex(index, query, limit = 40) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const yearMatch = q.match(/\b(19[89]\d|20[0-4]\d)\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const words = q.replace(/\b(19[89]\d|20[0-4]\d)\b/, '').split(/\s+/).filter(Boolean).map((w) => MAKE_ALIASES[w] || w);
  const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const out = [];
  for (const mk of index.makes) {
    const makeText = squash(mk.name);
    for (const [name, slug, yf, yt, types] of mk.models) {
      if (year && (year < yf || year > yt)) continue;
      const hay = `${makeText} ${squash(name)} ${mk.slug} ${slug}`;
      if (!words.every((w) => hay.includes(squash(w)))) continue;
      const exactModel = words.some((w) => squash(name) === squash(w));
      out.push({ make: mk.name, makeSlug: mk.slug, model: name, modelSlug: slug, yf, yt, types, score: (exactModel ? 2 : 0) + (words.some((w) => makeText.startsWith(squash(w))) ? 1 : 0) });
    }
  }
  return out.sort((a, b) => b.score - a.score || b.yt - a.yt || a.model.localeCompare(b.model)).slice(0, limit).map((r) => ({ ...r, year }));
}

export const TYPE_LABEL = { P: 'Car', T: 'Truck', M: 'SUV / MPV', I: 'Incomplete chassis' };

export const slugify = (s = '') => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'make';

/** Link into the vehicle database for a year/make/model (e.g. from a VIN decode or a shop vehicle). */
export const catalogPath = ({ make, model, year }) => `/catalog/${slugify(make)}${model ? `/${slugify(model)}` : ''}${year ? `?year=${year}` : ''}`;

const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';
/** VIN position-10 character for a model year. */
export const yearCode = (year) => YEAR_CODES[(((year - 1980) % 30) + 30) % 30];

export const FIELD_LABEL = {
  model: 'Model',
  series: 'Series',
  trim: 'Trim',
  body: 'Body',
  doors: 'Doors',
  drive: 'Drive',
  cyl: 'Cylinders',
  dispL: 'Liters',
  dispCC: 'cc',
  eng: 'Engine',
  engCfg: 'Layout',
  fuel: 'Fuel',
  fuel2: 'Secondary fuel',
  turbo: 'Turbo',
  hp: 'hp',
  kw: 'kW',
  trans: 'Transmission',
  elec: 'Electrification',
  batt: 'Battery',
  kwh: 'kWh',
  kwhTo: 'kWh (to)',
  evdu: 'Drive units',
  charger: 'Charger',
  brake: 'Brakes',
  gvwr: 'GVWR',
  gvwrTo: 'GVWR (to)',
  engInfo: 'Engine notes',
  engMfr: 'Engine maker',
  plantCountry: 'Plant country',
  plantCity: 'Plant city',
  plantState: 'Plant state',
  plantCo: 'Plant company',
};
