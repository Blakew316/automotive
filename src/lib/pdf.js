// Estimates, work orders, invoices and receipts as real PDF files (for email attachments and
// downloads) — the same content as the print view, laid out for Letter paper. pdf-lib is loaded
// only when a PDF is made, so it never slows the app down otherwise.
import { orderTotals, itemTotal, serviceTotal } from './pricing';
import { INSPECTION_RATINGS } from './workflow';
import { dueDate, hasTerms, termsLabel } from './accounts';
import { shopAt } from './locations';
import { money, fullName, vehicleName, date, phone, number } from './format';

const TITLES = { estimate: 'Estimate', workorder: 'Work Order', invoice: 'Invoice', receipt: 'Receipt' };
/** The document's name, e.g. "Invoice". */
export const docTitle = (kind) => TITLES[kind];

/** Which document an RO is right now: an estimate before work is approved, an invoice once it's done. */
export const docKind = (order, shop) => (order.status === 'estimate' ? 'estimate' : ['ready', 'closed'].includes(order.status) ? (orderPaid(order, shop) ? 'receipt' : 'invoice') : 'workorder');
const orderPaid = (order, shop) => (order.payments || []).length > 0 && orderTotals(order, shop).balance <= 0.004;

export const docFilename = (shop, order, kind) => `${TITLES[kind].replace(/\s+/g, '-')}-${order.number}-${String(shop.name || 'shop').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')}.pdf`;

// The standard PDF fonts use the Windows-1252 character set; anything outside it is spelled out.
const WINANSI = /[^\x20-\x7e\xa0-\xff–—‘’‚“”„†‡•…‰‹›€™ŒœŠšŸŽžƒˆ˜]/g;
const SWAP = { '→': '->', '←': '<-', '≥': '>=', '≤': '<=', '≈': '~', '−': '-', '\u00a0': ' ', '\t': ' ' };
export const pdfSafe = (s) =>
  String(s ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/[←→≥≤≈−\u00a0\t]/g, (c) => SWAP[c])
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u2044/g, '/')
    .replace(WINANSI, '');

