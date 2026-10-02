#!/usr/bin/env node
/**
 * Writes every WPI Driveline brand file from the logo in src/brand/artwork.js.
 *
 * Staff app (public/):
 *   icons/apple-touch-icon.png   180×180, opaque full-bleed square (iOS applies its own mask)
 *   icons/icon-192.png           manifest "any": the tile with rounded corners, transparent outside
 *   icons/icon-512.png
 *   icons/maskable-512.png       manifest "maskable": full bleed, mark inside the 80% safe zone
 *   favicon.svg                  32×32 vector tile
 *   splash/{light,dark}-WxH.png  apple-touch-startup-image for every current iPhone (portrait) and
 *                                iPad (portrait and landscape): the plain canvas color, no logo
 *   ../index.html                the <link rel="apple-touch-startup-image"> tags, written between the
 *                                <!-- launch screens --> markers (nothing else is touched)
 *
 * Public website (website/):
 *   assets/img/logo.svg          WPI, bars and DRIVELINE (the header and brand card)
 *   assets/img/logo-full.svg     the complete stacked logo with its tagline
 *   assets/img/logo-mark.svg     WPI over its bars
 *   assets/img/apple-touch-icon.png, favicon-32.png, icon-192.png, icon-512.png, icon-maskable-512.png
 *   favicon.ico                  16 and 32 px
 *   assets/img/og-image.png      1200×630 link preview
 *
 * The icon is the logo's mark — navy WPI over its blue and green bars — on a pale blue tile. At favicon
 * sizes the bars are drawn at least 2 px tall with a 1 px gap so they stay visible. The tile's gradient
 * is computed per pixel with the CSS linear-gradient math instead of being drawn by Skia, which dithers
 * gradients: the noise is invisible but makes the PNGs 5–8× larger. The glyphs are rasterized by
 * Chromium. Every PNG is then re-encoded here with the filter and zlib settings that compress it best;
 * launch screens are 1-bit palette PNGs of a few hundred bytes.
 *
 * Usage: node scripts/brand-assets.mjs
 */
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants, deflateSync, inflateSync } from 'node:zlib';
import { BARS, COLORS, DRIVELINE, WPI, logoSvg } from '../src/brand/artwork.js';
import { launch } from '../tests/support/env.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const WEBSITE = join(ROOT, 'website');
const SPLASH = join(PUBLIC, 'splash');
const INDEX = join(ROOT, 'index.html');

// The tile: linear-gradient(135deg, #f8fbff, #e3edfa) — a pale blue that keeps the navy mark crisp.
const STOPS = [
  [0, [248, 251, 255]],
  [1, [227, 237, 250]],
];
const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');

/** size: px; radius: corner radius / size; mark: the mark's width / size. */
const ICONS = [
  { file: 'public/icons/apple-touch-icon.png', size: 180, radius: 0, mark: 0.64, opaque: true },
  { file: 'public/icons/icon-192.png', size: 192, radius: 0.225, mark: 0.64 },
  { file: 'public/icons/icon-512.png', size: 512, radius: 0.225, mark: 0.64 },
  { file: 'public/icons/maskable-512.png', size: 512, radius: 0, mark: 0.52, opaque: true },
  { file: 'website/assets/img/apple-touch-icon.png', size: 180, radius: 0, mark: 0.64, opaque: true },
  { file: 'website/assets/img/icon-192.png', size: 192, radius: 0.225, mark: 0.64 },
  { file: 'website/assets/img/icon-512.png', size: 512, radius: 0.225, mark: 0.64 },
  { file: 'website/assets/img/icon-maskable-512.png', size: 512, radius: 0, mark: 0.52, opaque: true },
  { file: 'website/assets/img/favicon-32.png', size: 32, radius: 0.22, mark: 0.78 },
  { file: 'favicon-16', size: 16, radius: 0.22, mark: 0.84 }, // only inside favicon.ico
];

// Launch screens: the app's canvas color (index.css --canvas, theme-color) per color scheme.
const SCHEMES = { light: '#f2f6fa', dark: '#0a121e' };
// [CSS width, CSS height, device pixel ratio] in portrait.
const IPHONES = [
  [440, 956, 3], [402, 874, 3], [430, 932, 3], [420, 912, 3], [393, 852, 3], [390, 844, 3], [428, 926, 3],
  [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2], [414, 736, 3], [320, 568, 2],
];
const IPADS = [[744, 1133, 2], [768, 1024, 2], [810, 1080, 2], [820, 1180, 2], [834, 1112, 2], [834, 1194, 2], [1024, 1366, 2], [1032, 1376, 2]];

