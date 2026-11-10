import { createHash, generateKeyPairSync, sign, verify } from 'node:crypto';

export interface Ed25519Keyring {
  publicKeyPem: string;
  privateKeyPem: string;
  keyFingerprint: string;
}

export interface SignedGopherCapsule {
  selector: string;
  title: string;
  body: string;
  author: string;
  publishedAt: string;
  sha256: string;
  signatureBase64: string;
  publicKeyPem: string;
  keyFingerprint: string;
}

export function createEd25519Keyring(): Ed25519Keyring {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const keyFingerprint = createHash('sha256').update(publicKey).digest('hex').slice(0, 16);
  return { publicKeyPem: publicKey, privateKeyPem: privateKey, keyFingerprint };
}

function canonicalPayload(selector: string, title: string, body: string, publishedAt: string): Buffer {
  return Buffer.from(`${selector}\n${title}\n${publishedAt}\n${body}`, 'utf8');
}

export function signGopherCapsule(
  params: { selector: string; title: string; body: string; author: string; publishedAt?: string },
  keyring: Ed25519Keyring
): SignedGopherCapsule {
  const publishedAt = params.publishedAt ?? new Date().toISOString();
  const payload = canonicalPayload(params.selector, params.title, params.body, publishedAt);
  const sha256 = createHash('sha256').update(payload).digest('hex');
  const sig = sign(null, payload, keyring.privateKeyPem);

  return {
    selector: params.selector,
    title: params.title,
    body: params.body,
    author: params.author,
    publishedAt,
    sha256,
    signatureBase64: sig.toString('base64'),
    publicKeyPem: keyring.publicKeyPem,
    keyFingerprint: keyring.keyFingerprint,
  };
}

export function verifyGopherCapsule(capsule: SignedGopherCapsule): {
  valid: boolean;
  reason: string;
} {
  try {
    const payload = canonicalPayload(capsule.selector, capsule.title, capsule.body, capsule.publishedAt);
    const recomputedHash = createHash('sha256').update(payload).digest('hex');
    if (recomputedHash !== capsule.sha256) {
      return { valid: false, reason: 'SHA-256 digest mismatch — capsule content was modified in transit.' };
    }
    const ok = verify(null, payload, capsule.publicKeyPem, Buffer.from(capsule.signatureBase64, 'base64'));
    return ok
      ? { valid: true, reason: `Verified Ed25519 signature (key ${capsule.keyFingerprint}).` }
      : { valid: false, reason: 'Invalid Ed25519 signature.' };
  } catch (err) {
    return { valid: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
