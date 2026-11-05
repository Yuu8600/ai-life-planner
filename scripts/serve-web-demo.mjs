import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const base = '/ai-life-planner';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

// A static-only preview under the real Project Pages subpath. Missing routes are
// 404s, so a successful deep-link test cannot be hidden by a dev-server SPA fallback.
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === base) {
      response.writeHead(302, { Location: `${base}/` }).end();
      return;
    }
    if (!pathname.startsWith(`${base}/`)) {
      response.writeHead(404).end();
      return;
    }
    let file = path.resolve(root, pathname.slice(base.length + 1) || 'index.html');
    if (!file.startsWith(`${root}${path.sep}`)) {
      response.writeHead(404).end();
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    } catch {
      if (!path.extname(file)) file += '.html';
    }
    const content = await readFile(file);
    response.writeHead(200, {
      'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(content);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(4173, '127.0.0.1', () => console.log(`Web Demo: http://127.0.0.1:4173${base}/`));
