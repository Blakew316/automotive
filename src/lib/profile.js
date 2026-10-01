// Turns a vehicle configuration (year/make/model + vPIC attributes from a VIN decode or a catalog
// selection) into the technical facts the diagrams, parts list and repair guides are built from.
// Every inference is labelled: `known` facts come straight from NHTSA data; `typical` ones are
// era/layout conventions and are presented to the user as such.
import { findEngineFamily, inferEngineFromCode, LAYOUT_RULES } from '../data/engines';

const RWD_CARS = [
  [/bmw/i, /^(?!.*(mini|i3)).*/i],
  [/mercedes/i, /^(?!.*(a-class|cla|gla|glb|b-class|a\d|cla\d|gla\d|glb\d|eqa|eqb)).*/i],
  [/lexus/i, /^(ls|gs|is|rc|lc|sc)/i],
  [/infiniti/i, /^(g\d|m\d|q50|q60|q70|fx|qx70|ex|q45|j30)/i],
  [/genesis/i, /^(g70|g80|g90|gv70|gv80)/i],
  [/hyundai/i, /^(genesis|equus)/i],
  [/kia/i, /^(stinger|k900)/i],
  [/cadillac/i, /^(cts|ats|ct4|ct5|ct6|sts|xlr|catera|fleetwood|deville)/i],
  [/chevrolet/i, /^(camaro|corvette|caprice|ss|impala ss|express|silverado|colorado|tahoe|suburban|avalanche|s10|s-10|trailblazer$|ssr)/i],
  [/gmc/i, /^(sierra|canyon|yukon|savana|envoy|sonoma|jimmy)/i],
  [/cadillac/i, /^escalade/i],
  [/jeep/i, /^(grand cherokee|commander|liberty|gladiator|wrangler|wagoneer|grand wagoneer)/i],
  [/lexus/i, /^(gx|lx)/i],
  [/infiniti/i, /^(qx56|qx80|qx4)/i],
  [/ram/i, /^(1500|2500|3500|4500|5500|dakota)/i],
  [/hummer/i, /.*/],
  [/pontiac/i, /^(g8|gto|firebird|solstice)/i],
  [/ford/i, /^(mustang|crown victoria|thunderbird|e-|econoline|transit$|f-|ranger|expedition|excursion)/i],
  [/lincoln/i, /^(town car|ls|mark lt|navigator)/i],
  [/mercury/i, /^(grand marquis|marauder)/i],
  [/dodge/i, /^(charger|challenger|magnum|viper|ram|dakota|durango)/i],
  [/chrysler/i, /^(300|300c|crossfire)/i],
  [/jaguar/i, /^(xj|xk|xf|f-type|s-type)/i],
  [/porsche/i, /^(911|boxster|cayman|718)/i],
  [/mazda/i, /^(mx-5|miata|rx-?[78])/i],
  [/nissan/i, /^(350z|370z|z$|240sx|300zx|gt-r|titan|frontier|nv\d|armada)/i],
  [/toyota/i, /^(86|gr86|supra|tundra|tacoma|sequoia|4runner|land cruiser|t100)/i],
  [/subaru/i, /^brz/i],
  [/scion/i, /^fr-s/i],
  [/alfa romeo/i, /^(giulia|4c|8c)/i],
  [/maserati/i, /.*/],
  [/rolls-royce|bentley|aston martin|ferrari|lamborghini|mclaren/i, /.*/],
];

