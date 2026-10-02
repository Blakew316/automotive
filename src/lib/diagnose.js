// Auto diagnosis: for one vehicle and a concern, pull together what's actually known — the meaning of
// any trouble codes, NHTSA recalls, what owners of the same make/model/year have reported to NHTSA,
// and what fixed it at this shop before — and rank it against the symptom so the tech sees the
// likeliest answers first. Nothing here is invented: the vehicle-specific facts all come from NHTSA
// data or the shop's own repair orders; the symptom checks are general, not make-specific.
import { dtcCodes, dtcDetails } from '../data/dtcCodes';

/**
 * Common concerns: the words customers and owners use for them (matched as word starts), the NHTSA
 * component groups they fall under, the parts a repair for it usually names, and the general first
 * checks for any vehicle.
 */
export const SYMPTOMS = [
  {
    id: 'cel', label: 'Check engine light', words: ['check engine', 'engine light', 'service engine', 'cel', 'mil on', 'malfunction indicator'], systems: ['ENGINE', 'FUEL', 'EMISSION', 'POWER TRAIN'],
    parts: [],
    checks: ['Scan every module and save freeze-frame data before clearing anything', 'Note which codes are pending vs. confirmed and their mileage/time since set', 'Look up technical service bulletins and recalls for the codes before deep testing'],
  },
  {
    id: 'misfire', label: 'Misfire / runs rough', words: ['misfire', 'rough idle', 'idles rough', 'runs rough', 'running rough', 'stumble', 'hesitat', 'bucking', 'sputter', 'lack of power', 'loss of power', 'lost power'], systems: ['ENGINE', 'FUEL', 'ELECTRICAL'],
    parts: ['coil', 'spark plug', 'plug', 'ignition', 'injector', 'vacuum leak', 'intake', 'compression', 'mass air', 'maf', 'throttle body', 'fuel pump', 'pcv'],
    checks: ['Read misfire counters per cylinder (Mode $06) to find the cylinder', 'Swap the coil (then the plug) to another cylinder and see if the misfire follows', 'Inspect plugs and boots for wear, carbon tracking and oil', 'Check fuel trims for a vacuum leak or injector fault', 'Compression or leak-down test if ignition and fuel check out'],
  },
  {
    id: 'nostart', label: 'No start / no crank', words: ['no start', "won't start", 'wont start', 'will not start', 'would not start', 'does not start', 'fails to start', 'failed to start', 'no crank', "won't crank", 'cranks but', 'cranks no'], systems: ['ENGINE', 'ELECTRICAL', 'FUEL'],
    parts: ['battery', 'starter', 'fuel pump', 'crank sensor', 'crankshaft position', 'cam sensor', 'camshaft position', 'ignition switch', 'relay', 'immobilizer', 'terminal', 'cable'],
    checks: ['Battery state of charge and a load test; clean, tight cables and grounds', 'Crank or no crank? Check the starter command, neutral/clutch switch and starter draw', 'On a cranking engine: spark, injector pulse and fuel pressure', 'Security/immobilizer indicator and codes', 'Crank and cam sensor signals while cranking'],
  },
  {
    id: 'stall', label: 'Stalls / shuts off', words: ['stall', 'shuts off', 'shut off', 'dies', 'died while', 'cuts out', 'engine quit', 'turned off while driving'], systems: ['ENGINE', 'FUEL', 'ELECTRICAL', 'POWER TRAIN'],
    parts: ['throttle body', 'idle air', 'fuel pump', 'crank sensor', 'crankshaft position', 'maf', 'mass air', 'vacuum', 'egr', 'pcv', 'fuel filter'],
    checks: ['Codes and freeze-frame from the stall event', 'Throttle body/idle air cleanliness and idle relearn', 'Fuel pressure under load and fuel pump current', 'Crank sensor signal when hot', 'Vacuum leaks and MAF readings at idle'],
  },
  {
    id: 'overheat', label: 'Overheating / coolant loss', words: ['overheat', 'running hot', 'temperature gauge', 'coolant', 'antifreeze', 'steam', 'radiator', 'water pump', 'thermostat'], systems: ['ENGINE AND ENGINE COOLING', 'ENGINE'],
    parts: ['thermostat', 'water pump', 'radiator', 'coolant', 'fan', 'hose', 'head gasket', 'cooling'],
    checks: ['Coolant level and a cooling-system pressure test (cold)', 'Cooling fan operation and command', 'Thermostat opening temperature vs. actual', 'Combustion-gas (block) test for a head gasket', 'Water pump, hoses and heater core for leaks'],
  },
  {
    id: 'oil', label: 'Oil leak / burning oil', words: ['oil leak', 'leaking oil', 'leaks oil', 'burning oil', 'burns oil', 'oil consumption', 'consuming oil', 'low oil', 'oil pressure', 'oil light'], systems: ['ENGINE'],
    parts: ['gasket', 'seal', 'pcv', 'oil pan', 'valve cover', 'oil cooler', 'oil pressure', 'rear main', 'timing cover', 'sender', 'sending unit'],
    checks: ['Clean the area and add UV dye to find the source', 'Check the PCV system and crankcase pressure', 'Run a measured oil-consumption test', 'Verify oil pressure with a mechanical gauge'],
  },
  {
    id: 'trans', label: 'Shifting / transmission', words: ['transmission', 'shift', 'slip', 'harsh', 'gear', 'downshift', 'upshift', 'clutch', 'torque converter', 'shudder', 'neutral', 'jerk'], systems: ['POWER TRAIN'],
    parts: ['transmission', 'fluid exchange', 'valve body', 'solenoid', 'torque converter', 'clutch', 'shift', 'tcm', 'flywheel', 'trans mount'],
    checks: ['Fluid level and condition with the correct check procedure', 'TCM codes and software/calibration level', 'Adaptive values and shift relearn', 'Road test with data: commanded vs. actual gear, slip RPM, line pressure'],
  },
  {
    id: 'brakes', label: 'Brakes: noise, pedal, ABS', words: ['brake', 'braking', 'squeal', 'grind', 'pedal', 'abs', 'stopping'], systems: ['SERVICE BRAKES', 'PARKING BRAKE'],
    parts: ['brake', 'pad', 'rotor', 'caliper', 'master cylinder', 'abs', 'wheel speed', 'booster', 'drum', 'shoe'],
    checks: ['Measure pads and rotors; check rotor runout', 'Caliper slides and pad hardware', 'Brake fluid condition and moisture', 'ABS codes and wheel-speed sensor readings', 'Pedal feel: firm, soft, sinking or hard'],
  },
  {
    id: 'steering', label: 'Steering / pulling', words: ['steering', 'pull', 'wander', 'hard to steer', 'alignment', 'power steering', 'steering wheel'], systems: ['STEERING', 'SUSPENSION', 'WHEELS', 'TIRES'],
    parts: ['alignment', 'tie rod', 'rack', 'steering', 'ball joint', 'tire', 'power steering', 'eps', 'idler'],
    checks: ['Tire pressure, size and wear pattern', 'Alignment readings', 'Tie rods, ball joints and steering linkage play', 'Power steering fluid or EPS codes and assist current'],
  },
  {
    id: 'noise', label: 'Clunk / suspension noise', words: ['clunk', 'knock', 'rattle', 'squeak', 'creak', 'bump', 'suspension', 'strut', 'shock', 'sway bar'], systems: ['SUSPENSION', 'STEERING', 'STRUCTURE'],
    parts: ['link', 'bushing', 'strut', 'shock', 'ball joint', 'control arm', 'mount', 'sway', 'stabilizer', 'bearing', 'tie rod', 'spring'],
    checks: ['Road test over bumps and in turns to reproduce it', 'Sway bar links and bushings', 'Strut mounts, shocks and control-arm bushings', 'Ball joints, tie rods and wheel bearings'],
  },
  {
    id: 'vibration', label: 'Vibration / shake', words: ['vibrat', 'shake', 'shaking', 'shimmy', 'wobble', 'death wobble'], systems: ['SUSPENSION', 'STEERING', 'WHEELS', 'TIRES', 'POWER TRAIN'],
    parts: ['balance', 'tire', 'wheel bearing', 'hub', 'cv', 'axle', 'driveshaft', 'u-joint', 'rotor', 'motor mount'],
    checks: ['Note the speed and whether it changes with braking or throttle', 'Tire balance, out-of-round and belt separation', 'Driveshaft, CV joints and U-joints', 'Wheel bearings', 'Rotor runout if it shakes while braking'],
  },
  {
    id: 'electrical', label: 'Battery drain / electrical', words: ['battery', 'drain', 'dead battery', 'electrical', 'flicker', 'alternator', 'charging', 'warning lights', 'dash lights', 'power window', 'radio', 'module'], systems: ['ELECTRICAL SYSTEM'],
    parts: ['battery', 'alternator', 'ground', 'starter', 'fuse', 'relay', 'module', 'wiring', 'harness', 'terminal'],
    checks: ['Battery test and charging-system output', 'Parasitic draw test after the modules go to sleep', 'Main grounds and power distribution', 'Network codes (U-codes) across all modules'],
  },
  {
    id: 'ac', label: 'A/C or heat', words: ['a/c', 'air condition', 'not cold', 'blowing warm', 'blows warm', 'heater', 'no heat', 'blend door', 'blower', 'compressor'], systems: ['EQUIPMENT', 'ENGINE AND ENGINE COOLING'],
    parts: ['compressor', 'refrigerant', 'evacuate', 'recharge', 'a/c', 'condenser', 'evaporator', 'blend door', 'actuator', 'blower', 'heater core', 'expansion valve', 'orifice'],
    checks: ['High and low side pressures with the engine at fast idle', 'Compressor clutch or variable-valve command', 'Refrigerant charge by weight', 'Blend-door and mode-door operation', 'Coolant level and heater-core flow for no heat'],
  },
  {
    id: 'airbag', label: 'Airbag / SRS light', words: ['airbag', 'air bag', 'srs', 'seat belt', 'occupant'], systems: ['AIR BAGS', 'SEAT BELTS'],
    parts: ['airbag', 'air bag', 'clock spring', 'srs', 'seat belt', 'occupant'],
    checks: ['Read SRS codes (never probe airbag circuits with a test light)', 'Clock spring and seat connectors', 'Occupant classification sensor', 'Check for open recalls — SRS recalls are common'],
  },
  {
    id: 'fuel', label: 'Fuel smell / leak / mileage', words: ['fuel smell', 'gas smell', 'smell of gas', 'fuel leak', 'gas leak', 'fuel economy', 'gas mileage', 'fuel mileage', 'evap'], systems: ['FUEL SYSTEM', 'FUEL/PROPULSION'],
    parts: ['evap', 'purge', 'vent', 'gas cap', 'fuel cap', 'fuel line', 'injector', 'fuel pump', 'fuel tank', 'canister'],
    checks: ['Inspect fuel lines, rail and injector seals for leaks', 'EVAP smoke test', 'Fuel trims, O2/AFR sensor activity and thermostat temperature for poor mileage'],
  },
  {
    id: 'adas', label: 'Driver-assist warnings', words: ['lane', 'collision', 'adaptive cruise', 'cruise control', 'camera', 'parking sensor', 'blind spot', 'automatic emergency braking', 'radar'], systems: ['FORWARD COLLISION', 'LANE DEPARTURE', 'BACK OVER', 'ELECTRONIC STABILITY', 'VEHICLE SPEED CONTROL'],
    parts: ['calibrat', 'camera', 'radar', 'windshield'],
    checks: ['Codes in the camera/radar modules', 'Sensor and windshield/bumper condition and mounting', 'Calibration status — recalibrate after windshield or bumper work'],
  },
];

