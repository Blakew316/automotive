// Multiple locations: one shop, several addresses. The shop profile is the main location; each extra
// location can override the address, phone, sales tax and labor rate. Repair orders, appointments,
// time entries, purchase orders and inventory carry a locationId (none = the main location), and
// each device chooses which location it's working at (or all of them).
export const MAIN = 'main';

export const isMulti = (shop) => (shop?.locations || []).length > 0;

/** Every location, main first. */
export function siteList(shop) {
  const main = { id: MAIN, name: shop.locationName || 'Main location', address: shop.address, city: shop.city, state: shop.state, zip: shop.zip, phone: shop.phone, email: shop.email, taxRate: null, laborRate: null, main: true };
  return [main, ...(shop.locations || [])];
}

/** Where a record lives (records from before locations existed are at the main location). */
export const siteOf = (rec) => rec?.locationId || MAIN;

export function siteFor(shop, id) {
  return siteList(shop).find((l) => l.id === id) || siteList(shop)[0];
}

/** The shop profile as it applies at one location (address, phone, tax and labor rate). */
export function shopAt(shop, locationId) {
  if (!locationId || locationId === MAIN) return shop;
  const loc = (shop.locations || []).find((l) => l.id === locationId);
  if (!loc) return shop;
  const pick = (k) => (loc[k] != null && loc[k] !== '' ? loc[k] : shop[k]);
  return { ...shop, address: pick('address'), city: pick('city'), state: pick('state'), zip: pick('zip'), phone: pick('phone'), email: pick('email'), taxRate: pick('taxRate'), laborRate: pick('laborRate'), locationName: loc.name };
}

const SCOPED = ['orders', 'appointments', 'timeEntries', 'purchaseOrders', 'inventory'];

/** The shop's data seen from one location ('all' = everything). */
export function scopeState(state, site) {
  if (!site || site === 'all' || !isMulti(state.shop)) return state;
  const out = { ...state };
  for (const k of SCOPED) out[k] = (state[k] || []).filter((r) => siteOf(r) === site);
  return out;
}

/** The location new records should get from this device ('all' and single-location shops → main/none). */
export const stampFor = (shop, current) => (isMulti(shop) && current && current !== 'all' && current !== MAIN && siteList(shop).some((l) => l.id === current) ? current : null);
