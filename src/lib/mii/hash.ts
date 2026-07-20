// Local deterministic SHA-256 hashing. Browser- and Node-safe. No external
// packages, no network. Used only for local demo tamper-evidence.

// Prefer Web Crypto (browser + modern Node). Falls back to node:crypto only
// when running under Node without a Web Crypto subtle implementation.
export async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const bytes = new TextEncoder().encode(input);
    const digest = await subtle.digest('SHA-256', bytes);
    return bufferToHex(new Uint8Array(digest));
  }

  // Node fallback only when Web Crypto is unavailable. The specifier is built at
  // runtime and marked webpackIgnore so client bundles never try to include it.
  // (Node 19+ exposes global crypto.subtle, so this path is a rare safety net.)
  const nodeModule = 'node:crypto';
  const nodeCrypto = (await import(/* webpackIgnore: true */ nodeModule)) as typeof import('node:crypto');
  return nodeCrypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function bufferToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}
