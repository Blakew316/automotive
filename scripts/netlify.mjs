#!/usr/bin/env node
/**
 * Lays out the Netlify site exactly like GitHub Pages, from the dist/ that scripts/pages.mjs built:
 *   /automotive/        the marketing website for WPI Driveline Shop Management System
 *   /automotive/app/    the WPI Driveline Shop Management System staff app
 * The pages are built for that folder (website/business.json basePath), so they go inside it; the
 * bare domain forwards there (netlify.toml), and 404.html sits at the root, where Netlify looks for it.
 * netlify.toml also 301s the old shop website's pages (services, appointment, contact, fleet, ...) to
 * their new homes, mirroring the LEGACY list in scripts/pages.mjs.
 *
 * Usage: npm run build:pages && node scripts/netlify.mjs
 */
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'netlify-dist');
const base = JSON.parse(readFileSync(join(ROOT, 'website', 'business.json'), 'utf8')).basePath || '/';
const folder = base.replace(/^\/|\/$/g, '');

if (!existsSync(join(DIST, 'app', 'index.html'))) throw new Error('Run npm run build:pages first');
rmSync(OUT, { recursive: true, force: true });
cpSync(DIST, folder ? join(OUT, folder) : OUT, { recursive: true });
if (folder) cpSync(join(DIST, '404.html'), join(OUT, '404.html'));
console.log(`netlify: marketing website at ${base}, app at ${base}app/`);
