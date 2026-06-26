// Small deterministic-ish helpers. Runs client-side in the POC.

// Seed from the clock so ids stay unique across page reloads / rehydration.
let counter = Date.now();

// Monotonic id generator. Prefix keeps ids readable in audit/debug.
export function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bfifty\b/g, '50')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function clampConfidence(value: number): number {
  return Math.max(0, Math.min(0.97, value));
}
