#!/usr/bin/env node
/**
 * Renders the staff app's Home Screen icons, favicon and iOS launch screens from the app's logo
 * (src/components/Layout.jsx `Logo`: the accent-to-lilac gradient tile with a white lucide wrench).
 *
 *   public/icons/apple-touch-icon.png   180×180, opaque full-bleed square (iOS applies its own mask)
 *   public/icons/icon-192.png           manifest "any": the tile with rounded corners, transparent outside
 *   public/icons/icon-512.png
 *   public/icons/maskable-512.png       manifest "maskable": full bleed, wrench inside the 80% safe zone
 *   public/favicon.svg                  32×32 vector tile
 *   public/splash/{light,dark}-WxH.png  apple-touch-startup-image for every current iPhone (portrait)
 *                                       and iPad (portrait and landscape): the plain canvas color, no logo
 *   index.html                          the <link rel="apple-touch-startup-image"> tags, written between
 *                                       the <!-- launch screens --> markers (nothing else is touched)
 *
 * The icons are painted on a canvas in Chromium at their exact pixel size, with no highlight or shadow
 * so they read as the same mark as the in-app Logo; the wrench sits at its optical center (the heavy
 * head would otherwise make it look pushed up and to the right). The gradient is computed
 * per pixel with the CSS linear-gradient math instead of being drawn by Skia, which dithers gradients:
 * the noise is invisible but makes the PNGs 5–8× larger. The wrench (lucide-react's current path) and
 * the rounded corners are rasterized by Chromium. Every PNG is then re-encoded here with the filter and
 * zlib settings that compress it best; launch screens are 1-bit palette PNGs of a few hundred bytes.
 *
 * Usage: node scripts/app-icons.mjs
 */
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants, deflateSync, inflateSync } from 'node:zlib';
import { __iconNode as WRENCH } from 'lucide-react/dist/esm/icons/wrench.js';
import { launch } from '../tests/support/env.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const SPLASH = join(PUBLIC, 'splash');
const INDEX = join(ROOT, 'index.html');

// The Logo tile: linear-gradient(135deg, rgb(28 59 107) 30%, rgb(77 86 191) 75%, rgb(122 92 196) 115%).
const STOPS = [
  [0.3, [28, 59, 107]],
  [0.75, [77, 86, 191]],
  [1.15, [122, 92, 196]],
];
const STROKE = 2.2; // the Logo's Wrench strokeWidth (24×24 grid)
const WRENCH_D = WRENCH.filter(([tag]) => tag === 'path').map(([, attrs]) => attrs.d);
if (!WRENCH_D.length) throw new Error('lucide-react wrench icon has no <path>');

/** size: px; radius: corner radius / size; wrench: wrench box (24×24 grid) / size. */
const ICONS = [
  { file: 'icons/apple-touch-icon.png', size: 180, radius: 0, wrench: 0.52, opaque: true },
  { file: 'icons/icon-192.png', size: 192, radius: 0.225, wrench: 0.52 },
  { file: 'icons/icon-512.png', size: 512, radius: 0.225, wrench: 0.52 },
  { file: 'icons/maskable-512.png', size: 512, radius: 0, wrench: 0.4, opaque: true },
];

// Launch screens: the app's canvas color (index.html, theme-color) per color scheme.
const SCHEMES = { light: '#eff1f4', dark: '#0b1019' };
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
// Drawing (these two run in the page)

/** Where the wrench's stroked ink sits in its 24×24 grid: bounding-box center and area centroid. */
function measureWrench({ paths, stroke }) {
  const N = 480, k = 24 / N, canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.scale(1 / k, 1 / k);
  Object.assign(ctx, { lineWidth: stroke, lineCap: 'round', lineJoin: 'round' });
  for (const d of paths) ctx.stroke(new Path2D(d));
  const px = ctx.getImageData(0, 0, N, N).data;
  let sx = 0, sy = 0, sum = 0, x0 = N, y0 = N, x1 = 0, y1 = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = px[(y * N + x) * 4 + 3] / 255;
      if (!v) continue;
      sx += v * (x + 0.5);
      sy += v * (y + 0.5);
      sum += v;
      x0 = Math.min(x0, x), y0 = Math.min(y0, y), x1 = Math.max(x1, x + 1), y1 = Math.max(y1, y + 1);
    }
  }
  return { box: [((x0 + x1) / 2) * k, ((y0 + y1) / 2) * k], centroid: [(sx / sum) * k, (sy / sum) * k] };
}

