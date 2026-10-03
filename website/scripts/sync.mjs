#!/usr/bin/env node
/**
 * sync.mjs: keeps every standalone page in step with the shared partials, business.json and
 * partials/features.json.
 *
 * Each page is a complete HTML document. Shared regions are marked like:
 *   <!-- @partial header --> ...generated... <!-- @end header -->
 * and are regenerated on every run, from partials/<name>.html or from a generator below
 * (jsonld, breadcrumbs, related, featuresCards, featuresDirectory, finderChips, finderData,
 * featuresInterests, contact-email). An unknown partial name throws.
 *
 * Tokens such as {{root}}, {{name}}, {{appLink}} or {{signInLink}} are filled in the partials and
 * in page content alike. An unknown token is left in place, and check.mjs fails on it.
 *
 * Usage:
 *   node scripts/sync.mjs                    # every page + sitemap.xml/robots.txt
 *   node scripts/sync.mjs about.html         # only the pages you name
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Folders that hold pages. A new website subfolder must be added here and in check.mjs.
const PAGE_DIRS = ["", "features"];

const biz = JSON.parse(readFileSync(join(ROOT, "business.json"), "utf8"));
const ia = JSON.parse(readFileSync(join(ROOT, "partials/features.json"), "utf8"));
const partial = (name) => readFileSync(join(ROOT, "partials", `${name}.html`), "utf8").trimEnd();

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// Display text for card titles, kickers and blurbs: a hyphenated word ("check-in", "one-tap") is wrapped in
// span.nowrap so it never splits across lines at its hyphen. (Not U+2011: the Inter subset has no glyph for
// it, so it would fall back to another font.) JSON-LD, meta, finder data and labels keep plain text.
const nbh = (s) => esc(s).replace(/\p{L}+(?:-\p{L}+)+/gu, (w) => `<span class="nowrap">${w}</span>`);
const icon = (id, cls = "icon") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
const arrow = icon("i-arrow-right");

const site = biz.siteUrl.replace(/\/$/, "");
const basePath = (biz.basePath || "/").replace(/\/?$/, "/");
const appPath = (biz.appPath || "app/").replace(/^\//, "").replace(/\/?$/, "/");
const signInPath = (biz.signInPath || "app/signin").replace(/^\//, "");
const features = ia.features;
const bySlug = Object.fromEntries(features.map((f) => [f.slug, f]));
const featureHref = (slug) => `{{root}}features/${slug}.html`;

/* ---------- generated lists (header mega menu, More sheet, footer) ---------- */
const featuresMega = ia.groups
  .map((g) => {
    const items = features
      .filter((f) => f.group === g.id)
      .map(
        (f) =>
          `                <a class="mega-item" href="${featureHref(f.slug)}"><span class="icon-tile icon-tile-sm">${icon(f.icon)}</span><span class="mega-text"><strong>${esc(f.short)}</strong><small>${esc(f.line)}</small></span></a>`
      )
      .join("\n");
    return `              <div class="mega-col">\n                <p class="mega-label">${esc(g.title)}</p>\n${items}\n              </div>`;
  })
  .join("\n");
const featuresSheet = features
  .map((f) => `      <li><a href="${featureHref(f.slug)}">${icon(f.icon)}${esc(f.short)}${icon("i-chevron-right", "icon chev")}</a></li>`)
  .join("\n");
const featuresFooter = features.map((f) => `        <li><a href="${featureHref(f.slug)}">${esc(f.short)}</a></li>`).join("\n");

const motionToggle =
  `<button class="motion-toggle" type="button" aria-pressed="false">${icon("i-pause", "icon mt-pause")}${icon("i-play", "icon mt-play")}<span class="motion-toggle-label">Pause animations</span></button>`;

// Footer "Talk to us": a mailto and/or tel link when business.json has them, else the demo form.
const contactRow = () => {
  const rows = [];
  if (biz.email) rows.push(`<a class="footer-contact" href="mailto:${esc(biz.email)}">${icon("i-mail")}<span>${esc(biz.email)}</span></a>`);
  if (biz.phone && biz.phoneE164) rows.push(`<a class="footer-contact" href="tel:${esc(biz.phoneE164)}">${icon("i-phone")}<span>${esc(biz.phone)}</span></a>`);
  if (!rows.length) rows.push(`<a class="footer-contact" href="{{root}}demo.html?topic=question">${icon("i-chat")}<span>Use the demo form</span></a>`);
  return `      <p class="footer-talk">\n${rows.map((r) => `        ${r}`).join("\n")}\n      </p>`;
};

