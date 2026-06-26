import type { Zone } from './types';

export interface ZoneResolution {
  zone: Zone;
  rationale: string;
  streetNumber?: number;
}

// Pull candidate street numbers from address/cross-street text.
// Handles "174th", "180th", "210 174th Street", "Collins and 180th".
export function extractStreetNumbers(text: string): number[] {
  const matches = text.match(/\b(\d{2,3})(?:st|nd|rd|th)\b/gi) ?? [];
  return matches
    .map((m) => parseInt(m.replace(/(st|nd|rd|th)/i, ''), 10))
    .filter((n) => !Number.isNaN(n));
}

// Deterministic zone mapping from street numbers / directional hints.
//   195..181 -> North
//   180..172 -> Center
//   171..158 -> South
//   "east of Collins" -> Beach
//   else -> Unknown
export function resolveZone(text: string): ZoneResolution {
  const normalized = text.toLowerCase();

  if (normalized.includes('east of collins')) {
    return { zone: 'Beach', rationale: 'Text mentions "east of Collins" → Beach zone.' };
  }

  const numbers = extractStreetNumbers(text);
  for (const n of numbers) {
    if (n >= 181 && n <= 195) {
      return {
        zone: 'North',
        rationale: `Street number ${n} falls in 181–195 → North.`,
        streetNumber: n,
      };
    }
    if (n >= 172 && n <= 180) {
      return {
        zone: 'Center',
        rationale: `Street number ${n} falls in 172–180 → Center.`,
        streetNumber: n,
      };
    }
    if (n >= 158 && n <= 171) {
      return {
        zone: 'South',
        rationale: `Street number ${n} falls in 158–171 → South.`,
        streetNumber: n,
      };
    }
  }

  if (numbers.length > 0) {
    return {
      zone: 'Unknown',
      rationale: `Street number ${numbers[0]} is outside known zone bands; defaulting to Unknown.`,
      streetNumber: numbers[0],
    };
  }

  return { zone: 'Unknown', rationale: 'No street number or directional hint found → Unknown.' };
}
