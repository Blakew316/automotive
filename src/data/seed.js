// Demo shop data. Everything is generated relative to "now" so the dashboard always looks alive.
// Names, phone numbers (555-01xx is reserved for fiction) and emails (.example) are fictitious.
import { withCheckDigit } from '../lib/vin';
import { DEFAULT_MATRIX, priceFromMatrix, orderTotals } from '../lib/pricing';
import { INSPECTION_TEMPLATE } from '../lib/workflow';
import { seedExtras } from './seedExtras';
import { FRONT_DESK_DEFAULTS } from '../lib/operations';

export const DEFAULT_SHOP = {
  name: 'Main Street Auto Service',
  phone: '(217) 555-0142',
  email: 'service@mainstreetauto.example',
  address: '1200 N Main St',
  city: 'Springfield',
  state: 'IL',
  zip: '62702',
  laborRate: 145,
  techPayRate: 36,
  taxRate: 8.25,
  taxLabor: false,
  shopSuppliesPct: 5,
  shopSuppliesCap: 35,
  matrix: DEFAULT_MATRIX,
  bays: 6,
  warranty: '24 months / 24,000 miles on parts and labor',
  estimateTerms: 'Estimate valid for 30 days. No additional work will be performed without your authorization.',
  invoiceTerms: 'Payment due at vehicle pickup. Thank you for your business!',
};

export const TECHNICIANS = [
  { id: 't1', name: 'Marcus Reed', role: 'Master Technician', certs: 'ASE Master · L1', payRate: 42 },
  { id: 't2', name: 'Luis Ortega', role: 'Drivability & Electrical', certs: 'ASE A6 · A8 · L1', payRate: 38 },
  { id: 't3', name: 'Dana Whitfield', role: 'A-Technician', certs: 'ASE A1–A5', payRate: 30 },
  { id: 't4', name: 'Kim Park', role: 'Lube & Maintenance', certs: 'ASE G1', payRate: 22 },
];

const L = (description, hours) => ({ type: 'labor', description, hours });
const P = (description, qty, cost, extra = {}) => ({ type: 'part', description, qty, cost, ...extra });
const F = (description, price) => ({ type: 'fee', description, qty: 1, price });
const S = (description, cost, price, vendor) => ({ type: 'sublet', description, qty: 1, cost, price, vendor });

// Shop menu ("canned jobs"). Hours are this shop's own menu times — edit them in Settings.
export const CANNED_JOBS = [
  { id: 'cj-oil', title: 'Full synthetic oil & filter service', category: 'Maintenance', items: [L('Drain & refill engine oil, replace filter, reset oil life', 0.5), P('Full synthetic motor oil, 1 qt', 5, 6.1), P('Oil filter', 1, 7.4), F('Used oil & filter disposal', 3.5)] },
  { id: 'cj-rotate', title: 'Tire rotation & pressure check', category: 'Tires', items: [L('Rotate tires, set pressures to placard, torque lug nuts', 0.4)] },
  { id: 'cj-balance', title: 'Rotate & balance four tires', category: 'Tires', items: [L('Rotate and road-force balance four tires', 1.0), P('Wheel weights', 1, 4.0)] },
  { id: 'cj-align', title: 'Four-wheel alignment', category: 'Tires', items: [L('Four-wheel alignment, print before/after specs', 1.0)] },
  { id: 'cj-fbrakes', title: 'Front brake pads & rotors', category: 'Brakes', items: [L('Replace front pads & rotors, service slides, road test', 1.6), P('Ceramic brake pads, front', 1, 48.0), P('Brake rotor, front', 2, 54.0), P('Brake hardware kit', 1, 11.5), F('Brake cleaner & lubricant', 6.0)] },
  { id: 'cj-rbrakes', title: 'Rear brake pads & rotors', category: 'Brakes', items: [L('Replace rear pads & rotors, service slides, road test', 1.5), P('Ceramic brake pads, rear', 1, 44.0), P('Brake rotor, rear', 2, 49.0), P('Brake hardware kit', 1, 11.5)] },
  { id: 'cj-bfluid', title: 'Brake fluid exchange', category: 'Brakes', items: [L('Flush & bleed brake hydraulic system', 0.8), P('Brake fluid DOT 3/4, 32 oz', 1, 11.0)] },
  { id: 'cj-battery', title: 'Battery test & replacement', category: 'Electrical', items: [L('Test charging system, replace battery, reset BMS if equipped', 0.5), P('AGM battery', 1, 168.0), F('Battery core disposal', 0)] },
  { id: 'cj-diag', title: 'Check engine light diagnosis', category: 'Diagnostics', items: [L('Scan all modules, review freeze frame, pinpoint tests', 1.0)] },
  { id: 'cj-elec', title: 'Electrical diagnosis', category: 'Diagnostics', items: [L('Wiring diagram review, voltage-drop & circuit testing', 1.5)] },
  { id: 'cj-coolant', title: 'Cooling system service', category: 'Maintenance', items: [L('Drain & fill coolant, bleed air, pressure test', 1.0), P('OE-spec coolant, 1 gal', 2, 21.0)] },
  { id: 'cj-trans', title: 'Transmission fluid exchange', category: 'Maintenance', items: [L('Exchange transmission fluid, check level at temp', 1.2), P('ATF (OE spec), 1 qt', 8, 8.5)] },
  { id: 'cj-plugs', title: 'Spark plug replacement', category: 'Maintenance', items: [L('Replace spark plugs, inspect coil boots', 1.2), P('Iridium spark plug', 4, 11.5)] },
  { id: 'cj-filters', title: 'Engine & cabin air filters', category: 'Maintenance', items: [L('Replace engine & cabin air filters', 0.3), P('Engine air filter', 1, 15.0), P('Cabin air filter', 1, 14.0)] },
  { id: 'cj-ac', title: 'A/C performance check & recharge', category: 'Climate', items: [L('Evacuate, leak test, recharge to spec, verify vent temps', 1.2), P('Refrigerant R-1234yf, per oz', 16, 3.25), P('UV dye', 1, 6.0)] },
  { id: 'cj-belt', title: 'Serpentine belt replacement', category: 'Engine', items: [L('Replace serpentine belt, inspect tensioner & idlers', 0.7), P('Serpentine belt', 1, 34.0)] },
  { id: 'cj-wipers', title: 'Wiper blade replacement', category: 'Maintenance', items: [L('Replace front wiper blades', 0.2), P('Beam wiper blade', 2, 13.0)] },
  { id: 'cj-tpms', title: 'TPMS sensor replacement', category: 'Tires', items: [L('Dismount, replace TPMS sensor, remount, balance, relearn', 0.6), P('TPMS sensor, programmable', 1, 36.0)] },
  { id: 'cj-struts', title: 'Front strut assemblies (pair)', category: 'Suspension', items: [L('Replace front strut assemblies', 2.4), P('Complete strut assembly', 2, 124.0)] },
  { id: 'cj-hub', title: 'Wheel hub bearing assembly', category: 'Suspension', items: [L('Replace wheel hub bearing assembly', 1.3), P('Wheel hub bearing assembly', 1, 112.0)] },
  { id: 'cj-waterpump', title: 'Water pump replacement', category: 'Engine', items: [L('Replace water pump & gasket, refill & bleed coolant', 3.2), P('Water pump with gasket', 1, 92.0), P('OE-spec coolant, 1 gal', 2, 21.0)] },
  { id: 'cj-inspect', title: 'Pre-purchase inspection', category: 'Diagnostics', items: [L('Road test, scan, 60-point inspection with photos', 1.0)] },
  { id: 'cj-timing', title: 'Timing belt & water pump kit', category: 'Engine', items: [L('Replace timing belt, tensioner, idlers & water pump; refill & bleed coolant', 4.6), P('Timing belt kit with water pump', 1, 238.0), P('OE-spec coolant, 1 gal', 2, 21.0)] },
  { id: 'cj-valvecover', title: 'Valve cover gasket replacement', category: 'Engine', items: [L('Replace valve cover gasket & spark plug tube seals, clean & inspect', 2.1), P('Valve cover gasket set', 1, 46.0)] },
  { id: 'cj-cv', title: 'CV axle replacement', category: 'Suspension', items: [L('Replace front CV axle shaft, check fluid level', 1.4), P('CV axle shaft assembly', 1, 96.0)] },
  { id: 'cj-arms', title: 'Front lower control arms (pair)', category: 'Suspension', items: [L('Replace front lower control arms with ball joints & bushings', 2.2), P('Lower control arm with ball joint', 2, 82.0)] },
  { id: 'cj-tires', title: 'Tire installation (set of 4)', category: 'Tires', tires: true, items: [L('Mount & balance four tires, TPMS relearn, torque lug nuts', 1.0), P('Rubber valve stem', 4, 1.2), F('Tire disposal (4)', 16)] },
];

