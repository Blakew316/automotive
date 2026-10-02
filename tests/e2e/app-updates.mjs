// A deploy reaches staff without anyone closing the app: an open app (a Home Screen app on iPhone
// resumes instead of reloading) that comes back on screen reloads into the newer version, and stays
// put while nothing new has been published.
import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, APP } from '../support/env.mjs';
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };

const DIST = join(fileURLToPath(new URL('../..', import.meta.url)), 'dist', 'app');
const INDEX = join(DIST, 'index.html');
const shell = readFileSync(INDEX, 'utf8');
const main = shell.match(/<script type="module"[^>]*\ssrc="[^"]*\/assets\/([^"]+\.js)"/)?.[1];
ok(Boolean(main), `built app shell loads ${main}`);

const browser = await launch();
const page = await browser.newPage();
const comeBack = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
const running = () => page.evaluate(() => document.querySelector('script[type="module"][src]').getAttribute('src'));
let loads = 0;
page.on('load', () => loads++);
const copy = main.replace(/\.js$/, '-next.js');
try {
  await page.goto(APP + '/', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  const before = loads;
  await comeBack();
  await page.waitForTimeout(800);
  ok(loads === before, 'coming back with nothing new published: no reload');

  // Publish a "new version": same code under a new file name, as a deploy would.
  copyFileSync(join(DIST, 'assets', main), join(DIST, 'assets', copy));
  writeFileSync(INDEX, shell.replace(`/assets/${main}`, `/assets/${copy}`));
  await Promise.all([page.waitForEvent('load'), comeBack()]);
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  ok((await running()).endsWith(copy), 'coming back after a deploy: reloads into the new version');

  const after = loads;
  await comeBack();
  await page.waitForTimeout(800);
  ok(loads === after, 'and then stays put');
} finally {
  writeFileSync(INDEX, shell);
  rmSync(join(DIST, 'assets', copy), { force: true });
  await browser.close();
}