function normDrive(drive = '', { make, model, body, vehicleType }) {
  const d = drive.toLowerCase();
  if (/front|fwd/.test(d)) return { drive: 'fwd', driveKnown: true };
  if (/rear|rwd/.test(d)) return { drive: 'rwd', driveKnown: true };
  if (/awd|all-wheel/.test(d)) return { drive: 'awd', driveKnown: true };
  if (/4wd|4x4|4-wheel|6x6|8x8/.test(d)) return { drive: '4wd', driveKnown: true };
  if (/6x4|8x4|8x6|10x/.test(d)) return { drive: 'rwd', driveKnown: true, heavy: true };
  // "4x2" = two-wheel drive, axle unknown. Trucks/vans are rear-drive; for cars use known RWD lines.
  // Minivans and plain "Van" bodies are mostly front-drive; full-size vans are caught by RWD_CARS.
  const truckish = /pickup|truck|incomplete|chassis|cutaway|bus|motor ?home|cargo van/i.test(body || '') || /truck|incomplete|bus/i.test(vehicleType || '');
  if (truckish) return { drive: 'rwd', driveKnown: false };
  const rwd = RWD_CARS.some(([mk, md]) => mk.test(make || '') && md.test((model || '').toLowerCase()));
  return { drive: rwd ? 'rwd' : 'fwd', driveKnown: false };
}

function bodyClass(body = '', vehicleType = '', gvwr = '') {
  const b = body.toLowerCase();
  const heavy = /class [4-8]|class 3/i.test(gvwr) && /truck|incomplete|bus|chassis/i.test(`${vehicleType} ${b}`);
  if (/bus/.test(b) || /bus/i.test(vehicleType)) return 'bus';
  if (/motor ?home/.test(b)) return 'motorhome';
  if (/incomplete|chassis|cutaway|glider|stripped/.test(b)) return heavy ? 'heavy' : 'chassis';
  if (/pickup/.test(b)) return heavy ? 'heavy' : 'pickup';
  if (/van|minivan/.test(b)) return 'van';
  if (/sport utility|suv|cuv|crossover|mpv/.test(b)) return 'suv';
  if (/truck|tractor/.test(b) || /truck/i.test(vehicleType)) return heavy ? 'heavy' : 'pickup';
  if (/wagon|hatchback/.test(b)) return 'hatch';
  return 'car';
}

function inferLayout(cfg = '', cyl, make) {
  // Every 4- and 6-cylinder Subaru sold in the U.S. is a boxer; some vPIC records say "In-Line".
  if (/subaru/i.test(make) && (Number(cyl) === 4 || Number(cyl) === 6)) return { layout: 'H', layoutKnown: true };
  if (/^V/i.test(cfg)) return { layout: 'V', layoutKnown: true };
  if (/in-line|inline/i.test(cfg)) return { layout: 'I', layoutKnown: true };
  if (/horizontal|opposed|boxer|flat/i.test(cfg)) return { layout: 'H', layoutKnown: true };
  if (/^W/i.test(cfg)) return { layout: 'W', layoutKnown: true };
  if (/rotary|wankel/i.test(cfg)) return { layout: 'R', layoutKnown: true };
  const n = Number(cyl);
  if (!n) return { layout: null, layoutKnown: false };
  if (/bmw/i.test(make) && n === 6) return { layout: 'I', layoutKnown: false };
  if (n <= 5) return { layout: 'I', layoutKnown: false };
  if (n >= 8) return { layout: 'V', layoutKnown: false };
  return { layout: null, layoutKnown: false };
}

function injectionType(v, fuelKind, year) {
  const t = `${v.eng || ''} ${v.engInfo || ''}`.toUpperCase();
  if (fuelKind === 'diesel') return { injection: year >= 2003 ? 'common-rail' : 'diesel', injectionKnown: /CRI|COMMON RAIL/.test(t) };
  const port = /\b(MPFI|SFI|SMPI|MFI|PFI|PORT|MULTIPORT|MULTI-PORT|SEQUENTIAL)\b/.test(t);
  const direct = /\b(SIDI|GDI|DI|TSI|FSI|DIRECT|D-4|SGDI|GTDI|ECOBOOST|SKYACTIV-G)\b/.test(t);
  if (port && direct) return { injection: 'dual', injectionKnown: true };
  if (direct) return { injection: 'direct', injectionKnown: true };
  if (port) return { injection: 'port', injectionKnown: true };
  if (/\bTBI\b|THROTTLE BODY/.test(t)) return { injection: 'tbi', injectionKnown: true };
  if (/CARB/.test(t)) return { injection: 'carb', injectionKnown: true };
  return { injection: year >= 2015 ? 'direct' : 'port', injectionKnown: false };
}

