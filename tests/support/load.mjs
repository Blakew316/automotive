// Load an app module (which uses Vite-style extensionless imports) in Node by bundling it first.
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OUT } from './env.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));

export async function loadSrc(path) {
  const dir = join(OUT, 'bundles');
  mkdirSync(dir, { recursive: true });
  const outfile = join(dir, `${path.replace(/[^\w]+/g, '_')}.mjs`);
  await build({ entryPoints: [join(REPO, path)], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'error' });
  return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
}
