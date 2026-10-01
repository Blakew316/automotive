#!/usr/bin/env node
/**
 * check.mjs: static sanity checks for the standalone pages.
 *   node scripts/check.mjs            # all pages
 *   node scripts/check.mjs about.html # specific pages
 * Exits non-zero when any page has errors.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (JSON.parse(readFileSync(join(ROOT, "business.json"), "utf8")).basePath || "/").replace(/\/?$/, "/");
const REQUIRED_PARTIALS = ["head", "jsonld", "icons", "header", "footer", "tabbar"];
const BANNED = [/\bRPM\b/i, /Irwindale/i, /rpmautocenter/i, /lorem ipsum/i, /\bTODO\b/, /\{\{\w+\}\}/];

const listPages = () => {
  const out = [];
  for (const dir of ["", "services"]) {
    const abs = join(ROOT, dir);
    if (existsSync(abs)) for (const f of readdirSync(abs)) if (f.endsWith(".html")) out.push(join(dir, f));
  }
  return out.sort();
};

// Pages that make up the site. With --draft, links to planned pages that
// don't exist yet are tolerated (useful while pages are being built).
const services = JSON.parse(readFileSync(join(ROOT, "partials/services.json"), "utf8"));
const PLANNED = new Set([
  ...["index", "services", "about", "brands", "fleet", "specials", "resources", "faq", "contact", "appointment", "careers", "privacy", "404"].map((p) => `${p}.html`),
  ...services.map((s) => `services/${s.slug}.html`),
]);
const argv = process.argv.slice(2);
const DRAFT = argv.includes("--draft");
const args = argv.filter((a) => !a.startsWith("--")).map((a) => relative(ROOT, resolve(process.cwd(), a)));
const pages = args.length ? args : listPages();
let failed = 0;

for (const page of pages) {
  const errors = [];
  const warns = [];
  const html = readFileSync(join(ROOT, page), "utf8");
  const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");

  if (!/^<!doctype html>/i.test(html)) errors.push("missing <!doctype html>");
  if (!/<html lang="en">/.test(html)) errors.push('missing <html lang="en">');
  if (!/<meta name="viewport"/.test(html)) errors.push("missing viewport meta");
  if (!/<title>[^<]{10,}<\/title>/.test(html)) errors.push("missing/short <title>");
  if (!/<meta name="description" content="[^"]{50,}"/.test(html)) errors.push("missing/short meta description");
  if (!/<body[^>]*data-page="[\w-]+"/.test(html)) errors.push("body is missing data-page");
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
  if (title.replace(/&amp;/g, "&").length > 70) warns.push(`title is ${title.length} chars (aim for 70 or fewer)`);
  if (desc.replace(/&amp;/g, "&").length > 160) warns.push(`meta description is ${desc.length} chars (aim for 160 or fewer)`);
  for (const p of REQUIRED_PARTIALS) {
    if (!new RegExp(`<!-- @partial ${p} -->[\\s\\S]*?<!-- @end ${p} -->`).test(html)) errors.push(`missing partial ${p}`);
  }
  if (/<!-- @partial (\w+) -->\s*<!-- @end \1 -->/.test(html)) warns.push("empty partial markers: run node scripts/sync.mjs " + page);
  if (!/<main id="main"/.test(html)) errors.push('missing <main id="main">');

  const h1s = (text.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) errors.push(`expected exactly one <h1>, found ${h1s}`);

  // Duplicate ids
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) errors.push("duplicate ids: " + [...new Set(dup)].join(", "));

  // Images need alt
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\salt="/.test(m[0])) errors.push("img without alt: " + m[0].slice(0, 80));

  // Internal links + assets must resolve
  const base = dirname(join(ROOT, page));
  const refs = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|#|data:|javascript:|\/\/)/.test(ref)) continue;
    const clean = ref.split("#")[0].split("?")[0];
    if (!clean) continue;
    const target = clean.startsWith("/") ? join(ROOT, clean.startsWith(BASE) ? clean.slice(BASE.length) : clean) : join(base, clean);
    if (existsSync(target)) continue;
    const rel = relative(ROOT, target).replace(/\\/g, "/");
    if (DRAFT && PLANNED.has(rel)) continue;
    if (!errors.includes("broken link/asset: " + ref)) errors.push("broken link/asset: " + ref);
  }
  // In-page anchors
  for (const m of html.matchAll(/\shref="#([\w-]+)"/g)) if (m[1] !== "top" && !ids.includes(m[1])) errors.push("anchor to missing id: #" + m[1]);
  // <use href="#icon"> must exist in the sprite
  for (const m of html.matchAll(/<use href="#([\w-]+)"/g)) if (!ids.includes(m[1])) errors.push("missing icon/symbol: #" + m[1]);

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

  for (const re of BANNED) if (re.test(text)) errors.push("banned text: " + re);
  if (/—/.test(text.replace(/<!--[\s\S]*?-->/g, ""))) warns.push("contains an em dash (—); prefer commas or periods in copy");

  if (errors.length || warns.length) {
    console.log(`\n${page}`);
    errors.forEach((e) => console.log("  ✗ " + e));
    warns.forEach((w) => console.log("  ! " + w));
  }
  if (errors.length) failed++;
}
console.log(`\ncheck: ${pages.length} page(s), ${failed} with errors`);
process.exit(failed ? 1 : 0);
