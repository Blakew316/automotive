// Self-contained HTML copy of a customer report with photos and video embedded, for shops that
// don't use cloud sharing: email it, AirDrop it, or put it on a USB stick. Opens in any browser.
import { getFile } from './media';
import { money, date, dateTime, phone as fmtPhone, number } from './format';

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const RATING = { good: ['Good', '#1a9e5c'], soon: ['Needs attention soon', '#c27c0e'], now: ['Needs attention now', '#d63b30'] };

const toDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** Total bytes the export would embed (to warn before building a huge file). */
export function exportSize(order, includeVideo) {
  return (order.media || []).filter((m) => m.customer && (includeVideo || m.kind === 'image')).reduce((s, m) => s + (m.size || 0), 0);
}

export async function buildReportHtml(report, { includeVideo = true } = {}) {
  const data = new Map();
  for (const m of report.media) {
    if (m.kind === 'video' && !includeVideo) continue;
    const rec = await getFile(m.id);
    if (rec?.blob) data.set(m.id, await toDataUrl(rec.blob));
  }
  const media = (items) =>
    items.filter((m) => data.has(m.id)).length
      ? `<div class="grid">${items
          .filter((m) => data.has(m.id))
          .map(
            (m) =>
              `<figure>${m.kind === 'video' ? `<video controls playsinline preload="metadata" src="${data.get(m.id)}"></video>` : `<a href="#${esc(m.id)}"><img loading="lazy" src="${data.get(m.id)}" alt="${esc(m.caption)}"></a>`}${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}</figure>`,
          )
          .join('')}</div>`
      : '';
  // Full-screen views for photos via :target, no script needed.
  const zoom = report.media
    .filter((m) => m.kind === 'image' && data.has(m.id))
    .map((m) => `<a class="zoom" id="${esc(m.id)}" href="#_"><img src="${data.get(m.id)}" alt=""><span>${esc(m.caption)}</span></a>`)
    .join('');

  const { shop, vehicle, ro, totals } = report;
  const vName = vehicle ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') : 'Your vehicle';
  const byService = (id) => report.media.filter((m) => m.serviceId === id);
  const byInspection = (key) => report.media.filter((m) => m.inspectionKey === key && !m.serviceId);
  const general = report.media.filter((m) => !m.serviceId && !m.inspectionKey);
  const flagged = report.inspection.items.filter((i) => i.rating !== 'good');
  const good = report.inspection.items.filter((i) => i.rating === 'good');
  const label = (l) => esc(l.replace(/\s*\(.*\)$/, ''));
  const service = (s) => `
    <li${s.status === 'declined' ? ' class="declined"' : ''}>
      <div class="row"><div><strong>${esc(s.title)}</strong><div class="muted">${s.status === 'pending' ? 'Awaiting your approval' : s.status === 'declined' ? 'Declined' : s.done ? 'Completed' : 'Approved'}</div></div>${s.total != null ? `<strong>${money(s.total)}</strong>` : ''}</div>
      ${s.cause ? `<p><b>What we found:</b> ${esc(s.cause)}</p>` : ''}${s.correction ? `<p><b>What we did:</b> ${esc(s.correction)}</p>` : ''}
      ${media(byService(s.id))}
    </li>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(vName)} — RO #${esc(ro.number)} — ${esc(shop.name)}</title>
<style>
:root{color-scheme:light dark;--bg:#f5f5f7;--card:#fff;--ink:#1d1d1f;--ink2:#515154;--ink3:#86868b;--line:#e5e5ea}
@media (prefers-color-scheme:dark){:root{--bg:#000;--card:#1c1c1e;--ink:#f5f5f7;--ink2:#c7c7cc;--ink3:#8e8e93;--line:#38383a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:760px;margin:0 auto;padding:28px 16px 48px}h1{font-size:28px;letter-spacing:-.02em;margin:18px 0 4px}h2{font-size:15px;margin:0;padding:12px 16px;border-bottom:1px solid var(--line)}
.muted{color:var(--ink3);font-size:12.5px}.sub{color:var(--ink2);margin:0}.card{background:var(--card);border-radius:12px;margin:0 0 18px;overflow:hidden;box-shadow:0 0 0 .5px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.04)}
ul{list-style:none;margin:0;padding:0}li{padding:12px 16px;border-top:1px solid var(--line)}li:first-child{border-top:0}li p{margin:6px 0 0;color:var(--ink2);font-size:14px}.declined{opacity:.55}.declined strong{text-decoration:line-through}
.row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:10px}figure{margin:0}figure img,figure video{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;background:#0001;display:block}figcaption{font-size:12px;color:var(--ink2);margin-top:4px}
.zoom{display:none;position:fixed;inset:0;background:rgba(0,0,0,.94);z-index:9;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-decoration:none;padding:16px}.zoom:target{display:flex}.zoom img{max-width:100%;max-height:85vh;border-radius:6px}.zoom span{margin-top:10px;font-size:14px}
dl{margin:0;padding:12px 16px}dl div{display:flex;justify-content:space-between;padding:2px 0;color:var(--ink2)}dl .total{color:var(--ink);font-weight:600;font-size:16px}a.btn{display:inline-block;background:#0071e3;color:#fff;border-radius:8px;padding:8px 14px;text-decoration:none;font-weight:600;margin:4px 8px 4px 0}
footer{font-size:12px;color:var(--ink3);border-top:1px solid var(--line);padding-top:12px;margin-top:28px}
</style></head><body><main>
<div><strong>${esc(shop.name)}</strong><div class="muted">${esc([shop.address, [shop.city, shop.state].filter(Boolean).join(', '), shop.zip].filter(Boolean).join(' '))} · ${esc(fmtPhone(shop.phone))}</div></div>
<h1>${esc(vName)}</h1>
<p class="sub">${report.customer.firstName ? `Prepared for ${esc(report.customer.firstName)} · ` : ''}RO #${esc(ro.number)} · ${esc(date(ro.createdAt))}${vehicle?.mileage ? ` · ${number(vehicle.mileage)} mi` : ''} · <b>${esc(ro.statusLabel)}</b></p>
<p><a class="btn" href="tel:${esc(shop.phone.replace(/[^\d+]/g, ''))}">Call ${esc(fmtPhone(shop.phone))}</a></p>
${ro.concern ? `<section class="card"><h2>Your concern</h2><p style="padding:12px 16px;margin:0;color:var(--ink2)">${esc(ro.concern)}</p></section>` : ''}
${report.inspection.items.length ? `<section class="card"><h2>Vehicle inspection · ${report.inspection.items.length} point${report.inspection.items.length === 1 ? '' : 's'} checked</h2><ul>${flagged
    .map((i) => `<li><div><span class="dot" style="background:${RATING[i.rating][1]}"></span><strong>${label(i.label)}</strong> <span class="muted">${RATING[i.rating][0]}</span></div>${i.note ? `<p>${esc(i.note)}</p>` : ''}${media(byInspection(i.key))}</li>`)
    .join('')}${good.length ? `<li><div class="muted">In good condition: ${good.map((i) => label(i.label)).join(', ')}</div>${media(good.flatMap((i) => byInspection(i.key)))}</li>` : ''}</ul></section>` : ''}
${report.services.length ? `<section class="card"><h2>${['ready', 'closed'].includes(ro.status) ? 'Work performed' : 'Services'}</h2><ul>${report.services.map(service).join('')}</ul></section>` : ''}
${general.some((m) => data.has(m.id)) ? `<section class="card"><h2>Photos &amp; video</h2><div style="padding:0 16px 16px">${media(general)}</div></section>` : ''}
${totals ? `<section class="card"><h2>Summary</h2><dl><div><dt>Subtotal</dt><dd>${money(totals.subtotal)}</dd></div>${totals.discount > 0 ? `<div><dt>Discount</dt><dd>−${money(totals.discount)}</dd></div>` : ''}${totals.tax > 0 ? `<div><dt>Tax</dt><dd>${money(totals.tax)}</dd></div>` : ''}<div class="total"><dt>Total</dt><dd>${money(totals.total)}</dd></div>${totals.paid > 0 ? `<div><dt>Paid</dt><dd>${money(totals.paid)}</dd></div><div class="total"><dt>Balance due</dt><dd>${money(totals.balance)}</dd></div>` : ''}</dl></section>` : ''}
${report.notes.length ? `<section class="card"><h2>Notes from the shop</h2><ul>${report.notes.map((n) => `<li><div class="muted">${esc(dateTime(n.at))}</div><p style="margin-top:2px;color:var(--ink)">${esc(n.text)}</p></li>`).join('')}</ul></section>` : ''}
<footer>${shop.warranty ? `Warranty: ${esc(shop.warranty)}<br>` : ''}${vehicle?.vin ? `VIN ${esc(vehicle.vin)}<br>` : ''}${esc(shop.name)} · ${esc(fmtPhone(shop.phone))}${shop.email ? ` · ${esc(shop.email)}` : ''} · Report created ${esc(dateTime(report.generatedAt))}</footer>
</main>${zoom}</body></html>`;
}

export function downloadHtml(html, filename) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