// ---------------------------------------------------------------------------------------------------
// PNG reading and writing

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, data = Buffer.alloc(0)) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function png({ width, height, depth, colorType, palette, idat }) {
  const ihdr = Buffer.alloc(13); // compression, filter and interlace method stay 0
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = depth;
  ihdr[9] = colorType;
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), ...(palette ? [chunk('PLTE', palette)] : []), chunk('IDAT', idat), chunk('IEND')]);
}

/** A solid-color image: 1-bit palette with a single entry, so every row is zeros. */
function solidPNG(width, height, hex) {
  const rows = Buffer.alloc(height * (1 + Math.ceil(width / 8)));
  const idat = deflateSync(rows, { level: 9, memLevel: 9 });
  return png({ width, height, depth: 1, colorType: 3, palette: Buffer.from(hex.slice(1), 'hex'), idat });
}

const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
/** The value PNG filter type f predicts for byte i of a scanline (bpp bytes per pixel). */
function predict(f, line, prev, i, bpp) {
  const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
  return f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? paeth(a, b, c) : 0;
}

/** Reads the 8-bit RGB/RGBA, non-interlaced PNGs Chromium writes. Returns RGBA pixels. */
function decodePNG(buf) {
  let pos = 8, width = 0, height = 0, bpp = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('latin1', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      if (data[8] !== 8 || data[12] !== 0 || (data[9] !== 2 && data[9] !== 6)) throw new Error('unexpected PNG format from Chromium');
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bpp = data[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = width * bpp, rgba = Buffer.alloc(width * height * 4, 255);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) line[i] = (line[i] + predict(f, line, prev, i, bpp)) & 0xff;
    for (let x = 0; x < width; x++) line.copy(rgba, (y * width + x) * 4, x * bpp, x * bpp + bpp);
    prev = line;
  }
  return { width, height, rgba };
}

/** Encodes RGBA pixels (as RGB when fully opaque), keeping whichever filter/zlib choice is smallest. */
function encodePNG({ width, height, rgba }) {
  const opaque = rgba.every((v, i) => i % 4 !== 3 || v === 255);
  const bpp = opaque ? 3 : 4, stride = width * bpp;
  const lines = Array.from({ length: height }, (_, y) => {
    const line = Buffer.alloc(stride);
    for (let x = 0; x < width; x++) rgba.copy(line, x * bpp, (y * width + x) * 4, (y * width + x) * 4 + bpp);
    return line;
  });
  const filtered = (f, line, prev) => {
    const out = Buffer.alloc(stride + 1);
    out[0] = f;
    for (let i = 0; i < stride; i++) out[i + 1] = (line[i] - predict(f, line, prev, i, bpp)) & 0xff;
    return out;
  };
  const cost = (row) => row.subarray(1).reduce((s, v) => s + (v < 128 ? v : 256 - v), 0);
  let best = null;
  for (const mode of [0, 1, 2, 3, 4, 'adaptive']) {
    const rows = lines.map((line, y) => {
      const prev = y ? lines[y - 1] : Buffer.alloc(stride);
      if (mode !== 'adaptive') return filtered(mode, line, prev);
      return [0, 1, 2, 3, 4].map((f) => filtered(f, line, prev)).reduce((a, b) => (cost(b) < cost(a) ? b : a));
    });
    for (const strategy of [constants.Z_DEFAULT_STRATEGY, constants.Z_FILTERED]) {
      const idat = deflateSync(Buffer.concat(rows), { level: 9, memLevel: 9, strategy });
      if (!best || idat.length < best.length) best = idat;
    }
  }
  return { opaque, data: png({ width, height, depth: 8, colorType: opaque ? 2 : 6, idat: best }) };
}


// ---------------------------------------------------------------------------------------------------
// Drawing

/**
 * The mark for an icon S px wide: WPI's glyph, and the bars as [x, y, w, h] in logo units, thickened
 * to at least 2 px with a 1 px gap when the icon is small.
 */
