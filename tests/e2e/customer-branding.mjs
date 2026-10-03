// Customer pages lead with the shop's own name; the product signs off with one quiet "Powered by" line.
// This is the release gate for the marketing site's "your customers see your shop's name" claims.
import { launch, APP, ROOT, OUT } from '../support/env.mjs';
const CLOUD = 'https://huwcrbkplpudpsfczbyg.supabase.co';
const PRODUCT = 'WPI Driveline Shop Management System';
const POWERED = `Powered by ${PRODUCT}`;
const SP = OUT;
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const errors = [];
const watch = (page, name) => {
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text()) && errors.push(`${name} console: ${m.text()}`));
};
// Nothing here should reach the real cloud; customer pages work from the link alone.
const offline = (ctx) => ctx.route(CLOUD + '/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));

// ---- The sample shop's booking link, read from Settings → Website & booking button.
const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
await offline(desk);
const app = await desk.newPage();
watch(app, 'app');
await app.goto(APP + '/');
await app.waitForFunction(() => window.__autoshop);
const shopName = await app.evaluate(() => window.__autoshop.state().shop.name);
ok(shopName === 'Main Street Auto Service', `sample shop is ${shopName}`);
const bookingLink = async () => {
  await app.goto(APP + '/settings?tab=website');
  const link = await app.getByLabel('Booking link', { exact: true }).inputValue();
  ok(link.startsWith(`${ROOT}app/book?c=`), `booking link for "${await app.evaluate(() => window.__autoshop.state().shop.name)}" works without the cloud`);
  return link;
};
const rename = (name) => app.evaluate((n) => window.__autoshop.update((s) => void (s.shop.name = n)), name);
const sampleLink = await bookingLink();

// What a customer's page shows: where the shop's name sits relative to every copy of the product's logo.
const LOGO_VIEWBOXES = ['-81 -190 653 361', '-81 -190 653 418', '-8 -190 507 250'];
const anatomy = (page, name) =>
  page.evaluate(
    ({ name, boxes }) => {
      const heading = [...document.querySelectorAll('h1, h2')].find((e) => e.textContent.trim() === name) || null;
      const logos = [...document.querySelectorAll('svg')].filter((s) => boxes.includes(s.getAttribute('viewBox')));
      const header = document.querySelector('header.customer-header');
      return {
        heading: Boolean(heading),
        headingInHeader: Boolean(heading && header?.contains(heading)),
        logosAfterHeading: Boolean(heading) && logos.every((s) => heading.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING),
        headerLogo: header ? [...header.querySelectorAll('svg[role="img"]')].map((s) => s.getAttribute('aria-label')) : null,
        labelledLogos: logos.filter((s) => s.getAttribute('role') === 'img').length,
      };
    },
    { name, boxes: LOGO_VIEWBOXES },
  );

// ---- Another shop's booking page, on an iPhone and on a computer.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await offline(phone);
const cust = await phone.newPage();
watch(cust, 'customer');

await cust.goto(APP + '/book');
await cust.getByText('This booking link is incomplete.').waitFor();
ok(true, 'a bare /app/book says the booking link is incomplete');

async function otherShop(page, label) {
  await page.goto(sampleLink);
  const heading = page.getByRole('heading', { name: 'Main Street Auto Service', exact: true });
  await heading.waitFor();
  const a = await anatomy(page, 'Main Street Auto Service');
  ok(a.headingInHeader, `${label}: the shop's name is the heading in the page header`);
  ok(a.headerLogo && a.headerLogo.length === 0, `${label}: no product logo in the header`);
  ok(a.logosAfterHeading && a.labelledLogos === 0, `${label}: the shop's name comes before any WPI logo (the only one is the decorative mark in the Powered by line)`);
  const powered = page.getByText(POWERED, { exact: true });
  ok((await powered.count()) === 1 && (await powered.isVisible()), `${label}: one "${POWERED}" line`);
  const link = powered.locator('xpath=ancestor::a[1]');
  if (await link.count()) {
    ok((await link.getAttribute('href')) === ROOT && (await link.getAttribute('target')) === '_blank' && /noopener/.test(await link.getAttribute('rel')), `${label}: Powered by links to the product site in a new tab`);
  }
  const below = await page.evaluate((text) => {
    const h = [...document.querySelectorAll('h2')].find((e) => e.textContent.trim() === 'Main Street Auto Service');
    const p = [...document.querySelectorAll('p')].find((e) => e.textContent.trim() === text);
    return Boolean(h && p && h.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING);
  }, POWERED);
  ok(below, `${label}: the Powered by line sits below the page content`);
  ok((await page.title()) === 'Book a visit — Main Street Auto Service', `${label}: browser title names the shop ("${await page.title()}")`);
}
await otherShop(cust, 'iPhone');
await cust.screenshot({ path: `${SP}/shots/branding-book-other-390.png`, fullPage: true });
const deskCust = await desk.newPage();
watch(deskCust, 'customer-desk');
await otherShop(deskCust, '1280px');
await deskCust.screenshot({ path: `${SP}/shots/branding-book-other-1280.png`, fullPage: true });

// ---- The product's own shop (or a shop with no name): the logo leads and there's no Powered by line.
for (const [name, label, title] of [
  ['WPI Driveline', 'a shop named WPI Driveline', `Book a visit — ${PRODUCT}`],
  ['', 'a shop with no name', `Book a visit — ${PRODUCT}`],
]) {
  await rename(name);
  const link = await bookingLink();
  await cust.goto(link);
  await cust.locator('header.customer-header').waitFor();
  const a = await anatomy(cust, name || '—');
  ok(a.headerLogo && a.headerLogo.length === 1 && a.headerLogo[0] === PRODUCT, `${label}: the header shows the logo, named "${PRODUCT}" for screen readers`);
  ok((await cust.locator('header.customer-header').getByRole('img', { name: PRODUCT }).isVisible()), `${label}: the logo is visible`);
  ok((await cust.getByText(/Powered by/).count()) === 0, `${label}: no Powered by line`);
  ok((await cust.title()) === title, `${label}: browser title "${await cust.title()}"`);
  if (name) await cust.screenshot({ path: `${SP}/shots/branding-book-brand-390.png`, fullPage: true });
}
await rename('Main Street Auto Service');

// ---- Pages the shop shows from its own devices: the lobby screen and the customer report.
await app.goto(APP + '/lobby');
await app.getByRole('heading', { name: 'Main Street Auto Service', exact: true }).waitFor();
ok((await app.locator('header.customer-header svg[role="img"]').count()) === 0, 'lobby screen: the shop\'s name leads, no product logo in the header');
ok((await app.getByText(POWERED, { exact: true }).count()) === 1, 'lobby screen: Powered by line');
ok((await app.title()) === 'Main Street Auto Service — Vehicle status', `lobby screen title "${await app.title()}"`);
const orderId = await app.evaluate(() => window.__autoshop.state().orders.find((o) => o.status === 'estimate' && o.customerId)?.id);
await app.goto(`${APP}/orders/${orderId}/report`);
await app.getByText(POWERED, { exact: true }).waitFor();
ok(/— Main Street Auto Service$/.test(await app.title()), `customer report: title ends with the shop's name ("${await app.title()}")`);
ok(true, 'customer report: Powered by line');

await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO PAGE ERRORS');
if (errors.length) process.exit(1);
