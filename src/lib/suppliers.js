// Deep links into parts suppliers' own catalogs. Nothing is scraped — each link opens the
// supplier's site with the search or vehicle pre-filled so the counter person can price & order.
const enc = encodeURIComponent;
const slug = (s = '') => String(s).toLowerCase().trim().replace(/\s+/g, '+');

export const SUPPLIERS = [
  {
    id: 'rockauto',
    name: 'RockAuto',
    kind: 'Online catalog',
    search: (q) => `https://www.rockauto.com/en/partsearch/?partnum=${enc(q)}`,
    vehicle: (v) => `https://www.rockauto.com/en/catalog/${[slug(v.make), v.year, slug(v.model)].filter(Boolean).join(',')}`,
  },
  { id: 'napa', name: 'NAPA', kind: 'Retail & commercial', search: (q) => `https://www.napaonline.com/en/search?text=${enc(q)}` },
  { id: 'oreilly', name: "O'Reilly", kind: 'Retail & commercial', search: (q) => `https://www.oreillyauto.com/search?q=${enc(q)}` },
  { id: 'autozone', name: 'AutoZone', kind: 'Retail & commercial', search: (q) => `https://www.autozone.com/searchresult?searchText=${enc(q)}` },
  { id: 'advance', name: 'Advance', kind: 'Retail & commercial', search: (q) => `https://shop.advanceautoparts.com/web/SearchResults?searchTerm=${enc(q)}` },
];

export const B2B_PLATFORMS = [
  { id: 'partstech', name: 'PartsTech', url: 'https://partstech.com', desc: 'Free multi-supplier ordering platform for repair shops (live local inventory & pricing).' },
  { id: 'nexpart', name: 'Nexpart', url: 'https://www.nexpart.com', desc: 'Electronic catalog/ordering used by many WD and dealer parts counters.' },
  { id: 'worldpac', name: 'WORLDPAC speedDIAL', url: 'https://speeddial.worldpac.com', desc: 'OE and OE-supplier parts, strong on European and Asian makes.' },
];

// Manufacturer-operated genuine parts stores (browse OEM diagrams by VIN).
export const OEM_PARTS = [
  { makes: ['Ford', 'Lincoln'], name: 'Ford Parts', url: 'https://parts.ford.com' },
  { makes: ['Chevrolet', 'GMC', 'Buick', 'Cadillac'], name: 'GM Genuine Parts', url: 'https://www.gmparts.com' },
  { makes: ['Chrysler', 'Dodge', 'Jeep', 'Ram', 'Fiat', 'Alfa Romeo'], name: 'Mopar', url: 'https://store.mopar.com' },
  { makes: ['Toyota', 'Scion', 'Lexus'], name: 'Toyota Genuine Parts', url: 'https://autoparts.toyota.com' },
  { makes: ['Honda', 'Acura'], name: 'Honda Parts & Accessories', url: 'https://owners.honda.com/parts-accessories' },
  { makes: ['Nissan', 'Infiniti'], name: 'Nissan Parts', url: 'https://parts.nissanusa.com' },
  { makes: ['Subaru'], name: 'Subaru Parts', url: 'https://parts.subaru.com' },
  { makes: ['Kia'], name: 'Kia Parts', url: 'https://parts.kia.com' },
];

export const oemPartsFor = (make) => OEM_PARTS.find((o) => o.makes.includes(make));