function markGeometry(S, share) {
  const width = BARS.green[0] + BARS.green[2];
  const k = (S * share) / width; // px per logo unit
  const h = Math.max(BARS.blue[3], 2 / k);
  const gap = Math.max(BARS.green[0] - BARS.blue[2], 1 / k);
  const half = (width - gap) / 2;
  const top = BARS.blue[1] + Math.max(0, (h - BARS.blue[3]) * 0.25);
  return { k, width, top: WPI.y - 182, bottom: top + h, bars: [[0, top, half, h, COLORS.blue], [half + gap, top, half, h, COLORS.green]] };
}

/** Paints one icon on the page's canvas, which is exactly the viewport. Runs in the page. */
function paintIcon({ size: S, radius, stops, wpi, geo, navy }) {
  const canvas = document.querySelector('canvas');
  canvas.width = canvas.height = S;
  // Background: CSS linear-gradient(135deg, ...) on a square runs corner to corner, so a pixel's
  // position on the gradient line depends only on x + y: t = (x + y + 1) / 2S at pixel centers.
  const ramp = Array.from({ length: 2 * S - 1 }, (_, n) => {
    const t = (n + 1) / (2 * S);
    let i = stops.findIndex(([pos]) => pos >= t);
    if (i < 0) i = stops.length - 1;
    const [p0, c0] = stops[Math.max(0, i - 1)], [p1, c1] = stops[i];
    const u = p1 > p0 ? Math.min(1, Math.max(0, (t - p0) / (p1 - p0))) : 0;
    return [...c0.map((v, ch) => Math.round(v + (c1[ch] - v) * u)), 255];
  });
  const img = new ImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) img.data.set(ramp[x + y], (y * S + x) * 4);
  const bg = document.createElement('canvas');
  bg.width = bg.height = S;
  bg.getContext('2d').putImageData(img, 0, 0);

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.beginPath();
  ctx.roundRect(0, 0, S, S, radius * S);
  ctx.fillStyle = ctx.createPattern(bg, 'no-repeat');
  ctx.fill();

  // The mark, centered on its full height (glyph top to the bottom of the bars).
  const { k, width, top, bottom, bars } = geo;
  ctx.translate(S / 2 - (width / 2) * k, S / 2 - ((top + bottom) / 2) * k);
  ctx.scale(k, k);
  ctx.fillStyle = navy;
  ctx.save();
  ctx.translate(wpi.x, wpi.y);
  ctx.fill(new Path2D(wpi.d));
  ctx.restore();
  for (const [x, y, w, h, fill] of bars) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }
}

// ---------------------------------------------------------------------------------------------------

const written = [];
function write(rel, data) {
  const file = join(ROOT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  written.push(file);
}

/** An .ico holding PNG images (every browser since IE Vista-era reads PNG entries). */
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head[e] = head[e + 1] = size % 256;
    head.writeUInt16LE(1, e + 4); // color planes
    head.writeUInt16LE(32, e + 6); // bits per pixel
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...images.map((im) => im.data)]);
}

/** The link preview: the logo on the pale tile color, with the bars' blue and green as a soft wash. */
function ogPage() {
  const logo = logoSvg('lockup').replace(/ width="[\d.]+" height="[\d.]+"/, ' width="560"');
  return `<!doctype html><html><body style="margin:0">
<div style="width:1200px;height:630px;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(60% 80% at 100% 0%, rgb(31 122 224 / .10), transparent 70%),
  radial-gradient(55% 75% at 0% 100%, rgb(45 179 106 / .10), transparent 70%), ${hex(STOPS[0][1])}">${logo}</div>
</body></html>`;
}

