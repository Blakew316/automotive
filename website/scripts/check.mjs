#!/usr/bin/env node
/**
 * check.mjs: static checks for the marketing pages (structure, links, accessibility basics,
 * brand and honesty rules). scripts/pages.mjs runs it before every build and fails on errors.
 *   node scripts/check.mjs              # all pages
 *   node scripts/check.mjs about.html   # specific pages
 *   node scripts/check.mjs --draft      # tolerate links to planned pages that don't exist yet
 *   node scripts/check.mjs --release    # launch gate: placeholder and owner-review warnings become errors
 * Exits non-zero when any page (or the site-wide checks) has errors.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(ROOT, "..");
const biz = JSON.parse(readFileSync(join(ROOT, "business.json"), "utf8"));
const BASE = (biz.basePath || "/").replace(/\/?$/, "/");
const NAME = biz.name;
const REQUIRED_PARTIALS = ["head", "jsonld", "icons", "header", "footer", "tabbar"];
// Folders that hold pages. A new website subfolder must be added here and in sync.mjs.
const PAGE_DIRS = ["", "features"];

// Leftover {{tokens}} are checked separately, over the whole page (scripts included).
const BANNED = [
  /\bRPM\b/i, /Irwindale/i, /rpmautocenter/i, /lorem ipsum/i, /\bTODO\b/,
  // The old local-shop site
  /Auto (&amp;|&|and) Small Engine/i, /small[- ]engine/i, /Staff sign-in/, /AutoShop Pro/, /appointment\.html/, /services\//, /demo shop/i,
  // Owner decisions that aren't made: no fee claims, no self-hosted Supabase path, no account-support topic
  /\badds? no (extra )?fees\b/i, /your own Supabase project/i, /Help with my account/i,
  // No social proof, superlatives or results claims
  /[★⭐]/, /testimonial/i, /\b(trusted|loved|used) by (over |more than )?(\d|hundreds|thousands|shops|techs|teams|owners)/i,
  /(#1|\bnumber one|\bindustry[- ]leading|\bbest[- ]in[- ]class)\b/i,
  /\b\d+(\.\d+)?%\s+(faster|more|less|fewer|higher|increase|growth|savings?)\b/i, /\buptime\b/i,
  // No trials, sign-ups or store badges
  /\bfree trial\b/i, /sign up (now|free|today|in)/i, /create (your|an) account/i,
  /(download|get it) on (the )?(App Store|Google Play)/i,
  /(SOC ?2|PCI(-DSS)?|HIPAA)[ -](certified|compliant|type)/i,
];
// Prices are banned outside example figures.
const PRICE = /\$\d[\d,.]*\s*(\/|per|a)\s*(mo|month|user|seat|tech|location|shop)\b/i;
// Example data from the sample shop may appear only inside a tagged .mock-figure or an "Example" roadmap.
const EXAMPLE_DATA = [
  [/\b(Priya|Raman|Avery|Thompson|Carlos|Mendoza|Elijah|Sofia|Castillo|Jordan Mitchell|Marcus Reed|Luis Ortega|Dana Whitfield|Kim Park|Okafor)\b/, "a sample-shop name"],
  [/\bRO\s?#?\s?\d{5}\b|#1\d{4}\b/, "an RO number"],
  [/\$\s?\d[\d,]*\.\d{2}\b/, "a dollar amount with cents"],
  [/\b(?=[A-HJ-NPR-Z0-9]{17}\b)(?=[A-HJ-NPR-Z0-9]*\d)(?=[A-HJ-NPR-Z0-9]*[A-HJ-NPR-Z])[A-HJ-NPR-Z0-9]{17}\b/, "a VIN"],
  [/\(217\) 555-01\d\d/, "a sample-shop phone number"],
  [/[\w.+-]+@[\w-]+(\.[\w-]+)*\.example\b/, "an example email address"],
];
// Inside example figures: never an RO number (they shift with the load date), phone numbers only as
// (217) 555-01xx, emails only on .example domains.
const MOCK_RO = /\bRO\s?#?\s?\d{4,6}\b|#1\d{4}\b/;
const PHONE = /\(?\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const ROLES = new Set(["owner", "manager", "advisor", "tech"]);
const THIRD_PARTIES = /\b(Stripe|Twilio|Resend|Intuit|QuickBooks|Smartcar|Anthropic|Claude|NHTSA|Supabase|Apple|Google|Microsoft|Shopmonkey|Tekmetric|Mitchell|ALLDATA|Shop-Ware|NAPA|RO Writer|CARFAX|Netlify|GitHub)\b/i;
const CSS_ANIM_KEYWORDS = new Set([
  "none", "infinite", "linear", "ease", "ease-in", "ease-out", "ease-in-out", "step-start", "step-end", "both", "forwards", "backwards",
  "normal", "reverse", "alternate", "alternate-reverse", "running", "paused", "initial", "inherit", "unset", "revert", "revert-layer", "auto",
]);

const listPages = () => {
  const out = [];
  for (const dir of PAGE_DIRS) {
    const abs = join(ROOT, dir);
    if (existsSync(abs)) for (const f of readdirSync(abs)) if (f.endsWith(".html")) out.push(join(dir, f).replace(/\\/g, "/"));
  }
  return out.sort();
};

const argv = process.argv.slice(2);
const DRAFT = argv.includes("--draft");
const RELEASE = argv.includes("--release");
const args = argv.filter((a) => !a.startsWith("--")).map((a) => relative(ROOT, resolve(process.cwd(), a)).replace(/\\/g, "/"));
const pages = args.length ? args : listPages();

/* ---------- site-wide data ---------- */
const siteErrors = [];
const siteWarns = [];
const releaseWarn = (msg) => (RELEASE ? siteErrors : siteWarns).push(msg);

