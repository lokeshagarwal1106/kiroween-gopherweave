import { readFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { GopherCapsuleStore } from './gopher/capsuleStore.ts';
import { parseGopherMenu } from './gopher/rfc1436.ts';
import { createGopherTcpServer, fetchFromGopherTcp } from './gopher/tcpServer.ts';

export function startGopherWeaveStack(options?: { tcpPort?: number; httpPort?: number }) {
  const store = new GopherCapsuleStore();
  const tcpServer = createGopherTcpServer(store, '127.0.0.1', options?.tcpPort ?? 7070);

  let boundTcpPort = options?.tcpPort ?? 7070;
  tcpServer.listen(options?.tcpPort ?? 7070, '127.0.0.1', () => {
    boundTcpPort = (tcpServer.address() as AddressInfo).port;
  });

  const uiPath = path.resolve(process.cwd(), 'ui/index.html');
  const httpServer = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (reqUrl.pathname === '/api/gopher/menu' && req.method === 'GET') {
      const rawTcpResponse = await fetchFromGopherTcp('127.0.0.1', boundTcpPort, '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ items: parseGopherMenu(rawTcpResponse), rawTcpResponse, tcpPort: boundTcpPort }));
      return;
    }

    if (reqUrl.pathname === '/api/gopher/search' && req.method === 'GET') {
      const q = reqUrl.searchParams.get('q') ?? '';
      const rawTcpResponse = await fetchFromGopherTcp('127.0.0.1', boundTcpPort, `/search\t${q}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ items: parseGopherMenu(rawTcpResponse), rawTcpResponse }));
      return;
    }

    if (reqUrl.pathname === '/api/gopher/capsule' && req.method === 'GET') {
      const selector = reqUrl.searchParams.get('selector') ?? '/notes/manifesto';
      const capsule = store.getCapsule(selector);
      if (!capsule) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }
      const rawTcpResponse = await fetchFromGopherTcp('127.0.0.1', boundTcpPort, selector);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...capsule, rawTcpResponse }));
      return;
    }

    if (reqUrl.pathname === '/api/gopher/tamper' && req.method === 'POST') {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(Buffer.from(c));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { selector?: string };
      const tampered = store.toggleMitmTamper(body.selector ?? '/notes/manifesto');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tampered }));
      return;
    }

    if (reqUrl.pathname === '/api/gopher/publish' && req.method === 'POST') {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(Buffer.from(c));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { title?: string; body?: string };
      const created = store.publishCapsule(body.title || 'Untitled Note', body.body || '');
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(created));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(readFileSync(uiPath, 'utf8'));
  });

  httpServer.listen(options?.httpPort ?? 8790, '127.0.0.1');
  return { store, tcpServer, httpServer };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { store } = startGopherWeaveStack();
  console.log(
    `[GopherWeave] RFC 1436 TCP :7070 + Web Phosphor Gateway http://localhost:8790 | Signer: ${store.keyring.keyFingerprint}`
  );
}
