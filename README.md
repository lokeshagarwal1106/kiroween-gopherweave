# GopherWeave — Cryptographic Revival of RFC 1436 Gopher

> **Kiroween 2026 (`Resurrection` Category):** Bringing the 1991 RFC 1436 Gopher Protocol back to life with **Ed25519 signed capsules**, **live TCP selector routing**, **Type-7 full-text search**, and a **Phosphor CRT Web Gateway**.

---

## What It Does

1. **Live RFC 1436 TCP Server (`src/gopher/tcpServer.ts`):**
   - Speaks authentic CRLF / dot-terminated RFC 1436 wire frames on TCP `:7070`.
   - Routes hierarchical menu items (`0` plaintext capsule, `7` live Type-`7` search queries `/search\t<query>`, `3` error envelopes, `i` informational banners).
2. **Zero-Cost Ed25519 Capsule Signatures (`src/crypto/ed25519Capsules.ts`):**
   - Signs canonical `(selector, title, publishedAt, body)` records with Node `node:crypto` Ed25519 keys + SHA-256 digests.
   - Includes a 1-click **MITM Transit Tamper Test** demonstrating cryptographic failure (`SIGNATURE BROKEN`) on even a single injected line.
3. **Web Phosphor Gateway (`http://localhost:8790`):**
   - Connects over raw localhost TCP to the live Gopher daemon, displaying inspected capsule content alongside raw RFC 1436 wire output and a live signed-capsule publisher.

---

## Quick Start

```bash
npm install
npm run build
npm test
npm start
```

Open `http://localhost:8790` or query the Gopher socket directly:

```bash
printf '\r\n' | nc 127.0.0.1 7070
printf '/search\tEd25519\r\n' | nc 127.0.0.1 7070
```

---

## Kiroween `.kiro` Workflow Setup

1. Open this folder in **Kiro IDE** (`/Applications/Kiro.app`) or **`kiro-cli`** and sign in with your free AWS Builder ID / Kiro account.
2. Generate and verify `.kiro/specs/`, `.kiro/hooks/`, and `.kiro/steering/` inside this repo root before submitting to `kiroween.devpost.com` (make sure `.kiro` is committed and NOT gitignored!).

---

## Transparent Co-Engineering Note

Core RFC 1436 TCP & Ed25519 implementation was created cleanly under zero-billing, zero-PII, original MIT-compatible constraints with Google Antigravity, ready for genuine `.kiro/` spec/hook completion inside Kiro IDE/CLI.

---

## License

Released under the [MIT License](./LICENSE).
