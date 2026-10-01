// Service-history records for vehicle history services (CARFAX and others). One row per completed
// service on an invoiced RO, with the fields a history report needs: VIN, date, odometer, what was
// done, and who did it.
import { isoDate } from './format';

export const HISTORY_COLUMNS = ['VIN', 'Year', 'Make', 'Model', 'Service Date', 'Odometer', 'RO Number', 'Service Performed', 'Shop Name', 'Shop Address', 'Shop City', 'Shop State', 'Shop ZIP', 'Shop Phone'];

export function serviceHistory(state, { from, to } = {}) {
  const shop = state.shop;
  const rows = [];
  const missing = { vin: 0, mileage: 0 };
  let orders = 0;
  for (const o of state.orders) {
    if (!['ready', 'closed'].includes(o.status)) continue;
    const when = o.closedAt || o.invoicedAt || o.updatedAt || o.createdAt;
    const day = isoDate(when);
    if ((from && day < from) || (to && day > to)) continue;
    const v = state.vehicles.find((x) => x.id === o.vehicleId);
    const services = o.services.filter((s) => s.status !== 'declined');
    if (!services.length) continue;
    const vin = (v?.vin || '').toUpperCase();
    const odometer = o.mileageOut || o.mileageIn || null;
    if (vin.length !== 17) {
      missing.vin += 1;
      continue;
    }
    if (!odometer) missing.mileage += 1;
    orders += 1;
    for (const s of services) {
      rows.push([vin, v.year, v.make, v.model, day, odometer || '', o.number, [s.title, s.correction].filter(Boolean).join(' — '), shop.name, shop.address, shop.city, shop.state, shop.zip, shop.phone]);
    }
  }
  return { rows, orders, missing };
}

export function toCsv(header, rows) {
  const cell = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}
