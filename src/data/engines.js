// Engine families with manufacturer-published firing orders and cylinder numbering.
// Deliberately conservative: only well-documented families are listed. Anything not matched
// falls back to rules that hold for the layout as a whole (e.g. inline-6 is 1-5-3-6-2-4) or to
// "see OEM service information".
//
// `banks` (V engines only) describes cylinder numbering, viewed from the driver's seat:
// left = driver side (U.S.), right = passenger side, front-to-back.

export const ENGINE_FAMILIES = [
  // General Motors
  { id: 'gm-duramax', name: 'GM Duramax 6.6L V8 diesel', make: /chevrolet|gmc/i, code: /^(LB7|LLY|LBZ|LMM|LML|LGH|L5P|L5D)\b/i, cyl: 8, order: '1-2-7-8-4-5-6-3', fuel: /diesel/i },
  { id: 'gm-smallblock', name: 'GM small-block V8 (Gen III–V: LS/LT/Vortec)', make: /chevrolet|gmc|cadillac|buick|pontiac|hummer|saab|holden|isuzu/i, code: /^(LS[1-4679A]|LQ[49]|LM[47]|LR4|L33|L59|LMG|LC9|LY[256]|L7[67]|L9[2469]|LH[68]|LZ1|LMF|L20|L8[2-7]|L8T|LT[1245])\b/i, cyl: 8, order: '1-8-7-2-6-5-4-3', fuel: /gasoline|flex|ethanol/i, banks: { left: [1, 3, 5, 7], right: [2, 4, 6, 8] } },
  { id: 'gm-43', name: 'GM 4.3L V6 (Vortec / EcoTec3)', make: /chevrolet|gmc/i, code: /^(LU3|L35|LV3|LG3|4\.3)/i, cyl: 6, order: '1-6-5-4-3-2', banks: { left: [1, 3, 5], right: [2, 4, 6] } },
  { id: 'gm-hfv6', name: 'GM High Feature V6 (3.0/3.6L)', make: /chevrolet|gmc|cadillac|buick|saab|holden|pontiac|saturn|suzuki/i, code: /^(LY7|LP1|LLT|LF1|LFW|LFX|LGX|LGW|LF3)\b/i, cyl: 6, order: '1-2-3-4-5-6' },
  // Ford
  { id: 'ford-coyote', name: 'Ford 5.0L Coyote V8', make: /ford|lincoln/i, code: /^(5\.0L?[- ]?(4V|TIVCT|Ti-VCT)|Coyote)/i, cyl: 8, order: '1-5-4-8-6-3-7-2', banks: { right: [1, 2, 3, 4], left: [5, 6, 7, 8] } },
  { id: 'ford-modular-sohc', name: 'Ford 4.6/5.4L Modular V8', make: /ford|lincoln|mercury/i, code: /^(4\.6L?|5\.4L?)[- ]?(2V|3V|4V|SOHC|DOHC)?/i, cyl: 8, order: '1-3-7-2-6-5-4-8', banks: { right: [1, 2, 3, 4], left: [5, 6, 7, 8] } },
  { id: 'ford-v6-ecoboost', name: 'Ford EcoBoost / Cyclone V6 (2.7/3.0/3.3/3.5/3.7L)', make: /ford|lincoln|mercury|mazda/i, code: /^(2\.7L|3\.0L GTDI|3\.3L|3\.5L|3\.7L|3\.5L GTDI|3\.5 ECOBOOST|2\.7 ECOBOOST|Cyclone|3\.0L-4V)/i, cyl: 6, order: '1-4-2-5-3-6', fuel: /gasoline|flex|ethanol/i, banks: { right: [1, 2, 3], left: [4, 5, 6] } },
  { id: 'ford-powerstroke-67', name: 'Ford 6.7L Power Stroke V8 diesel', make: /ford/i, code: /^(6\.7L?|Scorpion)/i, cyl: 8, order: '1-3-7-2-6-5-4-8', fuel: /diesel/i },
  { id: 'ford-powerstroke-old', name: 'Ford 7.3/6.0/6.4L Power Stroke V8 diesel', make: /ford|international|navistar/i, code: /^(7\.3L?|6\.0L?|6\.4L?)/i, cyl: 8, order: '1-2-7-3-4-5-6-8', fuel: /diesel/i },
  // Stellantis
  { id: 'fca-hemi', name: 'Chrysler Gen III HEMI V8 (5.7/6.1/6.2/6.4L)', make: /chrysler|dodge|jeep|ram/i, code: /^(5\.7|6\.1|6\.2|6\.4|HEMI|EZ[ABCDEH]|ESF|ESG|EZJ|ESD)/i, cyl: 8, order: '1-8-4-3-6-5-7-2', fuel: /gasoline|flex|ethanol/i, banks: { left: [1, 3, 5, 7], right: [2, 4, 6, 8] } },
  { id: 'fca-pentastar', name: 'Chrysler Pentastar V6 (3.0/3.2/3.6L)', make: /chrysler|dodge|jeep|ram|fiat|lancia|volkswagen/i, code: /^(3\.6|3\.2|ERB|ERC|EHK|ERD|Pentastar)/i, cyl: 6, order: '1-2-3-4-5-6', fuel: /gasoline|flex|ethanol/i },
  { id: 'cummins-i6', name: 'Cummins 5.9/6.7L inline-6 diesel', make: /dodge|ram|cummins/i, code: /^(5\.9|6\.7|ETJ|ETH|ETK|ETL|ETG|ISB)/i, cyl: 6, order: '1-5-3-6-2-4', fuel: /diesel/i },
  // Toyota / Lexus
  { id: 'toyota-gr', name: 'Toyota GR V6 (1GR/2GR/3GR/4GR)', make: /toyota|lexus|scion/i, code: /^[1-7]GR/i, cyl: 6, order: '1-2-3-4-5-6' },
  { id: 'toyota-ur', name: 'Toyota UR V8 (1UR/2UR/3UR)', make: /toyota|lexus/i, code: /^[1-3]UR/i, cyl: 8, order: '1-8-4-3-6-5-7-2' },
  // Honda / Acura
  { id: 'honda-j', name: 'Honda J-series V6', make: /honda|acura/i, code: /^J(25|30|32|35|37)/i, cyl: 6, order: '1-4-2-5-3-6' },
  // Nissan / Infiniti
  { id: 'nissan-vq', name: 'Nissan VQ V6', make: /nissan|infiniti/i, code: /^VQ\d/i, cyl: 6, order: '1-2-3-4-5-6' },
  { id: 'nissan-vr', name: 'Nissan VR V6', make: /nissan|infiniti/i, code: /^VR\d/i, cyl: 6, order: '1-2-3-4-5-6' },
  // Hyundai / Kia / Genesis
  { id: 'hmg-lambda', name: 'Hyundai/Kia Lambda V6', make: /hyundai|kia|genesis/i, code: /^(G6D|G6DA|G6DB|G6DC|G6DH|G6DJ|G6DK|G6DM|G6DN|G6DP|Lambda)/i, cyl: 6, order: '1-2-3-4-5-6' },
  // Subaru (boxer)
  { id: 'subaru-h6', name: 'Subaru EZ/EG flat-6', make: /subaru/i, cyl: 6, layout: 'H', order: '1-6-3-2-5-4', banks: { right: [1, 3, 5], left: [2, 4, 6] } },
  { id: 'subaru-h4', name: 'Subaru flat-4 (EJ/FA/FB/EA/EG)', make: /subaru/i, cyl: 4, layout: 'H', order: '1-3-2-4', banks: { right: [1, 3], left: [2, 4] } },
];