const n = (x) => (x == null || x === '' ? null : Number(x));

/**
 * @param {{year:number, make:string, model:string, values:object, vehicleType?:string, driveOverride?:string}} cfg
 */
export function buildProfile(cfg) {
  const v = cfg.values || {};
  const year = Number(cfg.year) || null;
  const make = cfg.make || '';
  const model = cfg.model || '';
  const fuelText = `${v.fuel || ''} ${v.fuel2 || ''}`;
  const elec = v.elec || '';
  const code = (v.eng || '').split(/\s+-\s+|,/)[0].trim();
  const statedDisp = parseFloat(v.dispL) || (parseFloat(v.dispCC) ? Math.round(parseFloat(v.dispCC) / 100) / 10 : null);
  // When the VIN data names the engine model but not its size, fill in what the code itself fixes.
  const guess = !n(v.cyl) || !statedDisp || !v.engCfg ? inferEngineFromCode({ make, code }) : null;
  const fromCode = guess && (!n(v.cyl) || n(v.cyl) === guess.cyl) ? guess : null;
  const cylinders = n(v.cyl) || fromCode?.cyl || n(v.cylGuess) || null;
  const disp = statedDisp || fromCode?.disp || null;

  let powertrain = 'ice';
  if (/BEV/i.test(elec) || (/electric/i.test(v.fuel || '') && !cylinders && !disp && !/hybrid|HEV/i.test(elec))) powertrain = 'ev';
  else if (/fuel cell|FCEV|hydrogen/i.test(`${elec} ${fuelText}`)) powertrain = 'fcev';
  else if (/PHEV|plug-in/i.test(elec)) powertrain = 'phev';
  else if (/mild/i.test(elec)) powertrain = 'mhev';
  else if (/HEV|hybrid/i.test(elec) || (/electric/i.test(v.fuel2 || '') && cylinders)) powertrain = 'hybrid';

  const fuelKind = /diesel/i.test(fuelText) ? 'diesel' : /compressed natural|cng|lng|propane|lpg/i.test(fuelText) ? 'gaseous' : powertrain === 'ev' ? 'electric' : 'gasoline';
  const flex = /ethanol|e85|flex/i.test(fuelText);
  const inferred = inferLayout(v.engCfg || v.cfgGuess, cylinders, make);
  const { layout, layoutKnown } = !v.engCfg && fromCode?.layout ? { layout: fromCode.layout, layoutKnown: false } : { layout: inferred.layout, layoutKnown: inferred.layoutKnown && Boolean(v.engCfg || /subaru/i.test(make)) };
  const family = cylinders ? findEngineFamily({ make, code, cyl: cylinders, layout, fuel: fuelText }) : null;
  const layoutKey = layout && cylinders ? `${layout}${cylinders}` : null;
  const firingOrder = family?.order || (layout === 'I' ? LAYOUT_RULES[layoutKey] : null) || null;
  const { injection, injectionKnown } = powertrain === 'ev' ? { injection: null, injectionKnown: true } : injectionType(v, fuelKind, year || 2000);
  const { drive, driveKnown, heavy } = normDrive(cfg.driveOverride || v.drive, { make, model, body: v.body, vehicleType: cfg.vehicleType });
  const body = bodyClass(v.body, cfg.vehicleType, v.gvwr);
  const motors = /tri|three/i.test(v.evdu || '') ? 3 : /dual|two/i.test(v.evdu || '') ? 2 : /quad|four/i.test(v.evdu || '') ? 4 : powertrain === 'ev' ? (drive === 'awd' || drive === '4wd' ? 2 : 1) : 0;
  const turbo = v.turbo === 'Yes' || /TURBO|GTDI|ECOBOOST|TSI|TFSI|\bTC\b|VGT|BITURBO/i.test(`${v.eng || ''} ${v.engInfo || ''}`);
  const supercharged = /SUPERCHARG|\bSC\b/i.test(`${v.eng || ''} ${v.engInfo || ''}`);
  const automatic = /auto|cvt|dual.clutch|dct|direct drive/i.test(v.trans || '') ? true : /manual|standard/i.test(v.trans || '') ? false : null;
  const cvt = /cvt|continuously/i.test(v.trans || '');
  const dct = /dual.clutch|dct/i.test(v.trans || '');
  const ice = powertrain !== 'ev' && powertrain !== 'fcev';
  const era = year || 2000;
  const heavyDuty = heavy || body === 'heavy' || body === 'bus' || /class [4-8]/i.test(v.gvwr || '');

  return {
    year,
    make,
    model,
    trim: [v.trim, v.series].filter(Boolean).join(' · ') || null,
    values: v,
    powertrain,
    ice,
    electrified: powertrain !== 'ice',
    fuelKind,
    flex,
    cylinders,
    displacement: disp,
    sizeSource: n(v.cyl) && statedDisp ? 'vin' : fromCode ? 'code' : v.cylGuess ? 'make' : 'vin',
    layout,
    layoutKnown,
    engineCode: code || null,
    engineFamily: family,
    firingOrder,
    firingOrderSource: family ? 'family' : firingOrder ? 'layout' : null,
    banks: family?.banks || null,
    turbo,
    supercharged,
    injection,
    injectionKnown,
    drive,
    driveKnown,
    motors,
    body,
    bodyText: v.body || null,
    heavyDuty,
    transmission: v.trans || null,
    automatic,
    cvt,
    dct,
    doors: n(v.doors),
    gvwr: v.gvwr || null,
    hp: n(v.hp),
    battery: { type: v.batt || null, kwh: n(v.kwh) },
    // Era conventions (U.S. market) — shown as "typical", never as fact.
    era: {
      obd2: era >= 1996,
      canRequired: era >= 2008,
      canLikely: era >= 2004,
      coilOnPlug: era >= 2003 ? 'likely' : era >= 1995 ? 'mixed' : 'unlikely',
      tpms: era >= 2008,
      cabinFilter: era >= 2005 ? 'likely' : era >= 1996 ? 'mixed' : 'unlikely',
      electronicThrottle: era >= 2008 ? 'likely' : era >= 2001 ? 'mixed' : 'unlikely',
      electricPowerSteering: era >= 2015 ? 'likely' : era >= 2008 ? 'mixed' : 'unlikely',
      backupCamera: era >= 2018,
      startStop: era >= 2016 && ice && powertrain === 'ice' ? 'possible' : 'unlikely',
      electronicParkingBrake: era >= 2015 && body !== 'pickup' && !heavyDuty ? 'possible' : 'unlikely',
      smartCharging: era >= 2010,
      adas: era >= 2018 ? 'likely' : era >= 2013 ? 'possible' : 'unlikely',
      returnlessFuel: era >= 2000,
      dpf: fuelKind === 'diesel' && era >= 2007,
      scr: fuelKind === 'diesel' && era >= 2010,
    },
  };
}

export const POWERTRAIN_LABEL = {
  ice: 'Internal combustion',
  mhev: 'Mild hybrid',
  hybrid: 'Hybrid',
  phev: 'Plug-in hybrid',
  ev: 'Battery electric',
  fcev: 'Fuel cell electric',
};
export const DRIVE_LABEL = { fwd: 'Front-wheel drive', rwd: 'Rear-wheel drive', awd: 'All-wheel drive', '4wd': 'Four-wheel drive' };
export const BODY_LABEL = { car: 'Car', hatch: 'Hatchback / wagon', suv: 'SUV / crossover', pickup: 'Pickup', van: 'Van', chassis: 'Chassis cab', heavy: 'Medium / heavy truck', bus: 'Bus', motorhome: 'Motorhome chassis' };