let ia = { features: [], stages: [], pains: [], groups: [] };
try {
  ia = JSON.parse(readFileSync(join(ROOT, "partials/features.json"), "utf8"));
} catch (e) {
  siteErrors.push("partials/features.json is missing or not valid JSON: " + e.message);
}
const SLUGS = new Set((ia.features || []).map((f) => f.slug));
const bySlug = Object.fromEntries((ia.features || []).map((f) => [f.slug, f]));
const appPathRe = (biz.appPath || "app/").replace(/^\//, "").replace(/\/?$/, "/").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PLANNED = new Set([
  ...["index", "features", "mobile", "security", "works-with", "about", "faq", "demo", "privacy", "404"].map((p) => `${p}.html`),
  ...[...SLUGS].map((s) => `features/${s}.html`),
]);

// features.json consistency
{
  const groupIds = new Set((ia.groups || []).map((g) => g.id));
  for (const f of ia.features || []) {
    if (!f.slug || !f.title) siteErrors.push(`features.json: an entry is missing slug or title`);
    if ((f.short || "").length > 24) siteErrors.push(`features.json ${f.slug}: short "${f.short}" is ${f.short.length} chars (max 24)`);
    if ((f.line || "").length > 40) siteErrors.push(`features.json ${f.slug}: line "${f.line}" is ${f.line.length} chars (max 40)`);
    if (!groupIds.has(f.group)) siteErrors.push(`features.json ${f.slug}: unknown group "${f.group}"`);
    for (const r of f.related || []) if (!SLUGS.has(r)) siteErrors.push(`features.json ${f.slug}: related slug "${r}" doesn't exist`);
    if (!existsSync(join(ROOT, "features", `${f.slug}.html`)) && !DRAFT) siteErrors.push(`features.json ${f.slug}: features/${f.slug}.html doesn't exist`);
  }
  if (existsSync(join(ROOT, "features")))
    for (const file of readdirSync(join(ROOT, "features")))
      if (file.endsWith(".html") && !SLUGS.has(file.replace(/\.html$/, ""))) siteErrors.push(`features/${file} has no entry in partials/features.json`);
  for (const s of ia.stages || []) if (!SLUGS.has(s.feature)) siteErrors.push(`features.json stage "${s.id}": feature "${s.feature}" doesn't exist`);
  for (const p of ia.pains || []) for (const s of p.features || []) if (!SLUGS.has(s)) siteErrors.push(`features.json pain "${p.slug}": feature "${s}" doesn't exist`);
}

