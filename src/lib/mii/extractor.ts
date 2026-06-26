import type { SuggestedField, TranscriptLine } from './types';
import { translateSignal } from './dictionary';
import { makeId } from './util';

export const FIELD_CONFIDENCE = {
  NATURE: 0.88,
  ADDRESS: 0.82,
  APARTMENT: 0.8,
  VEHICLE: 0.78,
  PLATE: 0.76,
  CROSS_STREET: 0.82,
} as const;

interface RawField {
  key: string;
  label: string;
  value: string;
  confidence: number;
  sensitive: boolean;
}

// Deterministic field extraction from a single transcript line.
// Returns SuggestedField objects with provenance back to the source line.
export function extractFields(line: TranscriptLine): SuggestedField[] {
  const text = line.text;
  const raw: RawField[] = [];

  // --- Nature / signal code: 3-41, 41, 19 ---
  const signalMatch = text.match(/\b(3-41|41|19)\b/);
  if (signalMatch) {
    const code = signalMatch[1];
    const plain = translateSignal(code) ?? 'Unknown signal';
    raw.push({
      key: 'natureCode',
      label: 'Nature Code',
      value: code,
      confidence: FIELD_CONFIDENCE.NATURE,
      sensitive: false,
    });
    raw.push({
      key: 'naturePlain',
      label: 'Nature (Plain Talk)',
      value: plain,
      confidence: FIELD_CONFIDENCE.NATURE,
      sensitive: false,
    });
  }

  // --- Address: "210 174th Street" ---
  const addressMatch = text.match(/\b(\d+\s+\d{1,3}(?:st|nd|rd|th)\s+street)\b/i);
  if (addressMatch) {
    raw.push({
      key: 'address',
      label: 'Address',
      value: titleCase(addressMatch[1]),
      confidence: FIELD_CONFIDENCE.ADDRESS,
      sensitive: false,
    });
  }

  // --- Apartment: "Apartment 123" / "Apt 123" ---
  const aptMatch = text.match(/\b(?:apartment|apt)\.?\s+(\w+)\b/i);
  if (aptMatch) {
    raw.push({
      key: 'apartment',
      label: 'Apartment',
      value: `Apartment ${aptMatch[1]}`,
      confidence: FIELD_CONFIDENCE.APARTMENT,
      sensitive: false,
    });
  }

  // --- Vehicle: "red Honda" ---
  const vehicleMatch = text.match(
    /\b(red|blue|black|white|silver|gray|grey|green|gold)\s+(honda|toyota|ford|chevy|chevrolet|nissan|bmw|kia|hyundai|jeep|tesla)\b/i
  );
  if (vehicleMatch) {
    raw.push({
      key: 'vehicle',
      label: 'Vehicle Description',
      value: `${titleCase(vehicleMatch[1])} ${titleCase(vehicleMatch[2])}`,
      confidence: FIELD_CONFIDENCE.VEHICLE,
      sensitive: false,
    });
  }

  // --- Plate / tag (SENSITIVE): "Florida tag 123ABC" ---
  const plateMatch = text.match(/\btag\s+([a-z0-9]{4,8})\b/i);
  if (plateMatch) {
    raw.push({
      key: 'plate',
      label: 'License Plate / Tag',
      value: plateMatch[1].toUpperCase(),
      confidence: FIELD_CONFIDENCE.PLATE,
      sensitive: true,
    });
  }

  // --- Cross street: "Collins and 180th" ---
  const crossMatch = text.match(
    /\b([a-z]+)\s+and\s+(\d{1,3}(?:st|nd|rd|th)|[a-z]+(?:\s+(?:street|avenue|ave|st))?)\b/i
  );
  if (crossMatch && !/\b(?:apartment|apt)\b/i.test(crossMatch[0])) {
    raw.push({
      key: 'crossStreet',
      label: 'Cross Street',
      value: `${titleCase(crossMatch[1])} and ${titleCase(crossMatch[2])}`,
      confidence: FIELD_CONFIDENCE.CROSS_STREET,
      sensitive: false,
    });
  }

  return raw.map((r) => ({
    id: makeId('field'),
    key: r.key,
    label: r.label,
    value: r.value,
    confidence: r.confidence,
    sensitive: r.sensitive,
    confirmed: false,
    provenanceText: text,
    sourceTranscriptLineIds: [line.id],
  }));
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}