const SYMPTOM_BY_ID = Object.fromEntries(SYMPTOMS.map((s) => [s.id, s]));

/** Trouble codes in free text ("P0302, p0305 and U0100"). */
export function parseCodes(text = '') {
  const out = [];
  for (const m of String(text).toUpperCase().matchAll(/\b([PBCU][0-9][0-9A-F]{3})\b/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

const lower = (s) => String(s || '').toLowerCase();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A term matches at the start of a word ("stall" finds "stalled", "stalling").
const termRe = (t) => new RegExp(`(^|[^a-z0-9])${escape(t)}`, 'i');
const hasTerm = (text, t) => termRe(t).test(text);

/** Which common concerns a description mentions. */
export function detectSymptoms(text = '') {
  const t = lower(text);
  return SYMPTOMS.filter((s) => s.words.some((w) => hasTerm(t, w))).map((s) => s.id);
}

// Code families → the concern they usually show up as.
function codeSymptoms(code) {
  if (code[0] === 'P') {
    if (/^P03[01]/.test(code) || /^P035/.test(code)) return ['misfire'];
    if (/^P03[34]/.test(code)) return ['nostart', 'stall'];
    if (/^P017[0-5]/.test(code)) return ['misfire'];
    if (/^P0(11[5-9]|12[5-8]|21[7-8])/.test(code)) return ['overheat'];
    if (/^P052[0-4]/.test(code)) return ['oil'];
    if (/^P04[4-6]/.test(code)) return ['fuel'];
    if (/^P050/.test(code)) return ['stall'];
    if (/^P0(56|60|61|62)/.test(code)) return ['electrical'];
    if (/^P0[7-9]/.test(code)) return ['trans'];
    return ['cel'];
  }
  if (code[0] === 'C') return parseInt(code.slice(1), 16) < 0x200 ? ['brakes'] : ['steering'];
  if (code[0] === 'B') return /^B00/.test(code) ? ['airbag'] : ['electrical'];
  if (code[0] === 'U') return ['electrical'];
  return [];
}

// Words in code descriptions that say nothing about the fault.
const DESC_STOP = new Set(['circuit', 'bank', 'sensor', 'system', 'performance', 'range', 'malfunction', 'detected', 'high', 'low', 'input', 'intermittent', 'voltage', 'control', 'module', 'signal', 'correlation', 'position', 'threshold', 'below', 'above', 'open', 'short', 'ground', 'battery', 'switch', 'with', 'from', 'and', 'the', 'cylinder', 'multiple', 'random', 'stuck', 'condition', 'level', 'pressure', 'temperature', 'quantity', 'operation']);

/** The search terms for a concern: what the tech typed, the concerns it names, and its codes. */
export function searchTerms({ text = '', symptoms = [], codes = [] }) {
  const ids = [...new Set([...symptoms, ...detectSymptoms(text), ...codes.flatMap(codeSymptoms)])];
  const terms = new Set();
  ids.forEach((id) => SYMPTOM_BY_ID[id]?.words.forEach((w) => terms.add(w)));
  for (const c of codes) {
    terms.add(lower(c));
    const d = dtcCodes[c]?.d || '';
    for (const w of lower(d).replace(/[^a-z ]+/g, ' ').split(/\s+/)) if (w.length >= 5 && !DESC_STOP.has(w)) terms.add(w);
  }
  const parts = [...new Set(ids.flatMap((id) => SYMPTOM_BY_ID[id]?.parts || []))];
  return { ids, terms: [...terms], parts };
}

const systemsFor = (ids) => [...new Set(ids.flatMap((id) => SYMPTOM_BY_ID[id]?.systems || []))];
const inSystems = (components, systems) => systems.length > 0 && components.some((c) => systems.some((s) => c.toUpperCase().startsWith(s)));

/** NHTSA writes complaints in capitals; this reads them back in sentence case. */
export function sentenceCase(s = '') {
  const t = String(s).trim();
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase()).replace(/\b(i)\b/g, 'I');
}

/** "the failure mileage was 85,000" → 85000 */
export function failureMileage(summary = '') {
  const m = /mileage (?:was |of |at )?(?:approximately |about |around )?([\d,]{3,7})/i.exec(summary);
  const n = m ? Number(m[1].replace(/,/g, '')) : NaN;
  return Number.isFinite(n) && n >= 50 && n < 500000 ? n : null;
}

// Boilerplate in NHTSA complaint summaries, and filler words, never make a "pattern".
const PHRASE_STOP = new Set(
  ('the a an and or but of to in on at for with by from into onto over under up down out off as is was were be been being it its it\'s this that these those there then than ' +
    'he she they them their his her him we our you your i me my contact owns owner owned stated states vehicle vehicles car truck suv dealer dealership manufacturer failure mileage ' +
    'approximately approximate unknown speed notified repaired repair diagnosed taken independent mechanic local also when while after before which who had has have having not no ' +
    'would could did does do done again still just about around time times day days mph miles mile one two three first second third same new old other another any all some ' +
    'driving drove drive driven going went go got get gets getting said told called call informed remedy recall recalls number nhtsa campaign under warranty part parts ' +
    'issue issues problem problems occurred occurs occur happened happen happens because due like back very only even ever never if so such can cannot will may might should').split(' '),
);
const WORD = /^[a-z][a-z-]{2,}$/;
// Generic ways of naming the concern itself say nothing new.
const GENERIC_PHRASES = new Set(['check engine light', 'check engine', 'engine light', 'warning light', 'service engine soon']);

/** Phrases (2–3 words) that many of the complaints share — the pattern owners describe. */
export function commonPhrases(complaints, { exclude = [], limit = 8 } = {}) {
  const skip = new Set(exclude.flatMap((e) => lower(e).split(/[^a-z0-9]+/)).filter(Boolean));
  const counts = new Map();
  // The newest few hundred reports are plenty to see the pattern.
  for (const c of complaints.slice(0, 600)) {
    const words = lower(c.summary).replace(/[^a-z0-9' -]+/g, ' ').split(/\s+/).filter(Boolean);
    const seen = new Set();
    for (let i = 0; i < words.length; i += 1) {
      for (const len of [2, 3]) {
        const g = words.slice(i, i + len);
        if (g.length < len) continue;
        const [a, z] = [g[0], g[len - 1]];
        if (!WORD.test(a) || !WORD.test(z) || PHRASE_STOP.has(a) || PHRASE_STOP.has(z) || skip.has(a) || skip.has(z)) continue;
        if (len === 3 && !WORD.test(g[1]) && !/^\d/.test(g[1])) continue;
        seen.add(g.join(' '));
      }
    }
    seen.forEach((p) => counts.set(p, (counts.get(p) || 0) + 1));
  }
  const ranked = [...counts.entries()].filter(([p, n]) => n >= 2 && !GENERIC_PHRASES.has(p)).sort((a, b) => b[1] - a[1] || b[0].split(' ').length - a[0].split(' ').length);
  const out = [];
  for (const [phrase, n] of ranked) {
    // Keep the longer phrase when a shorter one is just part of it with about the same count.
    if (out.some((o) => (o.phrase.includes(phrase) || phrase.includes(o.phrase)) && Math.abs(o.n - n) <= Math.max(1, o.n * 0.25))) continue;
    out.push({ phrase, n });
    if (out.length >= limit) break;
  }
  return out;
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** A short window of the complaint around the first matching word. */
export function excerpt(summary, terms, size = 240) {
  const text = sentenceCase(summary);
  const l = lower(text);
  let at = -1;
  for (const t of terms) {
    const m = termRe(t).exec(l);
    if (m && (at < 0 || m.index < at)) at = m.index + m[1].length;
  }
  if (at < 0 || text.length <= size) return text.length > size ? `${text.slice(0, size).trim()}…` : text;
  const start = Math.max(0, at - Math.round(size / 3));
  const end = Math.min(text.length, start + size);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/**
 * Owner complaints ranked against the concern. With no concern yet, every complaint counts and the
 * result is simply what owners of this vehicle report most.
 */
export function rankComplaints(complaints = [], { ids = [], terms = [] } = {}) {
  const systems = systemsFor(ids);
  const res = terms.map((t) => [t, termRe(t)]);
  const scored = complaints.map((c) => {
    const text = lower(c.summary);
    const hits = res.filter(([, re]) => re.test(text)).map(([t]) => t);
    const codeHit = hits.some((h) => /^[pbcu][0-9][0-9a-f]{3}$/.test(h));
    const sys = inSystems(c.components, systems);
    return { ...c, hits, score: hits.length + (codeHit ? 3 : 0) + (sys && hits.length ? 1 : 0) };
  });
  const matched = terms.length ? scored.filter((c) => c.score > 0).sort((a, b) => b.score - a.score || (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0)) : scored;
  const byComponent = new Map();
  for (const c of matched) for (const k of c.components) byComponent.set(k, (byComponent.get(k) || 0) + 1);
  const components = [...byComponent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, n]) => ({ name, n }));
  const miles = matched.map((c) => failureMileage(c.summary)).filter(Boolean);
  return {
    total: complaints.length,
    matched,
    components,
    mileage: miles.length >= 2 ? { median: median(miles), low: Math.min(...miles), high: Math.max(...miles), n: miles.length } : null,
    crashes: matched.filter((c) => c.crash).length,
    fires: matched.filter((c) => c.fire).length,
  };
}

/** Recalls for the vehicle, the ones that may relate to this concern first. */
export function rankRecalls(recalls = [], { ids = [], terms = [] } = {}) {
  const systems = systemsFor(ids);
  const res = terms.map((t) => [t, termRe(t)]);
  return recalls
    .map((r) => {
      // What the defect is, not its consequence ("loss of power" is the consequence of many things).
      const text = lower(`${r.component} ${r.summary}`);
      const hits = res.filter(([, re]) => re.test(text)).map(([t]) => t);
      const sys = inSystems(String(r.component || '').split(':').map((s) => s.trim()), systems);
      const codeHit = hits.some((h) => /^[pbcu][0-9][0-9a-f]{3}$/.test(h));
      const related = codeHit || (sys && hits.length > 0) || hits.length >= 2;
      return { ...r, hits, related: terms.length > 0 && related };
    })
    .sort((a, b) => Number(b.related) - Number(a.related) || b.hits.length - a.hits.length);
}

// Lines that find a fault rather than fix it.
const DIAG = /\b(diagnos\w*|inspect\w*|scan|road test|evaluat\w*|check engine light|testing)\b/i;
// Routine work that says nothing about a fault.
const ROUTINE = /\b(oil (change|&\s*filter|and filter)|lube|rotat\w*|inspect\w*|multi-?point|wipers?|(cabin|engine)( & cabin| and cabin)? (air )?filters?|air filters?|car wash|detail\w*|courtesy|tire (mount|install)\w*|alignment check|pressure check)\b/i;
const titleKey = (t) => lower(t).replace(/\([^)]*\)/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const sameText = (a, b) => lower(a).replace(/[^a-z0-9]/g, '') === lower(b).replace(/[^a-z0-9]/g, '');

/**
 * What fixed it here before: past repair orders on the same make and model (then the same make)
 * whose concern, cause, correction or notes match, grouped by the work done.
 */
export function shopFixes(state, { vehicle, terms = [], codes = [], parts = [], excludeOrderId } = {}) {
  if (!vehicle?.make) return { fixes: [], common: [], orders: 0 };
  const vById = new Map(state.vehicles.map((v) => [v.id, v]));
  const groups = new Map();
  const common = new Map();
  // "Check engine light" is on half the repair orders in a shop; when the tech said something more
  // specific (a misfire, a code), match on that.
  const strong = terms.filter((t) => !SYMPTOM_BY_ID.cel.words.includes(t));
  const res = (strong.length || codes.length ? strong : terms).map((t) => [t, termRe(t)]);
  const partRes = parts.map(termRe);
  let orders = 0;
  for (const o of state.orders) {
    if (o.id === excludeOrderId) continue;
    const v = vById.get(o.vehicleId);
    if (!v || !sameText(v.make, vehicle.make)) continue;
    const sameModel = sameText(v.model, vehicle.model);
    if (sameModel) orders += 1;
    const done = o.services.filter((s) => s.status !== 'declined' && (s.done || s.status === 'approved' || ['ready', 'closed'].includes(o.status)));
    if (sameModel)
      for (const s of done) {
        if (ROUTINE.test(s.title) || DIAG.test(s.title)) continue;
        const k = titleKey(s.title);
        const g = common.get(k) || { title: s.title, n: 0, last: null };
        g.n += 1;
        if (!g.last || (o.closedAt || o.createdAt) > (g.last.closedAt || g.last.createdAt)) g.last = o;
        common.set(k, g);
      }
    if (!terms.length && !codes.length) continue;
    // Match on the whole visit — the concern, notes and everything written on its services…
    // A diagnosis line's title is boilerplate ("Check engine light diagnosis"); what the tech wrote on it isn't.
    const said = (x) => lower([DIAG.test(x.title) ? '' : x.title, x.cause, x.correction, x.note].join(' '));
    const visit = lower([o.concern, ...(o.notes || []).map((n) => n.text)].join(' '));
    const text = `${visit} ${done.map(said).join(' ')}`;
    const hits = res.filter(([, re]) => re.test(text)).map(([t]) => t);
    const codeHits = codes.filter((c) => text.includes(lower(c)));
    if (!hits.length && !codeHits.length) continue;
    // …then credit the repairs on it — a diagnosis line found the problem, the repair fixed it. A
    // repair counts when its own lines match, or when the visit matched and it's the kind of repair
    // that concern calls for (coils and plugs for a misfire, not a transmission service).
    const real = done.filter((s) => !ROUTINE.test(s.title));
    const diag = real.find((s) => DIAG.test(s.title));
    for (const s of real) {
      if (DIAG.test(s.title)) continue;
      const own = res.filter(([, re]) => re.test(said(s))).length + codes.filter((c) => said(s).includes(lower(c))).length;
      const part = partRes.some((re) => re.test(said(s)));
      if (!own && !part) continue;
      const k = titleKey(s.title);
      const hours = (s.items || []).filter((i) => i.type === 'labor').reduce((t, i) => t + (Number(i.hours) || 0), 0);
      const g = groups.get(k) || { title: s.title, n: 0, sameModel: 0, hours: [], score: 0, last: null, cause: '', correction: '', codes: new Set() };
      g.n += 1;
      if (sameModel) g.sameModel += 1;
      if (hours) g.hours.push(hours);
      g.score += hits.length + codeHits.length * 3 + own * 3 + (part ? 2 : 0) + (sameModel ? 2 : 0);
      codeHits.forEach((c) => g.codes.add(c));
      const at = o.closedAt || o.createdAt;
      if (!g.last || at > (g.last.closedAt || g.last.createdAt)) {
        g.last = o;
        g.lastVehicle = v;
        g.cause = s.cause || diag?.cause || g.cause;
        g.correction = s.correction || g.correction;
      }
      groups.set(k, g);
    }
  }
  const fixes = [...groups.values()]
    .map((g) => ({ ...g, codes: [...g.codes], hours: g.hours.length ? Math.round((g.hours.reduce((a, b) => a + b, 0) / g.hours.length) * 10) / 10 : null }))
    .sort((a, b) => b.score - a.score || b.n - a.n)
    .slice(0, 6);
  return { fixes, common: [...common.values()].sort((a, b) => b.n - a.n).slice(0, 6), orders };
}

/** What each code means, with the general causes and checks the library has for it. */
export const codeInfo = (codes) =>
  codes.map((code) => ({ code, description: dtcCodes[code]?.d || null, system: dtcCodes[code]?.s || null, ...(dtcDetails[code] || {}), known: Boolean(dtcCodes[code]) }));

/** General first checks for the concerns named. */
export const symptomChecks = (ids) => ids.map((id) => SYMPTOM_BY_ID[id]).filter(Boolean);

const firstSentence = (s = '') => {
  const t = sentenceCase(s).replace(/\s+/g, ' ').trim();
  const m = /^(.{20,220}?[.!?])(\s|$)/.exec(t);
  return m ? m[1] : t.length > 220 ? `${t.slice(0, 220)}…` : t;
};
const titleCase = (s = '') => lower(s).replace(/(^|[\s/-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
export const componentLabel = (c = '') => titleCase(String(c).split(':').slice(0, 2).join(' › '));

/** The quick answer at the top: the strongest leads, best first. */
export function quickAnswer({ codes = [], recalls = [], complaints, fixes = [], vehicleLabel = 'this vehicle', concern = false }) {
  const out = [];
  for (const r of recalls.filter((x) => x.related).slice(0, 2))
    out.push({ kind: 'recall', title: `Recall ${r.campaign} may cover this`, detail: `${componentLabel(r.component)} — ${firstSentence(r.summary)}` });
  const fix = fixes[0];
  if (fix)
    out.push({
      kind: 'shop',
      title: `Fixed here before: ${fix.title}`,
      detail: `${fix.n}× at this shop${fix.sameModel ? ` (${fix.sameModel} on this model)` : ''}${fix.hours ? ` · about ${fix.hours} h` : ''}${fix.last ? ` · last on RO #${fix.last.number}` : ''}${fix.cause ? ` · cause: ${fix.cause}` : ''}`,
      orderId: fix.last?.id,
    });
  for (const c of codes.filter((x) => x.causes?.length).slice(0, 2))
    out.push({ kind: 'code', title: `${c.code}: ${c.description}`, detail: `Most common cause: ${c.causes[0]}${c.causes[1] ? `; then ${c.causes[1].charAt(0).toLowerCase()}${c.causes[1].slice(1)}` : ''}.` });
  if (complaints && complaints.matched.length >= (concern ? 2 : 5)) {
    const top = complaints.components[0];
    const phrases = complaints.phrases?.slice(0, 3).map((p) => `“${p.phrase}”`).join(', ');
    out.push({
      kind: 'owners',
      title: `${complaints.matched.length} owner report${complaints.matched.length === 1 ? '' : 's'} to NHTSA ${concern ? 'describe this' : 'for this vehicle'}${top ? ` — mostly ${titleCase(top.name)}` : ''}`,
      detail: [phrases && `Common: ${phrases}`, complaints.mileage && `typically around ${complaints.mileage.median.toLocaleString('en-US')} mi`].filter(Boolean).join(' · ') || `Reported by owners of ${vehicleLabel}.`,
    });
  }
  return out;
}

/** Everything above as plain text for the AI assistant's diagnostic plan. */
export function diagnosisContext({ vehicleLabel, mileage, concern, codes = [], recalls = [], complaints, fixes = [], years }) {
  const lines = [`Vehicle: ${vehicleLabel}`];
  if (mileage) lines.push(`Mileage: ${Number(mileage).toLocaleString('en-US')} mi`);
  lines.push(`Concern: ${concern || '(none given)'}`);
  if (codes.length) lines.push(`Trouble codes:\n${codes.map((c) => `- ${c.code}${c.description ? ` — ${c.description}` : ' (not in the generic code list; manufacturer-specific)'}`).join('\n')}`);
  const rel = recalls.filter((r) => r.related);
  if (recalls.length)
    lines.push(`NHTSA recalls for this year/make/model (${recalls.length}; ${rel.length} may relate):\n${recalls.slice(0, 8).map((r) => `- ${r.campaign} ${componentLabel(r.component)}${r.related ? ' [may relate]' : ''}: ${firstSentence(r.summary)}`).join('\n')}`);
  if (complaints)
    lines.push(
      [
        `Owner complaints filed with NHTSA (${years}): ${complaints.total} total, ${complaints.matched.length} matching this concern.`,
        complaints.components.length && `Systems: ${complaints.components.map((c) => `${titleCase(c.name)} (${c.n})`).join(', ')}.`,
        complaints.phrases?.length && `Common phrases: ${complaints.phrases.map((p) => `${p.phrase} (${p.n})`).join(', ')}.`,
        complaints.mileage && `Failure mileage reported: median ${complaints.mileage.median}, range ${complaints.mileage.low}–${complaints.mileage.high} (${complaints.mileage.n} reports).`,
        ...complaints.matched.slice(0, 4).map((c) => `- Report: ${excerpt(c.summary, c.hits || [], 320)}`),
      ]
        .filter(Boolean)
        .join('\n'),
    );
  if (fixes.length)
    lines.push(`This shop's past repairs on similar concerns:\n${fixes.map((f) => `- ${f.title}: ${f.n}× (${f.sameModel} on this model)${f.hours ? `, ~${f.hours} h` : ''}${f.cause ? `; cause: ${f.cause}` : ''}${f.correction ? `; correction: ${f.correction}` : ''}`).join('\n')}`);
  return lines.join('\n\n');
}
