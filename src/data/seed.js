// Demo shop data. Everything is generated relative to "now" so the dashboard always looks alive.
// Names, phone numbers (555-01xx is reserved for fiction) and emails (.example) are fictitious.
import { withCheckDigit } from '../lib/vin';
import { DEFAULT_MATRIX, priceFromMatrix, orderTotals } from '../lib/pricing';
import { INSPECTION_TEMPLATE } from '../lib/workflow';

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
  { id: 't2', name: 'Luis Ortega', role: 'Drivability & Electrical', certs: 'ASE A6 · A8 · L1', payRate: 40 },
  { id: 't3', name: 'Dana Whitfield', role: 'A-Technician', certs: 'ASE A1–A5', payRate: 34 },
  { id: 't4', name: 'Kim Park', role: 'Lube & Maintenance', certs: 'ASE G1', payRate: 24 },
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
  const svc = (jobId, status = 'approved', extra = {}) => {
    const job = CANNED_JOBS.find((j) => j.id === jobId);
    return { id: id('svc'), title: job.title, status, techId: null, done: false, items: makeItems(job.items), ...extra };
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

  // History: closed repair orders over the last ~150 days (feeds reports and service history).
  const historyJobs = ['cj-oil', 'cj-oil', 'cj-oil', 'cj-rotate', 'cj-fbrakes', 'cj-rbrakes', 'cj-filters', 'cj-battery', 'cj-diag', 'cj-align', 'cj-bfluid', 'cj-coolant', 'cj-trans', 'cj-plugs', 'cj-wipers', 'cj-ac', 'cj-tpms', 'cj-belt', 'cj-struts', 'cj-hub', 'cj-balance'];
  for (let i = 0; i < 74; i++) {
    const daysAgo = Math.floor(3 + rand() * 150);
    const vi = Math.floor(rand() * vehicles.length);
    const jobs = [pick(historyJobs)];
    if (rand() < 0.55) jobs.push(pick(historyJobs));
    if (rand() < 0.2) jobs.push(pick(historyJobs));
    const uniq = [...new Set(jobs)];
    const t = pick(TECHNICIANS).id;
    const services = uniq.map((j) => ({ ...svc(j, 'approved'), techId: t, done: true }));
    if (rand() < 0.3) services.push({ ...svc(pick(['cj-fbrakes', 'cj-struts', 'cj-coolant', 'cj-trans', 'cj-align']), 'declined') });
    const mileageIn = Math.max(1000, V(vi).mileage - Math.round(daysAgo * 38));
    const o = order(vi, 'closed', {
      techId: t,
      services,
      mileageIn,
      mileageOut: mileageIn + 4,
      createdAt: at(daysAgo + (rand() < 0.3 ? 1 : 0), 8, Math.floor(rand() * 50)),
      authorizedAt: at(daysAgo, 9, 30),
      invoicedAt: at(daysAgo, 16, 10),
      closedAt: at(daysAgo, 17, 5),
      updatedAt: at(daysAgo, 17, 5),
      concern: '',
    });
    o.pendingPayment = true; // filled below once totals are known
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
      { ...svc('cj-balance', 'pending') },
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

  // Parts on estimates and not-yet-started work haven't been pulled or ordered yet.
  orders.forEach((o) => {
    if (o.status !== 'estimate' && o.status !== 'approved') return;
    o.services.forEach((sv) => sv.items.forEach((it) => it.type === 'part' && it.partStatus === 'received' && (it.partStatus = 'needed')));
  });

  // Payments for closed history.
  const payMethods = ['Card', 'Card', 'Card', 'Card', 'Cash', 'Check', 'Fleet account'];
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

  const inventory = INVENTORY.map((p) => ({ id: id('inv'), ...p }));

  const activity = [
    { id: id('act'), at: rel(-0.3), text: `Estimate #${number} created for ${V(13).year} ${V(13).make} ${V(13).model}` },
    { id: id('act'), at: rel(-0.6), text: `Invoice #${ready1.number} ready — customer notified` },
    { id: id('act'), at: rel(-0.5), text: `Estimate sent to Harper Nguyen` },
    { id: id('act'), at: rel(-1.2), text: 'Carlos Mendoza approved front brakes + CVT service' },
    { id: id('act'), at: rel(-1.9), text: 'Jordan Mitchell approved diagnosis + spark plugs' },
    { id: id('act'), at: at(1, 12, 0), text: 'Parts ordered: wheel hub bearing assembly (GM dealer)' },
  ];

  return {
    version: 2,
    seededAt: now.toISOString(),
    shop,
    technicians: TECHNICIANS.map((t) => ({ ...t })),
    customers,
    vehicles,
    orders: orders.map((o) => ({ ...o, techId: tech(o.techId) })),
    appointments,
    inventory,
    cannedJobs: CANNED_JOBS.map((j) => ({ ...j, items: j.items.map((i) => ({ ...i })) })),
    activity,
    counters: { order: number },
  };
}
