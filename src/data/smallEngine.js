// Small Engine Edition basics: the kinds of equipment a power-equipment shop works on, its
// inspection checklist and its menu of common jobs. Small and loaded with the app; the brand list
// (smallEngineBrands.js) and troubleshooting guide (smallEngineTroubleshoot.js) load with their pages.
// Hours and prices are a starting menu for the shop to edit in Settings, not manufacturer times.

/** Equipment a unit can be. `engine` says whether it usually has a small gas engine (vs. battery). */
export const EQUIPMENT_TYPES = [
  { id: 'push-mower', label: 'Push / walk-behind mower', group: 'Mowers' },
  { id: 'riding-mower', label: 'Riding mower / lawn tractor', group: 'Mowers' },
  { id: 'zero-turn', label: 'Zero-turn mower', group: 'Mowers' },
  { id: 'commercial-mower', label: 'Commercial walk-behind / stand-on', group: 'Mowers' },
  { id: 'garden-tractor', label: 'Garden / compact tractor', group: 'Mowers' },
  { id: 'chainsaw', label: 'Chainsaw', group: 'Handheld' },
  { id: 'trimmer', label: 'String trimmer / brushcutter', group: 'Handheld' },
  { id: 'blower', label: 'Leaf blower', group: 'Handheld' },
  { id: 'hedge-trimmer', label: 'Hedge trimmer', group: 'Handheld' },
  { id: 'edger', label: 'Edger', group: 'Handheld' },
  { id: 'pole-saw', label: 'Pole saw / pruner', group: 'Handheld' },
  { id: 'multi-tool', label: 'Combi / multi-tool', group: 'Handheld' },
  { id: 'generator', label: 'Generator', group: 'Power & cleaning' },
  { id: 'pressure-washer', label: 'Pressure washer', group: 'Power & cleaning' },
  { id: 'water-pump', label: 'Water / trash pump', group: 'Power & cleaning' },
  { id: 'snow-blower', label: 'Snow blower', group: 'Seasonal' },
  { id: 'tiller', label: 'Tiller / cultivator', group: 'Seasonal' },
  { id: 'log-splitter', label: 'Log splitter', group: 'Seasonal' },
  { id: 'chipper', label: 'Chipper / shredder', group: 'Seasonal' },
  { id: 'aerator', label: 'Aerator / dethatcher', group: 'Seasonal' },
  { id: 'utv', label: 'UTV / ATV', group: 'Other' },
  { id: 'go-kart', label: 'Go-kart / mini bike', group: 'Other' },
  { id: 'engine', label: 'Engine only', group: 'Other' },
  { id: 'battery-tool', label: 'Battery-powered equipment', group: 'Other' },
  { id: 'other', label: 'Other equipment', group: 'Other' },
];

export const equipmentType = (id) => EQUIPMENT_TYPES.find((t) => t.id === id) || null;
export const equipmentTypeLabel = (id) => equipmentType(id)?.label || '';

/** The Small Engine Edition's inspection checklist (same shape as lib/workflow INSPECTION_TEMPLATE). */
export const SE_INSPECTION_TEMPLATE = [
  { section: 'Engine', items: ['Engine oil level & condition', 'Air filter & pre-filter', 'Spark plug condition & gap', 'Compression (psi)', 'Cooling fins & shroud clean', 'Recoil starter & rope', 'Muffler & spark arrestor', 'Valve clearance'] },
  { section: 'Fuel system', items: ['Fuel age & condition', 'Fuel lines & clamps', 'Fuel filter', 'Fuel tank & cap vent', 'Carburetor / primer bulb', 'Choke & throttle linkage'] },
  { section: 'Electrical', items: ['Battery & terminals (test)', 'Charging output', 'Ignition / kill switch', 'Safety interlocks (seat, PTO, brake)', 'Key switch & wiring', 'Lights'] },
  { section: 'Cutting & drive', items: ['Blades — sharpness & balance', 'Deck / spindle bearings', 'Drive & deck belts', 'Pulleys & idlers', 'Blade brake / clutch (BBC)', 'Hydrostatic drive / transmission', 'Chain & bar condition', 'Trimmer head & line'] },
  { section: 'Chassis & safety', items: ['Tire pressure & condition', 'Brakes / parking brake', 'Steering & linkages', 'Guards & shields in place', 'Operator presence controls', 'Leaks (oil, fuel, hydraulic)'] },
];

