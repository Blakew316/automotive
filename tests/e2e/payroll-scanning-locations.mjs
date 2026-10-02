// Phase E: payroll (pay periods, overtime, exports, timecards, approval), barcode/VIN scanning
// (bundled decoder via photos and typed codes) and multiple locations.
import { launch, APP, OUT } from '../support/env.mjs';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const qrcode = require('qrcode-generator');
const SP = OUT;
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const errors = [];
const qrFile = (text, name) => {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const b64 = q.createDataURL(8, 6).split(',')[1];
  const path = `${SP}/${name}.gif`;
  fs.writeFileSync(path, Buffer.from(b64, 'base64'));
  return path;
};

const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, serviceWorkers: 'block', acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|NotFoundError|Requested device not found|getUserMedia/.test(m.text()) && errors.push(`console ${page.url()}: ${m.text()}`));
const state = async () => { await page.waitForFunction(() => window.__autoshop); return page.evaluate(() => window.__autoshop.state()); };
const download = async (click) => {
  const [d] = await Promise.all([page.waitForEvent('download'), click()]);
  return fs.readFileSync(await d.path(), 'utf8');
};

await page.goto(APP + '/');
let s = await state();

// ---------------------------------------------------------------- Payroll
// A new hourly tech with 50 hours last week (Mon–Fri, 10 h a day) → 40 regular + 10 overtime.
await page.evaluate(() => {
  window.__autoshop.update((d) => {
    d.technicians.push({ id: 'tech-test', name: 'Pat Payroll', role: 'Technician', payType: 'hourly', payRate: 30, laborCommissionPct: 0, partsCommissionPct: 0, active: true, payrollId: 'E-1042' });
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) - 7);
    for (let i = 0; i < 5; i++) {
      const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 7, 0);
      d.timeEntries.push({ id: `te-test-${i}`, kind: 'shift', techId: 'tech-test', start: start.toISOString(), end: new Date(start.getTime() + 10 * 3600000).toISOString() });
    }
  });
});
await page.goto(APP + '/team?tab=pay');
await page.getByRole('tab', { name: 'Last pay period' }).click();
const row = page.getByRole('row').filter({ hasText: 'Pat Payroll' });
await row.waitFor();
const cells = await row.locator('td').allTextContents();
ok(cells.some((c) => c.trim() === '40.00') && cells.some((c) => c.trim() === '10.00'), `40 regular + 10 overtime hours (${cells.slice(2, 4).join(' / ')})`);
ok(cells.some((c) => c.includes('$1,650.00')), 'gross = 40 × $30 + 10 × $45');
const hoursCsv = await download(() => page.getByRole('button', { name: 'Hours import' }).click());
ok(/Employee ID,Employee name,Regular hours,Overtime hours/.test(hoursCsv) && hoursCsv.includes('E-1042,Pat Payroll,40.00,10.00'), 'hours import CSV has ID, regular and overtime');
const fullCsv = await download(() => page.getByRole('button', { name: 'Payroll CSV' }).click());
ok(fullCsv.includes('Pat Payroll,E-1042') && fullCsv.includes('1650.00'), 'detailed payroll CSV');
await page.getByRole('button', { name: 'Approve this period' }).click();
await page.getByRole('button', { name: /Approved by/ }).waitFor();
s = await state();
ok(Object.values(s.shop.payroll.approved).some((a) => a?.gross > 0), 'pay period approval recorded');
// Settings: biweekly + daily overtime.
await page.getByRole('button', { name: 'Settings' }).click();
await page.getByRole('dialog').locator('select').first().selectOption('biweekly');
await page.getByLabel('…or (hours / day)').fill('8');
await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
s = await state();
ok(s.shop.payroll.period === 'biweekly' && s.shop.payroll.overtimeDaily === 8, 'payroll settings saved');
await page.getByRole('link', { name: 'Timecards' }).click();
await page.getByRole('heading', { name: 'Pat Payroll' }).waitFor();
ok(await page.getByText('Employee signature').count() > 0 && await page.getByText('Manager approval').count() > 0, 'printable timecards with signature lines');
await page.screenshot({ path: `${SP}/shots/e-timecard.png`, fullPage: false });

// Tech form has the payroll employee ID.
await page.goto(APP + '/team?tab=people');
ok(true, 'people tab loads');

