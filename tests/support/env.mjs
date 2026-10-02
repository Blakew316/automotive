// Shared settings for the browser suites: where the built app is served, where screenshots and
// downloads go, and a Chromium launcher that works on a dev machine, in CI and in sandboxes.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const PORT = Number(process.env.TEST_PORT || 4173);
export const ROOT = `http://localhost:${PORT}/automotive/`;
export const APP = `${ROOT}app`;
export const OUT = resolve(process.env.TEST_OUT || 'test-results');
mkdirSync(join(OUT, 'shots'), { recursive: true });

/** A Chromium build: CHROMIUM_PATH, then a browsers folder (PLAYWRIGHT_BROWSERS_PATH), then Playwright's own. */
function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (dir && existsSync(dir)) {
    const builds = readdirSync(dir).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
    for (const b of builds) {
      const exe = join(dir, b, 'chrome-linux', 'chrome');
      if (existsSync(exe)) return exe;
    }
  }
  return undefined;
}

export const launch = (opts = {}) => chromium.launch({ executablePath: chromiumPath(), ...opts });
