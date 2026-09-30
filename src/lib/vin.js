// Offline VIN decoding per 49 CFR Part 565 / ISO 3779.
// Works without a network connection: validates structure and check digit, resolves the
// manufacturer from the World Manufacturer Identifier (WMI) and the model year from position 10.
// Full trim/engine decoding comes from NHTSA vPIC (see nhtsa.js).

const TRANSLIT = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5,
  P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';

export const VIN_SECTIONS = [
  { key: 'wmi', label: 'WMI', range: [0, 3], desc: 'World Manufacturer Identifier — country and manufacturer' },
  { key: 'vds', label: 'VDS', range: [3, 8], desc: 'Vehicle Descriptor — model, body, engine, restraint system (manufacturer-defined)' },
  { key: 'check', label: 'Check', range: [8, 9], desc: 'Check digit — detects transcription errors' },
  { key: 'year', label: 'Year', range: [9, 10], desc: 'Model year code' },
  { key: 'plant', label: 'Plant', range: [10, 11], desc: 'Assembly plant (manufacturer-defined)' },
  { key: 'serial', label: 'Serial', range: [11, 17], desc: 'Production sequence number' },
];

/** Uppercase, strip separators. Leaves invalid letters in place so we can flag them. */
export const cleanVin = (s = '') => s.toUpperCase().replace(/[^A-Z0-9*]/g, '');

/** Common transcription fixes: I→1, O/Q→0. */
export const autocorrectVin = (s = '') => cleanVin(s).replace(/I/g, '1').replace(/[OQ]/g, '0');

export function computeCheckDigit(vin) {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = vin[i];
    const v = /\d/.test(c) ? Number(c) : TRANSLIT[c];
    if (v === undefined) return null;
    sum += v * WEIGHTS[i];
  }
  const r = sum % 11;
  return r === 10 ? 'X' : String(r);
}

/** Replace position 9 with the correct check digit (used for generating demo VINs). */
export function withCheckDigit(vin) {
  const v = cleanVin(vin).padEnd(17, '0').slice(0, 17);
  const cd = computeCheckDigit(v.slice(0, 8) + '0' + v.slice(9));
  return v.slice(0, 8) + cd + v.slice(9);
}

export function validateVin(input) {
  const vin = cleanVin(input);
  const errors = [];
  const warnings = [];
  if (vin.length !== 17) errors.push(`VIN must be 17 characters (currently ${vin.length}).`);
  const bad = [...new Set(vin.match(/[IOQ]/g) || [])];
  if (bad.length) errors.push(`VINs never contain ${bad.join(', ')} — did you mean ${bad.map((b) => (b === 'I' ? '1' : '0')).join(', ')}?`);
  let checkDigitOk = null;
  let expected = null;
  if (vin.length === 17 && !bad.length && !vin.includes('*')) {
    expected = computeCheckDigit(vin);
    checkDigitOk = expected === vin[8];
    if (!checkDigitOk) {
      warnings.push(`Check digit is ${vin[8]}, expected ${expected}. Re-check the VIN — non-North-American vehicles may not use a check digit.`);
    }
  }
  if (vin.length === 17 && !YEAR_CODES.includes(vin[9])) errors.push(`Position 10 (“${vin[9]}”) is not a valid model-year code.`);
  return { vin, valid: errors.length === 0, errors, warnings, checkDigitOk, expected };
}

/** Model year from position 10; position 7 alpha ⇒ 2010–2039 cycle (NA light vehicles). */
export function modelYear(vin, now = new Date()) {
  const idx = YEAR_CODES.indexOf(vin?.[9]);
  if (idx < 0) return null;
  const early = 1980 + idx;
  const late = early + 30;
  const pos7Alpha = /[A-Z]/.test(vin[6] || '');
  let year = pos7Alpha ? late : early;
  if (year > now.getFullYear() + 1) year -= 30;
  return year;
}

