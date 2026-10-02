#!/usr/bin/env node
/**
 * sync.mjs: keeps every standalone page in step with the shared partials
 * and the shop details in business.json.
 *
 * Each page is a complete HTML document. Shared regions are marked like:
 *   <!-- @partial header --> ...generated... <!-- @end header -->
 * and are regenerated from partials/<name>.html. Shop details inside page
 * content are marked with data-biz="key" (text) or data-biz-href="key" (links).
 *
 * Usage:
 *   node scripts/sync.mjs              # every page + sitemap.xml/robots.txt
 *   node scripts/sync.mjs about.html   # only the pages you name
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const biz = JSON.parse(readFileSync(join(ROOT, "business.json"), "utf8"));
const services = JSON.parse(readFileSync(join(ROOT, "partials/services.json"), "utf8"));
const partial = (name) => readFileSync(join(ROOT, "partials", `${name}.html`), "utf8").trimEnd();

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* ---------- hours ---------- */
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const DAY_SHORT = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun" };
const DAY_LONG = { Mo: "Monday", Tu: "Tuesday", We: "Wednesday", Th: "Thursday", Fr: "Friday", Sa: "Saturday", Su: "Sunday" };
const fmtTime = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}\u00a0${ampm}`;
};
const dayHours = Object.fromEntries(DAYS.map((d) => [d, null]));
for (const g of biz.hours) for (const d of g.days) dayHours[d] = { opens: g.opens, closes: g.closes };
const dayLabel = (d) => (dayHours[d] ? `${fmtTime(dayHours[d].opens)} – ${fmtTime(dayHours[d].closes)}` : "Closed");
const groups = [];
for (const d of DAYS) {
  const label = dayLabel(d);
  const last = groups[groups.length - 1];
  if (last && last.label === label) last.days.push(d);
  else groups.push({ label, days: [d] });
}
const groupName = (days) => (days.length === 1 ? DAY_SHORT[days[0]] : `${DAY_SHORT[days[0]]} – ${DAY_SHORT[days.at(-1)]}`);
const hoursList = groups
  .map((g) => `        <li data-days="${g.days.join(" ")}"><span>${groupName(g.days)}</span><span>${g.label}</span></li>`)
  .join("\n");
const hoursRows = DAYS.map(
  (d) => `      <tr data-day="${d}"><th scope="row">${DAY_LONG[d]}</th><td>${dayLabel(d)}</td></tr>`
).join("\n");
const hoursShort = groups
  .filter((g) => g.label !== "Closed")
  .map((g) => `${groupName(g.days).replace(" – ", "–")} ${g.label.replace(" – ", "–")}`)
  .join(" · ");

/* ---------- generated lists ---------- */
const svcHref = (s) => `{{root}}services/${s.slug}.html`;
const servicesMega = services
  .map(
    (s) =>
      `              <a class="mega-item" href="${svcHref(s)}"><span class="icon-tile icon-tile-sm"><svg class="icon" aria-hidden="true"><use href="#${s.icon}"/></svg></span><span class="mega-text"><strong>${esc(s.title)}</strong><small>${esc(s.blurb)}</small></span></a>`
  )
  .join("\n");
const servicesSheet = services
  .map((s) => `      <li><a href="${svcHref(s)}"><svg class="icon" aria-hidden="true"><use href="#${s.icon}"/></svg>${esc(s.title)}<svg class="icon chev" aria-hidden="true"><use href="#i-chevron-right"/></svg></a></li>`)
  .join("\n");
const servicesFooter = services.map((s) => `        <li><a href="${svcHref(s)}">${esc(s.title)}</a></li>`).join("\n");

const cityLine = `${biz.city}, ${biz.region} ${biz.postalCode}`.trim();
const site = biz.siteUrl.replace(/\/$/, "");

const jsonld = () => {
  const data = {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    name: biz.name,
    description: "Complete auto care and small engine repair: maintenance, diagnostics, brakes, engines, A/C, tires and more.",
    url: site + "/",
    image: site + "/assets/img/og-image.png",
    logo: site + "/assets/img/icon-512.png",
    telephone: biz.phoneE164,
    email: biz.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: biz.street,
      addressLocality: biz.city,
      addressRegion: biz.region,
      postalCode: biz.postalCode,
      addressCountry: biz.country,
    },
    openingHoursSpecification: biz.hours.map((g) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: g.days.map((d) => DAY_LONG[d]),
      opens: g.opens,
      closes: g.closes,
    })),
  };
  if (biz.timeZone) data.additionalProperty = { "@type": "PropertyValue", name: "timeZone", value: biz.timeZone };
  const sameAs = Object.values(biz.social || {}).filter(Boolean);
  if (sameAs.length) data.sameAs = sameAs;
  return `<script type="application/ld+json" id="business-data">${JSON.stringify(data)}</script>`;
};

/* ---------- pages ---------- */
const listPages = () => {
  const out = [];
  for (const dir of ["", "services"]) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) if (f.endsWith(".html")) out.push(join(dir, f));
  }
  return out.sort();
};

const tokens = (page) => {
  const depth = page.split("/").length - 1;
  // 404.html is served at arbitrary URLs, so it uses root-absolute paths (under basePath).
  const root = page === "404.html" ? (biz.basePath || "/").replace(/\/?$/, "/") : "../".repeat(depth);
  const path = page.replace(/\\/g, "/");
  const canonical = path === "index.html" ? `${site}/` : `${site}/${path}`;
  return {
    root,
    canonical,
    name: esc(biz.name),
    shortName: esc(biz.shortName || biz.name),
    phone: esc(biz.phone),
    tel: esc(biz.phoneE164),
    email: esc(biz.email),
    street: esc(biz.street),
    cityLine: esc(cityLine),
    mapsUrl: esc(biz.mapsUrl),
    siteUrl: esc(site),
    formEndpoint: esc(biz.formEndpoint || ""),
    inboxUrl: esc(biz.shopInbox?.url || ""),
    inboxKey: esc(biz.shopInbox?.key || ""),
    staffLink: biz.staffAppUrl ? `<span aria-hidden="true">&middot;</span><a href="${esc(biz.staffAppUrl)}">Staff sign-in</a>` : "",
    year: String(new Date().getFullYear()),
    servicesMega,
    servicesSheet,
    servicesFooter,
    hoursList,
    hoursRows,
    hoursShort: esc(hoursShort),
  };
};

const fill = (tpl, t) => {
  // Two passes so generated lists can themselves contain {{root}}.
  const once = (s) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in t ? t[k] : m));
  return once(once(tpl));
};

const PARTIALS = {
  head: () => partial("head") + `\n<link rel="canonical" href="{{canonical}}">\n<meta property="og:url" content="{{canonical}}">\n<meta property="og:site_name" content="{{name}}">\n<meta property="og:type" content="website">\n<meta property="og:image" content="{{siteUrl}}/assets/img/og-image.png">\n<meta name="twitter:card" content="summary_large_image">`,
  icons: () => partial("icons"),
  header: () => partial("header"),
  tabbar: () => partial("tabbar"),
  cta: () => partial("cta"),
  footer: () => partial("footer"),
  jsonld: () => jsonld(),
  "hours-table": () => `<table class="hours-table">\n  <caption class="visually-hidden">Shop hours</caption>\n  <tbody>\n{{hoursRows}}\n  </tbody>\n</table>`,
};

const markActive = (html, navKey, tabKey, pagePath, root) => {
  const here = pagePath.replace(/\\/g, "/");
  const cur = (href) => (href.replace(/^(\.\.\/)+/, "").replace(root, "") === here ? "page" : "true");
  // Header links get the sliding pill; tab bar + sheet links get aria-current.
  html = html.replace(/<a class="nav-link" href="([^"]+)" data-nav="([\w-]+)">/g, (m, href, key) =>
    key === navKey ? `<a class="nav-link is-active" href="${href}" data-nav="${key}" aria-current="${cur(href)}"><span class="nav-pill" aria-hidden="true"></span>` : m
  );
  html = html.replace(/<a class="(tab[^"]*)" href="([^"]+)" data-nav="([\w-]+)">/g, (m, cls, href, key) =>
    key === tabKey ? `<a class="${cls} is-active" href="${href}" data-nav="${key}" aria-current="${cur(href)}">` : m
  );
  html = html.replace(/<a href="([^"]+)" data-nav="([\w-]+)">/g, (m, href, key) =>
    key === navKey ? `<a class="is-active" href="${href}" data-nav="${key}" aria-current="${cur(href)}">` : m
  );
  html = html.replace(/<a class="btn btn-primary btn-sm header-book" href="([^"]+)" data-nav="([\w-]+)">/g, (m, href, key) =>
    key === navKey ? `<a class="btn btn-primary btn-sm header-book is-active" href="${href}" data-nav="${key}" aria-current="page">` : m
  );
  return html;
};

// Any remaining link to the current page (mega menu, sheet list, footer) gets aria-current="page".
const markCurrentLinks = (html, pagePath) => {
  const here = pagePath.replace(/\\/g, "/");
  const dir = here.includes("/") ? here.slice(0, here.lastIndexOf("/") + 1) : "";
  return html.replace(/<a\b([^>]*?)\bhref="([^"#?]+)"([^>]*)>/g, (m, pre, href, post) => {
    if (/aria-current=/.test(pre + post) || /^(https?:|mailto:|tel:|\/)/.test(href)) return m;
    const parts = (dir + href).split("/");
    const out = [];
    for (const seg of parts) seg === ".." ? out.pop() : out.push(seg);
    return out.join("/") === here ? `<a${pre}href="${href}"${post} aria-current="page">` : m;
  });
};

const BIZ_TEXT = (t) => ({
  name: t.name,
  phone: t.phone,
  email: t.email,
  street: t.street,
  cityLine: t.cityLine,
  address: `${t.street}, ${t.cityLine}`,
  addressLines: `${t.street}<br>${t.cityLine}`,
  hoursShort: t.hoursShort,
});
const BIZ_HREF = (t) => ({ tel: `tel:${t.tel}`, mailto: `mailto:${t.email}`, maps: t.mapsUrl });

const syncPage = (page) => {
  const file = join(ROOT, page);
  const src = readFileSync(file, "utf8");
  const t = tokens(page);
  const navKey = (src.match(/<body[^>]*\bdata-page="([\w-]+)"/) || [])[1] || "";
  const tabKey = (src.match(/<body[^>]*\bdata-tab="([\w-]+)"/) || [])[1] || navKey;

  let out = src.replace(/<!-- @partial ([\w-]+) -->[\s\S]*?<!-- @end \1 -->/g, (m, name) => {
    if (!PARTIALS[name]) throw new Error(`${page}: unknown partial "${name}"`);
    let body = fill(PARTIALS[name](), t);
    if (name === "header" || name === "tabbar") body = markActive(body, navKey, tabKey, page, t.root);
    if (["header", "tabbar", "footer"].includes(name)) body = markCurrentLinks(body, page);
    return `<!-- @partial ${name} -->\n${body}\n<!-- @end ${name} -->`;
  });

  const text = BIZ_TEXT(t);
  out = out.replace(/(<([a-z][a-z0-9]*)\b[^>]*\bdata-biz="([\w-]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g, (m, open, tag, key, inner, close) =>
    key in text ? `${open}${text[key]}${close}` : m
  );
  const href = BIZ_HREF(t);
  out = out.replace(/<a\b[^>]*\bdata-biz-href="([\w-]+)"[^>]*>/g, (tag, key) =>
    key in href ? tag.replace(/\bhref="[^"]*"/, `href="${href[key]}"`) : tag
  );
  // Plain {{root}} tokens may be used inside page content for convenience.
  out = out.replace(/\{\{root\}\}/g, t.root);

  if (out !== src) {
    writeFileSync(file, out);
    return true;
  }
  return false;
};

const args = process.argv.slice(2).map((a) => relative(ROOT, join(process.cwd(), a)));
const pages = args.length ? args : listPages();
let changed = 0;
for (const p of pages) if (syncPage(p)) changed++;
console.log(`sync: ${pages.length} page(s) checked, ${changed} updated`);

if (!args.length) {
  const urls = listPages()
    .filter((p) => !/^(404|privacy)\.html$/.test(p))
    .map((p) => (p === "index.html" ? `${site}/` : `${site}/${p}`));
  writeFileSync(
    join(ROOT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`
  );
  writeFileSync(join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
  console.log(`sync: sitemap.xml (${urls.length} urls) and robots.txt written`);
}
