// Small Engine Edition: top power-equipment and engine brands, and where shops look up parts.
// Placeholder shape — filled in with the full list.

/** Google search limited to one site (no deep links to guess at). */
export const siteSearch = (domain, q) => `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ${q}`.trim())}`;

/**
 * kind: 'engine' (engine maker), 'equipment' (machine maker) or 'both'.
 * types: EQUIPMENT_TYPES ids (data/smallEngine.js) the brand is known for.
 */
export const SE_BRANDS = [
  { slug: 'briggs-stratton', name: 'Briggs & Stratton', domain: 'briggsandstratton.com', kind: 'engine', types: ['push-mower', 'riding-mower', 'zero-turn', 'generator', 'pressure-washer', 'snow-blower'], note: 'Engines for mowers, generators and pressure washers' },
];

/** Parts suppliers, searched by part or model number. */
export const PARTS_SOURCES = [
  { id: 'partstree', name: 'PartsTree', domain: 'partstree.com', note: 'OEM parts diagrams by model number' },
];
