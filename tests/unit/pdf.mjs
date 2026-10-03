// PDF estimates, invoices and receipts: every kind builds, opens as a valid PDF, names the software in
// its metadata, spans pages when long, and survives characters outside the PDF fonts' character set.
import { PDFDocument } from 'pdf-lib';
import { loadSrc } from '../support/load.mjs';
const { orderPdf, docKind, pdfSafe } = await loadSrc('src/lib/pdf.js');
const { createSeed } = await loadSrc('src/data/seed.js');
const { PRODUCT } = await loadSrc('src/brand/artwork.js');
const { migrate } = await loadSrc('src/store/defaults.js');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };

const s = migrate(createSeed());
const pick = (st) => s.orders.find((o) => o.status === st && o.services.length);
for (const [label, o, kind] of [['estimate', pick('estimate'), 'estimate'], ['work order', pick('in_progress'), 'workorder'], ['invoice', pick('ready'), 'invoice'], ['receipt', s.orders.find((o) => o.status === 'closed' && o.payments.length), 'receipt']]) {
  const r = await orderPdf(s, o, kind);
  const doc = await PDFDocument.load(r.bytes, { updateMetadata: false });
  ok(Buffer.from(r.bytes.slice(0, 5)).toString() === '%PDF-' && doc.getPageCount() >= 1 && doc.getTitle().includes(String(o.number)), `${label} PDF builds and opens (${doc.getPageCount()} page${doc.getPageCount() === 1 ? '' : 's'}, ${Math.round(r.bytes.length / 1024)} KB)`);
  ok(doc.getCreator() === PRODUCT && doc.getProducer() === PRODUCT && doc.getAuthor() === s.shop.name, `${label} PDF metadata names ${PRODUCT} and the shop`);
  ok(r.filename.endsWith('.pdf') && r.filename.includes(String(o.number)), `${label} file name ${r.filename}`);
}
// A long RO runs onto more pages.
const long = structuredClone(pick('in_progress'));
for (let k = 0; k < 6; k++) long.services.push(...structuredClone(long.services).map((x, j) => ({ ...x, id: `${x.id}-${k}-${j}`, cause: 'Worn components found on inspection. '.repeat(6), correction: 'Replaced and road tested. '.repeat(6) })));
const big = await PDFDocument.load((await orderPdf(s, long, 'workorder')).bytes);
ok(big.getPageCount() >= 2, `long RO spans ${big.getPageCount()} pages`);
// Characters the standard fonts can't draw.
const odd = structuredClone(pick('estimate'));
odd.concern = 'Noise → grinding ≥ 30 mph 🚗 — “clunk” ½ café';
odd.services[0].title = 'Brakes ✓ check';
await orderPdf(s, odd, 'estimate');
ok(pdfSafe('a → b ≥ c 🚗 café ½') === 'a -> b >= c  cafe 1/2', 'unsupported characters are spelled out or dropped');
// The product's own shop gets the logo header; a blank name falls back to the product as author.
for (const name of ['WPI Driveline', '']) {
  const own = { ...s, shop: { ...s.shop, name } };
  const doc = await PDFDocument.load((await orderPdf(own, pick('ready'), 'invoice')).bytes, { updateMetadata: false });
  ok(doc.getPageCount() >= 1 && doc.getAuthor() === (name || PRODUCT), `invoice for a shop named "${name}" builds (author ${doc.getAuthor()})`);
}
ok(docKind({ status: 'estimate', services: [], payments: [] }, s.shop) === 'estimate' && docKind({ status: 'in_progress', services: [], payments: [] }, s.shop) === 'workorder', 'the right document for the RO’s stage');
