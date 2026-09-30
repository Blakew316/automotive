// Electrical reference data. Standards-based (SAE J1962, DIN 72552/ISO 7588, ISO 8820-3, SAE J2863, ASTM B258).
// Fact-checked September 2026. OEM wiring diagrams remain the authority for any specific vehicle.

export const OBD_PINS = [
  { pin: 1, fn: 'Manufacturer discretionary', note: 'Often GM single-wire CAN (GMLAN) or OEM-specific lines' },
  { pin: 2, fn: 'SAE J1850 Bus +', note: 'Legacy PWM (Ford) and VPW (GM, Chrysler) networks', std: true },
  { pin: 3, fn: 'Manufacturer discretionary', note: 'Often a secondary CAN (e.g. Ford MS-CAN +)' },
  { pin: 4, fn: 'Chassis ground', std: true, power: true },
  { pin: 5, fn: 'Signal ground', std: true, power: true },
  { pin: 6, fn: 'CAN High', note: 'ISO 15765-4 high-speed CAN (all 2008+ U.S. vehicles)', std: true },
  { pin: 7, fn: 'K-line', note: 'ISO 9141-2 / ISO 14230-4 (KWP2000)', std: true },
  { pin: 8, fn: 'Manufacturer discretionary' },
  { pin: 9, fn: 'Manufacturer discretionary' },
  { pin: 10, fn: 'SAE J1850 Bus −', note: 'PWM only', std: true },
  { pin: 11, fn: 'Manufacturer discretionary', note: 'Often a secondary CAN (e.g. Ford MS-CAN −)' },
  { pin: 12, fn: 'Manufacturer discretionary' },
  { pin: 13, fn: 'Manufacturer discretionary' },
  { pin: 14, fn: 'CAN Low', note: 'ISO 15765-4', std: true },
  { pin: 15, fn: 'L-line', note: 'ISO 9141-2 / ISO 14230-4', std: true },
  { pin: 16, fn: 'Battery positive', note: 'Unswitched 12 V — scan tool power', std: true, power: true },
];

export const OBD_TESTS = [
  { test: 'Pin 16 to pins 4/5', expect: 'Battery voltage (~12.4–12.7 V, key off)', fault: 'No voltage: check the fuse feeding the DLC (often shared with the power outlet/cigar lighter).' },
  { test: 'Pin 4 and 5 to battery −', expect: 'Under 0.1 V voltage drop / continuity', fault: 'High reading: open or corroded ground splice.' },
  { test: 'Pins 6 to 14, battery disconnected', expect: '~60 Ω (two 120 Ω terminators in parallel)', fault: '~120 Ω: one terminator or bus branch open. ~40 Ω: an extra terminator. ~0 Ω: CAN-H shorted to CAN-L.' },
  { test: 'Pin 6 (CAN-H) to ground, key on', expect: '~2.5–3.5 V (meter averages ≈2.6 V)', fault: 'At 0 V or 12 V: wire shorted to ground or power; a module may be dragging the bus.' },
  { test: 'Pin 14 (CAN-L) to ground, key on', expect: '~1.5–2.5 V (meter averages ≈2.4 V)', fault: 'Sum of CAN-H + CAN-L should be ≈5 V.' },
];

export const RELAY_TERMINALS = [
  { t: '30', fn: 'Common / power feed', detail: 'Fused battery or ignition feed to the switched load.' },
  { t: '85', fn: 'Coil (usually ground side)', detail: 'Relays with a suppression diode are polarity-sensitive: 85 must be negative.' },
  { t: '86', fn: 'Coil (usually switched +)', detail: 'Control signal from the switch or module.' },
  { t: '87', fn: 'Normally open (NO)', detail: 'Connected to 30 when the coil is energized — feeds the load.' },
  { t: '87a', fn: 'Normally closed (NC)', detail: 'Connected to 30 when the coil is off (5-pin changeover relays only).' },
];