async function renderPNGs() {
  const browser = await launch();
  const ico16 = [];
  try {
    const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
    await page.setContent('<!doctype html><html><body style="margin:0"><canvas style="display:block"></canvas></body></html>');
    for (const icon of ICONS) {
      await page.setViewportSize({ width: icon.size, height: icon.size });
      await page.evaluate(paintIcon, { ...icon, stops: STOPS, wpi: WPI, geo: markGeometry(icon.size, icon.mark), navy: COLORS.navy });
      const shot = decodePNG(await page.screenshot({ omitBackground: !icon.opaque }));
      if (shot.width !== icon.size || shot.height !== icon.size) throw new Error(`${icon.file}: rendered ${shot.width}×${shot.height}`);
      const { opaque, data } = encodePNG(shot);
      if (icon.opaque && !opaque) throw new Error(`${icon.file} must be fully opaque`);
      if (icon.size <= 32) ico16.push({ size: icon.size, data });
      if (icon.file.includes('/')) write(icon.file, data);
    }
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.setContent(ogPage());
    write('website/assets/img/og-image.png', encodePNG(decodePNG(await page.screenshot())).data);
  } finally {
    await browser.close();
  }
  write('website/favicon.ico', ico(ico16.sort((a, b) => a.size - b.size)));
}

function favicon() {
  // The same tile and mark as the PNG icons, at 32×32 with the small-size bars.
  const S = 32, geo = markGeometry(S, 0.78);
  const tx = (S / 2 - (geo.width / 2) * geo.k).toFixed(3), ty = (S / 2 - ((geo.top + geo.bottom) / 2) * geo.k).toFixed(3);
  const r = (n) => +n.toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${hex(STOPS[0][1])}"/>
      <stop offset="1" stop-color="${hex(STOPS[1][1])}"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="7" fill="url(#tile)"/>
  <g transform="translate(${tx} ${ty}) scale(${geo.k.toFixed(5)})">
    <path transform="translate(${WPI.x} ${WPI.y})" fill="${COLORS.navy}" d="${WPI.d}"/>
    ${geo.bars.map(([x, y, w, h, fill]) => `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${fill}"/>`).join('\n    ')}
  </g>
</svg>
`;
}

function launchScreens() {
  const screens = [
    ...IPHONES.map(([w, h, dpr]) => ({ w, h, dpr, orientation: 'portrait' })),
    ...IPADS.flatMap(([w, h, dpr]) => ['portrait', 'landscape'].map((orientation) => ({ w, h, dpr, orientation }))),
  ];
  rmSync(SPLASH, { recursive: true, force: true });
  const tags = [], seen = new Set();
  for (const [scheme, color] of Object.entries(SCHEMES)) {
    for (const { w, h, dpr, orientation } of screens) {
      // device-width/height don't swap when an iPad turns; only the image does.
      const [pw, ph] = orientation === 'portrait' ? [w * dpr, h * dpr] : [h * dpr, w * dpr];
      const name = `${scheme}-${pw}x${ph}.png`;
      if (seen.has(name)) throw new Error(`two launch screens would be ${name}`);
      seen.add(name);
      write(`public/splash/${name}`, solidPNG(pw, ph, color));
      const media = `screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation}) and (prefers-color-scheme: ${scheme})`;
      tags.push(`<link rel="apple-touch-startup-image" media="${media}" href="/splash/${name}" />`);
    }
  }
  return tags;
}

function writeLinks(tags) {
  const html = readFileSync(INDEX, 'utf8');
  const markers = /(<!-- launch screens -->)[\s\S]*?(\r?\n[ \t]*<!-- \/launch screens -->)/;
  if (!markers.test(html)) throw new Error('index.html is missing the <!-- launch screens --> … <!-- /launch screens --> markers');
  const next = html.replace(markers, (_, open, close) => `${open}\n${tags.map((t) => `    ${t}`).join('\n')}${close}`);
  if (next !== html) writeFileSync(INDEX, next);
  return next !== html;
}

for (const variant of ['lockup', 'full', 'mark']) {
  write(`website/assets/img/${variant === 'lockup' ? 'logo' : `logo-${variant}`}.svg`, `${logoSvg(variant)}\n`);
}
await renderPNGs();
write('public/favicon.svg', favicon());
const tags = launchScreens();
const changed = writeLinks(tags);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
for (const file of written.filter((f) => !f.startsWith(SPLASH))) console.log(`${relative(ROOT, file).padEnd(42)} ${kb(statSync(file).size)}`);
const splash = written.filter((f) => f.startsWith(SPLASH));
console.log(`public/splash/ ${splash.length} launch screens, ${kb(splash.reduce((s, f) => s + statSync(f).size, 0))}`);
console.log(`index.html: ${tags.length} launch screen links ${changed ? 'written' : 'unchanged'}`);
