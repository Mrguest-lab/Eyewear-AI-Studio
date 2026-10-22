// Node HTTP server for the AI gateway (no framework, no build step).
//   node --experimental-strip-types server/index.ts      (Node >= 22.6)
// Env: see .env.example. Optionally serves the built frontend from ./dist so the
// whole app can run as one service (e.g. Cloud Run / Render / a local machine).

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { handleRequest } from './aiHandlers.ts';
import type { Env } from './aiHandlers.ts';

const PORT = Number(process.env.PORT || 8787);
const MAX_BODY = 32 * 1024 * 1024;
const DIST = resolve(process.env.STATIC_DIR || 'dist');
const SERVE_STATIC = process.env.SERVE_STATIC !== 'false';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// Load .env if present (simple KEY=VALUE parser; real env vars win).
try {
  const text = await readFile('.env', 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {
  // no .env file
}

const env = process.env as unknown as Env;

async function serveStatic(pathname: string): Promise<{ body: Buffer; type: string } | null> {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  let file = resolve(join(DIST, rel));
  if (!file.startsWith(DIST)) return null;
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(DIST, 'index.html'); // SPA fallback
  }
  try {
    return { body: await readFile(file), type: MIME[extname(file)] || 'application/octet-stream' };
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (!url.pathname.startsWith('/api/')) {
      const file = SERVE_STATIC ? await serveStatic(url.pathname) : null;
      if (!file) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'content-type': file.type });
      res.end(file.body);
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > MAX_BODY) {
        res.writeHead(413, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large' }));
        return;
      }
      chunks.push(chunk as Buffer);
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers.set(k, v);
      else if (Array.isArray(v)) headers.set(k, v.join(', '));
    }
    const method = req.method || 'GET';
    const request = new Request(url, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' || !chunks.length ? undefined : Buffer.concat(chunks)
    });
    const clientKey = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anon').split(',')[0].trim();
    const response = await handleRequest(request, env, fetch, clientKey);
    const outHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => (outHeaders[k] = v));
    res.writeHead(response.status, outHeaders);
    if (response.body) {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Server error' }));
  }
});

server.listen(PORT, () => {
  const configured = [env.GEMINI_API_KEY && 'gemini', env.REPLICATE_API_TOKEN && 'replicate'].filter(Boolean);
  console.log(`AI gateway listening on http://localhost:${PORT}  providers: ${configured.join(', ') || 'none configured'}`);
});
