#!/usr/bin/env node
/**
 * Assembles the GitHub Pages site:
 *   <base>          the shop's public website (website/)
 *   <base>app/      the WPI Driveline staff app (Vite build)
 *
 * GitHub Pages serves one 404.html for every missing path. It is the app shell, so deep links into
 * the app (e.g. <base>app/orders/123) load directly; a small script in front of it forwards links
 * from before the app moved under app/ and sends anything else to the website's not-found page.
 *
 * Usage: node scripts/pages.mjs [base]   (default /automotive/)
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || '/automotive/').replace(/\/?$/, '/');
const DIST = join(ROOT, 'dist');
const SITE = join(ROOT, 'website');

// Top-level app routes that used to live at <base><route>.
const APP_ROUTES = ['orders', 'workflow', 'calendar', 'messages', 'marketing', 'tech', 'team', 'accounting', 'integrations', 'import', 'customers', 'vehicles', 'vin', 'catalog', 'parts', 'library', 'reports', 'settings', 'share', 'book'];
// Website source files that aren't part of the published site.
const SITE_SKIP = new Set(['scripts', 'partials', 'package.json', 'README.md', 'business.json', '404.html']);

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
      // Forward old links (from before the app moved to app/) and send unknown pages to the website.
      (function () {
        var b = ${JSON.stringify(BASE)}, p = location.pathname, q = location.search + location.hash;
        if (p.indexOf(b + 'app/') === 0) return;
        var r = p.indexOf(b) === 0 ? p.slice(b.length) : p.replace(/^\\//, '');
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