const L = (description, hours) => ({ type: 'labor', description, hours });
const P = (description, qty, cost, extra = {}) => ({ type: 'part', description, qty, cost, ...extra });
const F = (description, price) => ({ type: 'fee', description, qty: 1, price });

/** Shop menu ("canned jobs") for power equipment, same shape as data/seed CANNED_JOBS. */
export const SE_CANNED_JOBS = [
  { id: 'se-tune-push', title: 'Push mower tune-up', category: 'Tune-ups', items: [L('Change oil, replace air filter & spark plug, sharpen & balance blade, clean deck, adjust cables', 1.0), P('SAE 30 / 10W-30 small engine oil, 20 oz', 1, 5.5), P('Air filter (walk-behind)', 1, 8.5), P('Spark plug', 1, 4.25), F('Shop supplies & oil disposal', 4.0)] },
  { id: 'se-tune-rider', title: 'Riding mower / lawn tractor tune-up', category: 'Tune-ups', items: [L('Oil & filter, air & fuel filter, spark plugs, sharpen & balance blades, grease spindles, check belts, battery and tire pressure', 2.0), P('10W-30 small engine oil, 48 oz', 1, 13.5), P('Oil filter (small engine)', 1, 9.5), P('Air filter & pre-cleaner', 1, 18.0), P('Inline fuel filter', 1, 4.5), P('Spark plug', 2, 4.25), F('Shop supplies & oil disposal', 6.0)] },
  { id: 'se-tune-zt', title: 'Zero-turn service', category: 'Tune-ups', items: [L('Engine oil & filter, air & fuel filters, plugs, sharpen & balance blades, grease fittings, inspect belts and hydro drive', 2.5), P('10W-30 small engine oil, 64 oz', 1, 17.0), P('Oil filter (small engine)', 1, 9.5), P('Air filter & pre-cleaner', 1, 22.0), P('Inline fuel filter', 1, 4.5), P('Spark plug', 2, 4.25), F('Shop supplies & oil disposal', 8.0)] },
  { id: 'se-tune-hand', title: 'Handheld tune-up (saw, trimmer, blower)', category: 'Tune-ups', items: [L('Replace spark plug, air & fuel filter, inspect fuel lines, clean spark arrestor, adjust carburetor', 0.8), P('Spark plug', 1, 4.25), P('Air filter (handheld)', 1, 7.5), P('Fuel filter (in-tank)', 1, 4.0)] },
  { id: 'se-carb-clean', title: 'Carburetor clean & adjust', category: 'Fuel system', items: [L('Remove, disassemble, clean and reinstall carburetor; adjust idle and mixture', 1.0), P('Carburetor gasket & bowl kit', 1, 9.0), P('Fresh fuel & stabilizer', 1, 6.0)] },
  { id: 'se-carb-replace', title: 'Carburetor replacement', category: 'Fuel system', items: [L('Replace carburetor, gaskets and fuel line; set idle', 0.8), P('Carburetor assembly', 1, 38.0), P('Fuel line, per ft', 2, 2.5)] },
  { id: 'se-fuel-lines', title: 'Fuel line & filter replacement', category: 'Fuel system', items: [L('Replace fuel lines, filter and primer bulb as needed', 0.6), P('Fuel line, per ft', 3, 2.5), P('Inline fuel filter', 1, 4.5), P('Primer bulb', 1, 4.0)] },
  { id: 'se-blades', title: 'Blade sharpen & balance', category: 'Cutting & deck', items: [L('Remove, sharpen and balance mower blades, reinstall to torque', 0.5)] },
  { id: 'se-blades-new', title: 'Mower blade replacement', category: 'Cutting & deck', items: [L('Replace mower blades, torque blade bolts', 0.5), P('Mower blade (OEM spec)', 2, 16.0)] },
  { id: 'se-deck-belt', title: 'Deck belt replacement', category: 'Cutting & deck', items: [L('Replace deck belt, inspect pulleys & idlers', 0.8), P('Deck belt', 1, 32.0)] },
  { id: 'se-drive-belt', title: 'Drive belt replacement', category: 'Drive', items: [L('Replace traction drive belt, adjust tension', 1.2), P('Drive belt', 1, 34.0)] },
  { id: 'se-spindle', title: 'Deck spindle replacement', category: 'Cutting & deck', items: [L('Replace deck spindle assembly, grease and test', 1.0), P('Spindle assembly', 1, 48.0)] },
  { id: 'se-deck-level', title: 'Deck leveling & cut-quality adjust', category: 'Cutting & deck', items: [L('Set tire pressures, level deck side-to-side and front-to-back', 0.5)] },
  { id: 'se-hydro', title: 'Hydrostatic transmission service', category: 'Drive', items: [L('Change hydro oil & filters, purge air, adjust tracking', 1.5), P('Hydrostatic oil, 1 qt', 3, 12.0), P('Hydro filter', 2, 22.0)] },
  { id: 'se-recoil', title: 'Recoil starter repair', category: 'Engine', items: [L('Rewind or replace recoil starter rope and spring', 0.5), P('Starter rope', 1, 4.0)] },
  { id: 'se-starter', title: 'Electric starter / solenoid replacement', category: 'Electrical', items: [L('Test starting circuit, replace starter or solenoid', 0.8), P('Starter solenoid', 1, 24.0)] },
  { id: 'se-battery', title: 'Battery test & replacement', category: 'Electrical', items: [L('Load test battery and charging output, replace battery', 0.3), P('U1 lawn & garden battery', 1, 38.0), F('Battery core disposal', 0)] },
  { id: 'se-no-start', title: 'No-start / runs-poorly diagnosis', category: 'Diagnostics', items: [L('Check spark, fuel, compression, safety interlocks and valve lash; pinpoint the fault', 1.0)] },
  { id: 'se-valves', title: 'Valve adjustment', category: 'Engine', items: [L('Set valve clearance, replace valve cover gasket', 0.8), P('Valve cover gasket', 1, 6.0)] },
  { id: 'se-head-gasket', title: 'Head gasket replacement', category: 'Engine', items: [L('Replace cylinder head gasket, clean surfaces, torque head', 2.0), P('Head gasket', 1, 14.0)] },
  { id: 'se-chain-sharpen', title: 'Chainsaw chain sharpen', category: 'Handheld', items: [L('Sharpen saw chain, set depth gauges', 0.3)] },
  { id: 'se-chain-bar', title: 'Chain & bar replacement', category: 'Handheld', items: [L('Replace chain and guide bar, check sprocket and oiler', 0.4), P('Saw chain', 1, 22.0), P('Guide bar', 1, 38.0)] },
  { id: 'se-trimmer-head', title: 'Trimmer head & line', category: 'Handheld', items: [L('Replace trimmer head, reload line', 0.3), P('Trimmer head', 1, 22.0), P('Trimmer line', 1, 6.0)] },
  { id: 'se-generator', title: 'Generator service', category: 'Power equipment', items: [L('Oil change, air filter, spark plug, carburetor drain, load test output', 1.2), P('10W-30 small engine oil, 20 oz', 1, 5.5), P('Air filter', 1, 12.0), P('Spark plug', 1, 4.25)] },
  { id: 'se-pw-pump', title: 'Pressure washer pump service', category: 'Power equipment', items: [L('Change pump oil, replace unloader / seals and O-rings, test pressure', 1.0), P('Pump oil', 1, 8.0), P('Pump seal & O-ring kit', 1, 24.0)] },
  { id: 'se-snow', title: 'Snow blower tune-up', category: 'Seasonal', items: [L('Oil change, plug, carb clean, adjust cables, check shear pins, auger and drive belts', 1.5), P('5W-30 small engine oil, 20 oz', 1, 6.0), P('Spark plug', 1, 4.25), P('Shear pin & cotter set', 1, 6.0)] },
  { id: 'se-winterize', title: 'Winterize / storage prep', category: 'Seasonal', items: [L('Stabilize or drain fuel, run carb dry, fog cylinder, change oil, charge battery', 0.6), P('Fuel stabilizer', 1, 6.0)] },
  { id: 'se-spring', title: 'Spring start-up check', category: 'Seasonal', items: [L('Fresh fuel, charge & test battery, check oil, tire pressure, belts and blades; run test', 0.5)] },
  { id: 'se-tire', title: 'Tire or tube repair / replace', category: 'Drive', items: [L('Repair flat or replace tire/tube, mount and inflate', 0.5), P('Tire sealant / tube', 1, 12.0)] },
  { id: 'se-pickup', title: 'Pickup & delivery', category: 'Service', items: [F('Pickup & delivery (local)', 45.0)] },
];

/** Jobs customers can book online by default in this edition. */
export const SE_BOOKING_JOB_IDS = ['se-tune-push', 'se-tune-rider', 'se-tune-zt', 'se-tune-hand', 'se-blades', 'se-no-start', 'se-generator', 'se-snow'];
