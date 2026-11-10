import net from 'node:net';
import type { GopherCapsuleStore } from './capsuleStore.ts';
import { serializeGopherMenu } from './rfc1436.ts';

export function createGopherTcpServer(
  store: GopherCapsuleStore,
  advertisedHost = '127.0.0.1',
  advertisedPort = 7070
): net.Server {
  return net.createServer((socket) => {
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const nlIdx = buffer.indexOf('\n');
      if (nlIdx === -1 && buffer.length < 1024) return;

      const rawSelector = (nlIdx >= 0 ? buffer.slice(0, nlIdx) : buffer).replace(/\r$/, '');
      let responseText: string;

      if (rawSelector === '' || rawSelector === '/') {
        responseText = serializeGopherMenu(store.buildRootMenu(advertisedHost, advertisedPort));
      } else if (rawSelector.startsWith('/search\t')) {
        const query = rawSelector.slice('/search\t'.length);
        responseText = serializeGopherMenu(store.searchCapsules(query, advertisedHost, advertisedPort));
      } else if (rawSelector.startsWith('/search?')) {
        const query = rawSelector.slice('/search?'.length);
        responseText = serializeGopherMenu(store.searchCapsules(query, advertisedHost, advertisedPort));
      } else {
        const capsule = store.getCapsule(rawSelector);
        if (!capsule) {
          responseText = serializeGopherMenu([
            { type: '3', display: `Selector not found: ${rawSelector}`, selector: 'error', host: advertisedHost, port: advertisedPort },
          ]);
        } else {
          // Include RFC 1436 plaintext response with verifiable Ed25519 envelope header.
          responseText = [
            `X-GopherWeave-Title: ${capsule.title}`,
            `X-GopherWeave-Signer: ${capsule.keyFingerprint}`,
            `X-GopherWeave-SHA256: ${capsule.sha256}`,
            `X-GopherWeave-Ed25519-Sig: ${capsule.signatureBase64}`,
            `X-GopherWeave-Published: ${capsule.publishedAt}`,
            `---`,
            capsule.body,
            '.',
            '',
          ].join('\r\n');
        }
      }

      socket.end(responseText);
    });
  });
}

export function fetchFromGopherTcp(host: string, port: number, selector: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ host, port }, () => {
      client.write(`${selector}\r\n`);
    });
    const chunks: Buffer[] = [];
    client.on('data', (c) => chunks.push(Buffer.from(c)));
    client.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    client.on('error', reject);
  });
}
