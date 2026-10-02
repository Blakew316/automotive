// Visual tour: every main screen in light, dark and phone size — fails on page errors, console
// errors or sideways scrolling on a phone; saves screenshots of the key screens.
import { launch, APP, OUT } from '../support/env.mjs';
const BASE = APP;
const SP = OUT;
const pages = ['/', '/workflow', '/orders', '/calendar', '/messages', '/marketing', '/marketing?tab=declined', '/marketing?tab=lapsed', '/marketing?tab=reviews', '/marketing?tab=campaigns', '/tech', '/team', '/team?tab=time', '/team?tab=pay', '/team?tab=people', '/parts?tab=orders', '/reports', '/reports?tab=techs', '/reports?tab=estimates', '/reports?tab=customers', '/accounting', '/accounting?tab=expenses', '/accounting?tab=deposits', '/accounting?tab=tax', '/accounting?tab=export', '/integrations', '/import', '/settings', '/settings?tab=payments', '/settings?tab=messaging', '/settings?tab=booking', '/customers', '/settings?tab=website', '/team?tab=access', '/reports?tab=goals', '/parts?tab=tires', '/parts?tab=inventory', '/book'];
const browser = await launch();
const errors = [];
for (const [mode, vp] of [['light', { width: 1440, height: 1000 }], ['dark', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, colorScheme: mode === 'dark' ? 'dark' : 'light', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${mode}] ${page.url()} pageerror: ${e.message}`));
  // Deep links are served by GitHub Pages' 404.html (the app shell), so only non-document failures count.
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`[${mode}] ${page.url()} console: ${m.text()}`));
  page.on('response', (r) => r.status() >= 400 && r.request().resourceType() !== 'document' && errors.push(`[${mode}] ${r.status()} ${r.url()}`));
  for (const p of pages) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    const name = `${mode}-${p.replace(/[^a-z0-9]+/gi, '_') || 'root'}.png`;
    if (mode === 'light' || ['/', '/tech', '/marketing', '/accounting', '/team', '/messages', '/calendar', '/integrations'].includes(p)) await page.screenshot({ path: `${SP}/shots/${name}`, fullPage: mode !== 'mobile' });
    // Horizontal overflow check on mobile.
    if (mode === 'mobile') {
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 2) errors.push(`[mobile] ${p} horizontal overflow ${over}px`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
if (errors.length) process.exit(1);