export const RELAY_TESTS = [
  'Measure coil resistance 85–86: typically 50–120 Ω on 12 V mini relays. Open = failed coil.',
  'Energize 86 (+12 V) and ground 85 — you should hear/feel a click.',
  'With the coil energized, 30–87 should show near 0 Ω (or <0.2 V drop under load). With it off, 30–87a closed.',
  'In circuit, a voltage-drop test across 30–87 under load is more reliable than an ohmmeter.',
];

// Blade fuses (ATO/ATC, mini, low-profile mini share this code). ISO 8820-3.
export const BLADE_FUSES = [
  { a: '1', color: 'Black', hex: '#1d1d1f' },
  { a: '2', color: 'Gray', hex: '#8e8e93' },
  { a: '3', color: 'Violet', hex: '#8e5bb5' },
  { a: '4', color: 'Pink', hex: '#f2a0c0' },
  { a: '5', color: 'Tan', hex: '#d4b48c' },
  { a: '7.5', color: 'Brown', hex: '#8a5a2e' },
  { a: '10', color: 'Red', hex: '#d93a2f' },
  { a: '15', color: 'Blue', hex: '#2f6fdb' },
  { a: '20', color: 'Yellow', hex: '#f2c230' },
  { a: '25', color: 'Natural / clear', hex: '#eeeee8' },
  { a: '30', color: 'Green', hex: '#2e9e4f' },
  { a: '35', color: 'Blue-green', hex: '#1aa39a' },
  { a: '40', color: 'Orange / amber', hex: '#f28c28' },
];

export const MAXI_FUSES = [
  { a: '20', color: 'Yellow', hex: '#f2c230' },
  { a: '30', color: 'Green', hex: '#2e9e4f' },
  { a: '40', color: 'Orange / amber', hex: '#f28c28' },
  { a: '50', color: 'Red', hex: '#d93a2f' },
  { a: '60', color: 'Blue', hex: '#2f6fdb' },
  { a: '70', color: 'Brown / tan', hex: '#8a5a2e', varies: true },
  { a: '80', color: 'Natural / clear', hex: '#eeeee8' },
  { a: '100', color: 'Violet', hex: '#8e5bb5', varies: true },
  { a: '120', color: 'Purple', hex: '#6b3fa0', varies: true },
];

export const JCASE_FUSES = [
  { a: '20', color: 'Blue', hex: '#2f6fdb' },
  { a: '25', color: 'White', hex: '#f4f4f0' },
  { a: '30', color: 'Pink', hex: '#f2a0c0' },
  { a: '40', color: 'Green', hex: '#2e9e4f' },
  { a: '50', color: 'Red', hex: '#d93a2f', varies: true },
  { a: '60', color: 'Yellow', hex: '#f2c230' },
];

// Wire color abbreviations as printed in OEM diagrams. Two colors = base/stripe (e.g. GN/WH = green with white stripe).
export const WIRE_COLORS = [
  { color: 'Black', hex: '#1d1d1f', us: 'BK · BLK', honda: 'BLK', toyota: 'B', din: 'sw' },
  { color: 'White', hex: '#f4f4f0', us: 'WH · WHT', honda: 'WHT', toyota: 'W', din: 'ws' },
  { color: 'Red', hex: '#d93a2f', us: 'RD · RED', honda: 'RED', toyota: 'R', din: 'rt' },
  { color: 'Green', hex: '#2e9e4f', us: 'GN · GRN', honda: 'GRN', toyota: 'G', din: 'gn' },
  { color: 'Blue', hex: '#2f6fdb', us: 'BU · BLU', honda: 'BLU', toyota: 'L', din: 'bl' },
  { color: 'Yellow', hex: '#f2c230', us: 'YE · YEL', honda: 'YEL', toyota: 'Y', din: 'ge' },
  { color: 'Brown', hex: '#8a5a2e', us: 'BN · BRN', honda: 'BRN', toyota: 'BR', din: 'br' },
  { color: 'Orange', hex: '#f28c28', us: 'OG · ORN', honda: 'ORN', toyota: 'O', din: 'or' },
  { color: 'Pink', hex: '#f2a0c0', us: 'PK · PNK', honda: 'PNK', toyota: 'P', din: 'rs' },
  { color: 'Violet / purple', hex: '#8e5bb5', us: 'VT · PPL', honda: 'PUR', toyota: 'V', din: 'vi' },
  { color: 'Gray', hex: '#8e8e93', us: 'GY · GRY', honda: 'GRY', toyota: 'GR', din: 'gr' },
  { color: 'Tan', hex: '#d4b48c', us: 'TN · TAN', honda: '—', toyota: '—', din: '—' },
  { color: 'Light green', hex: '#8fd18a', us: 'LG · LT GRN', honda: 'LT GRN', toyota: 'LG', din: '—' },
  { color: 'Light / sky blue', hex: '#7fb8f0', us: 'LB · LT BLU', honda: 'LT BLU', toyota: 'SB', din: '—' },
];