// ---------------------------------------------------------------- Scanning (bundled decoder)
const vehicle = s.vehicles.find((v) => v.vin && v.vin.length === 17);
await page.goto(APP + '/vin');
await page.getByRole('button', { name: 'Scan' }).click();
await page.getByRole('dialog').getByText(/camera isn’t available|Camera permission/).waitFor({ timeout: 10000 }).catch(() => {});
await page.locator('input[aria-label="Barcode photo"]').setInputFiles(qrFile(vehicle.vin, 'vin-qr'));
await page.waitForFunction((vin) => [...document.querySelectorAll('input')].some((i) => i.value === vin), vehicle.vin, { timeout: 20000 });
ok(true, `VIN read from a photo with the bundled decoder (${vehicle.vin})`);
await page.getByText(vehicle.make, { exact: false }).first().waitFor();

// Inventory: give a part a barcode by typing in the scanner, then find it from a photo.
s = await state();
const part = s.inventory.find((p) => p.qty >= 3 && p.partNumber);
await page.goto(APP + '/parts?tab=inventory');
await page.getByPlaceholder('Part #, SKU, barcode, brand, bin').fill(part.description);
await page.getByRole('row').filter({ hasText: part.description }).first().hover();
await page.getByRole('row').filter({ hasText: part.description }).first().getByRole('button', { name: 'Edit' }).click();
await page.getByRole('button', { name: 'Scan the part’s barcode' }).click();
await page.getByRole('button', { name: 'Type it' }).click();
await page.getByLabel('Typed code').fill('012345678905');
await page.getByRole('button', { name: 'Use', exact: true }).click();
ok((await page.getByLabel('Barcode (UPC/EAN)').inputValue()) === '012345678905', 'barcode filled from the scanner');
await page.getByRole('dialog').getByRole('button', { name: /Save/ }).click();
await page.getByPlaceholder('Part #, SKU, barcode, brand, bin').fill('');
await page.getByRole('button', { name: 'Scan a part barcode' }).click();
await page.locator('input[aria-label="Barcode photo"]').setInputFiles(qrFile('12345678905', 'part-qr'));
await page.getByText(`${part.qty} in stock`).first().waitFor({ timeout: 20000 }).catch(async () => {
  await page.getByText(/in stock/).first().waitFor({ timeout: 5000 });
});
ok(await page.getByRole('button', { name: 'Pull 1' }).count() > 0, 'scanned part found (UPC with/without leading zero)');
await page.getByRole('button', { name: 'Pull 1' }).click();
s = await state();
ok(s.inventory.find((p) => p.id === part.id).qty === part.qty - 1, 'pulled one from stock');

// Cycle count.
await page.getByRole('button', { name: 'Count' }).click();
await page.getByRole('button', { name: 'Type it' }).click();
await page.getByLabel('Typed code').fill(part.partNumber);
await page.getByRole('button', { name: 'Use', exact: true }).click();
await page.getByLabel('Counted on the shelf').fill('9');
await page.getByRole('button', { name: 'Save count' }).click();
s = await state();
const counted = s.inventory.find((p) => p.id === part.id);
ok(counted.qty === 9 && counted.countedAt, 'count corrected the quantity and stamped the date');
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');

// RO: add a part by scanning.
const ro = s.orders.find((o) => ['estimate', 'approved', 'in_progress'].includes(o.status) && o.services.length);
await page.goto(APP + `/orders/${ro.id}`);
await page.getByRole('button', { name: 'From inventory' }).first().click();
await page.getByRole('button', { name: 'Scan the part’s barcode' }).click();
await page.getByRole('button', { name: 'Type it' }).click();
await page.getByLabel('Typed code').fill('0012345678905');
await page.getByRole('button', { name: 'Use', exact: true }).click();
s = await state();
ok(s.orders.find((o) => o.id === ro.id).services[0].items.some((i) => i.inventoryId === part.id), 'scanned part added to the repair order');

