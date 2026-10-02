// Two-step sign-in: set up an authenticator app (real TOTP codes), sign in with password + code,
// require it for a role, the setup prompt at sign-in, the owner resetting a lost phone, and the
// banner for someone already signed in when the rule changes.
import { launch, APP, OUT as SP } from '../support/env.mjs';
import { fakeCloud } from '../support/fakecloud.mjs';
import { totp } from '../support/totp.mjs';
const CLOUD = 'https://huwcrbkplpudpsfczbyg.supabase.co';
const SESSION = 'autoshop-pro:cloud-session';
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const errors = [];
const cloud = fakeCloud();
const owner = cloud.addUser('owner@shop.test', 'owner-pass-123', { autoshop_staff: true, autoshop_role: 'owner', autoshop_staff_id: 'staff-owner' }, { name: 'Shop owner' });
const advisor = cloud.addUser('advisor@shop.test', 'advisor-pass-123', { autoshop_staff: true, autoshop_role: 'advisor', autoshop_staff_id: 'staff-advisor' }, { name: 'Jordan Blake' });

async function device() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(CLOUD + '/**', (r) => cloud.handle(r));
  await ctx.routeWebSocket(/realtime/, (ws) => ws.close());
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|WebSocket|realtime|net::ERR/.test(m.text()) && errors.push(`console ${page.url()}: ${m.text()}`));
  return page;
}
const signIn = async (page, email, password) => {
  await page.goto(APP + '/signin');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
};
const saved = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), SESSION);

// ---- The owner turns it on.
const page = await device();
await signIn(page, 'owner@shop.test', 'owner-pass-123');
await page.waitForURL(/settings\?tab=cloud/);
await page.goto(APP + '/settings?tab=cloud#two-step');
const card = page.locator('#two-step');
await card.getByText('Off for your login').waitFor();
await card.getByRole('button', { name: 'Set up' }).click();
await card.getByText('Can’t scan? Type this key instead').click();
const secret = (await card.getByTestId('two-step-secret').innerText()).trim();
ok(/^[A-Z2-7]{16,}$/.test(secret), 'setup shows a QR code and the key to type in');
await card.getByLabel('6-digit code').fill(String((Number(totp(secret)) + 1) % 1e6).padStart(6, '0'));
await card.getByRole('button', { name: 'Turn on' }).click();
await card.getByText(/That code didn’t match/).waitFor();
ok(owner.factors[0].status === 'unverified', 'a wrong code doesn’t turn it on');
await card.getByLabel('6-digit code').fill(totp(secret));
await card.getByRole('button', { name: 'Turn on' }).click();
await card.getByText('On for your login').waitFor();
ok(owner.factors.filter((f) => f.status === 'verified').length === 1, 'the right code turns two-step sign-in on');
ok((await saved(page)).mfa === true, 'this device’s session already used the code');

// ---- An advisor signs in on their own device (two-step not required yet).
const adv = await device();
await signIn(adv, 'advisor@shop.test', 'advisor-pass-123');
await adv.waitForURL((u) => !u.pathname.endsWith('/signin'));
ok(!(await saved(adv)).mfa, 'advisor signs in with just a password while it’s optional');

// ---- Require it for service advisors.
await card.getByRole('switch', { name: 'Require two-step sign-in for Service advisors' }).click();
await page.getByText(/Service advisors must now use two-step sign-in/).first().waitFor();
ok(JSON.stringify(cloud.db.mfaRoles) === '["advisor"]', 'owner requires it for advisors');
await page.screenshot({ path: `${SP}/shots/two-step-settings.png`, fullPage: true });

// ---- The advisor's device, already signed in, is told to set it up.
await adv.reload();
await adv.getByText(/now requires two-step sign-in for your role/).waitFor();
await adv.getByRole('link', { name: 'Set it up' }).click();
await adv.getByRole('heading', { name: 'Set up two-step sign-in' }).waitFor();
await adv.screenshot({ path: `${SP}/shots/two-step-enroll.png` });
await adv.getByText('Can’t scan? Type this key instead').click();
let advSecret = (await adv.getByTestId('two-step-secret').innerText()).trim();
await adv.getByLabel('6-digit code').fill(totp(advSecret));
await adv.getByRole('button', { name: 'Turn on' }).click();
await adv.waitForURL((u) => !u.pathname.endsWith('/signin'));
ok(advisor.factors.some((f) => f.status === 'verified'), 'a signed-in advisor is sent to set it up, and does');

// ---- Signing in again: password, then the code. Nothing is saved before the code.
await page.evaluate((k) => localStorage.removeItem(k), SESSION);
await signIn(page, 'owner@shop.test', 'owner-pass-123');
await page.getByRole('heading', { name: 'Enter your code' }).waitFor();
ok((await saved(page)) === null, 'a password alone doesn’t sign this device in');
await page.getByLabel('6-digit code').fill('000000');
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByText(/That code didn’t match/).waitFor();
ok(true, 'wrong code refused');
await page.getByLabel('6-digit code').fill(totp(secret));
await page.getByRole('button', { name: 'Continue' }).click();
await page.waitForURL((u) => !u.pathname.endsWith('/signin'));
const s1 = await saved(page);
ok(s1 && JSON.parse(Buffer.from(s1.access.split('.')[1], 'base64url')).aal === 'aal2', 'with the code the device is signed in (aal2 session)');

// ---- Owner sees who uses it, and resets the advisor's lost phone.
await page.goto(APP + '/team?tab=access');
const row = page.getByRole('listitem').filter({ hasText: 'advisor@shop.test' });
await row.getByText('Two-step', { exact: true }).waitFor();
ok((await page.getByRole('listitem').filter({ hasText: 'owner@shop.test' }).getByText('Two-step', { exact: true }).count()) === 1, 'Staff & access shows who uses two-step sign-in');
await row.getByRole('button', { name: 'Reset two-step' }).click();
await page.getByText('Two-step sign-in reset for Jordan Blake').first().waitFor();
ok(!advisor.factors.length, 'owner resets it for someone who lost their phone');

// ---- On a new phone the advisor signs in and is asked to set it up again.
const adv2 = await device();
await signIn(adv2, 'advisor@shop.test', 'advisor-pass-123');
await adv2.getByRole('heading', { name: 'Set up two-step sign-in' }).waitFor();
ok((await adv2.getByText(/requires two-step sign-in for your role/).count()) === 1, 'at sign-in the advisor is told the shop requires it');
await adv2.getByText('Can’t scan? Type this key instead').click();
advSecret = (await adv2.getByTestId('two-step-secret').innerText()).trim();
await adv2.getByLabel('6-digit code').fill(totp(advSecret));
await adv2.getByRole('button', { name: 'Turn on' }).click();
await adv2.waitForURL((u) => !u.pathname.endsWith('/signin'));
ok(advisor.factors.some((f) => f.status === 'verified'), 'set up again on the new phone');

ok(errors.length === 0, `no page errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
await browser.close();
console.log('TWO-STEP PASS');
