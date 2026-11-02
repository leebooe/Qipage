import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { picsumListUrl } from '../src/picsum-source.js';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 3000);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.md': 'text/plain; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === '/__qipage/picsum/photos') {
      const page = Number(requestUrl.searchParams.get('page') || 1);
      if (req.method !== 'GET' || !Number.isSafeInteger(page) || page < 1) {
        res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Invalid photo list request'); return;
      }
      // Only forward requests to Picsum's public photo list.
      try {
        const upstream = await fetch(picsumListUrl(page), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(18000) });
        const body = await upstream.text();
        res.writeHead(upstream.status, {
          'Content-Type': upstream.headers.get('content-type') || 'text/plain',
          'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        });
        res.end(body);
      } catch { res.writeHead(502, { 'Content-Type': 'text/plain' }).end('Picsum photo list temporarily unavailable'); }
      return;
    }
    let filename = resolve(root, '.' + pathname);
    if (filename !== root && !filename.startsWith(root + sep)) { res.writeHead(403).end('Forbidden'); return; }
    if ((await stat(filename)).isDirectory()) filename = resolve(filename, 'index.html');
    res.writeHead(200, { 'Content-Type': types[extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(await readFile(filename));
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Qipage: http://127.0.0.1:${port}`));