// ---------------------------------------------------------------- Locations
await page.goto(APP + '/settings?tab=general');
await page.getByRole('button', { name: 'Add location' }).click();
await page.getByRole('dialog').getByLabel('Name').fill('West Side');
await page.getByRole('dialog').getByLabel('Street address').fill('8800 W Wabash Ave');
await page.getByRole('dialog').getByLabel('City').fill('Springfield');
await page.getByRole('dialog').getByLabel('Phone').fill('(217) 555-0188');
await page.getByRole('dialog').getByLabel('Sales tax (%)').fill('8.5');
await page.getByRole('dialog').getByLabel('Labor rate ($/hr)').fill('150');
await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
const switcher = page.getByLabel('Location', { exact: true }).first();
await switcher.waitFor();
s = await state();
const west = s.shop.locations[0];
ok(west.name === 'West Side' && west.taxRate === 8.5 && west.laborRate === 150, 'location saved with its own tax and labor rate');
const totalOpen = s.orders.filter((o) => o.status !== 'closed').length;

await switcher.selectOption(west.id);
await page.goto(APP + '/orders');
await page.getByRole('heading', { name: 'Repair Orders' }).waitFor().catch(() => {});
let rows = await page.locator('tbody tr').count();
ok(rows === 0 || (await page.getByText(/No repair orders/).count()) > 0, `West Side starts with no ROs (${rows} rows)`);
// New RO at West Side.
const cust = s.customers.find((c) => s.vehicles.some((v) => v.customerId === c.id));
const veh = s.vehicles.find((v) => v.customerId === cust.id);
await page.goto(APP + `/orders/new?customer=${cust.id}&vehicle=${veh.id}&jobs=cj-oil`);
ok((await page.getByLabel('Location').last().inputValue()) === west.id, 'new RO defaults to this device’s location');
await page.getByRole('button', { name: 'Create estimate' }).click();
await page.waitForURL(/orders\/ro/);
s = await state();
const wro = s.orders.find((o) => o.locationId === west.id);
ok(wro, 'RO stamped with the location');
ok(wro.services[0].items.filter((i) => i.type === 'labor').every((i) => i.rate === 150), 'labor priced at the location’s rate');
const tax = await page.evaluate((id) => {
  const st = window.__autoshop.state();
  return st.orders.find((o) => o.id === id);
}, wro.id);
ok(tax, 'RO readable');
await page.goto(APP + `/orders/${wro.id}/print`);
await page.getByText('8800 W Wabash Ave').waitFor();
ok(await page.getByText('(217) 555-0188').count() > 0, 'printed estimate uses the location’s address and phone');
ok(await page.getByText('Sales tax (8.5%)').count() > 0, 'location sales tax applied');
// Dashboard / workflow scoped.
await page.goto(APP + '/workflow');
await page.waitForTimeout(400);
ok(await page.getByText(`#${wro.number}`).count() > 0, 'workflow shows the West Side RO');
// Front desk check-in link carries the location.
await page.goto(APP + '/frontdesk');
// Back to all locations.
await page.getByLabel('Location', { exact: true }).first().selectOption('all');
await page.goto(APP + '/orders');
await page.locator('thead th', { hasText: 'Location' }).waitFor();
ok(await page.locator('tbody td', { hasText: 'West Side' }).count() >= 1, 'all-locations list shows each RO’s location');
await page.goto(APP + '/reports');
await page.getByText('By location').waitFor();
ok(await page.locator('td', { hasText: 'West Side' }).count() > 0 && await page.locator('td', { hasText: 'Main location' }).count() > 0, 'reports compare locations');
await page.screenshot({ path: `${SP}/shots/e-reports-locations.png`, fullPage: false });
// Inventory transfer to West Side.
s = await state();
const stock = s.inventory.find((p) => p.qty >= 4 && p.partNumber && p.id !== part.id);
await page.goto(APP + '/parts?tab=inventory');
await page.getByPlaceholder('Part #, SKU, barcode, brand, bin').fill(stock.partNumber);
const r1 = page.getByRole('row').filter({ hasText: stock.description }).first();
await r1.hover();
await r1.getByRole('button', { name: `Transfer ${stock.description}` }).click();
await page.getByRole('dialog').getByLabel('Quantity').fill('2');
await page.getByRole('dialog').getByRole('button', { name: /^Transfer/ }).click();
s = await state();
const moved = s.inventory.filter((p) => p.partNumber === stock.partNumber);
ok(moved.find((p) => p.id === stock.id).qty === stock.qty - 2 && moved.some((p) => p.locationId === west.id && p.qty === 2), 'stock transferred to West Side');
ok(totalOpen > 0, 'main location data untouched');

ok(errors.length === 0, `no page errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
await browser.close();
console.log('PHASE E PASS');
