// Load an app module (which uses Vite-style extensionless imports) in Node by bundling it first.
// loadSrc(path, { edition: 'small-engine' }) bundles it as the Small Engine Edition build would
// (VITE_EDITION set), into its own file so both editions can load side by side.
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OUT } from './env.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));

export async function loadSrc(path, { edition } = {}) {
  const dir = join(OUT, 'bundles');
  mkdirSync(dir, { recursive: true });
  const se = edition === 'small-engine';
  const outfile = join(dir, `${path.replace(/[^\w]+/g, '_')}${se ? '.small-engine' : ''}.mjs`);
  const define = se ? { 'import.meta.env': JSON.stringify({ VITE_EDITION: 'small-engine' }) } : undefined;
  await build({ entryPoints: [join(REPO, path)], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'error', ...(define ? { define } : {}) });
  return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
}