// Tire quotes used by the demo: size and good / better / best [tier, brand, model, cost, price each].
const TIRE_SETS = [
  { size: '225/65R17', options: [['good', 'Cooper', 'Endeavor', 118, 155], ['better', 'Continental', 'TrueContact Tour', 149, 194], ['best', 'Michelin', 'CrossClimate2', 182, 236]] },
  { size: '215/55R17', options: [['good', 'Hankook', 'Kinergy PT', 98, 129], ['better', 'Bridgestone', 'Turanza QuietTrack', 139, 181], ['best', 'Michelin', 'Defender2', 161, 209]] },
  { size: '245/75R17', options: [['good', 'Cooper', 'Discoverer AT3 4S', 176, 229], ['better', 'BFGoodrich', 'Trail-Terrain T/A', 191, 249], ['best', 'Michelin', 'Defender LTX M/S2', 226, 294]] },
];

export const INVENTORY = [
  { sku: 'OF-FL500S', partNumber: 'FL-500S', brand: 'Motorcraft', description: 'Oil filter', category: 'Filters', location: 'A1-01', qty: 14, min: 8, cost: 8.1, vendor: 'Ford dealer' },
  { sku: 'OF-FL820S', partNumber: 'FL-820S', brand: 'Motorcraft', description: 'Oil filter', category: 'Filters', location: 'A1-02', qty: 6, min: 6, cost: 7.2, vendor: 'Ford dealer' },
  { sku: 'OF-PF63E', partNumber: 'PF63E', brand: 'ACDelco', description: 'Oil filter', category: 'Filters', location: 'A1-03', qty: 9, min: 6, cost: 7.9, vendor: 'GM dealer' },
  { sku: 'OF-PF48', partNumber: 'PF48', brand: 'ACDelco', description: 'Oil filter', category: 'Filters', location: 'A1-04', qty: 4, min: 6, cost: 7.4, vendor: 'GM dealer' },
  { sku: 'OF-15400', partNumber: '15400-PLM-A02', brand: 'Honda', description: 'Oil filter', category: 'Filters', location: 'A1-05', qty: 18, min: 10, cost: 6.3, vendor: 'Honda dealer' },
  { sku: 'OF-YZZA1', partNumber: '04152-YZZA1', brand: 'Toyota', description: 'Oil filter element (cartridge)', category: 'Filters', location: 'A1-06', qty: 11, min: 8, cost: 7.8, vendor: 'Toyota dealer' },
  { sku: 'OF-YZZF1', partNumber: '90915-YZZF1', brand: 'Toyota', description: 'Oil filter (spin-on)', category: 'Filters', location: 'A1-07', qty: 3, min: 6, cost: 6.9, vendor: 'Toyota dealer' },
  { sku: 'OF-68191349', partNumber: '68191349AA', brand: 'Mopar', description: 'Oil filter element (cartridge)', category: 'Filters', location: 'A1-08', qty: 7, min: 6, cost: 9.4, vendor: 'Mopar dealer' },
  { sku: 'CF-80292', partNumber: '80292-TBA-A11', brand: 'Honda', description: 'Cabin air filter', category: 'Filters', location: 'A2-01', qty: 5, min: 4, cost: 18.6, vendor: 'Honda dealer' },
  { sku: 'OIL-0W20-Q', partNumber: '', brand: 'Bulk', description: 'Full synthetic 0W-20, per qt', category: 'Fluids', location: 'Bulk tank 1', qty: 212, min: 60, cost: 4.2, vendor: 'Lubricant distributor' },
  { sku: 'OIL-5W30-Q', partNumber: '', brand: 'Bulk', description: 'Full synthetic 5W-30, per qt', category: 'Fluids', location: 'Bulk tank 2', qty: 164, min: 60, cost: 4.3, vendor: 'Lubricant distributor' },
  { sku: 'OIL-5W20-Q', partNumber: '', brand: 'Bulk', description: 'Synthetic blend 5W-20, per qt', category: 'Fluids', location: 'Bulk tank 3', qty: 48, min: 60, cost: 3.6, vendor: 'Lubricant distributor' },
  { sku: 'CLT-ORANGE', partNumber: 'VC-3DIL-B', brand: 'Motorcraft', description: 'Orange coolant, prediluted, 1 gal', category: 'Fluids', location: 'B1-01', qty: 8, min: 4, cost: 19.5, vendor: 'Ford dealer' },
  { sku: 'CLT-SLLC', partNumber: '00272-SLLC2', brand: 'Toyota', description: 'Super Long Life coolant, 1 gal', category: 'Fluids', location: 'B1-02', qty: 6, min: 4, cost: 22.0, vendor: 'Toyota dealer' },
  { sku: 'CLT-HONDA2', partNumber: 'OL999-9011', brand: 'Honda', description: 'Type 2 coolant, 1 gal', category: 'Fluids', location: 'B1-03', qty: 2, min: 4, cost: 24.0, vendor: 'Honda dealer' },
  { sku: 'ATF-ULV', partNumber: 'XT-12-QULV', brand: 'Motorcraft', description: 'MERCON ULV ATF, 1 qt', category: 'Fluids', location: 'B2-01', qty: 24, min: 12, cost: 9.8, vendor: 'Ford dealer' },
  { sku: 'ATF-WS', partNumber: '00289-ATFWS', brand: 'Toyota', description: 'ATF WS, 1 qt', category: 'Fluids', location: 'B2-02', qty: 12, min: 12, cost: 8.9, vendor: 'Toyota dealer' },
  { sku: 'ATF-DW1', partNumber: '08200-9008', brand: 'Honda', description: 'ATF DW-1, 1 qt', category: 'Fluids', location: 'B2-03', qty: 9, min: 8, cost: 8.4, vendor: 'Honda dealer' },
  { sku: 'ATF-DEX6', partNumber: '10-9395', brand: 'ACDelco', description: 'DEXRON-VI ATF, 1 qt', category: 'Fluids', location: 'B2-04', qty: 16, min: 12, cost: 7.6, vendor: 'GM dealer' },
  { sku: 'BF-DOT3', partNumber: '', brand: 'Generic', description: 'Brake fluid DOT 3, 32 oz', category: 'Fluids', location: 'B3-01', qty: 10, min: 6, cost: 9.9, vendor: 'Local jobber' },
  { sku: 'REF-1234YF', partNumber: '', brand: 'Generic', description: 'Refrigerant R-1234yf, 10 lb cylinder', category: 'Fluids', location: 'Cage', qty: 2, min: 1, cost: 389.0, vendor: 'Local jobber' },
  { sku: 'BAT-H6', partNumber: 'MTX-48/H6', brand: 'Interstate', description: 'AGM battery, group 48/H6', category: 'Electrical', location: 'C1-01', qty: 3, min: 2, cost: 172.0, vendor: 'Interstate' },
  { sku: 'BAT-65', partNumber: 'MTP-65', brand: 'Interstate', description: 'Flooded battery, group 65', category: 'Electrical', location: 'C1-02', qty: 2, min: 2, cost: 138.0, vendor: 'Interstate' },
  { sku: 'BAT-H7', partNumber: 'MTP-94R/H7', brand: 'Interstate', description: 'Flooded battery, group 94R/H7', category: 'Electrical', location: 'C1-03', qty: 1, min: 2, cost: 152.0, vendor: 'Interstate' },
  { sku: 'SP-ILZKR7B11', partNumber: 'ILZKR7B11', brand: 'NGK', description: 'Laser Iridium spark plug', category: 'Ignition', location: 'D1-01', qty: 16, min: 8, cost: 10.9, vendor: 'Local jobber' },
  { sku: 'WB-22', partNumber: '22A', brand: 'Bosch ICON', description: 'Beam wiper blade, 22 in', category: 'Wipers', location: 'E1-22', qty: 6, min: 4, cost: 16.5, vendor: 'Local jobber' },
  { sku: 'WB-26', partNumber: '26A', brand: 'Bosch ICON', description: 'Beam wiper blade, 26 in', category: 'Wipers', location: 'E1-26', qty: 5, min: 4, cost: 17.5, vendor: 'Local jobber' },
  { sku: 'WB-18', partNumber: '18A', brand: 'Bosch ICON', description: 'Beam wiper blade, 18 in', category: 'Wipers', location: 'E1-18', qty: 1, min: 4, cost: 15.5, vendor: 'Local jobber' },
  { sku: 'TIRE-2256517-CE', partNumber: '', brand: 'Cooper', description: 'Endeavor 225/65R17 tire', category: 'Tires', location: 'Tire rack A1', qty: 8, min: 4, max: 12, cost: 118.0, vendor: 'Tire distributor' },
  { sku: 'TIRE-2155517-HK', partNumber: '', brand: 'Hankook', description: 'Kinergy PT 215/55R17 tire', category: 'Tires', location: 'Tire rack A2', qty: 4, min: 4, max: 8, cost: 98.0, vendor: 'Tire distributor' },
  { sku: 'TIRE-2457517-CD', partNumber: '', brand: 'Cooper', description: 'Discoverer AT3 4S 245/75R17 tire', category: 'Tires', location: 'Tire rack B1', qty: 2, min: 4, max: 8, cost: 176.0, vendor: 'Tire distributor' },
  { sku: 'TPMS-UNI', partNumber: '', brand: 'Programmable', description: 'TPMS sensor, 315/433 MHz programmable', category: 'Tires', location: 'F1-01', qty: 8, min: 6, cost: 34.0, vendor: 'Tire distributor' },
  { sku: 'VS-TR413', partNumber: 'TR413', brand: 'Generic', description: 'Snap-in valve stem', category: 'Tires', location: 'F1-02', qty: 90, min: 50, cost: 0.45, vendor: 'Tire distributor' },
  { sku: 'SUP-BRKCLN', partNumber: '', brand: 'Generic', description: 'Brake parts cleaner, 14 oz', category: 'Shop supplies', location: 'Supply room', qty: 30, min: 24, cost: 3.4, vendor: 'Local jobber' },
  { sku: 'SUP-GLOVES', partNumber: '', brand: 'Generic', description: 'Nitrile gloves, box of 100 (L)', category: 'Shop supplies', location: 'Supply room', qty: 5, min: 6, cost: 11.0, vendor: 'Local jobber' },
];