// The header lockup: logo.svg inlined (so it paints with the page), decorative, without its <title>.
const logoInline = () => {
  const svg = readFileSync(join(ROOT, "assets/img/logo.svg"), "utf8")
    .replace(/<\?xml[^>]*\?>\s*/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<title>[\s\S]*?<\/title>/g, "")
    .trim();
  return svg.replace(/^<svg\b([^>]*)>/, (m, attrs) => {
    const viewBox = (attrs.match(/\sviewBox="([^"]+)"/) || [])[1] || "-81 -190 653 361";
    const [, , w, h] = viewBox.split(/\s+/).map(Number);
    const height = 46;
    const width = Math.round((w / h) * height);
    return `<svg class="brand-logo" viewBox="${viewBox}" width="${width}" height="${height}" aria-hidden="true" focusable="false">`;
  });
};

// "Shop Cloud" in generated copy always links its definition.
const cloudLink = (text) => esc(text).replace(/Shop Cloud/g, `<a href="{{root}}works-with.html#shop-cloud">Shop Cloud</a>`);
const needsLine = (needs) => {
  const optional = /^Optional:\s*/i.test(needs);
  const body = needs.replace(/^Optional:\s*/i, "");
  const text = /^Nothing extra/i.test(body) ? body.charAt(0).toLowerCase() + body.slice(1) : body;
  return `<strong>${optional ? "Optional:" : "Needs:"}</strong> ${cloudLink(text)}`;
};

/* ---------- generated partials (built from features.json and page context) ---------- */
const featureCard = (f, indent) =>
  [
    `${indent}<a class="card card-link feature-card" href="${featureHref(f.slug)}">`,
    `${indent}  <span class="icon-tile">${icon(f.icon)}</span>`,
    `${indent}  <h3>${nbh(f.title)}</h3>`,
    `${indent}  <p>${nbh(f.blurb)}</p>`,
    `${indent}  <span class="link-arrow">Learn more ${arrow}</span>`,
    `${indent}</a>`,
  ].join("\n");

const featuresCards = () =>
  [
    `<div class="grid grid-3" data-reveal-stagger>`,
    ...features.map((f) => featureCard(f, "  ")),
    `  <a class="card card-link feature-card card-soft" href="{{root}}features.html">`,
    `    <span class="icon-tile">${icon("i-grid")}</span>`,
    `    <h3>See every feature</h3>`,
    `    <p>All twelve parts in the order a car meets them, with what each one needs.</p>`,
    `    <span class="link-arrow">All features ${arrow}</span>`,
    `  </a>`,
    `</div>`,
  ].join("\n");

const featureSlugOf = (page) => (page.match(/^features\/([\w-]+)\.html$/) || [])[1];

