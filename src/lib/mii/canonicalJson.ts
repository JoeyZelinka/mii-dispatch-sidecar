// Deterministic, dependency-free canonical JSON serialization for local
// tamper-evidence hashing. NOT cryptographic signing; local demo only.

// Serialize JSON-compatible data with object keys sorted alphabetically and
// array order preserved. Undefined object properties are omitted; undefined
// array elements serialize as null (to preserve array indexes). Input is never
// mutated. Output is stable across runs.
export function canonicalizeForHash(value: unknown): string {
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'number') return Number.isFinite(value as number) ? String(value) : 'null';
  if (t === 'boolean') return (value as boolean) ? 'true' : 'false';
  if (t === 'string') return JSON.stringify(value);
  if (t === 'undefined' || t === 'function') return 'null';

  if (Array.isArray(value)) {
    const items = value.map((v) => (v === undefined ? 'null' : serialize(v)));
    return `[${items.join(',')}]`;
  }

  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    const entries = keys.map((k) => `${JSON.stringify(k)}:${serialize(obj[k])}`);
    return `{${entries.join(',')}}`;
  }

  return 'null';
}

// Deep clone (JSON round-trip) and remove ONLY the top-level `integrity` field,
// so a hash can be computed over the export content excluding the hash itself.
export function stripAuditIntegrity(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const clone = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  delete clone.integrity;
  return clone;
}
