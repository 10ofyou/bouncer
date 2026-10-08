// Tiny fixture server for the end-to-end test. Serves test/fixtures and
// records any POST to /collect, which is where the fake forms submit.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function startServer(port = 0) {
  const hits = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/collect') {
      let body = '';
      for await (const c of req) body += c;
      hits.push({ host: req.headers.host, body });
      res.end('stolen');
      return;
    }
    const name = path.basename(url.pathname);
    if (!name.endsWith('.html')) { res.statusCode = 404; res.end(); return; }
    try {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(await readFile(path.join(DIR, name)));
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, hits }));
  });
}