/** Paints one icon on the page's canvas, which is exactly the viewport. */
function paintIcon({ size: S, radius, wrench, center, stops, paths, stroke }) {
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

  // The wrench box, placed so its optical center (from measureWrench) lands on the icon's center.
  const w = wrench * S;
  ctx.translate(S / 2 - (center[0] / 24) * w, S / 2 - (center[1] / 24) * w);
  ctx.scale(w / 24, w / 24);
  Object.assign(ctx, { strokeStyle: '#fff', lineWidth: stroke, lineCap: 'round', lineJoin: 'round' });
  for (const d of paths) ctx.stroke(new Path2D(d));
}

// ---------------------------------------------------------------------------------------------------

const written = [];
function write(rel, data) {
  const file = join(PUBLIC, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  written.push(file);
}

async function renderIcons() {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
    await page.setContent('<!doctype html><html><body style="margin:0"><canvas style="display:block"></canvas></body></html>');
    const m = await page.evaluate(measureWrench, { paths: WRENCH_D, stroke: STROKE });
    // Optical center: halfway between the bounding box's center and the centroid, so the heavy head
    // doesn't make the wrench look pushed toward the top right.
    const center = [0, 1].map((i) => (m.box[i] + m.centroid[i]) / 2);
    for (const icon of ICONS) {
      await page.setViewportSize({ width: icon.size, height: icon.size });
      await page.evaluate(paintIcon, { ...icon, center, stops: STOPS, paths: WRENCH_D, stroke: STROKE });
      const shot = decodePNG(await page.screenshot({ omitBackground: !icon.opaque }));
      if (shot.width !== icon.size || shot.height !== icon.size) throw new Error(`${icon.file}: rendered ${shot.width}×${shot.height}`);
      const { opaque, data } = encodePNG(shot);
      if (icon.opaque && !opaque) throw new Error(`${icon.file} must be fully opaque`);
      write(icon.file, data);
    }
  } finally {
    await browser.close();
  }
}

function favicon() {
  // userSpaceOnUse on the 32×32 tile: the 135deg line runs (0,0)→(32,32); stretching it to 115% keeps
  // the CSS stop positions (30%, 75%, 115%) without clamping the last one.
  const end = (32 * STOPS.at(-1)[0]).toFixed(1);
  const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
  const stops = STOPS.map(([pos, rgb]) => `<stop offset="${+(pos / STOPS.at(-1)[0]).toFixed(4)}" stop-color="${hex(rgb)}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="tile" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${end}" y2="${end}">
      ${stops.join('\n      ')}
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="url(#tile)"/>
  <g transform="translate(6 6) scale(0.8333)" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    ${WRENCH_D.map((d) => `<path d="${d}"/>`).join('\n    ')}
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
      write(`splash/${name}`, solidPNG(pw, ph, color));
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

await renderIcons();
write('favicon.svg', favicon());
const tags = launchScreens();
const changed = writeLinks(tags);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
for (const file of written.filter((f) => !f.startsWith(SPLASH))) console.log(`${relative(ROOT, file).padEnd(30)} ${kb(statSync(file).size)}`);
const splash = written.filter((f) => f.startsWith(SPLASH));
console.log(`public/splash/ ${splash.length} launch screens, ${kb(splash.reduce((s, f) => s + statSync(f).size, 0))}`);
console.log(`index.html: ${tags.length} launch screen links ${changed ? 'written' : 'unchanged'}`);