// Solid copper at 20 °C (ASTM B258). Stranded automotive wire reads slightly higher.
export const AWG = [
  { awg: '22', mm2: 0.326, ohmPer1000ft: 16.14 },
  { awg: '20', mm2: 0.518, ohmPer1000ft: 10.15 },
  { awg: '18', mm2: 0.823, ohmPer1000ft: 6.385 },
  { awg: '16', mm2: 1.309, ohmPer1000ft: 4.016 },
  { awg: '14', mm2: 2.081, ohmPer1000ft: 2.525 },
  { awg: '12', mm2: 3.309, ohmPer1000ft: 1.588 },
  { awg: '10', mm2: 5.261, ohmPer1000ft: 0.999 },
  { awg: '8', mm2: 8.366, ohmPer1000ft: 0.628 },
  { awg: '6', mm2: 13.3, ohmPer1000ft: 0.395 },
  { awg: '4', mm2: 21.15, ohmPer1000ft: 0.249 },
  { awg: '2', mm2: 33.63, ohmPer1000ft: 0.156 },
  { awg: '1/0', mm2: 53.48, ohmPer1000ft: 0.0983 },
  { awg: '2/0', mm2: 67.43, ohmPer1000ft: 0.0779 },
];

export const TRAILER_4FLAT = [
  { fn: 'Ground', color: 'White', hex: '#f4f4f0' },
  { fn: 'Tail / running lights', color: 'Brown', hex: '#8a5a2e' },
  { fn: 'Left turn & stop', color: 'Yellow', hex: '#f2c230' },
  { fn: 'Right turn & stop', color: 'Green', hex: '#2e9e4f' },
];

// 7-way RV blade: pin functions are fixed; only wire colors differ between the RV-industry and SAE J2863 schemes.
export const TRAILER_7WAY = [
  { pin: '1', fn: 'Ground', rv: ['White', '#f4f4f0'], sae: ['White', '#f4f4f0'] },
  { pin: '2', fn: 'Electric brakes', rv: ['Blue', '#2f6fdb'], sae: ['Blue', '#2f6fdb'] },
  { pin: '3', fn: 'Tail / running lights', rv: ['Green', '#2e9e4f'], sae: ['Brown', '#8a5a2e'] },
  { pin: '4', fn: '+12 V battery / charge', rv: ['Black', '#1d1d1f'], sae: ['Black', '#1d1d1f'] },
  { pin: '5', fn: 'Left turn & stop', rv: ['Red', '#d93a2f'], sae: ['Yellow', '#f2c230'] },
  { pin: '6', fn: 'Right turn & stop', rv: ['Brown', '#8a5a2e'], sae: ['Green', '#2e9e4f'] },
  { pin: '7 (center)', fn: 'Back-up / reverse lights', rv: ['Yellow', '#f2c230'], sae: ['Purple', '#8e5bb5'] },
];
