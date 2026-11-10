import {
  createEd25519Keyring,
  type Ed25519Keyring,
  type SignedGopherCapsule,
  signGopherCapsule,
  verifyGopherCapsule,
} from '../crypto/ed25519Capsules.ts';
import type { GopherMenuItem } from './rfc1436.ts';

export class GopherCapsuleStore {
  readonly keyring: Ed25519Keyring;
  private capsules = new Map<string, SignedGopherCapsule>();
  private tamperedSelectors = new Set<string>();

  constructor() {
    this.keyring = createEd25519Keyring();
    this.seedInitialCapsules();
  }

  private seedInitialCapsules(): void {
    const seeds = [
      {
        selector: '/notes/manifesto',
        title: 'Why Resurrect RFC 1436 Gopher in 2026?',
        author: 'archive-keeper',
        publishedAt: '2026-11-10T09:00:00.000Z',
        body: [
          'In 1991, University of Minnesota released RFC 1436 (The Internet Gopher Protocol).',
          'Pure hierarchical text menus over raw TCP — zero trackers, zero megabyte bundles.',
          'GopherWeave revives RFC 1436 with Ed25519 signed capsules so every line stays verifiable.',
        ].join('\n'),
      },
      {
        selector: '/notes/ed25519-spec',
        title: 'Detached Ed25519 Envelope Design',
        author: 'crypto-scribe',
        publishedAt: '2026-11-10T09:30:00.000Z',
        body: [
          'Every capsule signs canonical (selector, title, timestamp, body) with Ed25519.',
          'Clients verify signatures locally with zero external PKI or paid APIs.',
          'Even a single flipped character fails SHA-256 + Ed25519 verification immediately.',
        ].join('\n'),
      },
      {
        selector: '/notes/type7-index',
        title: 'RFC 1436 Item Type 7 Live Full-Text Search',
        author: 'index-bot',
        publishedAt: '2026-11-10T10:00:00.000Z',
        body: [
          'In RFC 1436, Item Type 7 encodes <selector>\\t<search terms>\\r\\n over TCP.',
          'GopherWeave indexes every signed capsule in memory and returns dynamic menus matching queries.',
        ].join('\n'),
      },
    ];

    for (const s of seeds) {
      this.capsules.set(s.selector, signGopherCapsule(s, this.keyring));
    }
  }

  publishCapsule(title: string, body: string, author = 'freelance-node'): SignedGopherCapsule {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || `note-${Date.now()}`;
    const selector = `/notes/${slug}`;
    const capsule = signGopherCapsule({ selector, title, body, author }, this.keyring);
    this.tamperedSelectors.delete(selector);
    this.capsules.set(selector, capsule);
    return capsule;
  }

  toggleMitmTamper(selector: string): boolean {
    if (!this.capsules.has(selector)) return false;
    if (this.tamperedSelectors.has(selector)) {
      this.tamperedSelectors.delete(selector);
      return false;
    }
    this.tamperedSelectors.add(selector);
    return true;
  }

  getCapsule(selector: string): (SignedGopherCapsule & { verification: { valid: boolean; reason: string }; simulatedTamper: boolean }) | null {
    const clean = this.capsules.get(selector);
    if (!clean) return null;

    const simulatedTamper = this.tamperedSelectors.has(selector);
    const exposed: SignedGopherCapsule = simulatedTamper
      ? { ...clean, body: `${clean.body}\n[UNAUTHORIZED PROXY MODIFICATION]` }
      : clean;

    return {
      ...exposed,
      verification: verifyGopherCapsule(exposed),
      simulatedTamper,
    };
  }

  buildRootMenu(host: string, port: number): GopherMenuItem[] {
    const header: GopherMenuItem[] = [
      { type: 'i', display: '=== GOPHERWEAVE // RFC 1436 + Ed25519 CAPSULES ===', selector: 'fake', host, port },
      { type: 'i', display: `Authority Fingerprint: ${this.keyring.keyFingerprint}`, selector: 'fake', host, port },
      { type: '7', display: 'Search Signed Capsules (Type 7 Index)', selector: '/search', host, port },
    ];
    const docItems: GopherMenuItem[] = [...this.capsules.values()].map((c) => ({
      type: '0',
      display: `${c.title} [Ed25519:${c.keyFingerprint.slice(0, 8)}]`,
      selector: c.selector,
      host,
      port,
    }));
    return [...header, ...docItems];
  }

  searchCapsules(query: string, host: string, port: number): GopherMenuItem[] {
    const q = query.trim().toLowerCase();
    const matches = [...this.capsules.values()].filter(
      (c) => !q || c.title.toLowerCase().includes(q) || c.body.toLowerCase().includes(q) || c.selector.toLowerCase().includes(q)
    );
    if (matches.length === 0) {
      return [{ type: '3', display: `No capsules matched "${query}"`, selector: 'error', host, port }];
    }
    return matches.map((c) => ({
      type: '0',
      display: `[MATCH] ${c.title}`,
      selector: c.selector,
      host,
      port,
    }));
  }
}