/**
 * Layout-wide rules (independent of manufacturer). Inline-4 and inline-6 firing orders are
 * effectively universal; inline-5 engines (VW/Audi, Volvo, GM Atlas, Ford/Volvo diesels) use 1-2-4-5-3.
 */
export const LAYOUT_RULES = {
  I4: '1-3-4-2',
  I5: '1-2-4-5-3',
  I6: '1-5-3-6-2-4',
};

export function findEngineFamily({ make = '', code = '', cyl, layout, fuel = '' }) {
  return (
    ENGINE_FAMILIES.find(
      (f) =>
        f.make.test(make) &&
        (!f.cyl || !cyl || f.cyl === Number(cyl)) &&
        (!f.layout || f.layout === layout) &&
        (!f.fuel || f.fuel.test(fuel)) &&
        (f.code ? f.code.test(code.trim()) : true),
    ) || null
  );
}

// Engine model codes whose cylinder count and layout are fixed by the code itself (and, where the
// code encodes it, displacement). Used only when the VIN data doesn't state them; results are
// shown as inferred. Heavy-duty diesel families are almost all inline-6.
const D = (s) => (m) => Number(m[s]) / 10; // e.g. Nissan VQ35 -> 3.5
const CODE_RULES = [
  // Heavy-duty diesels (any make — these engines are installed by many chassis builders)
  { re: /^(ISB|QSB|B)\s?4\.5|^(ISF|F)\s?[23]\.8/i, cyl: 4, layout: 'I' },
  { re: /^(ISB|QSB|B)\s?6\.7|^PX-?7/i, cyl: 6, layout: 'I', disp: 6.7 },
  { re: /^(ISB|QSB|B)\s?5\.9|^PX-?6/i, cyl: 6, layout: 'I' },
  { re: /^(ISB|QSB|ISC|QSC|ISL|QSL|L9|ISL9|C8\.3|ISM|M11|N14|ISX|QSX|X12|X15|ISX12|ISX15|ISZ)\b/i, cyl: 6, layout: 'I' },
  { re: /^PX-?[89]\b|^MX-?1[13]\b|^MX\b/i, cyl: 6, layout: 'I' },
  { re: /^DD(8|13|15|16)\b|^SERIES ?60\b|^S60\b/i, cyl: 6, layout: 'I' },
  { re: /^DD5\b|^SERIES ?50\b/i, cyl: 4, layout: 'I' },
  { re: /^C-?(7|9|9\.3|10|11|12|13|15|16|18)\b|^3(126|176|406)/i, cyl: 6, layout: 'I' },
  { re: /^3208\b/i, cyl: 8, layout: 'V' },
  { re: /^DT ?(360|408|466|530|570)\b|^MAXXFORCE ?(DT|9|10|11|13)\b|^A26\b/i, cyl: 6, layout: 'I' },
  { re: /^N(9|10|13)\b/i, notMake: /bmw|mini|rolls/i, cyl: 6, layout: 'I' },
  { re: /^(VT ?365|T444E|MAXXFORCE ?7)\b/i, cyl: 8, layout: 'V' },
  { re: /^(D11|D12|D13|D16|VED ?1[23])\b|^MP ?(7|8|10)\b|^E7\b/i, cyl: 6, layout: 'I' },
  // Detroit Diesel two-strokes: cylinders, V or inline, cubic inches per cylinder (8V-92, 6-71…)
  { re: /^(6|8|12|16)V-?(53|71|92|149)/i, cyl: (m) => Number(m[1]), layout: 'V' },
  { re: /^([2-6])-(53|71)/i, cyl: (m) => Number(m[1]), layout: 'I' },
  { re: /^J05/i, cyl: 4, layout: 'I' },
  { re: /^(J08|A09)/i, cyl: 6, layout: 'I' },
  { re: /^4HK1/i, cyl: 4, layout: 'I', disp: 5.2 },
  { re: /^6HK1/i, cyl: 6, layout: 'I', disp: 7.8 },
  { re: /^4JJ1/i, cyl: 4, layout: 'I', disp: 3.0 },
  // Honda / Acura
  { make: /honda|acura/i, re: /^J(\d\d)[A-Z]/, cyl: 6, layout: 'V', disp: D(1) },
  { make: /honda|acura/i, re: /^C(\d\d)[A-Z]/, cyl: 6, layout: 'V', disp: D(1) },
  { make: /honda|acura/i, re: /^[KRLDFHB](\d\d)[A-Z]/, cyl: 4, layout: 'I', disp: D(1) },
  // Nissan / Infiniti
  { make: /nissan|infiniti/i, re: /^(VQ|VG|VR)(\d\d)/, cyl: 6, layout: 'V', disp: D(2) },
  { make: /nissan|infiniti/i, re: /^(VK|VH)(\d\d)/, cyl: 8, layout: 'V', disp: D(2) },
  { make: /nissan|infiniti/i, re: /^(QR|MR|SR|KA|GA|CA)(\d\d)|^HR(1[56])/, cyl: 4, layout: 'I', disp: (m) => Number(m[2] || m[3]) / 10 },
  { make: /nissan|infiniti/i, re: /^RB(\d\d)/, cyl: 6, layout: 'I', disp: D(1) },
  // Toyota / Lexus / Scion
  { make: /toyota|lexus|scion/i, re: /^[1-7]GR/, cyl: 6, layout: 'V' },
  { make: /toyota|lexus|scion/i, re: /^[1-3]U[RZ]/, cyl: 8, layout: 'V' },
  { make: /toyota|lexus|scion/i, re: /^[1-3]MZ|^[1-5]VZ|^V35A/, cyl: 6, layout: 'V' },
  { make: /toyota|lexus|scion/i, re: /^[1-3]A[RZ]|^[1-3]Z[RZ]|^[12]NZ|^[1-3]RZ|^[12]TR|^A25[AB]|^M20A|^T24A|^22R|^[3-5]S-/, cyl: 4, layout: 'I' },
  { make: /toyota|lexus|scion/i, re: /^[12]FZ|^[12]JZ|^7M/, cyl: 6, layout: 'I' },
];

export function inferEngineFromCode({ make = '', code = '' }) {
  const c = String(code).trim().toUpperCase();
  if (!c) return null;
  for (const r of CODE_RULES) {
    if (r.make && !r.make.test(make)) continue;
    if (r.notMake && r.notMake.test(make)) continue;
    const m = c.match(r.re);
    if (!m) continue;
    const disp = typeof r.disp === 'function' ? r.disp(m) : r.disp || null;
    return { cyl: typeof r.cyl === 'function' ? r.cyl(m) : r.cyl, layout: r.layout, disp: disp && disp > 0.5 && disp < 20 ? disp : null };
  }
  return null;
}