const CUSTOMERS = [
  ['Avery', 'Thompson', '0101', 'Avid DIYer; prefers text updates', []],
  ['Jordan', 'Mitchell', '0102', '', ['Fleet']],
  ['Priya', 'Raman', '0103', 'Commutes 60 mi/day', []],
  ['Carlos', 'Mendoza', '0104', '', ['VIP']],
  ['Harper', 'Nguyen', '0105', 'Tesla owner — ask before any 12V work', []],
  ['Elijah', 'Brooks', '0106', '', []],
  ['Sofia', 'Castillo', '0107', 'Spanish preferred', []],
  ['Wesley', 'Grant', '0108', 'Off-road build — lift kit installed', ['VIP']],
  ['Naomi', 'Fischer', '0109', '', []],
  ['Tyler', 'Okafor', '0110', 'Company truck — bill to Okafor Landscaping', ['Fleet']],
  ['Grace', 'Holloway', '0111', '', []],
  ['Mateo', 'Alvarez', '0112', '', []],
  ['Lena', 'Kowalski', '0113', 'Wait customer — usually stays in lobby', []],
  ['Isaac', 'Bennett', '0114', '', []],
];

// [customer index, VIN prefix (pos 1–8), model-year code, plant, year, make, model, trim, engine, color, plate, mileage]
const VEHICLES = [
  [0, '1HGCV1F5', 'L', 'A', 2020, 'Honda', 'Accord', 'EX-L', '1.5L Turbo I4', 'Platinum White', 'DKR 4471', 48210],
  [1, '1FTEW1EP', 'J', 'F', 2018, 'Ford', 'F-150', 'XLT SuperCrew 4x4', '2.7L EcoBoost V6', 'Oxford White', 'FLT 2201', 96480],
  [1, '1GCUYDED', 'L', 'Z', 2020, 'Chevrolet', 'Silverado 1500', 'LT Crew Cab 4WD', '5.3L V8', 'Summit White', 'FLT 2207', 71350],
  [2, '4T1G11AK', 'M', 'U', 2021, 'Toyota', 'Camry', 'SE', '2.5L I4', 'Celestial Silver', 'PRY 921', 30120],
  [3, '1C6SRFFT', 'L', 'N', 2020, 'Ram', '1500', 'Big Horn Crew Cab 4x4', '5.7L HEMI V8', 'Granite Crystal', 'CMZ 88', 64210],
  [4, '5YJ3E1EB', 'K', 'F', 2019, 'Tesla', 'Model 3', 'Long Range AWD', 'Dual Motor Electric', 'Midnight Silver', 'EV HN19', 58760],
  [5, '2HKRW2H8', 'K', 'H', 2019, 'Honda', 'CR-V', 'EX-L AWD', '1.5L Turbo I4', 'Modern Steel', 'BRK 1190', 62040],
  [6, '2T3P1RFV', 'L', 'C', 2020, 'Toyota', 'RAV4', 'XLE AWD', '2.5L I4', 'Blueprint', 'SFC 7720', 41880],
  [7, '1C4HJXDG', 'M', 'W', 2021, 'Jeep', 'Wrangler Unlimited', 'Sport S', '3.6L V6', 'Firecracker Red', 'WRNGL 4', 38960],
  [8, '1FMSK8DH', 'L', 'G', 2020, 'Ford', 'Explorer', 'XLT 4WD', '2.3L EcoBoost I4', 'Agate Black', 'NAF 3348', 52300],
  [9, '3TMCZ5AN', 'K', 'M', 2019, 'Toyota', 'Tacoma', 'TRD Off-Road 4x4', '3.5L V6', 'Cement', 'OKF 551', 88710],
  [10, '2HGFC2F5', 'K', 'H', 2019, 'Honda', 'Civic', 'LX', '2.0L I4', 'Aegean Blue', 'GHL 2019', 57420],
  [11, '2GNAXKEV', 'K', '6', 2019, 'Chevrolet', 'Equinox', 'LT', '1.5L Turbo I4', 'Mosaic Black', 'MAV 623', 67890],
  [12, 'WBA5R1C5', 'K', 'A', 2019, 'BMW', '330i', 'Sedan', '2.0L Turbo I4', 'Mineral Grey', 'LKW 330', 44120],
  [13, '3VWC57BU', 'K', 'M', 2019, 'Volkswagen', 'Jetta', 'S', '1.4L Turbo I4', 'Pure White', 'IBN 4410', 51230],
  [3, '1N4AL3AP', 'G', 'C', 2016, 'Nissan', 'Altima', '2.5 SV', '2.5L I4', 'Gun Metallic', 'CMZ 89', 112480],
  [2, '4S4BSACC', 'H', '3', 2017, 'Subaru', 'Outback', '2.5i Premium', '2.5L H4', 'Crystal Black', 'PRY 922', 94560],
];

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeed(now = new Date()) {
  const rand = mulberry32(20260930);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  let n = 0;
  const id = (p) => `${p}_${(++n).toString(36).padStart(4, '0')}`;
  const shop = { ...DEFAULT_SHOP };
  const rate = shop.laborRate;
  const matrix = shop.matrix;
  // "Today" is anchored to shop hours so the demo looks plausible whenever it's opened:
  // during business hours activity is relative to now; after close it's relative to 4:30 PM;
  // before opening it reflects yesterday afternoon. Promise times and upcoming appointments
  // land in the next stretch of business hours.
  const hourNow = now.getHours() + now.getMinutes() / 60;
  const open = hourNow >= 7.5 && hourNow < 17;
  const anchor = new Date(now);
  if (!open) {
    if (hourNow < 7.5) anchor.setDate(anchor.getDate() - 1);
    anchor.setHours(16, 30, 0, 0);
  }
  const nextStart = new Date(now);
  if (!open) {
    if (hourNow >= 17) nextStart.setDate(nextStart.getDate() + 1);
    nextStart.setHours(8, 0, 0, 0);
  }
  const snap = (d, step) => {
    d.setMinutes(Math.round(d.getMinutes() / step) * step, 0, 0);
    return d;
  };
  const rel = (hours) => snap(new Date(anchor.getTime() + hours * 3600000), 5).toISOString();
  const ahead = (hours) => snap(new Date(nextStart.getTime() + hours * 3600000), 15).toISOString();
  const at = (daysAgo, hour = 9, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const customers = CUSTOMERS.map(([firstName, lastName, ext, notes, tags], i) => ({
    id: id('cus'),
    firstName,
    lastName,
    phone: `(217) 555-${ext}`,
    email: `${firstName}.${lastName}@example.com`.toLowerCase(),
    address: `${200 + i * 37} ${pick(['Oak', 'Maple', 'Cedar', 'Walnut', 'Elm', 'Lincoln', 'Washington'])} ${pick(['St', 'Ave', 'Dr', 'Ln'])}`,
    city: 'Springfield',
    state: 'IL',
    zip: pick(['62702', '62703', '62704', '62711']),
    company: tags.includes('Fleet') && lastName === 'Okafor' ? 'Okafor Landscaping' : tags.includes('Fleet') ? 'Mitchell Plumbing Co.' : '',
    notes,
    tags,
    textOptIn: true,
    createdAt: at(400 - i * 23),
  }));

  const vehicles = VEHICLES.map(([ci, prefix, yr, plant, year, make, model, trim, engine, color, plate, mileage], i) => ({
    id: id('veh'),
    customerId: customers[ci].id,
    vin: withCheckDigit(`${prefix}0${yr}${plant}${String(104233 + i * 7919).slice(-6)}`),
    year,
    make,
    model,
    trim,
    engine,
    color,
    plate,
    plateState: 'IL',
    mileage,
    notes: '',
    createdAt: customers[ci].createdAt,
  }));

  const tech = (tid) => TECHNICIANS.find((t) => t.id === tid)?.id || null;
  const makeItems = (items) =>
    items.map((it) => {
      const base = { id: id('itm'), ...it };
      if (it.type === 'labor') return { ...base, rate };
      if (it.type === 'part') return { ...base, price: it.price ?? priceFromMatrix(it.cost, matrix), partStatus: 'received' };
      return base;
    });
  const tireQuote = (set = pick(TIRE_SETS)) => ({
    size: set.size,
    qty: 4,
    selectedId: null,
    dots: [],
    registered: false,
    options: set.options.map(([tier, brand, model, cost, price]) => ({ id: id('tire'), tier, brand, model, spec: '', warranty: '', cost, price })),
  });
  const svc = (jobId, status = 'approved', extra = {}) => {
    const job = CANNED_JOBS.find((j) => j.id === jobId);
    return { id: id('svc'), title: job.title, status, techId: null, done: false, items: makeItems(job.items), ...(job.tires ? { tires: tireQuote() } : {}), ...extra };
  };
  const custom = (title, items, status = 'approved', extra = {}) => ({ id: id('svc'), title, status, techId: null, done: false, items: makeItems(items), ...extra });

  const inspection = (level) => {
    const out = {};
    INSPECTION_TEMPLATE.forEach(({ section, items }) =>
      items.forEach((label) => {
        const r = rand();
        out[`${section}::${label}`] = { rating: r < level ? 'good' : r < level + 0.12 ? 'soon' : r < level + 0.16 ? 'now' : 'good', note: '' };
      }),
    );
    return out;
  };

  const orders = [];
  let number = 10398;
  const V = (i) => vehicles[i];
  const order = (vi, status, fields) => {
    const v = V(vi);
    const o = {
      id: id('ro'),
      number: ++number,
      status,
      customerId: v.customerId,
      vehicleId: v.id,
      techId: null,
      advisor: 'Jordan Blake',
      concern: '',
      mileageIn: v.mileage,
      mileageOut: null,
      services: [],
      inspection: {},
      notes: [],
      payments: [],
      discount: { type: 'amt', value: 0 },
      createdAt: at(0),
      updatedAt: at(0),
      promisedAt: null,
      authorizedAt: null,
      invoicedAt: null,
      closedAt: null,
      ...fields,
    };
    orders.push(o);
    return o;
  };

  // The rest of the customer base: regulars from Springfield and nearby towns. Phone numbers use
  // the 555-0100–0199 range reserved for fiction in each area code.
  const FIRST = ['James', 'Mary', 'Robert', 'Linda', 'Michael', 'Susan', 'David', 'Karen', 'Chris', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Angela', 'Anthony', 'Megan', 'Mark', 'Rachel', 'Steven', 'Laura', 'Paul', 'Emily', 'Andrew', 'Kayla', 'Joshua', 'Brianna', 'Kevin', 'Olivia', 'Brian', 'Hailey', 'Eric', 'Morgan', 'Ryan', 'Alyssa', 'Jacob', 'Lauren', 'Nathan', 'Destiny', 'Aaron', 'Jasmine', 'Luke', 'Gabriela', 'Dylan', 'Tanya', 'Derek', 'Monica', 'Travis', 'Renee'];
  const LAST = ['Anderson', 'Baker', 'Carter', 'Diaz', 'Evans', 'Foster', 'Garcia', 'Hughes', 'Jensen', 'Keller', 'Lopez', 'Morgan', 'Nelson', 'Ortiz', 'Patel', 'Quinn', 'Reyes', 'Schultz', 'Turner', 'Underwood', 'Vasquez', 'Walsh', 'Young', 'Zimmerman', 'Brennan', 'Coleman', 'Dawson', 'Fleming', 'Harmon', 'Ingram', 'Lambert', 'McCoy', 'Novak', 'Parsons', 'Russo', 'Sutton', 'Tran', 'Whitaker'];
  // Only 100 fictional numbers per area code, so the base is split across 217, 309 and 618.
  const TOWNS = [
    ['Springfield', '217', ['62702', '62703', '62704', '62711']],
    ['Chatham', '217', ['62629']],
    ['Pekin', '309', ['61554']],
    ['Bloomington', '309', ['61701', '61704']],
    ['Peoria', '309', ['61604', '61614']],
    ['Alton', '618', ['62002']],
    ['Edwardsville', '618', ['62025']],
    ['Collinsville', '618', ['62234']],
  ];
  const COLORS = ['Black', 'White', 'Silver', 'Gray', 'Blue', 'Red', 'Dark Green', 'Pearl White', 'Charcoal'];
  // Numbers kept free for the past customers below and the demo's online booking request.
  const usedExt = new Set([...customers.map((c) => c.phone), ...['0115', '0116', '0117', '0177', '0188', '0199'].map((x) => `(217) 555-${x}`)]);
  const usedNames = new Set(customers.map((c) => `${c.firstName} ${c.lastName}`));
  const gr = mulberry32(99);
  const gpick = (arr) => arr[Math.floor(gr() * arr.length)];
  let serial = 300000;
  for (let i = 0; i < 150; i++) {
    let firstName;
    let lastName;
    do {
      firstName = gpick(FIRST);
      lastName = gpick(LAST);
    } while (usedNames.has(`${firstName} ${lastName}`));
    usedNames.add(`${firstName} ${lastName}`);
    const [city, area, zips] = i < 70 ? TOWNS[i % 6 === 5 ? 1 : 0] : gpick(TOWNS.slice(2));
    let phone;
    do phone = `(${area}) 555-01${String(Math.floor(gr() * 100)).padStart(2, '0')}`;
    while (usedExt.has(phone));
    usedExt.add(phone);
    const c = {
      id: id('cus'),
      firstName,
      lastName,
      phone,
      email: gr() < 0.8 ? `${firstName}.${lastName}${Math.floor(gr() * 90) + 10}@example.com`.toLowerCase() : '',
      address: `${100 + Math.floor(gr() * 2800)} ${gpick(['Oak', 'Maple', 'Cedar', 'Walnut', 'Elm', 'Lincoln', 'Washington', 'Jefferson', 'Park', 'Prairie', 'Chestnut'])} ${gpick(['St', 'Ave', 'Dr', 'Ln', 'Ct', 'Rd'])}`,
      city,
      state: 'IL',
      zip: gpick(zips),
      company: '',
      notes: '',
      tags: gr() < 0.06 ? ['VIP'] : [],
      textOptIn: gr() < 0.92,
      createdAt: at(160 + Math.floor(gr() * 900)),
    };
    customers.push(c);
    const nVeh = gr() < 0.18 ? 2 : 1;
    for (let k = 0; k < nVeh; k++) {
      const [, prefix, yr, plant, year, make, model, trim, engine] = gpick(VEHICLES.filter((v) => v[6] !== 'Model 3'));
      serial += 1 + Math.floor(gr() * 9000);
      vehicles.push({
        id: id('veh'),
        customerId: c.id,
        vin: withCheckDigit(`${prefix}0${yr}${plant}${String(serial).slice(-6)}`),
        year,
        make,
        model,
        trim,
        engine,
        color: gpick(COLORS),
        plate: `${String.fromCharCode(65 + Math.floor(gr() * 26))}${String.fromCharCode(65 + Math.floor(gr() * 26))}${String.fromCharCode(65 + Math.floor(gr() * 26))} ${100 + Math.floor(gr() * 9000)}`,
        plateState: 'IL',
        mileage: (2026 - year) * (9000 + Math.floor(gr() * 7000)) + Math.floor(gr() * 5000),
        notes: '',
        createdAt: c.createdAt,
      });
    }
  }

  // History: closed repair orders over the last ~150 days (feeds reports, accounting, marketing and
  // service history). Each service goes to the tech who'd normally do that kind of work.
  const JOB_MIX = [
    ['cj-oil', 18], ['cj-rotate', 8], ['cj-filters', 7], ['cj-wipers', 4], ['cj-fbrakes', 9], ['cj-rbrakes', 6], ['cj-bfluid', 4], ['cj-battery', 5], ['cj-diag', 8], ['cj-elec', 3],
    ['cj-align', 6], ['cj-balance', 4], ['cj-coolant', 3], ['cj-trans', 3], ['cj-plugs', 4], ['cj-ac', 4], ['cj-tpms', 3], ['cj-belt', 3], ['cj-struts', 3], ['cj-hub', 3],
    ['cj-waterpump', 3], ['cj-timing', 3], ['cj-valvecover', 4], ['cj-cv', 3], ['cj-arms', 3], ['cj-tires', 3],
  ];
  const mixTotal = JOB_MIX.reduce((a, [, w]) => a + w, 0);
  const pickJob = () => {
    let r = rand() * mixTotal;
    for (const [jid, w] of JOB_MIX) if ((r -= w) < 0) return jid;
    return 'cj-oil';
  };
  const TECH_FOR = { Maintenance: ['t4', 't3'], Tires: ['t4', 't3'], Brakes: ['t3', 't1'], Diagnostics: ['t2', 't1'], Electrical: ['t2', 't3'], Climate: ['t2', 't3'], Engine: ['t1', 't3'], Suspension: ['t1', 't3'] };
  // Flagged hours a tech can turn in a day (Kim is part-time; Saturdays are a half day for two techs).
  const CAP = { t1: 7, t2: 7, t3: 7, t4: 5 };
  const hoursOf = (jid) => CANNED_JOBS.find((j) => j.id === jid).items.filter((i) => i.type === 'labor').reduce((a, i) => a + i.hours, 0);
  const regulars = vehicles.map((_, i) => i).filter((i) => !['Model 3'].includes(vehicles[i].model));
  // A growing shop: busier over the last two months than earlier in the year.
  for (let daysAgo = 150; daysAgo >= 1; daysAgo--) {
    const day = new Date(now);
    day.setDate(day.getDate() - daysAgo);
    if (day.getDay() === 0) continue;
    const saturday = day.getDay() === 6;
    const load = { t1: 0, t2: 0, t3: 0, t4: 0 };
    const cap = saturday ? { t1: 0, t2: 0, t3: 3.2, t4: 3.2 } : CAP;
    const assign = (jid) => {
      const h = hoursOf(jid);
      const cat = CANNED_JOBS.find((j) => j.id === jid).category;
      // Dispatch like a service advisor: the specialist if they have room, otherwise whoever's lightest.
      const pref = TECH_FOR[cat] || ['t3'];
      const fits = (t) => cap[t] > 0 && load[t] + h <= cap[t];
      const score = (t) => load[t] / cap[t] - (t === pref[0] ? 0.3 : pref.includes(t) ? 0.15 : 0);
      const t = ['t1', 't2', 't3', 't4'].filter(fits).sort((a, b) => score(a) - score(b))[0];
      if (t) load[t] += h;
      return t;
    };
    const busy = daysAgo <= 60;
    const count = saturday ? 2 + Math.floor(rand() * 2) : busy ? 6 + Math.floor(rand() * 3) : 4 + Math.floor(rand() * 2);
    for (let n = 0; n < count; n++) {
      const vi = pick(regulars);
      const jobs = [pickJob()];
      if (rand() < 0.68) jobs.push(pickJob());
      if (rand() < 0.32) jobs.push(pickJob());
      const services = [];
      for (const j of new Set(jobs)) {
        const t = assign(j);
        if (t) services.push({ ...svc(j, 'approved'), techId: t, done: true });
      }
      if (!services.length) continue; // fully booked — the car comes back another day
      if (rand() < 0.3) services.push({ ...svc(pick(['cj-fbrakes', 'cj-struts', 'cj-coolant', 'cj-trans', 'cj-align', 'cj-arms', 'cj-valvecover']), 'declined') });
      const mileageIn = Math.max(1000, V(vi).mileage - Math.round(daysAgo * 38));
      // How the visit was booked — online booking grows as the shop promotes it.
      const pOnline = 0.12 + 0.3 * (1 - daysAgo / 150);
      const r = rand();
      const o = order(vi, 'closed', {
        source: r < pOnline ? 'online' : r < pOnline + (1 - pOnline) * 0.62 ? 'phone' : 'walk-in',
        techId: services[0].techId,
        services,
        mileageIn,
        mileageOut: mileageIn + 4,
        createdAt: at(daysAgo + (rand() < 0.2 ? 1 : 0), 7 + Math.floor(rand() * 2), Math.floor(rand() * 59)),
        authorizedAt: at(daysAgo, 8, 15 + Math.floor(rand() * 40)),
        invoicedAt: at(daysAgo, saturday ? 12 : 16, saturday ? 10 + Math.floor(rand() * 20) : 35 + Math.floor(rand() * 24)),
        closedAt: at(daysAgo, saturday ? 12 : 17, 30 + Math.floor(rand() * 25)),
        updatedAt: at(daysAgo, 17, 5),
        concern: '',
      });
      o.pendingPayment = true; // filled below once totals are known
    }
  }
  orders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  orders.forEach((o, i) => (o.number = 10399 + i));
  number = 10399 + orders.length - 1;

  // Active work in the shop right now.
  order(1, 'in_progress', {
    techId: 't2',
    concern: 'Check engine light on. Rough idle when cold, stumbles on hard acceleration.',
    createdAt: rel(-3.2),
    authorizedAt: rel(-1.9),
    promisedAt: ahead(2.5),
    services: [
      { ...svc('cj-diag', 'approved'), techId: 't2', done: true, cause: 'P0302 / P0305 stored. Cyl 2 & 5 plugs worn to 0.048 in gap; coil boots carbon tracked.', correction: '' },
      custom('Spark plugs & ignition coil boots (V6)', [L('Replace spark plugs (6) and coil boots', 2.1), P('Iridium spark plug', 6, 13.9), P('Ignition coil boot', 6, 9.6)], 'approved', { techId: 't2' }),
      { ...svc('cj-fbrakes', 'pending'), note: 'Front pads 3 mm, rotors below discard' },
    ],
    inspection: inspection(0.8),
    notes: [{ id: id('note'), at: rel(-1.95), text: 'Customer approved diag + plugs by phone. Wants a call on brakes.', internal: true }],
  });
  order(2, 'waiting_parts', {
    techId: 't1',
    concern: 'Grinding / humming from front right that gets louder when turning left.',
    createdAt: at(1, 8, 15),
    authorizedAt: at(1, 11, 20),
    promisedAt: at(-1, 15, 0),
    services: [
      custom('Front right wheel hub bearing assembly', [L('Replace RF wheel hub bearing assembly', 1.3), P('Wheel hub bearing assembly (4WD)', 1, 146.0, { partNumber: '', partStatus: 'ordered', eta: at(-1, 10, 0) })], 'approved', { techId: 't1' }),
      { ...svc('cj-rotate', 'approved'), techId: 't1' },
    ],
    inspection: inspection(0.85),
    notes: [{ id: id('note'), at: at(1, 12, 0), text: 'Hub on order from GM dealer, ETA tomorrow 10 AM.', internal: true }],
  });
  order(3, 'approved', {
    techId: 't4',
    concern: '30,000 mile service.',
    createdAt: rel(-1.5),
    authorizedAt: rel(-1.4),
    promisedAt: ahead(1.5),
    services: [svc('cj-oil'), svc('cj-rotate'), svc('cj-filters'), svc('cj-bfluid')],
  });
  order(5, 'estimate', {
    concern: 'Clunk from front suspension over bumps, worse on cold mornings.',
    createdAt: rel(-0.8),
    services: [
      custom('Front upper control arms (pair)', [L('Replace front upper control arms, check alignment', 1.8), P('Front upper control arm', 2, 88.0)], 'pending'),
      { ...svc('cj-align', 'pending') },
      custom('Cabin air filter (HEPA-style)', [L('Replace cabin air filter', 0.3), P('Cabin air filter', 2, 19.5)], 'pending'),
    ],
    notes: [{ id: id('note'), at: rel(-0.5), text: 'Estimate texted to customer.', internal: true }],
  });
  order(8, 'estimate', {
    concern: 'Steering shake ("death wobble") after hitting bumps at 45–55 mph.',
    createdAt: at(1, 14, 30),
    services: [
      custom('Front track bar & steering stabilizer', [L('Replace front track bar and steering stabilizer, torque to spec', 1.6), P('Adjustable front track bar', 1, 142.0), P('Steering stabilizer', 1, 64.0)], 'pending'),
      { ...svc('cj-align', 'pending') },
      { ...svc('cj-tires', 'pending'), tires: tireQuote(TIRE_SETS[2]), note: 'Front tires cupped from the shake — customer asked for options.' },
    ],
  });
  const ready1 = order(0, 'ready', {
    techId: 't4',
    concern: 'Oil life at 5%. Wipers streaking.',
    createdAt: rel(-3.4),
    authorizedAt: rel(-3.3),
    invoicedAt: rel(-0.6),
    promisedAt: rel(-0.5),
    mileageOut: 48214,
    services: [
      { ...svc('cj-oil'), techId: 't4', done: true },
      { ...svc('cj-wipers'), techId: 't4', done: true },
      { ...svc('cj-battery', 'declined'), note: 'Battery tested 68% SOH — recommend within 6 months' },
    ],
    inspection: inspection(0.88),
  });
  order(6, 'ready', {
    techId: 't3',
    concern: 'A/C blowing warm air.',
    createdAt: at(1, 8, 45),
    authorizedAt: at(1, 9, 30),
    invoicedAt: rel(-2.5),
    mileageOut: 62045,
    services: [
      { ...svc('cj-ac'), techId: 't3', done: true, cause: 'Low charge; UV dye found slow leak at low-side service port valve core.', correction: 'Replaced valve core, evacuated & recharged to spec, vent temp 41°F.' },
      { ...svc('cj-filters'), techId: 't3', done: true },
    ],
    inspection: inspection(0.9),
  });
  order(4, 'in_progress', {
    techId: 't1',
    concern: 'Coolant leak — puddle under front of truck overnight, sweet smell.',
    createdAt: at(1, 7, 50),
    authorizedAt: at(1, 10, 0),
    promisedAt: ahead(3),
    services: [
      { ...svc('cj-diag'), title: 'Cooling system pressure test & leak diagnosis', techId: 't1', done: true, cause: 'Water pump weep hole seeping under pressure test.' },
      { ...svc('cj-waterpump'), techId: 't1' },
      { ...svc('cj-belt', 'approved'), techId: 't1' },
    ],
    inspection: inspection(0.82),
  });
  order(15, 'approved', {
    techId: 't3',
    concern: 'Brakes squealing; CVT fluid never changed.',
    createdAt: rel(-2.8),
    authorizedAt: rel(-1.2),
    promisedAt: ahead(4),
    services: [{ ...svc('cj-fbrakes'), techId: 't3' }, { ...svc('cj-trans', 'approved'), title: 'CVT fluid exchange', techId: 't3' }],
  });
  order(13, 'estimate', {
    concern: 'Oil spots on driveway. Burning smell after highway drives.',
    createdAt: rel(-0.3),
    services: [custom('Oil leak diagnosis (UV dye)', [L('Add UV dye, clean, road test & inspect for oil leaks', 0.8), P('Oil UV dye', 1, 7.0)], 'pending')],
  });

  // Installed tires on completed work: the option chosen, its line on the RO, and DOT numbers.
  orders.forEach((o) => {
    if (o.status !== 'closed') return;
    o.services.forEach((sv) => {
      const q = sv.tires;
      if (!q || sv.status === 'declined') return;
      const opt = q.options[rand() < 0.25 ? 0 : rand() < 0.65 ? 1 : 2];
      q.selectedId = opt.id;
      const plant = pick(['4D', 'HY', 'B7', 'CU', 'U9', 'MD']);
      const batch = Math.floor(rand() * 9000 + 1000).toString(36).toUpperCase().padStart(4, 'X').slice(0, 4);
      // Made 3–40 weeks before they were installed (DOT date code = week + year).
      const made = new Date(new Date(o.invoicedAt).getTime() - (21 + Math.floor(rand() * 260)) * 86400000);
      const week = String(Math.min(52, Math.floor((made - new Date(made.getFullYear(), 0, 1)) / (7 * 86400000)) + 1)).padStart(2, '0');
      q.dots = Array.from({ length: q.qty }, () => `DOT ${plant} ${batch} ${week}${String(made.getFullYear()).slice(2)}`);
      q.registered = rand() < 0.7;
      sv.items.push({ id: id('itm'), type: 'part', tireLine: true, partNumber: '', partStatus: 'received', description: `${opt.brand} ${opt.model} ${q.size}`, brand: opt.brand, qty: q.qty, cost: opt.cost, price: opt.price, autoPrice: false });
    });
  });

  // Parts on estimates and not-yet-started work haven't been pulled or ordered yet.
  orders.forEach((o) => {
    if (o.status !== 'estimate' && o.status !== 'approved') return;
    o.services.forEach((sv) => sv.items.forEach((it) => it.type === 'part' && it.partStatus === 'received' && (it.partStatus = 'needed')));
  });

  // Payments for closed history.
  const payMethods = ['Card', 'Card', 'Card', 'Card', 'Cash', 'Check', 'ACH'];
  orders.forEach((o) => {
    if (o.status !== 'closed') return;
    delete o.pendingPayment;
    const total = orderTotals(o, shop).total;
    o.payments = [{ id: id('pay'), at: o.closedAt, method: pick(payMethods), amount: total, ref: '' }];
  });

  const appointments = [];
  const appt = (vi, dayOffset, hour, minute, duration, title, extra = {}) => {
    const v = V(vi);
    let start;
    if (dayOffset === 0) {
      // For today, "hour" is an offset: negative = already arrived (from the anchor), positive = upcoming.
      start = new Date(hour < 0 ? rel(hour) : ahead(hour));
      snap(start, 15);
    } else {
      start = new Date(now);
      start.setDate(start.getDate() + dayOffset);
      start.setHours(hour, minute, 0, 0);
    }
    appointments.push({ id: id('apt'), customerId: v.customerId, vehicleId: v.id, start: start.toISOString(), duration, title, techId: null, status: 'scheduled', notes: '', ...extra });
  };
  appt(0, 0, -3, 0, 60, 'Oil change + wipers', { status: 'arrived', techId: 't4' });
  appt(15, 0, -2.5, 0, 180, 'Brakes + CVT service', { status: 'arrived', techId: 't3' });
  appt(3, 0, -1.75, 0, 90, '30k service', { status: 'arrived', techId: 't4' });
  appt(13, 0, -0.5, 0, 60, 'Oil leak inspection', { status: 'arrived' });
  appt(11, 0, 1, 0, 60, 'Oil change, check brakes', { techId: 't4' });
  appt(16, 0, 2.25, 0, 90, 'Rattle over bumps — test drive', { techId: 't3' });
  appt(9, 1, 8, 0, 120, 'Fleet PM service', { techId: 't4' });
  appt(12, 1, 9, 30, 60, 'Oil change + tire rotation', { techId: 't4' });
  appt(7, 1, 13, 0, 120, 'Alignment after lift install', { techId: 't1' });
  appt(10, 2, 10, 0, 90, 'Pre-purchase inspection', { techId: 't2' });
  appt(14, 2, 14, 30, 60, 'Battery warning light', { techId: 't2' });
  appt(2, 3, 8, 0, 60, 'Oil change (fleet)', { techId: 't4' });
  appt(4, 4, 9, 0, 120, 'Transmission fluid service', { techId: 't3' });
  appt(6, 6, 10, 30, 45, 'Tire rotation', {});

  const inventory = INVENTORY.map((p) => ({ id: id('inv'), max: p.min * 3, ...p }));

  const activity = [
    { id: id('act'), at: rel(-0.3), text: `Estimate #${number} created for ${V(13).year} ${V(13).make} ${V(13).model}` },
    { id: id('act'), at: rel(-0.6), text: `Invoice #${ready1.number} ready — customer notified` },
    { id: id('act'), at: rel(-0.5), text: `Estimate sent to Harper Nguyen` },
    { id: id('act'), at: rel(-1.2), text: 'Carlos Mendoza approved front brakes + CVT service' },
    { id: id('act'), at: rel(-1.9), text: 'Jordan Mitchell approved diagnosis + spark plugs' },
    { id: id('act'), at: at(1, 12, 0), text: 'Parts ordered: wheel hub bearing assembly (GM dealer)' },
  ];

  // Older history (numbered before the main run of ROs) so Marketing has real work to do:
  // vehicles overdue for an oil service, and past customers who haven't been back in a year.
  const r2 = mulberry32(7);
  let oldNumber = 10300;
  const pastOrder = (v, daysAgo, jobIds, declined = []) => {
    const t = pick(TECHNICIANS).id;
    const services = [...jobIds.map((j) => ({ ...svc(j, 'approved'), techId: t, done: true })), ...declined.map((j) => svc(j, 'declined'))];
    const mileageIn = Math.max(1000, v.mileage - Math.round(daysAgo * 36));
    const o = {
      id: id('ro'),
      number: ++oldNumber,
      status: 'closed',
      customerId: v.customerId,
      vehicleId: v.id,
      techId: t,
      advisor: 'Jordan Blake',
      concern: '',
      mileageIn,
      mileageOut: mileageIn + 4,
      services,
      inspection: inspection(0.85),
      notes: [],
      payments: [],
      discount: { type: 'amt', value: 0 },
      createdAt: at(daysAgo, 8, Math.floor(r2() * 50)),
      updatedAt: at(daysAgo, 17, 5),
      promisedAt: null,
      authorizedAt: at(daysAgo, 9, 30),
      invoicedAt: at(daysAgo, 16, 10),
      closedAt: at(daysAgo, 17, 5),
    };
    o.payments = [{ id: id('pay'), at: o.closedAt, method: pick(['Card', 'Card', 'Cash', 'Check']), amount: orderTotals(o, shop).total, ref: '' }];
    orders.push(o);
  };
  // Regulars whose last oil change here was 6–7 months ago.
  const oiled = new Set(orders.filter((o) => o.services.some((x) => /oil/i.test(x.title) && x.status !== 'declined')).map((o) => o.vehicleId));
  const busy = new Set([...orders.filter((o) => o.status !== 'closed').map((o) => o.vehicleId), ...appointments.map((a) => a.vehicleId)]);
  vehicles
    .filter((v) => !oiled.has(v.id) && !busy.has(v.id) && v.make !== 'Tesla')
    .slice(0, 4)
    .forEach((v, i) => pastOrder(v, 186 + i * 11 + Math.floor(r2() * 5), ['cj-oil', 'cj-rotate']));
  // Past customers — last seen 10 to 15 months ago.
  const PAST = [
    ['Marcus', 'Delgado', '0115', [2016, 'Chevrolet', 'Malibu', 'LT', '1.5L Turbo I4', 'Silver Ice', 'MDL 16', 88400], [452, 318], ['cj-fbrakes']],
    ['Hannah', 'Price', '0116', [2017, 'Hyundai', 'Elantra', 'SE', '2.0L I4', 'Phantom Black', 'HNP 117', 79100], [401, 344], []],
    ['Owen', 'Ricci', '0117', [2015, 'Ford', 'Escape', 'SE 4WD', '2.0L EcoBoost I4', 'Ruby Red', 'OWR 15', 121900], [470, 389], ['cj-struts']],
  ];
  PAST.forEach(([firstName, lastName, ext, [year, make, model, trim, engine, color, plate, mileage], visits, declined], i) => {
    const c = { id: id('cus'), firstName, lastName, phone: `(217) 555-${ext}`, email: `${firstName}.${lastName}@example.com`.toLowerCase(), address: `${410 + i * 41} ${pick(['Oak', 'Maple', 'Cedar', 'Walnut'])} St`, city: 'Springfield', state: 'IL', zip: pick(['62702', '62704']), company: '', notes: '', tags: [], textOptIn: true, createdAt: at(visits[0] + 2) };
    customers.push(c);
    const v = { id: id('veh'), customerId: c.id, vin: '', year, make, model, trim, engine, color, plate, plateState: 'IL', mileage, notes: '', createdAt: c.createdAt };
    vehicles.push(v);
    visits.forEach((d, k) => pastOrder(v, d, k ? ['cj-oil'] : ['cj-oil', 'cj-filters'], k === visits.length - 1 ? declined : []));
  });
  // Fleet accounts: Mitchell Plumbing Co. (Net 30, PO numbers, credit limit) and Okafor Landscaping
  // (Net 15) — units with unit numbers, maintenance plans, invoices on terms and a batch check.
  const fleetAccounts = (() => {
    const DAY = 86400000;
    const mitchell = customers.find((c) => c.company === 'Mitchell Plumbing Co.');
    const okafor = customers.find((c) => c.company === 'Okafor Landscaping');
    if (!mitchell || !okafor) return;
    const spec = (model) => VEHICLES.find((x) => x[6] === model);
    const addUnit = (c, model, unit, plate, mileage, driver, serial) => {
      const [, prefix, yr, plant, year, make, , trim, engine] = spec(model);
      const v = { id: id('veh'), customerId: c.id, vin: withCheckDigit(`${prefix}0${yr}${plant}${String(serial).slice(-6)}`), year, make, model, trim, engine, color: 'Oxford White', plate, plateState: 'IL', mileage, notes: '', unit, driver, createdAt: c.createdAt };
      vehicles.push(v);
      return v;
    };
    const mine = (c) => vehicles.filter((v) => v.customerId === c.id);
    const [m1, m2] = mine(mitchell);
    Object.assign(m1, { unit: '12', driver: 'Service — R. Ortiz' });
    Object.assign(m2, { unit: '7', driver: 'Service — K. Lee' });
    const m3 = addUnit(mitchell, 'F-150', '14', 'FLT 2214', 88120, 'Install — D. Ruiz', 551208);
    const m4 = addUnit(mitchell, 'Silverado 1500', '15', 'FLT 2215', 23400, 'Install — T. Brooks', 662914);
    const m5 = addUnit(mitchell, '1500', '9', 'FLT 2209', 104300, 'Owner — J. Mitchell', 773419);
    const [o1] = mine(okafor);
    Object.assign(o1, { unit: 'T-1', driver: 'Crew lead' });
    const o2 = addUnit(okafor, 'F-150', 'T-2', 'OKF 552', 131800, 'Mowing crew', 884127);

    mitchell.account = {
      terms: 'net30', creditLimit: 15000, poRequired: true, preApproved: 750, taxExempt: false, taxId: '',
      billingEmail: 'ap@mitchellplumbing.example', invoiceNote: 'Mitchell Plumbing Co.: include the PO number on every invoice. Remit to Accounts Payable.',
      contacts: [
        { id: id('ct'), name: 'Dana Whitfield', role: 'Accounts payable', phone: '(217) 555-0190', email: 'ap@mitchellplumbing.example' },
        { id: id('ct'), name: 'Ray Ortiz', role: 'Fleet manager', phone: '(217) 555-0191', email: 'ray.ortiz@mitchellplumbing.example' },
      ],
      pmPlans: [
        { id: id('pm'), label: 'Oil & filter service', miles: 5000, months: 6, jobId: 'cj-oil' },
        { id: id('pm'), label: 'Tire rotation', miles: 7500, months: null, jobId: 'cj-rotate' },
        { id: id('pm'), label: 'Annual safety inspection', miles: null, months: 12, jobId: null },
      ],
      portal: null,
    };
    okafor.account = {
      terms: 'net15', creditLimit: 5000, poRequired: false, preApproved: 400, taxExempt: false, taxId: '', billingEmail: okafor.email, invoiceNote: '',
      contacts: [], pmPlans: [{ id: id('pm'), label: 'Oil & filter service', miles: 5000, months: 6, jobId: 'cj-oil' }], portal: null,
    };

    // Service history (PM status follows from it), then put some invoices on the account.
    const last = () => orders[orders.length - 1];
    let po = 4460;
    const charge = (o, c, terms) => {
      o.payments = [];
      o.po = c === mitchell ? `PO-${++po}` : '';
      o.charge = { at: o.invoicedAt, terms, dueAt: new Date(new Date(o.invoicedAt).getTime() + (terms === 'net30' ? 30 : 15) * DAY).toISOString() };
      return o;
    };
    pastOrder(m1, 205, ['cj-oil', 'cj-rotate']);
    pastOrder(m2, 38, ['cj-oil']);
    charge(last(), mitchell, 'net30');
    pastOrder(m3, 168, ['cj-oil', 'cj-rotate']);
    pastOrder(m5, 96, ['cj-oil', 'cj-fbrakes']);
    const older = [charge(last(), mitchell, 'net30')];
    pastOrder(m3, 74, ['cj-rbrakes']);
    older.push(charge(last(), mitchell, 'net30'));
    pastOrder(m1, 52, ['cj-battery']);
    const pastDue = charge(last(), mitchell, 'net30');
    last().services.push(custom('Annual safety inspection', [{ type: 'labor', description: 'Fleet annual inspection: brakes, steering, lights, tires, leaks, emissions check', hours: 1.0 }]));
    pastOrder(m4, 12, ['cj-oil', 'cj-wipers']);
    charge(last(), mitchell, 'net30');
    // One check paid the two oldest invoices (and part of the next).
    const check = { id: id('batch'), at: new Date(now.getTime() - 9 * DAY).toISOString(), ref: '20417' };
    older.forEach((o) => o.payments.push({ id: id('pay'), at: check.at, method: 'Check', amount: orderTotals(o, shop).total, ref: check.ref, batchId: check.id }));
    pastDue.payments.push({ id: id('pay'), at: check.at, method: 'Check', amount: 150, ref: check.ref, batchId: check.id });
    pastOrder(o1, 140, ['cj-oil']);
    pastOrder(o2, 24, ['cj-oil', 'cj-filters']);
    charge(last(), okafor, 'net15');
    return [mitchell.id, okafor.id];
  })();
  void fleetAccounts;

  // Front desk: two loaners (one out today), a customer waiting in the lobby, a shuttle ride, a
  // comeback on no charge, and core charges on batteries.
  shop.frontDesk = {
    ...FRONT_DESK_DEFAULTS,
    loaners: [
      { id: 'loan-1', name: 'Loaner 1 — 2022 Toyota Corolla', plate: 'MSA 101', mileage: 21450, fuel: '3/4', active: true },
      { id: 'loan-2', name: 'Loaner 2 — 2021 Honda Civic', plate: 'MSA 102', mileage: 33870, fuel: 'F', active: true },
    ],
    lobby: { ...FRONT_DESK_DEFAULTS.lobby, wifiName: 'MainStreet-Guest', wifiPassword: 'tuneup2026' },
  };
  {
    const busyNow = orders.filter((o) => ['approved', 'in_progress', 'waiting_parts'].includes(o.status) && !o.vehicleId?.startsWith('veh_ci'));
    const custOf = (o) => customers.find((c) => c.id === o.customerId);
    if (busyNow[0]) busyNow[0].transport = 'waiting';
    if (busyNow[1]) Object.assign(busyNow[1], { transport: 'loaner', loaner: { id: 'loan-1', name: 'Loaner 1 — 2022 Toyota Corolla', outAt: at(0, 8, 5), outMiles: 21450, outFuel: '3/4', notes: 'Small scuff rear bumper', signature: null, by: [custOf(busyNow[1])?.firstName, custOf(busyNow[1])?.lastName].join(' ') } });
    if (busyNow[2]) {
      const addr = `${custOf(busyNow[2])?.address || ''}, Springfield`;
      Object.assign(busyNow[2], { transport: 'shuttle', shuttle: { dropoff: { at: at(0, 8, 20), address: addr, done: true }, pickup: { at: at(0, 16, 30), address: addr, done: false } } });
    }
    const back = busyNow.slice(3).find((o) => orders.some((p) => p.vehicleId === o.vehicleId && p.status === 'closed'));
    if (back) {
      const prev = orders.filter((p) => p.vehicleId === back.vehicleId && p.status === 'closed').sort((a, b) => b.closedAt.localeCompare(a.closedAt))[0];
      back.comeback = { of: prev.id, ofNumber: prev.number, techId: prev.techId, reason: 'Noise came back after the last repair', at: back.createdAt };
      back.services.slice(0, 1).forEach((sv) => (sv.noCharge = 'comeback'));
    }
    orders.forEach((o) =>
      o.services.forEach((sv) =>
        sv.items.forEach((it) => {
          if (it.type !== 'part' || !/battery/i.test(it.description || '') || o.status === 'estimate') return;
          // Recent cores are still in the back room; older ones went back and were credited.
          const age = (now - new Date(o.invoicedAt || o.createdAt)) / 86400000;
          it.core = { amount: 18, status: age < 10 ? 'owed' : age < 24 ? 'returned' : 'credited', ...(age >= 10 ? { returnedAt: new Date(new Date(o.invoicedAt || o.createdAt).getTime() + 5 * 86400000).toISOString() } : {}) };
        }),
      ),
    );
  }
  orders.sort((a, b) => a.number - b.number);

  const finalOrders = orders.map((o) => ({ ...o, techId: tech(o.techId) }));
  const extras = seedExtras({ shop, orders: finalOrders, customers, vehicles, technicians: TECHNICIANS.map((t) => ({ ...t })), inventory, now, rand, id });

  return {
    version: 2,
    seededAt: now.toISOString(),
    // This is the made-up sample shop: the app shows a banner with a way back to the product's site
    // until the shop is replaced or someone signs in. Local only — it never syncs or goes in a backup.
    sample: true,
    shop: { ...shop, ...extras.shopExtras, frontDesk: shop.frontDesk },
    technicians: extras.technicians,
    customers,
    vehicles,
    orders: finalOrders,
    appointments,
    inventory,
    cannedJobs: CANNED_JOBS.map((j) => ({ ...j, items: j.items.map((i) => ({ ...i })) })),
    activity,
    purchaseOrders: extras.purchaseOrders,
    timeEntries: extras.timeEntries,
    messages: extras.messages,
    expenses: extras.expenses,
    bookingRequests: extras.bookingRequests,
    campaigns: extras.campaigns,
    inspectionTemplates: extras.inspectionTemplates,
    counters: { order: number, po: 2003 },
  };
}
