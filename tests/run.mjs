// Test runner.
//   node tests/run.mjs                 unit + server-function tests, then every browser suite
//   node tests/run.mjs --unit          fast tests of app logic (no build needed)
//   node tests/run.mjs --functions     the Supabase Edge Functions, with every outside service mocked
//   node tests/run.mjs --e2e [names…]  browser suites against the built site (npm run build:pages first)
//   node tests/run.mjs --e2e --shard 2/4   one quarter of the browser suites (CI runs four at once)
// Screenshots, downloads and logs go to test-results/ (TEST_OUT to change it).
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT, ROOT, OUT } from './support/env.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO = join(HERE, '..');
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const shardArg = args[args.indexOf('--shard') + 1];
const named = args.filter((a) => !a.startsWith('--') && a !== shardArg);
const list = (dir) => readdirSync(join(HERE, dir)).filter((f) => f.endsWith('.mjs')).map((f) => ({ group: dir, name: f.replace(/\.mjs$/, ''), file: join(HERE, dir, f) })).sort((a, b) => a.name.localeCompare(b.name));

const all = !flag('--unit') && !flag('--functions') && !flag('--e2e');
let suites = [];
if (all || flag('--unit')) suites.push(...list('unit'));
if (all || flag('--functions')) suites.push(...list('functions'));
if (all || flag('--e2e')) {
  let e2e = list('e2e');
  if (named.length) e2e = e2e.filter((s) => named.includes(s.name));
  if (shardArg && flag('--shard')) {
    const [i, n] = shardArg.split('/').map(Number);
    e2e = e2e.filter((_, k) => k % n === i - 1);
  }
  suites.push(...e2e);
}

const up = async () => {
  try {
    const r = await fetch(`${ROOT}app/`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
};
let server = null;
async function ensureServer() {
  if (await up()) return;
  if (!existsSync(join(REPO, 'dist', 'app', 'index.html'))) {
    console.error('No build found — run `npm run build:pages` first.');
    process.exit(2);
  }
  server = spawn(process.execPath, [join(HERE, 'support', 'pages-server.mjs'), join(REPO, 'dist'), String(PORT)], { stdio: 'ignore', detached: false });
  for (let i = 0; i < 50 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
}

function run(s) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [s.file], { cwd: REPO, env: { ...process.env, TEST_OUT: OUT } });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), 8 * 60_000);
    child.on('close', (code) => {
      clearTimeout(timer);
      writeFileSync(join(OUT, `${s.group}-${s.name}.log`), out);
      resolve({ ...s, ok: code === 0, out, secs: Math.round((Date.now() - started) / 1000), checks: (out.match(/^ok\b/gm) || []).length });
    });
  });
}

const results = [];
for (const s of suites) {
  if (s.group === 'e2e') await ensureServer();
  const r = await run(s);
  results.push(r);
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${s.group}/${s.name}  (${r.checks} checks, ${r.secs}s)`);
  if (!r.ok) console.log(r.out.split('\n').slice(-15).map((l) => `      ${l}`).join('\n'));
}
server?.kill();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? ` — failed: ${failed.map((r) => r.name).join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
