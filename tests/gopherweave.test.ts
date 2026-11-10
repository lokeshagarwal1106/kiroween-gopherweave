import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { verifyGopherCapsule } from '../src/crypto/ed25519Capsules.ts';
import { GopherCapsuleStore } from '../src/gopher/capsuleStore.ts';
import { parseGopherMenu, serializeGopherMenu } from '../src/gopher/rfc1436.ts';
import { createGopherTcpServer, fetchFromGopherTcp } from '../src/gopher/tcpServer.ts';

describe('GopherWeave RFC 1436 & Ed25519 Cryptography', () => {
  it('serializes and parses RFC 1436 menus with CRLF and dot termination', () => {
    const raw = serializeGopherMenu([
      { type: '0', display: 'Read Note', selector: '/notes/a', host: '127.0.0.1', port: 7070 },
      { type: '7', display: 'Search', selector: '/search', host: '127.0.0.1', port: 7070 },
    ]);
    assert.ok(raw.endsWith('\r\n.\r\n'));
    const parsed = parseGopherMenu(raw);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].type, '0');
    assert.equal(parsed[1].type, '7');
  });

  it('verifies Ed25519 signatures and catches single-byte MITM tampering immediately', () => {
    const store = new GopherCapsuleStore();
    const clean = store.getCapsule('/notes/manifesto');
    assert.ok(clean);
    assert.equal(clean.verification.valid, true);

    store.toggleMitmTamper('/notes/manifesto');
    const tampered = store.getCapsule('/notes/manifesto');
    assert.ok(tampered);
    assert.equal(tampered.verification.valid, false);
    assert.equal(verifyGopherCapsule({ ...clean, title: 'Altered Title' }).valid, false);
  });
});

describe('GopherWeave Live RFC 1436 TCP Server Round-Trip', () => {
  const store = new GopherCapsuleStore();
  let tcpPort = 0;
  let closeTcp: () => Promise<void>;

  before(async () => {
    const srv = createGopherTcpServer(store, '127.0.0.1', 0);
    await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', resolve));
    tcpPort = (srv.address() as AddressInfo).port;
    closeTcp = () => new Promise<void>((res, rej) => srv.close((e) => (e ? rej(e) : res())));
  });

  after(async () => {
    await closeTcp();
  });

  it('serves live root menu, Type-7 search, and signed capsule over raw TCP', async () => {
    const rootRaw = await fetchFromGopherTcp('127.0.0.1', tcpPort, '');
    const rootItems = parseGopherMenu(rootRaw);
    assert.ok(rootItems.some((i) => i.selector === '/notes/manifesto'));

    const searchRaw = await fetchFromGopherTcp('127.0.0.1', tcpPort, '/search\tEd25519');
    const searchItems = parseGopherMenu(searchRaw);
    assert.ok(searchItems.length >= 1);

    const docRaw = await fetchFromGopherTcp('127.0.0.1', tcpPort, '/notes/manifesto');
    assert.ok(docRaw.includes('X-GopherWeave-Ed25519-Sig:'));
    assert.ok(docRaw.includes('RFC 1436'));
  });
});
