#!/usr/bin/env node
/**
 * Assembles the GitHub Pages site:
 *   <base>          the marketing website for WPI Driveline Shop Management System (website/)
 *   <base>app/      the WPI Driveline Shop Management System staff app (Vite build)
 *
 * The website is checked first (website/scripts/check.mjs); any page error stops the build.
 *
 * GitHub Pages serves one 404.html for every missing path. It is the app shell, so deep links into
 * the app (e.g. <base>app/orders/123) load directly; a small script in front of it forwards pages of
 * the old shop website (LEGACY), links from before the app moved under app/ (APP_ROUTES) and /site,
 * and sends anything else to the website's not-found page. netlify.toml mirrors LEGACY as real 301s.
 *
 * Usage: node scripts/pages.mjs [base]   (default /automotive/)
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Top-level app routes that used to live at <base><route>. website/scripts/check.mjs reads this list:
// no website page or folder may use one of these names (hosts serve <name>.html for /<name>, which
// would shadow the forwarder), which is why the integrations page is works-with.html.
export const APP_ROUTES = ['orders', 'workflow', 'calendar', 'messages', 'marketing', 'tech', 'team', 'accounting', 'integrations', 'import', 'customers', 'vehicles', 'vin', 'catalog', 'parts', 'library', 'reports', 'settings', 'share', 'book'];

// Pages of the old shop website and where they live now. Patterns run against the path after the base,
// with or without .html; the first match wins, and they're checked before APP_ROUTES.
export const LEGACY = [
  ['^services/diagnostics(\\.html)?$', 'features/diagnosis.html'],
  ['^services/inspections(\\.html)?$', 'features/inspections.html'],
  ['^services(\\.html)?/?$', 'features.html'],
  ['^services/', 'features.html'],
  ['^(appointment|contact)(\\.html)?$', 'demo.html'],
  ['^fleet(\\.html)?$', 'features/fleet.html'],
  ['^(brands|resources)(\\.html)?$', 'features/diagnosis.html'],
  ['^specials(\\.html)?$', 'index.html'],
  ['^careers(\\.html)?$', 'about.html'],
];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || '/automotive/').replace(/\/?$/, '/');
const DIST = join(ROOT, 'dist');
const SITE = join(ROOT, 'website');

// Website source files that aren't part of the published site.
const SITE_SKIP = new Set(['scripts', 'partials', 'package.json', 'README.md', 'business.json', '404.html']);

const isMain = (() => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) build();

function build() {
  // Static checks on every page (links, ids, brand and honesty rules). Errors stop the build.
  execFileSync(process.execPath, [join(SITE, 'scripts', 'check.mjs')], { cwd: SITE, stdio: 'inherit' });

  rmSync(DIST, { recursive: true, force: true });
  execFileSync('npx', ['vite', 'build', `--base=${BASE}app/`, '--outDir', 'dist/app'], { cwd: ROOT, stdio: 'inherit' });

  const biz = JSON.parse(readFileSync(join(SITE, 'business.json'), 'utf8'));
  if ((biz.basePath || '/').replace(/\/?$/, '/') !== BASE) {
    throw new Error(`website/business.json basePath is "${biz.basePath}" but the site is being built for "${BASE}". Update it and run node website/scripts/sync.mjs.`);
  }
  cpSync(SITE, DIST, { recursive: true, filter: (src) => src === SITE || !SITE_SKIP.has(src.slice(SITE.length + 1).split(/[\\/]/)[0]) });
  cpSync(join(SITE, '404.html'), join(DIST, 'not-found.html'));

  const route = `^(${APP_ROUTES.join('|')})(\\/|$)`;
  const forward = `<script>
      // Forward pages of the old shop website and old app links (from before the app moved to app/),
      // and send unknown pages to the website.
      (function () {
        var b = ${JSON.stringify(BASE)}, p = location.pathname, q = location.search + location.hash;
        if (p.indexOf(b + 'app/') === 0) return;
        var r = p.indexOf(b) === 0 ? p.slice(b.length) : p.replace(/^\\//, '');
        var legacy = ${JSON.stringify(LEGACY)};
        for (var i = 0; i < legacy.length; i++) if (new RegExp(legacy[i][0]).test(r)) return location.replace(b + legacy[i][1]);
        if (new RegExp(${JSON.stringify(route)}).test(r)) location.replace(b + 'app/' + r + q);
        else if (/^site\\/?$/.test(r)) location.replace(b);
        else location.replace(b + 'not-found.html');
      })();
    </script>`;
  const shell = readFileSync(join(DIST, 'app', 'index.html'), 'utf8');
  if (!shell.includes('<head>')) throw new Error('dist/app/index.html has no <head>');
  writeFileSync(join(DIST, '404.html'), shell.replace('<head>', `<head>\n    ${forward}`));

  // The app's old service worker was registered for the whole site; replace it with one that removes itself.
  writeFileSync(
    join(DIST, 'sw.js'),
    `// The staff app now lives in app/ with its own service worker. This retires the old one registered at the site root.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => /^shell-|^runtime-v1$/.test(k)).map((k) => caches.delete(k))))
      .then(() => self.registration.unregister()),
  );
});
`,
  );

  for (const f of ['index.html', 'app/index.html', 'app/sw.js', '404.html', 'not-found.html', 'sw.js']) {
    if (!existsSync(join(DIST, f))) throw new Error(`missing dist/${f}`);
  }
  console.log(`pages: website at ${BASE}, app at ${BASE}app/`);
}