export async function orderPdf(state, order, kind = docKind(order, shopAt(state.shop, order.locationId)), { showParts = true, showDeclined = true } = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const shop = shopAt(state.shop, order.locationId);
  const c = state.customers.find((x) => x.id === order.customerId);
  const v = state.vehicles.find((x) => x.id === order.vehicleId);
  const t = orderTotals(order, shop);
  const invoiceLike = kind === 'invoice' || kind === 'receipt';

  const doc = await PDFDocument.create();
  doc.setTitle(`${TITLES[kind]} ${order.number} — ${shop.name}`);
  doc.setAuthor(shop.name || 'AutoShop Pro');
  doc.setCreator('AutoShop Pro');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const W = 612;
  const H = 792;
  const M = 48;
  const INK = rgb(0.08, 0.11, 0.15);
  const INK2 = rgb(0.3, 0.35, 0.42);
  const INK3 = rgb(0.45, 0.5, 0.56);
  const LINE = rgb(0.86, 0.88, 0.91);
  const NAVY = rgb(0.11, 0.23, 0.42);
  const INDIGO = rgb(0.3, 0.34, 0.75);

  let page;
  let y;
  const pages = [];
  const newPage = () => {
    page = doc.addPage([W, H]);
    pages.push(page);
    y = H - M;
  };
  const ensure = (need) => {
    if (y - need < M + 24) {
      newPage();
      text(`${TITLES[kind]} ${order.number} (continued)`, M, y, { f: bold, size: 10, color: INK3 });
      y -= 22;
    }
  };
  const width = (s, f = font, size = 10) => f.widthOfTextAtSize(pdfSafe(s), size);
  function text(s, x, yy, { f = font, size = 10, color = INK, align = 'left', maxW } = {}) {
    let str = pdfSafe(s);
    if (maxW) while (str.length > 1 && f.widthOfTextAtSize(str, size) > maxW) str = `${str.slice(0, -2)}…`;
    const w = f.widthOfTextAtSize(str, size);
    page.drawText(str, { x: align === 'right' ? x - w : x, y: yy, size, font: f, color });
  }
  const wrap = (s, maxW, f = font, size = 10) => {
    const words = pdfSafe(s).split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const para = (s, x, maxW, { f = font, size = 9.5, color = INK2, lead = 13 } = {}) => {
    for (const l of wrap(s, maxW, f, size)) {
      ensure(lead);
      text(l, x, y, { f, size, color });
      y -= lead;
    }
  };
  const rule = (yy, color = LINE, thick = 0.75) => page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: thick, color });

  newPage();
  // ---- Header
  text(shop.name || 'Auto repair', M, y - 6, { f: bold, size: 18 });
  const addr = [shop.address, [shop.city, shop.state].filter(Boolean).join(', ') + (shop.zip ? ` ${shop.zip}` : ''), [shop.phone, shop.email].filter(Boolean).join(' · ')].filter((x) => x && x.trim());
  addr.forEach((l, i) => text(l, M, y - 24 - i * 12, { size: 9.5, color: INK2 }));
  text(TITLES[kind], W - M, y - 8, { f: bold, size: 22, align: 'right' });
  const meta = [
    `No. ${order.number}`,
    date(invoiceLike ? order.invoicedAt || new Date().toISOString() : order.createdAt),
    order.po ? `PO ${order.po}` : null,
    invoiceLike && hasTerms(c) ? `${termsLabel(c.account.terms)} · due ${date(dueDate(order, c))}` : null,
  ].filter(Boolean);
  meta.forEach((l, i) => text(l, W - M, y - 26 - i * 12, { size: 9.5, color: INK2, align: 'right' }));
  y -= Math.max(24 + addr.length * 12, 26 + meta.length * 12) + 10;
  // A navy rule that turns indigo at the end — the app's accent.
  page.drawLine({ start: { x: M, y }, end: { x: W - M - 120, y }, thickness: 1.5, color: NAVY });
  page.drawLine({ start: { x: W - M - 120, y }, end: { x: W - M, y }, thickness: 1.5, color: INDIGO });
  y -= 20;

  // ---- Customer & vehicle
  const colW = (W - 2 * M - 24) / 2;
  const block = (x, label, lines) => {
    let yy = y;
    text(label.toUpperCase(), x, yy, { f: bold, size: 7.5, color: INK3 });
    yy -= 13;
    lines.filter(Boolean).forEach(([s, opts], i) => {
      text(s, x, yy, { size: 10, color: i ? INK2 : INK, maxW: colW, ...(opts || {}) });
      yy -= 12.5;
    });
    return yy;
  };
  const custLines = [
    [fullName(c), { f: bold }],
    c?.company ? [c.company] : null,
    c?.account?.taxExempt && order.taxExempt ? [`Tax exempt${c.account.taxId ? ` · ${c.account.taxId}` : ''}`] : null,
    c?.address ? [c.address] : null,
    c?.city || c?.state ? [`${[c?.city, c?.state].filter(Boolean).join(', ')} ${c?.zip || ''}`] : null,
    c?.phone ? [phone(c.phone)] : null,
    c?.email ? [c.email] : null,
  ];
  const vehLines = [
    [`${v?.unit ? `Unit ${v.unit} · ` : ''}${v ? vehicleName(v, { trim: true }) : 'Vehicle'}`, { f: bold }],
    v?.engine ? [v.engine] : null,
    [`VIN ${v?.vin || '—'}`, { f: mono, size: 9 }],
    [`${v?.plate ? `Plate ${v.plate} ${v.plateState || ''} · ` : ''}Mileage in ${order.mileageIn ? number(order.mileageIn) : '—'}${order.mileageOut ? ` / out ${number(order.mileageOut)}` : ''}`],
  ];
  const y1 = block(M, 'Customer', custLines);
  const y2 = block(M + colW + 24, 'Vehicle', vehLines);
  y = Math.min(y1, y2) - 6;
  rule(y);
  y -= 16;

  if (order.concern) {
    text('CUSTOMER CONCERN', M, y, { f: bold, size: 7.5, color: INK3 });
    y -= 13;
    para(order.concern, M, W - 2 * M, { size: 10, color: INK });
    y -= 4;
    rule(y);
    y -= 16;
  }

  // ---- Line items
  const cQty = W - M - 190;
  const cRate = W - M - 100;
  const cAmt = W - M;
  const head = () => {
    text('Description', M, y, { size: 8.5, color: INK3 });
    text('Qty/Hrs', cQty, y, { size: 8.5, color: INK3, align: 'right' });
    text('Rate', cRate, y, { size: 8.5, color: INK3, align: 'right' });
    text('Amount', cAmt, y, { size: 8.5, color: INK3, align: 'right' });
    y -= 6;
    rule(y);
    y -= 14;
  };
  head();
  for (const s of order.services.filter((x) => showDeclined || x.status !== 'declined')) {
    const declined = s.status === 'declined';
    const tone = declined ? INK3 : INK;
    ensure(30);
    const note = declined ? '  Declined — not included' : kind === 'estimate' && s.status === 'pending' ? '  Awaiting approval' : '';
    text(s.title, M, y, { f: bold, size: 10.5, color: tone, maxW: cQty - M - 60 - width(note, font, 8.5) });
    if (note) text(note, M + Math.min(width(s.title, bold, 10.5), cQty - M - 60 - width(note, font, 8.5)) + 2, y, { size: 8.5, color: INK3 });
    text(s.noCharge ? 'No charge' : money(serviceTotal(s)), cAmt, y, { f: bold, size: 10.5, color: tone, align: 'right' });
    y -= 14;
    for (const i of s.items) {
      ensure(13);
      const label = i.description || (i.type === 'labor' ? 'Labor' : 'Part');
      const pn = showParts && i.type === 'part' && i.partNumber ? `  ${[i.brand, i.partNumber].filter(Boolean).join(' ')}` : '';
      text(label, M + 10, y, { size: 9.5, color: declined ? INK3 : INK2, maxW: cQty - M - 70 - (pn ? Math.min(width(pn, mono, 8), 120) : 0) });
      if (pn) text(pn, M + 10 + Math.min(width(label, font, 9.5), cQty - M - 70 - Math.min(width(pn, mono, 8), 120)), y, { f: mono, size: 8, color: INK3, maxW: 120 });
      text(i.type === 'labor' ? Number(i.hours || 0).toFixed(1) : String(i.qty ?? ''), cQty, y, { size: 9.5, color: INK2, align: 'right' });
      text(money(i.type === 'labor' ? Number(i.rate) || 0 : Number(i.price) || 0), cRate, y, { size: 9.5, color: INK2, align: 'right' });
      text(money(itemTotal(i)), cAmt, y, { size: 9.5, color: INK2, align: 'right' });
      y -= 12.5;
    }
    if (s.cause) para(`Cause: ${s.cause}`, M + 10, cQty - M - 10, { size: 8.5, lead: 11.5 });
    if (s.correction) para(`Correction: ${s.correction}`, M + 10, cQty - M - 10, { size: 8.5, lead: 11.5 });
    y -= 6;
  }

  // ---- Totals
  const rows = [
    ['Labor', t.labor],
    ['Parts', t.parts],
    t.fees > 0 ? ['Fees', t.fees] : null,
    t.sublet > 0 ? ['Sublet', t.sublet] : null,
    t.supplies > 0 ? ['Shop supplies', t.supplies] : null,
    t.discount > 0 ? ['Discount', -t.discount] : null,
    [`Sales tax (${shop.taxRate}%)`, t.tax],
  ].filter(Boolean);
  ensure(rows.length * 13 + 70);
  rule(y + 4);
  y -= 10;
  const tx = W - M - 210;
  for (const [l, val] of rows) {
    text(l, tx, y, { size: 9.5, color: INK2 });
    text(money(val), cAmt, y, { size: 9.5, align: 'right' });
    y -= 13;
  }
  page.drawLine({ start: { x: tx, y: y + 6 }, end: { x: cAmt, y: y + 6 }, thickness: 0.75, color: LINE });
  y -= 8;
  text('Total', tx, y, { f: bold, size: 13 });
  text(money(t.total), cAmt, y, { f: bold, size: 13, align: 'right' });
  y -= 16;
  if (invoiceLike) {
    for (const p of order.payments || []) {
      ensure(13);
      text(`Paid ${date(p.at)} · ${p.method || 'Payment'}${p.last4 ? ` ••${p.last4}` : ''}`, tx, y, { size: 9, color: INK2, maxW: 150 });
      text(money(-(Number(p.amount) || 0)), cAmt, y, { size: 9, align: 'right' });
      y -= 12;
    }
    text('Balance due', tx, y, { f: bold, size: 11 });
    text(money(Math.max(0, t.balance)), cAmt, y, { f: bold, size: 11, align: 'right' });
    y -= 14;
    if (kind === 'receipt') {
      // A "Paid in full" stamp, in the shop's navy.
      const sw = width('PAID IN FULL', bold, 12) + 20;
      page.drawRectangle({ x: M, y: y + 18, width: sw, height: 22, borderColor: rgb(0.1, 0.5, 0.31), borderWidth: 1.5, color: rgb(1, 1, 1), opacity: 1 });
      text('PAID IN FULL', M + 10, y + 25, { f: bold, size: 12, color: rgb(0.1, 0.5, 0.31) });
    }
  }
  y -= 8;

  // ---- Inspection findings
  const flagged = Object.entries(order.inspection || {}).filter(([, r]) => r.rating === 'soon' || r.rating === 'now');
  if (flagged.length) {
    ensure(40);
    rule(y + 6);
    y -= 10;
    text('INSPECTION FINDINGS', M, y, { f: bold, size: 7.5, color: INK3 });
    y -= 13;
    for (const [key, r] of flagged) {
      ensure(12);
      const dot = r.rating === 'now' ? rgb(0.77, 0.19, 0.19) : rgb(0.67, 0.39, 0.02);
      page.drawCircle({ x: M + 3, y: y + 3, size: 2.6, color: dot });
      text(`${key.split('::')[1]} — ${INSPECTION_RATINGS[r.rating].short}${r.note ? `, ${r.note}` : ''}`, M + 12, y, { size: 9.5, color: INK2, maxW: W - 2 * M - 12 });
      y -= 12.5;
    }
    y -= 6;
  }

  // ---- Terms and signature
  ensure(60);
  rule(y + 4);
  y -= 12;
  if (invoiceLike && c?.account?.invoiceNote) para(c.account.invoiceNote, M, W - 2 * M, { f: bold, color: INK });
  const terms = invoiceLike ? shop.invoiceTerms : shop.estimateTerms;
  if (terms) para(terms, M, W - 2 * M, { size: 8.5, lead: 11.5 });
  if (shop.warranty) para(`Warranty: ${shop.warranty}.`, M, W - 2 * M, { size: 8.5, lead: 11.5 });
  if (!invoiceLike) {
    ensure(50);
    y -= 26;
    page.drawLine({ start: { x: M, y }, end: { x: W - M - 170, y }, thickness: 0.75, color: INK3 });
    page.drawLine({ start: { x: W - M - 140, y }, end: { x: W - M, y }, thickness: 0.75, color: INK3 });
    y -= 11;
    text('I authorize the repairs above and agree to the terms. Customer signature', M, y, { size: 8, color: INK2 });
    text('Date', W - M - 140, y, { size: 8, color: INK2 });
  }

  // ---- Page footers
  pages.forEach((p, i) => {
    const s = pdfSafe(`${shop.name} · ${TITLES[kind]} ${order.number} · Page ${i + 1} of ${pages.length}`);
    p.drawText(s, { x: (W - font.widthOfTextAtSize(s, 7.5)) / 2, y: 26, size: 7.5, font, color: INK3 });
  });

  const bytes = await doc.save();
  return { bytes, filename: docFilename(shop, order, kind), kind, title: TITLES[kind] };
}

/** Base64 of the PDF, for an email attachment. */
export const toBase64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

export function downloadPdf({ bytes, filename }) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