const breadcrumbs = (page) => {
  const f = bySlug[featureSlugOf(page)];
  if (!f) throw new Error(`${page}: the breadcrumbs partial is only for features/<slug>.html pages listed in features.json`);
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${site}/` },
      { "@type": "ListItem", position: 2, name: "Features", item: `${site}/features.html` },
      { "@type": "ListItem", position: 3, name: f.title, item: `${site}/features/${f.slug}.html` },
    ],
  };
  return [
    `<nav class="breadcrumb" aria-label="Breadcrumb">`,
    `  <ol>`,
    `    <li><a href="{{root}}index.html">Home</a></li>`,
    `    <li><a href="{{root}}features.html">Features</a></li>`,
    `    <li><span aria-current="page">${esc(f.title)}</span></li>`,
    `  </ol>`,
    `</nav>`,
    `<script type="application/ld+json">${JSON.stringify(data)}</script>`,
  ].join("\n");
};

const related = (page) => {
  const f = bySlug[featureSlugOf(page)];
  if (!f) throw new Error(`${page}: the related partial is only for features/<slug>.html pages listed in features.json`);
  return [`<div class="grid grid-3 related" data-related data-reveal-stagger>`, ...f.related.map((s) => featureCard(bySlug[s], "  ")), `</div>`].join("\n");
};

const roleAttr = (roles) => (roles || []).join(" ");
// A link label and its arrow wrap as one run (the arrow stays on the last word): see .dir-card-foot.
const footLink = (href, label, iconId, extra = "") =>
  `<a class="link-arrow" href="${href}"${extra}><span>${label}&nbsp;${icon(iconId)}</span></a>`;
const dirCard = (f, span) => {
  const cls = ["card", "dir-card", f.featured ? "is-feature" : "", span ? "is-span" : ""].filter(Boolean).join(" ");
  return [
    `          <article class="${cls}" id="dir-${f.slug}" data-slug="${f.slug}" data-roles="${roleAttr(f.roles)}">`,
    `            <div class="dir-card-head">`,
    `              <span class="icon-tile">${icon(f.icon)}</span>`,
    `              <div><h4>${nbh(f.title)}</h4><p class="dir-card-kicker">${nbh(f.line)}</p></div>`,
    `            </div>`,
    `            <p>${nbh(f.blurb)}</p>`,
    `            <p class="dir-card-needs">${icon("i-info")}<span>${needsLine(f.needs)}</span></p>`,
    f.note ? `            <p class="dir-card-note">${esc(f.note)}</p>` : "",
    `            <div class="dir-card-foot">`,
    `              ${footLink(featureHref(f.slug), `Learn more<span class="visually-hidden"> about ${esc(f.title)}</span>`, "i-arrow-right")}`,
    `              ${footLink(`{{appLink}}${esc(f.appRoute)}`, esc(f.demoLabel), "i-arrow-up-right", " data-no-prerender")}`,
    `            </div>`,
    `          </article>`,
  ]
    .filter(Boolean)
    .join("\n");
};
const everywhereCard = (item, span) =>
  [
    `          <article class="card dir-card${span ? " is-span" : ""}">`,
    `            <div class="dir-card-head">`,
    `              <span class="icon-tile">${icon(item.icon)}</span>`,
    `              <div><h4>${nbh(item.title)}</h4></div>`,
    `            </div>`,
    `            <p>${cloudLink(item.blurb)}</p>`,
    `            <div class="dir-card-foot">`,
    `              ${footLink(`{{root}}${esc(item.href)}`, `Learn more<span class="visually-hidden"> about ${esc(item.title)}</span>`, "i-arrow-right")}`,
    `            </div>`,
    `          </article>`,
  ].join("\n");

// Which cards sit alone at the end of a two-column row (a featured card always takes a whole row);
// those get .is-span and take the row too. site.js redoes this after the role filter.
const loneCards = (wide) => {
  let col = 0;
  return wide.map((isWide, i) => {
    const alone = !isWide && col === 0 && (i === wide.length - 1 || wide[i + 1]);
    col = isWide || alone ? 0 : 1 - col;
    return alone;
  });
};
const featuresDirectory = () => {
  const groups = [
    ...ia.groups.map((g) => {
      const list = features.filter((f) => f.group === g.id);
      const span = loneCards(list.map((f) => Boolean(f.featured)));
      return { ...g, cards: list.map((f, i) => dirCard(f, span[i])) };
    }),
    (() => {
      const span = loneCards(ia.everywhere.items.map(() => false));
      return { ...ia.everywhere, cards: ia.everywhere.items.map((item, i) => everywhereCard(item, span[i])) };
    })(),
  ];
  const nav = groups
    .map((g) => `      <li><a href="#grp-${g.id}">${icon(g.icon)}${esc(g.title)}<span class="count">${g.cards.length}</span></a></li>`)
    .join("\n");
  const sections = groups
    .map((g) =>
      [
        `    <section class="dir-group" id="grp-${g.id}" aria-labelledby="grp-${g.id}-title">`,
        `      <div class="dir-group-head" data-reveal>`,
        `        <span class="icon-tile icon-tile-sm">${icon(g.icon)}</span>`,
        `        <div>`,
        `          <h3 id="grp-${g.id}-title">${esc(g.title)}</h3>`,
        `          <p>${esc(g.line)}</p>`,
        `        </div>`,
        `      </div>`,
        `      <div class="dir-cards" data-reveal-stagger>`,
        ...g.cards,
        `      </div>`,
        `    </section>`,
      ].join("\n")
    )
    .join("\n");
  return [
    `<div class="dir">`,
    `  <nav class="dir-nav" aria-label="Feature groups" data-dir-nav>`,
    `    <p class="dir-nav-label">Jump to</p>`,
    `    <ol>`,
    nav,
    `      <li class="dir-nav-pill" aria-hidden="true"></li>`,
    `    </ol>`,
    `  </nav>`,
    `  <div class="dir-groups">`,
    sections,
    `  </div>`,
    `</div>`,
  ].join("\n");
};

// Role chips for the directory (features.html): button[data-role] that site.js wires to .dir-card[data-roles].
const roleChips = () =>
  [
    `<div class="role-chips" role="group" aria-label="Show features for">`,
    ...ia.roles.map((r) => `  <button class="role-chip" type="button" data-role="${r.id}" aria-pressed="${r.id === "all"}">${esc(r.label)}</button>`),
    `</div>`,
  ].join("\n");

// Pain chips for the bottleneck finder (features.html #finder), one per features.json pains[].
const finderChips = () =>
  [
    `<div class="finder-chips" role="group" aria-label="What&rsquo;s slowing your shop down?" data-reveal-stagger="fade">`,
    ...ia.pains.map(
      (p) =>
        `  <button class="finder-chip" type="button" data-pain="${p.slug}" aria-pressed="false">${icon(bySlug[p.features[0]].icon, "icon i-off")}${icon("i-check", "icon i-on")}${esc(p.label)}</button>`
    ),
    `</div>`,
  ].join("\n");

// The finder's pain → feature map. JSON inside <script>, so "<" is escaped.
const finderData = (page, t) => {
  const data = {
    pains: ia.pains.map((p) => ({ slug: p.slug, label: p.label, features: p.features })),
    features: features.map((f) => ({ slug: f.slug, title: f.title, short: f.short, icon: f.icon, href: `${t.root}features/${f.slug}.html` })),
  };
  return `<script type="application/json" id="finder-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
};