// No top-level page or folder may be named after an app route: hosts serve <name>.html for
// /automotive/<name>, which would shadow the 404 forwarder that sends old app links to app/.
const APP_ROUTES = (() => {
  try {
    const src = readFileSync(join(REPO, "scripts/pages.mjs"), "utf8");
    const m = src.match(/APP_ROUTES\s*=\s*\[([^\]]*)\]/);
    return m ? [...m[1].matchAll(/['"]([\w-]+)['"]/g)].map((x) => x[1]) : [];
  } catch {
    return [];
  }
})();
if (!APP_ROUTES.length) siteWarns.push("couldn't read APP_ROUTES from scripts/pages.mjs");
for (const r of APP_ROUTES) {
  if (existsSync(join(ROOT, `${r}.html`))) siteErrors.push(`${r}.html is named after the app route "${r}"; rename it (see the APP_ROUTE naming rule in README.md)`);
  if (existsSync(join(ROOT, r)) && statSync(join(ROOT, r)).isDirectory()) siteErrors.push(`${r}/ is named after the app route "${r}"`);
}

// business.json
if (/@([\w-]+\.)*(example\.(com|org|net)|[\w-]+\.example)$/i.test(biz.email || "")) siteErrors.push(`business.json email "${biz.email}" is an example address`);
if (!biz.email) releaseWarn("business.json email is blank (the footer and the demo form's mailto fallback stay hidden until it's set)");
if ((biz._placeholders || []).length) releaseWarn(`business.json still lists placeholders: ${biz._placeholders.join(", ")}`);

// Keyframes defined in the shared stylesheet
const SITE_CSS = existsSync(join(ROOT, "assets/css/site.css")) ? readFileSync(join(ROOT, "assets/css/site.css"), "utf8") : "";
const keyframesIn = (css) => new Set([...css.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)/g)].map((m) => m[1]));
const SHARED_KEYFRAMES = keyframesIn(SITE_CSS);
const animationNames = (css) => {
  const names = [];
  for (const m of css.matchAll(/(?:^|[;{\s"'])animation(?:-name)?\s*:\s*([^;}"]+)/g)) {
    let v = m[1];
    // Drop functions (var(), cubic-bezier(), steps(), calc()), including one level of nesting.
    for (let i = 0; i < 3; i++) v = v.replace(/[\w-]*\([^()]*\)/g, " ");
    for (const part of v.split(",")) for (const tok of part.trim().split(/\s+/)) {
      if (!tok || /^[\d.+-]/.test(tok) || CSS_ANIM_KEYWORDS.has(tok.toLowerCase()) || tok.startsWith("--") || tok.includes("!")) continue;
      if (/^[a-zA-Z_][\w-]*$/.test(tok)) names.push(tok);
    }
  }
  return names;
};
// site.css may only use keyframes that site.css (or, for page-scoped rules, some page) defines.
{
  const pageKeyframes = new Set();
  for (const p of listPages())
    for (const m of readFileSync(join(ROOT, p), "utf8").matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) for (const k of keyframesIn(m[1])) pageKeyframes.add(k);
  for (const name of new Set(animationNames(SITE_CSS.replace(/\/\*[\s\S]*?\*\//g, ""))))
    if (!SHARED_KEYFRAMES.has(name) && !pageKeyframes.has(name)) siteErrors.push(`site.css uses animation "${name}" but no @keyframes defines it`);
}

/* ---------- helpers ---------- */
// Cut every element whose opening tag matches `test` (nesting-aware for the same tag name).
const cutBlocks = (html, test) => {
  let out = "";
  let i = 0;
  const open = /<([a-z][a-z0-9]*)\b[^>]*>/gi;
  for (;;) {
    open.lastIndex = i;
    let m;
    while ((m = open.exec(html)) && !test(m[0])) {}
    if (!m) break;
    const tag = m[1].toLowerCase();
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
    re.lastIndex = m.index + m[0].length;
    let depth = 1;
    let t;
    while (depth && (t = re.exec(html))) depth += t[1] ? -1 : t[0].endsWith("/>") ? 0 : 1;
    out += html.slice(i, m.index);
    i = t ? t.index + t[0].length : html.length;
  }
  return out + html.slice(i);
};
const blocksOf = (html, test) => {
  const out = [];
  const open = /<([a-z][a-z0-9]*)\b[^>]*>/gi;
  let m;
  while ((m = open.exec(html))) {
    if (!test(m[0])) continue;
    const tag = m[1].toLowerCase();
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
    re.lastIndex = m.index + m[0].length;
    let depth = 1;
    let t;
    while (depth && (t = re.exec(html))) depth += t[1] ? -1 : t[0].endsWith("/>") ? 0 : 1;
    const end = t ? t.index + t[0].length : html.length;
    out.push(html.slice(m.index, end));
    open.lastIndex = end;
  }
  return out;
};
const hasClass = (tag, cls) => new RegExp(`\\sclass="[^"]*(?<![\\w-])${cls}(?![\\w-])[^"]*"`).test(tag);
const isMockFigure = (tag) => /^<figure\b/i.test(tag) && hasClass(tag, "mock-figure");
const isExampleRoadmap = (tag) => /\sclass="[^"]*(?<![\w-])roadmap(-steps)?(?![\w-])/.test(tag) && /\saria-label="[^"]*\bExample\b/i.test(tag);
const visibleText = (html) =>
  html.replace(/<[^>]*>/g, " ") +
  " " +
  [...html.matchAll(/\s(?:alt|aria-label|title|placeholder)="([^"]*)"/g)].map((m) => m[1]).join(" ");

/* ---------- pages ---------- */
let failed = 0;
for (const page of pages) {
  const errors = [];
  const warns = [];
  const file = join(ROOT, page);
  if (!existsSync(file)) {
    console.log(`\n${page}\n  ✗ file not found`);
    failed++;
    continue;
  }
  const html = readFileSync(file, "utf8");
  const noComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const text = noComments.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");

  if (!/^<!doctype html>/i.test(html)) errors.push("missing <!doctype html>");
  if (!/<html lang="en">/.test(html)) errors.push('missing <html lang="en">');
  if (!/<meta name="viewport"/.test(html)) errors.push("missing viewport meta");
  if (!/<title>[^<]{10,}<\/title>/.test(html)) errors.push("missing/short <title>");
  if (!/<meta name="description" content="[^"]{50,}"/.test(html)) errors.push("missing/short meta description");
  if (!/<body[^>]*data-page="[\w-]+"/.test(html)) errors.push("body is missing data-page");
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
  const plainTitle = title.replace(/&amp;/g, "&");
  if (!plainTitle.includes(NAME)) errors.push(`<title> must contain "${NAME}"`);
  if (plainTitle.length > 70) warns.push(`title is ${plainTitle.length} chars (aim for 70 or fewer)`);
  if (desc.replace(/&amp;/g, "&").length > 160) warns.push(`meta description is ${desc.length} chars (aim for 160 or fewer)`);
  for (const p of REQUIRED_PARTIALS) {
    if (!new RegExp(`<!-- @partial ${p} -->[\\s\\S]*?<!-- @end ${p} -->`).test(html)) errors.push(`missing partial ${p}`);
  }
  const OPTIONAL_EMPTY = new Set(["contact-email"]);
  for (const m of html.matchAll(/<!-- @partial ([\w-]+) -->\s*<!-- @end \1 -->/g))
    if (!OPTIONAL_EMPTY.has(m[1])) warns.push(`empty partial ${m[1]}: run node scripts/sync.mjs ${page}`);
  const hasCta = /<!-- @partial cta -->/.test(html);
  const noCta = /^(demo|privacy|404)\.html$/.test(page);
  if (hasCta && noCta) warns.push("the cta band is omitted on demo, privacy and 404");
  if (!hasCta && !noCta) warns.push("missing the cta partial (every page except demo, privacy and 404 ends with it)");
  if (page.startsWith("features/")) {
    for (const p of ["breadcrumbs", "related"]) if (!new RegExp(`<!-- @partial ${p} -->`).test(html)) warns.push(`feature page is missing the ${p} partial`);
    if (!/<body[^>]*data-page="features"/.test(html) || !/<body[^>]*data-tab="features"/.test(html)) errors.push('feature pages use <body data-page="features" data-tab="features">');
  }
  if (!/<main id="main"/.test(html)) errors.push('missing <main id="main">');

  const h1s = (text.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) errors.push(`expected exactly one <h1>, found ${h1s}`);

  // The header home link carries the full product name.
  const brand = (html.match(/<a class="brand"[^>]*>/) || [])[0];
  if (brand && !(brand.match(/aria-label="([^"]*)"/) || [])[1]?.includes(NAME)) errors.push(`the header .brand aria-label must contain "${NAME}"`);

  // Duplicate ids
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) errors.push("duplicate ids: " + [...new Set(dup)].join(", "));

  // Images need alt; third-party names stay out of alt text (names in text only, never logos).
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const alt = (m[0].match(/\salt="([^"]*)"/) || [])[1];
    if (alt == null) errors.push("img without alt: " + m[0].slice(0, 80));
    else if (THIRD_PARTIES.test(alt)) warns.push(`third-party name in an img alt ("${alt}"): providers appear as text, never logos`);
  }

  // Internal links + assets must resolve. Links into the app (app/ or basePath + app/) are fine.
  const base = dirname(file);
  const refs = [
    ...[...noComments.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1]),
    ...[...noComments.matchAll(/\ssrcset="([^"]+)"/g)].flatMap((m) => m[1].split(",").map((c) => c.trim().split(/\s+/)[0])),
    ...[...noComments.replace(/<script[\s\S]*?<\/script>/g, "").matchAll(/url\((["']?)([^)"']+)\1\)/g)].map((m) => m[2].trim()).filter((u) => !u.startsWith("#")),
  ];
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|#|data:|javascript:|\/\/)/.test(ref)) continue;
    const clean = ref.split("#")[0].split("?")[0];
    if (!clean) continue;
    const target = clean.startsWith("/") ? join(ROOT, clean.startsWith(BASE) ? clean.slice(BASE.length) : clean) : join(base, clean);
    const rel = relative(ROOT, target).replace(/\\/g, "/");
    if (rel === "app" || rel.startsWith("app/")) continue;
    if (existsSync(target)) continue;
    if (DRAFT && PLANNED.has(rel)) continue;
    if (!errors.includes("broken link/asset: " + ref)) errors.push("broken link/asset: " + ref);
  }
  // Every link into the app must opt out of prerendering (it would boot the app and seed the sample shop).
  for (const m of html.matchAll(/<a\b[^>]*\shref="([^"]+)"[^>]*>/g)) {
    const href = m[1];
    let rel = null;
    if (/^https?:/.test(href)) {
      const site = biz.siteUrl.replace(/\/$/, "");
      if (href.startsWith(site + "/")) rel = href.slice(site.length + 1);
    } else if (!/^(mailto:|tel:|#|data:|javascript:|\/\/)/.test(href)) {
      const clean = href.split("#")[0].split("?")[0];
      const target = clean.startsWith("/") ? join(ROOT, clean.startsWith(BASE) ? clean.slice(BASE.length) : clean) : join(base, clean);
      rel = relative(ROOT, target).replace(/\\/g, "/");
    }
    if (rel != null && (rel === "app" || rel.startsWith("app/")) && !/\sdata-no-prerender\b/.test(m[0])) errors.push(`app link without data-no-prerender: ${href}`);
  }
  // mailto links never point at example addresses
  for (const m of html.matchAll(/href="mailto:([^"?]*)/g))
    if (/@([\w-]+\.)*(example\.(com|org|net)|[\w-]+\.example)$/i.test(m[1])) errors.push(`mailto to an example address: ${m[1]}`);

  // Deep links: demo.html?interest=<feature slug> | ?topic=question, features.html?role=owner|manager|advisor|tech
  for (const m of noComments.matchAll(/\shref="([^"#]*?)(demo|features)\.html\?([^"#]*)/g)) {
    const q = new URLSearchParams(m[3].replace(/&amp;/g, "&"));
    if (m[2] === "demo" && q.has("interest") && !SLUGS.has(q.get("interest"))) errors.push(`demo.html?interest=${q.get("interest")} isn't a features.json slug`);
    if (m[2] === "demo" && q.has("topic") && q.get("topic") !== "question") errors.push(`demo.html?topic=${q.get("topic")}: the only topic deep link is ?topic=question`);
    if (m[2] === "features" && q.has("role") && !ROLES.has(q.get("role"))) errors.push(`features.html?role=${q.get("role")}: use owner, manager, advisor or tech`);
  }

  // The marketing site can't be saved as a lookalike app.
  if (/<link\b[^>]*\srel="manifest"/i.test(noComments)) errors.push("no web app manifest on the marketing site (remove <link rel=\"manifest\">)");
  if (/<meta\b[^>]*\sname="apple-mobile-web-app-title"/i.test(noComments)) errors.push("no apple-mobile-web-app-title on the marketing site");

  // Unknown or unfilled {{tokens}} anywhere, scripts included (sync fills every known token).
  for (const tok of new Set([...noComments.matchAll(/\{\{\s*[\w-]+\s*\}\}/g)].map((m) => m[0])))
    errors.push(`leftover token ${tok}: run node scripts/sync.mjs ${page}, or fix the name (unknown tokens are left in place)`);

  // In-page anchors
  for (const m of html.matchAll(/\shref="#([\w-]+)"/g)) if (m[1] !== "top" && !ids.includes(m[1])) errors.push("anchor to missing id: #" + m[1]);
  // <use href="#icon"> must exist in the sprite
  for (const m of html.matchAll(/<use href="#([\w-]+)"/g)) if (!ids.includes(m[1])) errors.push("missing icon/symbol: #" + m[1]);
  // url(#id) references (gradients, markers, clip paths) must exist
  for (const m of noComments.matchAll(/url\(#([\w-]+)\)/g)) if (!ids.includes(m[1])) errors.push(`url(#${m[1]}) points at a missing id`);
  for (const m of html.matchAll(/\smarker-(?:start|mid|end)="url\(#([\w-]+)\)"/g)) if (!ids.includes(m[1])) errors.push(`marker #${m[1]} is missing`);

  // aria-labelledby / aria-controls / aria-describedby / for= must point at ids
  for (const m of html.matchAll(/\s(?:aria-labelledby|aria-controls|aria-describedby|for)="([^"]+)"/g))
    for (const id of m[1].split(/\s+/)) if (!ids.includes(id)) errors.push(`reference to missing id "${id}"`);

  // Form controls need labels
  for (const m of html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const attrs = m[2];
    if (/type="(hidden|submit|button)"/.test(attrs) || /name="bot-field"/.test(attrs)) continue;
    const id = (attrs.match(/\sid="([^"]+)"/) || [])[1];
    const labelled = /aria-label(ledby)?=/.test(attrs) || (id && new RegExp(`for="${id}"`).test(html)) || /class="choice"/.test(html.slice(Math.max(0, m.index - 200), m.index));
    if (!labelled) errors.push(`form control without label: <${m[1]}${attrs.slice(0, 60)}>`);
  }

  // Example figures: tagged, and nothing interactive inside but the Replay button.
  const figures = blocksOf(noComments, isMockFigure);
  for (const fig of figures) {
    const head = fig.slice(0, 90).replace(/\s+/g, " ");
    if (!/<[^>]*\sclass="[^"]*(?<![\w-])mock-tag(?![\w-])[^"]*"[^>]*>[^<]*Example/.test(fig)) errors.push(`mock-figure without a visible .mock-tag "Example · sample shop": ${head}`);
    const inner = fig.replace(/^<figure\b[^>]*>/, "");
    if (/<(h[1-6]|a|input|select|textarea)\b/i.test(inner)) errors.push(`mock-figure contains a heading, link or form control (use spans/divs): ${head}`);
    for (const b of inner.matchAll(/<button\b[^>]*>/gi)) if (!hasClass(b[0], "mock-replay")) errors.push(`mock-figure contains a button other than .mock-replay: ${head}`);
    if (/<figure\b/i.test(inner)) errors.push(`mock-figures never nest: ${head}`);
    const figText = visibleText(fig);
    const ro = figText.match(MOCK_RO);
    if (ro) errors.push(`mock-figure prints an RO number ("${ro[0]}"); RO numbers shift with the load date, so identify jobs by vehicle and name`);
    for (const p of figText.matchAll(PHONE)) if (!/^\(217\) 555-01\d\d$/.test(p[0])) errors.push(`mock-figure phone "${p[0]}": use (217) 555-01xx only`);
    for (const e of figText.matchAll(EMAIL)) if (!/\.example$/i.test(e[0])) errors.push(`mock-figure email "${e[0]}": use a .example domain only`);
  }
  // Example data outside tagged figures and "Example" roadmaps
  const outside = cutBlocks(cutBlocks(text, isMockFigure), isExampleRoadmap);
  const outsideText = visibleText(outside.replace(/<title>[\s\S]*?<\/title>/, "")).replace(/Main Street Auto Service/g, "");
  for (const [re, what] of EXAMPLE_DATA) {
    const m = outsideText.match(re);
    if (m) errors.push(`example data (${what}: "${m[0]}") outside a tagged .mock-figure or an "Example" roadmap`);
  }

  // Structured data: product JSON-LD only; FAQPage only on faq.html; never offers, ratings or reviews.
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      errors.push("JSON-LD that isn't valid JSON");
      continue;
    }
    const s = JSON.stringify(data);
    if (/"FAQPage"/.test(s) && page !== "faq.html") errors.push("FAQPage JSON-LD belongs on faq.html only");
    if (/"(offers|aggregateRating|review|reviews)"\s*:/.test(s)) errors.push("JSON-LD must not include offers, aggregateRating or review");
    if (/"AutoRepair"|"LocalBusiness"/.test(s)) errors.push("JSON-LD still describes a local repair shop");
  }

  // Keyframes referenced by the page must exist somewhere.
  const pageCss = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
  const styleAttrs = [...html.matchAll(/\sstyle="([^"]*)"/g)].map((m) => m[1]).join(";");
  const known = new Set([...SHARED_KEYFRAMES, ...keyframesIn(pageCss)]);
  for (const name of new Set(animationNames(pageCss + "\n" + styleAttrs))) if (!known.has(name)) errors.push(`animation "${name}" has no @keyframes in site.css or this page`);

  // View-transition names: unique per page (a duplicate cancels the transition). The only static ft-* name is
  // ft-<slug> on that feature page's hero icon tile; listing pages set theirs from site.js on pageswap.
  const slug = (page.match(/^features\/([\w-]+)\.html$/) || [])[1];
  {
    const inline = [...noComments.matchAll(/\sstyle="[^"]*view-transition-name\s*:\s*([\w-]+)/g)].map((m) => m[1]).filter((n) => n !== "none");
    const dupVt = inline.filter((n, i) => inline.indexOf(n) !== i);
    if (dupVt.length) errors.push("duplicate view-transition-name: " + [...new Set(dupVt)].join(", "));
    const ft = [...new Set([...inline, ...[...pageCss.matchAll(/view-transition-name\s*:\s*(ft-[\w-]+)/g)].map((m) => m[1])].filter((n) => n.startsWith("ft-")))];
    for (const n of ft) if (n !== `ft-${slug}`) errors.push(`view-transition-name ${n} belongs only on features/${n.slice(3)}.html's hero icon tile`);
  }

  // The feature page template (README "The feature page template"); warnings while a page is being built.
  if (slug && bySlug[slug]) {
    const f = bySlug[slug];
    const missing = [];
    for (const id of ["hero", "needs", "faq", "related"]) if (!ids.includes(id)) missing.push(`#${id}`);
    if (ids.includes("needs") && !/Good to know/.test(text)) missing.push(`the "Good to know" callout`);
    if (!new RegExp(`\\shref="[^"]*demo\\.html\\?interest=${slug}"`).test(html)) missing.push(`"Request a demo" → ../demo.html?interest=${slug}`);
    if (!new RegExp(`\\shref="(\\.\\./)+${appPathRe}${f.appRoute}"[^>]*data-no-prerender`).test(html)) missing.push(`"${f.demoLabel}" → {{appLink}}${f.appRoute}`);
    if (!new RegExp(`view-transition-name\\s*:\\s*ft-${slug}\\b`).test(noComments)) missing.push(`the hero icon tile's view-transition-name: ft-${slug}`);
    if (missing.length) warns.push("feature page template is missing: " + missing.join("; "));
  }

  // Inbox-driven features land on the shop's signed-in devices; never "by itself" / "before you open".
  {
    const m = visibleText(text).match(/\bby itself\b|\bbefore you (even )?open\b/i);
    if (m) warns.push(`"${m[0]}": inbox-driven features are applied when a signed-in device is open (about every minute); say that instead`);
  }
  // Blue #1F7AE0 and green #2DB36A are for fills and strokes, never text (status text uses --accent / --green-ink).
  if (/(^|[^-\w])color\s*:\s*(#1F7AE0|#2DB36A|var\(--(blue|green)\))/i.test(pageCss + ";" + styleAttrs))
    warns.push("color: blue/green (#1F7AE0, #2DB36A) fails AA as text; use --accent or --green-ink (fine for an icon stroked with currentColor)");

  for (const re of BANNED) {
    const m = text.match(re);
    if (m) errors.push(`banned text ${re}: "${m[0]}"`);
  }
  {
    const m = cutBlocks(text, isMockFigure).match(PRICE);
    if (m) errors.push(`banned price "${m[0]}" (no prices outside example figures)`);
  }
  if (/—/.test(text)) warns.push("contains an em dash (—); prefer commas or periods in copy");

  // Every Shop Cloud mention in the page body links its definition.
  const bodyText = visibleText((text.match(/<body[\s\S]*$/) || [""])[0]);
  if (/Shop Cloud/.test(bodyText) && page !== "works-with.html" && !/href="[^"]*works-with\.html#shop-cloud"/.test(html))
    warns.push("mentions Shop Cloud without a link to works-with.html#shop-cloud");
  if (page === "works-with.html" && /Shop Cloud/.test(bodyText) && !ids.includes("shop-cloud")) errors.push("works-with.html must define Shop Cloud at #shop-cloud");

  // Owner-review markers: warnings now, errors at release.
  const review = (html.match(/\sdata-owner-review\b/g) || []).length;
  if (review) (RELEASE ? errors : warns).push(`${review} [data-owner-review] section(s) still need the owner's sign-off`);

  if (errors.length || warns.length) {
    console.log(`\n${page}`);
    errors.forEach((e) => console.log("  ✗ " + e));
    warns.forEach((w) => console.log("  ! " + w));
  }
  if (errors.length) failed++;
}

if (siteErrors.length || siteWarns.length) {
  console.log("\nsite");
  siteErrors.forEach((e) => console.log("  ✗ " + e));
  siteWarns.forEach((w) => console.log("  ! " + w));
}
console.log(`\ncheck: ${pages.length} page(s), ${failed} with errors${siteErrors.length ? `, ${siteErrors.length} site-wide error(s)` : ""}${RELEASE ? " (release)" : ""}`);
process.exit(failed || siteErrors.length ? 1 : 0);
