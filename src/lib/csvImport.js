// Spreadsheet import for moving from another shop system: parse CSV, auto-match columns by the
// names common shop systems and spreadsheets use, then build de-duplicated records.
import { uid } from './format';
import { cleanVin } from './vin';

/** RFC 4180-ish CSV parser (quotes, escaped quotes, CRLF, BOM); detects comma/semicolon/tab. */
export function parseCsv(text) {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.slice(0, src.indexOf('\n') === -1 ? undefined : src.indexOf('\n'));
  const delim = [',', '\t', ';'].map((d) => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const clean = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!clean.length) return { header: [], rows: [] };
  const [header, ...body] = clean;
  return { header: header.map((h) => h.trim()), rows: body.map((r) => header.map((_, i) => (r[i] ?? '').trim())) };
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Field → header names seen in exports from shop systems, accounting tools and spreadsheets.
export const IMPORT_TYPES = {
  customers: {
    label: 'Customers & vehicles',
    body: 'One row per customer or per vehicle. Rows with the same phone or email become one customer.',
    fields: [
      { key: 'fullName', label: 'Full name', match: ['name', 'customer', 'customername', 'fullname', 'displayname', 'contact', 'contactname', 'customerfullname'] },
      { key: 'firstName', label: 'First name', match: ['firstname', 'first', 'fname', 'customerfirstname', 'givenname'] },
      { key: 'lastName', label: 'Last name', match: ['lastname', 'last', 'lname', 'customerlastname', 'surname', 'familyname'] },
      { key: 'company', label: 'Company', match: ['company', 'companyname', 'business', 'businessname', 'fleet', 'account'] },
      { key: 'phone', label: 'Phone', match: ['phone', 'mobile', 'cell', 'cellphone', 'mobilephone', 'phonenumber', 'primaryphone', 'phone1', 'homephone', 'workphone', 'telephone'] },
      { key: 'email', label: 'Email', match: ['email', 'emailaddress', 'email1', 'primaryemail', 'customeremail'] },
      { key: 'address', label: 'Street address', match: ['address', 'street', 'address1', 'streetaddress', 'addressline1', 'billingaddress', 'billingstreet'] },
      { key: 'city', label: 'City', match: ['city', 'town', 'billingcity'] },
      { key: 'state', label: 'State', match: ['state', 'province', 'region', 'st', 'billingstate'] },
      { key: 'zip', label: 'ZIP', match: ['zip', 'zipcode', 'postalcode', 'postcode', 'billingzip', 'billingpostalcode'] },
      { key: 'notes', label: 'Customer notes', match: ['notes', 'note', 'customernotes', 'comments'] },
      { key: 'vin', label: 'VIN', match: ['vin', 'vinnumber', 'vehiclevin', 'vehicleidentificationnumber'] },
      { key: 'year', label: 'Year', match: ['year', 'vehicleyear', 'modelyear', 'yr'] },
      { key: 'make', label: 'Make', match: ['make', 'vehiclemake', 'manufacturer'] },
      { key: 'model', label: 'Model', match: ['model', 'vehiclemodel'] },
      { key: 'trim', label: 'Trim / submodel', match: ['trim', 'submodel', 'series', 'vehicletrim'] },
      { key: 'engine', label: 'Engine', match: ['engine', 'enginesize', 'motor', 'vehicleengine'] },
      { key: 'color', label: 'Color', match: ['color', 'colour', 'vehiclecolor'] },
      { key: 'plate', label: 'License plate', match: ['plate', 'license', 'licenseplate', 'licenseplatenumber', 'tag', 'platenumber'] },
      { key: 'plateState', label: 'Plate state', match: ['platestate', 'licensestate', 'licenseplatestate', 'tagstate'] },
      { key: 'mileage', label: 'Mileage', match: ['mileage', 'odometer', 'miles', 'lastmileage', 'mileagein', 'currentmileage'] },
      { key: 'vehicle', label: 'Vehicle (one column, e.g. “2018 Honda Accord”)', match: ['vehicle', 'vehicledescription', 'yearmakemodel', 'ymm', 'car'] },
    ],
  },
  inventory: {
    label: 'Parts inventory',
    body: 'One row per stocked part. Rows with an existing part number update quantity and cost.',
    fields: [
      { key: 'partNumber', label: 'Part number', match: ['partnumber', 'partno', 'part', 'pn', 'number', 'itemnumber', 'mfgpartnumber'] },
      { key: 'description', label: 'Description', match: ['description', 'desc', 'name', 'partname', 'itemname', 'item', 'partdescription'] },
      { key: 'brand', label: 'Brand', match: ['brand', 'manufacturer', 'mfg', 'mfr', 'linecode', 'line'] },
      { key: 'category', label: 'Category', match: ['category', 'type', 'group', 'partcategory', 'class'] },
      { key: 'qty', label: 'Quantity on hand', match: ['qty', 'quantity', 'onhand', 'qtyonhand', 'stock', 'instock', 'quantityonhand', 'count'] },
      { key: 'min', label: 'Reorder point', match: ['min', 'minimum', 'minqty', 'reorder', 'reorderpoint', 'minstock', 'reorderlevel'] },
      { key: 'cost', label: 'Cost', match: ['cost', 'unitcost', 'yourcost', 'costprice', 'purchaseprice', 'avgcost', 'averagecost'] },
      { key: 'location', label: 'Bin / location', match: ['location', 'bin', 'shelf', 'binlocation'] },
      { key: 'vendor', label: 'Vendor', match: ['vendor', 'supplier', 'distributor', 'preferredvendor'] },
      { key: 'sku', label: 'SKU', match: ['sku', 'stockcode', 'internalcode'] },
    ],
  },
};

/** Best-guess mapping of field → column index. */
export function autoMap(type, header) {
  const fields = IMPORT_TYPES[type].fields;
  const used = new Set();
  const map = {};
  // Exact synonym matches first, then "contains" matches for prefixed headers like "Customer Phone".
  for (const pass of ['exact', 'contains']) {
    for (const f of fields) {
      if (map[f.key] != null) continue;
      const idx = header.findIndex((h, i) => {
        if (used.has(i)) return false;
        const n = norm(h);
        return pass === 'exact' ? f.match.includes(n) : f.match.some((m) => m.length > 3 && n.includes(m));
      });
      if (idx !== -1) {
        map[f.key] = idx;
        used.add(idx);
      }
    }
  }
  return map;
}

const digits = (p = '') => p.replace(/\D/g, '').slice(-10);
const num = (s) => {
  const n = parseFloat(String(s).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const formatPhone = (p) => {
  const d = digits(p);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p.trim();
};
const cap = (s) => (s && s === s.toUpperCase() && s.length > 3 ? s.toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase()) : s);

/**
 * Build new records from mapped rows, skipping what's already on file.
 * Returns { customers, vehicles, inventory, updates, skipped, errors }.
 */
export function buildImport(type, rows, map, state) {
  const get = (r, k) => (map[k] != null && map[k] !== '' ? (r[Number(map[k])] ?? '').trim() : '');
  const now = new Date().toISOString();
  const result = { customers: [], vehicles: [], inventory: [], inventoryUpdates: [], skipped: 0, errors: [] };

  if (type === 'inventory') {
    const byPn = new Map(state.inventory.map((p) => [norm(p.partNumber || ''), p]));
    const seen = new Set();
    rows.forEach((r, i) => {
      const partNumber = get(r, 'partNumber');
      const description = get(r, 'description');
      if (!partNumber && !description) return result.errors.push(`Row ${i + 2}: no part number or description`);
      const key = norm(partNumber);
      const rec = { partNumber, description: description || partNumber, brand: get(r, 'brand'), category: get(r, 'category') || 'General', qty: num(get(r, 'qty')), min: num(get(r, 'min')), cost: num(get(r, 'cost')), location: get(r, 'location'), vendor: get(r, 'vendor'), sku: get(r, 'sku') || partNumber };
      if (key && byPn.has(key)) {
        result.inventoryUpdates.push({ id: byPn.get(key).id, qty: rec.qty, cost: rec.cost || byPn.get(key).cost });
        return;
      }
      if (key && seen.has(key)) return result.skipped++;
      if (key) seen.add(key);
      result.inventory.push({ ...rec, id: uid('inv') });
    });
    return result;
  }

  // Customers (+ vehicles on the same row).
  const byPhone = new Map();
  const byEmail = new Map();
  const byName = new Map();
  const index = (c) => {
    if (c.phone && digits(c.phone).length >= 7) byPhone.set(digits(c.phone), c);
    if (c.email) byEmail.set(c.email.toLowerCase(), c);
    byName.set(norm(`${c.firstName}${c.lastName}${c.company}`), c);
  };
  state.customers.forEach(index);
  const vins = new Set(state.vehicles.map((v) => v.vin).filter(Boolean));
  const vehicleKeys = new Set(state.vehicles.map((v) => `${v.customerId}|${v.year}|${norm(v.make || '')}|${norm(v.model || '')}`));
  const isNew = new Set();

  rows.forEach((r, i) => {
    let firstName = cap(get(r, 'firstName'));
    let lastName = cap(get(r, 'lastName'));
    const full = cap(get(r, 'fullName'));
    if (!firstName && !lastName && full) {
      if (full.includes(',')) [lastName, firstName] = full.split(',').map((s) => s.trim());
      else {
        const parts = full.split(/\s+/);
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      }
    }
    const company = get(r, 'company');
    const phone = get(r, 'phone');
    const email = get(r, 'email').toLowerCase();
    if (!firstName && !lastName && !company && !phone && !email) return result.errors.push(`Row ${i + 2}: no name, phone or email`);

    let c = (phone && byPhone.get(digits(phone))) || (email && byEmail.get(email)) || (!phone && !email && byName.get(norm(`${firstName}${lastName}${company}`)));
    if (!c) {
      c = { id: uid('cus'), firstName: firstName || '', lastName: lastName || '', company, phone: formatPhone(phone), email, address: get(r, 'address'), city: get(r, 'city'), state: get(r, 'state').toUpperCase().slice(0, 2), zip: get(r, 'zip'), notes: get(r, 'notes'), tags: ['Imported'], textOptIn: true, createdAt: now };
      result.customers.push(c);
      isNew.add(c.id);
      index(c);
    } else if (!isNew.has(c.id)) result.skipped++;

    // Vehicle on this row?
    let year = get(r, 'year');
    let make = get(r, 'make');
    let model = get(r, 'model');
    const combo = get(r, 'vehicle');
    if (!make && combo) {
      const m = combo.match(/^(\d{4})\s+(\S+)\s+(.+)$/);
      if (m) [, year, make, model] = m;
    }
    const vin = cleanVin(get(r, 'vin'));
    if (!vin && !make && !model) return;
    if (vin && vins.has(vin)) return;
    const y = parseInt(year, 10);
    const yearVal = y > 1900 && y < 2100 ? y : y >= 0 && y < 100 ? (y > 40 ? 1900 + y : 2000 + y) : '';
    const key = `${c.id}|${yearVal}|${norm(make)}|${norm(model)}`;
    if (!vin && vehicleKeys.has(key)) return;
    vehicleKeys.add(key);
    if (vin) vins.add(vin);
    result.vehicles.push({ id: uid('veh'), customerId: c.id, vin: vin.length === 17 ? vin : '', year: yearVal, make: cap(make), model: cap(model), trim: get(r, 'trim'), engine: get(r, 'engine'), color: get(r, 'color'), plate: get(r, 'plate').toUpperCase(), plateState: get(r, 'plateState').toUpperCase().slice(0, 2), mileage: Math.round(num(get(r, 'mileage'))), notes: vin && vin.length !== 17 ? `Imported VIN: ${vin}` : '', createdAt: now });
  });
  return result;
}

/** Sample file so shops can see the expected layout. */
export const SAMPLE_CSV = {
  customers: 'First Name,Last Name,Phone,Email,Address,City,State,Zip,VIN,Year,Make,Model,Mileage,License Plate\nJordan,Lee,(555) 010-2299,jordan@example.com,12 Oak St,Springfield,IL,62701,,2017,Toyota,Camry,84210,ABC1234\n',
  inventory: 'Part Number,Description,Brand,Category,Qty On Hand,Reorder Point,Cost,Bin,Vendor\nPH7317,Oil filter,FRAM,Filters,12,6,4.25,A1-08,Local jobber\n',
};