// The demo form's "What to see" cards: one checkbox per feature, valued and titled with its title.
const featuresInterests = () =>
  [
    `<div class="choice-grid interest-grid">`,
    ...features.map(
      (f) =>
        `  <label class="choice"><input type="checkbox" name="interests" value="${esc(f.title)}" data-slug="${f.slug}" data-title="${esc(f.title)}" data-label="Interested in"><span class="choice-card">${icon(f.icon)}<span class="choice-text"><span class="choice-name">${esc(f.title)}</span><small>${esc(f.line)}</small></span></span></label>`
    ),
    `</div>`,
  ].join("\n");

// A mailto link when business.json has an email; nothing otherwise (the demo form's error fallback looks for it).
const contactEmail = () => (biz.email ? `<a class="contact-email" href="mailto:${esc(biz.email)}">${icon("i-mail")}<span>${esc(biz.email)}</span></a>` : "");

const jsonld = () => {
  const org = {
    "@type": "Organization",
    "@id": `${site}/#org`,
    name: biz.company || biz.shortName || biz.name,
    url: `${site}/`,
    logo: `${site}/assets/img/icon-512.png`,
  };
  if (biz.email) org.email = biz.email;
  const sameAs = Object.values(biz.social || {}).filter(Boolean);
  if (sameAs.length) org.sameAs = sameAs;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      org,
      {
        "@type": "SoftwareApplication",
        "@id": `${site}/#app`,
        name: biz.name,
        alternateName: biz.shortName,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Auto repair shop management",
        operatingSystem: "Web browser; installs on iPhone, iPad, Android, Mac and PC",
        description: biz.description,
        url: `${site}/${appPath}`,
        image: `${site}/assets/img/og-image.png`,
        publisher: { "@id": `${site}/#org` },
        featureList: features.map((f) => f.title),
        softwareHelp: { "@type": "WebPage", url: `${site}/faq.html` },
      },
      { "@type": "WebSite", "@id": `${site}/#website`, name: biz.name, url: `${site}/`, publisher: { "@id": `${site}/#org` } },
    ],
  };
  return `<script type="application/ld+json" id="product-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
};

/* ---------- pages ---------- */
const listPages = () => {
  const out = [];
  for (const dir of PAGE_DIRS) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) if (f.endsWith(".html")) out.push(join(dir, f).replace(/\\/g, "/"));
  }
  return out.sort();
};

const attr = (s) => String(s).replace(/"/g, "&quot;");

const tokens = (page, src) => {
  const depth = page.split("/").length - 1;
  // 404.html is served at arbitrary URLs, so it uses root-absolute paths (under basePath).
  const root = page === "404.html" ? basePath : "../".repeat(depth);
  // 404.html is published as not-found.html (scripts/pages.mjs); the site's 404.html is the app's forwarder.
  const canonical = page === "index.html" ? `${site}/` : page === "404.html" ? `${site}/not-found.html` : `${site}/${page}`;
  const title = ((src.match(/<title>([^<]*)<\/title>/) || [])[1] || biz.name).trim();
  const description = ((src.match(/<meta name="description" content="([^"]*)"/) || [])[1] || biz.description).trim();
  return {
    root,
    canonical,
    pageTitle: attr(title),
    pageDescription: attr(description),
    name: esc(biz.name),
    shortName: esc(biz.shortName || biz.name),
    company: esc(biz.company || biz.shortName || biz.name),
    tagline: esc(biz.tagline || ""),
    description: esc(biz.description || ""),
    email: esc(biz.email || ""),
    phone: esc(biz.phone || ""),
    tel: esc(biz.phoneE164 || ""),
    siteUrl: esc(site),
    basePath: esc(basePath),
    formEndpoint: esc(biz.formEndpoint || ""),
    inboxUrl: esc(biz.shopInbox?.url || ""),
    inboxKey: esc(biz.shopInbox?.key || ""),
    year: String(new Date().getFullYear()),
    appLink: `${root}${appPath}`,
    signInLink: `<a href="${root}${signInPath}" data-no-prerender>Sign in</a>`,
    logoInline: logoInline(),
    motionToggle,
    contactRow: contactRow(),
    featuresMega,
    featuresSheet,
    featuresFooter,
  };
};

const fill = (tpl, t) => {
  // Two passes so generated lists can themselves contain {{root}}.
  const once = (s) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in t ? t[k] : m));
  return once(once(tpl));
};

const HEAD_EXTRA = [
  `<link rel="canonical" href="{{canonical}}">`,
  `<meta property="og:type" content="website">`,
  `<meta property="og:site_name" content="{{name}}">`,
  `<meta property="og:title" content="{{pageTitle}}">`,
  `<meta property="og:description" content="{{pageDescription}}">`,
  `<meta property="og:url" content="{{canonical}}">`,
  `<meta property="og:image" content="{{siteUrl}}/assets/img/og-image.png">`,
  `<meta property="og:image:width" content="1200">`,
  `<meta property="og:image:height" content="630">`,
  `<meta property="og:image:alt" content="{{name}} logo">`,
  `<meta name="twitter:card" content="summary_large_image">`,
].join("\n");

const PARTIALS = {
  head: () => partial("head") + "\n" + HEAD_EXTRA,
  icons: () => partial("icons"),
  header: () => partial("header"),
  tabbar: () => partial("tabbar"),
  cta: () => partial("cta"),
  footer: () => partial("footer"),
  jsonld,
  breadcrumbs,
  related,
  featuresCards,
  featuresDirectory,
  roleChips,
  finderChips,
  finderData,
  featuresInterests,
  "contact-email": contactEmail,
};

// Which header/tab entry a page lights up. Feature pages are "features"; works-with.html is "integrations".
const navKeys = (page, src) => {
  let navKey = (src.match(/<body[^>]*\bdata-page="([\w-]+)"/) || [])[1] || "";
  let tabKey = (src.match(/<body[^>]*\bdata-tab="([\w-]+)"/) || [])[1] || "";
  if (page.startsWith("features/")) navKey = tabKey = "features";
  if (page === "works-with.html") navKey = "integrations";
  return { navKey, tabKey: tabKey || navKey };
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

const syncPage = (page) => {
  const file = join(ROOT, page);
  const src = readFileSync(file, "utf8");
  const t = tokens(page, src);
  const { navKey, tabKey } = navKeys(page, src);

  let out = src.replace(/<!-- @partial ([\w-]+) -->[\s\S]*?<!-- @end \1 -->/g, (m, name) => {
    if (!PARTIALS[name]) throw new Error(`${page}: unknown partial "${name}"`);
    let body = fill(PARTIALS[name](page, t), t);
    if (name === "header" || name === "tabbar") body = markActive(body, navKey, tabKey, page, t.root);
    if (["header", "tabbar", "footer"].includes(name)) body = markCurrentLinks(body, page);
    return `<!-- @partial ${name} -->\n${body}\n<!-- @end ${name} -->`;
  });
  // Every known token may be used in page content too ({{root}}, {{appLink}}, {{signInLink}}, {{name}} ...).
  out = fill(out, t);

  if (out !== src) {
    writeFileSync(file, out);
    return true;
  }
  return false;
};

const args = process.argv.slice(2).map((a) => relative(ROOT, join(process.cwd(), a)).replace(/\\/g, "/"));
const pages = args.length ? args : listPages();
let changed = 0;
for (const p of pages) if (syncPage(p)) changed++;
console.log(`sync: ${pages.length} page(s) checked, ${changed} updated`);

if (!args.length) {
  const urls = listPages()
    .filter((p) => !/^(404|privacy)\.html$/.test(p))
    .sort((a, b) => (a === "index.html" ? -1 : b === "index.html" ? 1 : 0))
    .map((p) => (p === "index.html" ? `${site}/` : `${site}/${p}`));
  writeFileSync(
    join(ROOT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`
  );
  writeFileSync(join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
  console.log(`sync: sitemap.xml (${urls.length} urls) and robots.txt written`);
}
