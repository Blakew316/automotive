// Minimal GitHub Pages stand-in: serves dist/ under /automotive/, directory index, .html fallback, 404.html.
import http from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
const DIST = process.argv[2], PORT = Number(process.argv[3] || 4173), BASE = '/automotive/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain', '.gz': 'application/gzip', '.wasm': 'application/wasm', '.gif': 'image/gif' };
const send = (res, code, file) => { res.writeHead(code, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file)); };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (!p.startsWith(BASE) && p !== BASE.slice(0, -1)) { res.writeHead(404); return res.end('not under base'); }
  if (p === BASE.slice(0, -1)) { res.writeHead(301, { Location: BASE + url.search }); return res.end(); }
  const rel = p.slice(BASE.length);
  const abs = join(DIST, rel);
  if (existsSync(abs) && statSync(abs).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' + url.search }); return res.end(); }
    if (existsSync(join(abs, 'index.html'))) return send(res, 200, join(abs, 'index.html'));
  } else if (existsSync(abs)) return send(res, 200, abs);
  else if (existsSync(abs + '.html')) return send(res, 200, abs + '.html');
  return send(res, 404, join(DIST, '404.html'));
}).listen(PORT, () => console.log('pages server on', PORT));