function regionFor(wmi) {
  const a = wmi[0];
  const b = wmi[1];
  const inRange = (from, to) => b >= from && b <= to;
  if ('145'.includes(a)) return 'United States';
  if (a === '7') return inRange('A', 'E') ? 'New Zealand' : 'United States';
  if (a === '2') return 'Canada';
  if (a === '3') return inRange('A', 'W') ? 'Mexico' : 'Latin America';
  if (a === '9') return 'Brazil';
  if (a === '6') return 'Australia';
  if (a === '8') return 'South America';
  if (a === 'J') return 'Japan';
  if (a === 'K') return inRange('L', 'R') ? 'South Korea' : 'Asia';
  if (a === 'L') return 'China';
  if (a === 'M') return inRange('A', 'E') ? 'India' : inRange('F', 'K') ? 'Indonesia' : inRange('L', 'R') ? 'Thailand' : 'Asia';
  if (a === 'N') return inRange('L', 'R') ? 'Türkiye' : 'Asia';
  if (a === 'P') return 'Asia';
  if (a === 'S') return inRange('A', 'M') ? 'United Kingdom' : 'Europe';
  if (a === 'T') return inRange('J', 'P') ? 'Czechia' : inRange('R', 'V') ? 'Hungary' : inRange('A', 'H') ? 'Switzerland' : 'Europe';
  if (a === 'U') return 'Europe';
  if (a === 'V') return inRange('F', 'R') ? 'France' : inRange('S', 'W') ? 'Spain' : 'Europe';
  if (a === 'W') return 'Germany';
  if (a === 'X') return 'Europe';
  if (a === 'Y') return inRange('S', 'W') ? 'Sweden' : inRange('A', 'E') ? 'Belgium' : 'Europe';
  if (a === 'Z') return 'Italy';
  return 'Unknown';
}

// WMI → make. Covers the manufacturers seen in the vast majority of US shops.
const WMI = {
  // Honda / Acura
  '1HG': 'Honda', '2HG': 'Honda', 'JHM': 'Honda', '5FN': 'Honda', '5J6': 'Honda', '2HK': 'Honda', '7FA': 'Honda',
  '5FP': 'Honda', 'JHL': 'Honda', '3CZ': 'Honda', '3HG': 'Honda', '19X': 'Honda', 'SHH': 'Honda', 'SHS': 'Honda', 'JH2': 'Honda Powersports',
  '19U': 'Acura', 'JH4': 'Acura', '5J8': 'Acura', '2HN': 'Acura', '19V': 'Acura',
  // Toyota / Lexus / Scion
  '4T1': 'Toyota', '4T3': 'Toyota', '4T4': 'Toyota', '5TD': 'Toyota', '5TF': 'Toyota', '5YF': 'Toyota', '2T1': 'Toyota', '2T3': 'Toyota',
  'JTD': 'Toyota', 'JTE': 'Toyota', 'JTM': 'Toyota', 'JTN': 'Toyota', 'JTK': 'Scion', 'JTL': 'Scion', '3TM': 'Toyota', '3TY': 'Toyota',
  '7MU': 'Toyota', 'JT2': 'Toyota', 'JT3': 'Toyota', 'JT4': 'Toyota', 'JT8': 'Lexus', 'NMT': 'Toyota',
  'JTH': 'Lexus', 'JTJ': 'Lexus', '2T2': 'Lexus', '58A': 'Lexus', '58B': 'Lexus',
  // Nissan / Infiniti
  'JN1': 'Nissan', 'JN8': 'Nissan', 'JN6': 'Nissan', '1N4': 'Nissan', '1N6': 'Nissan', '5N1': 'Nissan', '3N1': 'Nissan', '3N6': 'Nissan', '3N8': 'Nissan', 'KNM': 'Nissan',
  'JNK': 'Infiniti', 'JNR': 'Infiniti', 'JNX': 'Infiniti', '5N3': 'Infiniti',
  // Mazda
  'JM1': 'Mazda', 'JM3': 'Mazda', 'JMZ': 'Mazda', '3MZ': 'Mazda', '3MV': 'Mazda', '3MD': 'Mazda', '7MM': 'Mazda', '1YV': 'Mazda', '4F2': 'Mazda', '4F4': 'Mazda',
  // Subaru
  'JF1': 'Subaru', 'JF2': 'Subaru', '4S3': 'Subaru', '4S4': 'Subaru', '4S6': 'Subaru',
  // Mitsubishi
  'JA3': 'Mitsubishi', 'JA4': 'Mitsubishi', 'JA7': 'Mitsubishi', 'ML3': 'Mitsubishi', 'ML4': 'Mitsubishi', 'MMB': 'Mitsubishi', '4A3': 'Mitsubishi', '4A4': 'Mitsubishi',
  // Hyundai / Genesis / Kia
  'KMH': 'Hyundai', 'KM8': 'Hyundai', '5NP': 'Hyundai', '5NM': 'Hyundai', '5NT': 'Hyundai', '3H3': 'Hyundai Translead', '7YA': 'Hyundai',
  'KMT': 'Genesis', 'KMU': 'Genesis',
  'KNA': 'Kia', 'KND': 'Kia', 'KNC': 'Kia', '5XX': 'Kia', '5XY': 'Kia', '3KP': 'Kia', '3KM': 'Kia',
  // Ford / Lincoln / Mercury
  '1FA': 'Ford', '1FB': 'Ford', '1FC': 'Ford', '1FD': 'Ford', '1FM': 'Ford', '1FT': 'Ford', '1ZV': 'Ford', '2FA': 'Ford', '2FM': 'Ford',
  '2FT': 'Ford', '3FA': 'Ford', '3FM': 'Ford', '3FT': 'Ford', '3FE': 'Ford', 'NM0': 'Ford', 'WF0': 'Ford', 'MAJ': 'Ford', '1FF': 'Ford',
  '1LN': 'Lincoln', '5LM': 'Lincoln', '5LT': 'Lincoln', '2LM': 'Lincoln', '3LN': 'Lincoln', '2LN': 'Lincoln',
  '1ME': 'Mercury', '2ME': 'Mercury', '4M2': 'Mercury', '3ME': 'Mercury',
  // General Motors
  '1G1': 'Chevrolet', '1GC': 'Chevrolet', '1GN': 'Chevrolet', '1GB': 'Chevrolet', '1GA': 'Chevrolet', '2G1': 'Chevrolet', '2GC': 'Chevrolet', '2GN': 'Chevrolet',
  '2GB': 'Chevrolet', '3G1': 'Chevrolet', '3GC': 'Chevrolet', '3GN': 'Chevrolet', '3GB': 'Chevrolet', 'KL7': 'Chevrolet', 'KL8': 'Chevrolet', 'KL1': 'Chevrolet', 'KL5': 'Suzuki',
  '1GT': 'GMC', '1GK': 'GMC', '1GD': 'GMC', '2GT': 'GMC', '2GK': 'GMC', '3GT': 'GMC', '3GK': 'GMC', '3GD': 'GMC',
  '1G4': 'Buick', '2G4': 'Buick', '5GA': 'Buick', 'KL4': 'Buick', 'LRB': 'Buick', 'W04': 'Buick',
  '1G6': 'Cadillac', '1GY': 'Cadillac', '3GY': 'Cadillac', 'LRE': 'Cadillac',
  '1G2': 'Pontiac', '2G2': 'Pontiac', '5Y2': 'Pontiac', '1G8': 'Saturn', '5GR': 'Hummer', '1G3': 'Oldsmobile', '1GM': 'Pontiac',
  // Stellantis
  '1C3': 'Chrysler', '2C3': 'Chrysler', '2C4': 'Chrysler', '1C4': 'Chrysler', '3C4': 'Chrysler', '2A4': 'Chrysler', '2A8': 'Chrysler', '1A4': 'Chrysler', '1A8': 'Chrysler',
  '1B3': 'Dodge', '2B3': 'Dodge', '1B7': 'Dodge', '1D7': 'Dodge', '3D7': 'Dodge', '2D4': 'Dodge', '1D4': 'Dodge', '2D3': 'Dodge', '1D3': 'Dodge', '3D4': 'Dodge', '2B4': 'Dodge',
  '1C6': 'Ram', '3C6': 'Ram', '3C7': 'Ram', '2C7': 'Ram', '1C7': 'Ram',
  '1J4': 'Jeep', '1J8': 'Jeep', '1J7': 'Jeep', 'ZAC': 'Jeep',
  'ZFA': 'Fiat', '3C3': 'Fiat', 'ZAR': 'Alfa Romeo', 'ZAS': 'Alfa Romeo', 'ZAM': 'Maserati', 'ZN6': 'Maserati',
  // EV makers
  '5YJ': 'Tesla', '7SA': 'Tesla', '7G2': 'Tesla', 'LRW': 'Tesla', 'XP7': 'Tesla', 'SFZ': 'Tesla',
  '7PD': 'Rivian', '7FC': 'Rivian', '50E': 'Lucid', 'LPS': 'Polestar', 'YSM': 'Polestar', '7SV': 'Polestar',
  // German
  'WBA': 'BMW', 'WBS': 'BMW', 'WBX': 'BMW', 'WBY': 'BMW', '5UX': 'BMW', '5YM': 'BMW', '4US': 'BMW', '3MF': 'BMW', '5UJ': 'BMW', 'WB1': 'BMW Motorrad', 'WB3': 'BMW Motorrad',
  'WMW': 'MINI', 'WMZ': 'MINI',
  'WDD': 'Mercedes-Benz', 'WDB': 'Mercedes-Benz', 'WDC': 'Mercedes-Benz', 'WDF': 'Mercedes-Benz', 'W1K': 'Mercedes-Benz', 'W1N': 'Mercedes-Benz', 'W1V': 'Mercedes-Benz',
  'W1W': 'Mercedes-Benz', 'W1X': 'Mercedes-Benz', 'W1Y': 'Mercedes-Benz', '4JG': 'Mercedes-Benz', '55S': 'Mercedes-Benz', 'WD3': 'Mercedes-Benz', 'WD4': 'Mercedes-Benz', 'WME': 'smart',
  'WVW': 'Volkswagen', 'WVG': 'Volkswagen', 'WV1': 'Volkswagen', 'WV2': 'Volkswagen', '1VW': 'Volkswagen', '1V2': 'Volkswagen', '3VW': 'Volkswagen', '3VV': 'Volkswagen', '9BW': 'Volkswagen',
  'WAU': 'Audi', 'WA1': 'Audi', 'WUA': 'Audi', 'TRU': 'Audi', 'WAC': 'Audi',
  'WP0': 'Porsche', 'WP1': 'Porsche',
  // British / Swedish / Italian exotics
  'SAJ': 'Jaguar', 'SAD': 'Jaguar', 'SAL': 'Land Rover', 'SAR': 'Rover', 'SCA': 'Rolls-Royce', 'SCB': 'Bentley', 'SCF': 'Aston Martin', 'SCC': 'Lotus', 'SBM': 'McLaren',
  'YV1': 'Volvo', 'YV4': 'Volvo', 'YV2': 'Volvo Trucks', 'YV3': 'Volvo Buses', '7JR': 'Volvo', '7JD': 'Volvo', 'LVY': 'Volvo', 'YS3': 'Saab', 'YS2': 'Scania',
  'ZFF': 'Ferrari', 'ZHW': 'Lamborghini', 'ZDM': 'Ducati', 'ZGU': 'Moto Guzzi',
  // Other passenger
  'JS1': 'Suzuki', 'JS2': 'Suzuki', 'JS3': 'Suzuki', 'JS4': 'Suzuki', '2S3': 'Suzuki',
  'JAA': 'Isuzu', 'JAB': 'Isuzu', 'JAC': 'Isuzu', 'JAL': 'Isuzu', '4S2': 'Isuzu', '4NU': 'Isuzu', 'J8D': 'Isuzu',
  'VF1': 'Renault', 'VF3': 'Peugeot', 'VF7': 'Citroën', 'TMB': 'Škoda', 'VSS': 'SEAT', 'UU1': 'Dacia', 'W0L': 'Opel', 'W0V': 'Opel',
  'LGX': 'BYD', 'LC0': 'BYD', 'LSJ': 'MG', 'LVS': 'Ford (China)', 'LFV': 'Volkswagen (China)',
  // Motorcycles & powersports
  '1HD': 'Harley-Davidson', '5HD': 'Harley-Davidson', 'JYA': 'Yamaha', 'JKA': 'Kawasaki', 'JKB': 'Kawasaki', 'SMT': 'Triumph', 'VBK': 'KTM', '56K': 'Indian',
  '4XA': 'Polaris', '3NS': 'Polaris', '2BP': 'BRP (Can-Am)', '3JB': 'BRP (Can-Am)',
  // Medium / heavy duty
  '1FU': 'Freightliner', '1FV': 'Freightliner', '3AK': 'Freightliner', '4UZ': 'Freightliner Custom Chassis', '1XK': 'Kenworth', '2XK': 'Kenworth', '1XP': 'Peterbilt', '2XP': 'Peterbilt',
  '1HT': 'International', '3HA': 'International', '3HS': 'International', '1HS': 'International', '1M1': 'Mack', '1M2': 'Mack', '4V4': 'Volvo Trucks', '4V5': 'Volvo Trucks', '5KJ': 'Western Star',
  '5PV': 'Hino', 'JHH': 'Hino', 'JL6': 'Mitsubishi Fuso', 'JLS': 'Sterling', '2NK': 'Kenworth', '1NK': 'Kenworth', '1NP': 'Peterbilt', '4DR': 'IC Bus', '1BA': 'Blue Bird',
};

export function lookupWmi(vin) {
  const wmi = cleanVin(vin).slice(0, 3);
  const make = WMI[wmi] || null;
  return { wmi, make, country: wmi.length === 3 ? regionFor(wmi) : null };
}

/** Structural decode that never touches the network. */
export function decodeOffline(input) {
  const check = validateVin(input);
  const { vin } = check;
  const { wmi, make, country } = lookupWmi(vin);
  return {
    ...check,
    wmi,
    make,
    country,
    year: vin.length >= 10 ? modelYear(vin) : null,
    plantCode: vin[10] || null,
    serial: vin.slice(11) || null,
  };
}

/** Pull something that looks like a VIN out of arbitrary text (e.g. a pasted registration line or barcode scan). */
export function extractVin(text = '') {
  const m = text.toUpperCase().match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
  return m ? m[0] : null;
}
