import type { CueEvent, TranscriptLine } from './types';
import { makeId, normalize } from './util';

export const CUE_CONFIDENCE = {
  ROUTING: 0.92,
  OFFICER_OPENER: 0.9,
  PROTOCOL_TOKEN: 0.86,
  UNIT_STATUS: 0.84,
} as const;

interface RawCue {
  phrase: string;
  cueType: CueEvent['cueType'];
  confidence: number;
  routedAgency?: string;
  rationale: string;
}

// Deterministic, explainable cue detection over a single transcript line.
export function detectCues(line: TranscriptLine): CueEvent[] {
  const norm = normalize(line.text);
  const raw: RawCue[] = [];

  // --- Routing cue: "sunny isles fifty" / "sunny isles 50" ---
  if (/\bsunny isles 50\b/.test(norm)) {
    raw.push({
      phrase: 'Sunny Isles 50',
      cueType: 'ROUTING',
      confidence: CUE_CONFIDENCE.ROUTING,
      routedAgency: 'SIBPD',
      rationale: 'Matched routing cue "Sunny Isles 50" → opens Sunny Isles (SIBPD) routing context.',
    });
  }

  // --- Officer opener: "sunny isles {unit}, 19" ---
  const opener = norm.match(/\bsunny isles (\d{2,3}) 19\b/);
  if (opener) {
    raw.push({
      phrase: `Sunny Isles ${opener[1]}, 19`,
      cueType: 'OFFICER_OPENER',
      confidence: CUE_CONFIDENCE.OFFICER_OPENER,
      routedAgency: 'SIBPD',
      rationale: `Matched officer-opener pattern "Sunny Isles ${opener[1]}, 19" → officer-initiated traffic stop.`,
    });
  }

  // --- Protocol tokens: qsk / qsl ---
  if (/\bqsk\b/.test(norm)) {
    raw.push({
      phrase: 'QSK',
      cueType: 'PROTOCOL_TOKEN',
      confidence: CUE_CONFIDENCE.PROTOCOL_TOKEN,
      rationale: 'Protocol token QSK → "proceed with transmission / go ahead".',
    });
  }
  if (/\bqsl\b/.test(norm)) {
    raw.push({
      phrase: 'QSL',
      cueType: 'PROTOCOL_TOKEN',
      confidence: CUE_CONFIDENCE.PROTOCOL_TOKEN,
      rationale: 'Protocol token QSL → "acknowledge / affirmative" (readback/confirmation).',
    });
  }

  // --- Unit status cues ---
  if (/\ben route\b/.test(norm)) {
    raw.push({
      phrase: 'en route',
      cueType: 'UNIT_STATUS',
      confidence: CUE_CONFIDENCE.UNIT_STATUS,
      rationale: 'Unit status cue "en route" → unit EN_ROUTE.',
    });
  }
  if (/\barrival\b/.test(norm)) {
    raw.push({
      phrase: 'arrival',
      cueType: 'UNIT_STATUS',
      confidence: CUE_CONFIDENCE.UNIT_STATUS,
      rationale: 'Unit status cue "arrival" → unit ARRIVED.',
    });
  }
  if (/\bavailable\b/.test(norm)) {
    raw.push({
      phrase: 'available',
      cueType: 'UNIT_STATUS',
      confidence: CUE_CONFIDENCE.UNIT_STATUS,
      rationale: 'Unit status cue "available" → unit AVAILABLE.',
    });
  }
  if (/\bout of service\b/.test(norm)) {
    raw.push({
      phrase: 'out of service',
      cueType: 'UNIT_STATUS',
      confidence: CUE_CONFIDENCE.UNIT_STATUS,
      rationale: 'Unit status cue "out of service" → unit OUT_OF_SERVICE.',
    });
  }

  return raw.map((r) => ({
    id: makeId('cue'),
    phrase: r.phrase,
    cueType: r.cueType,
    confidence: r.confidence,
    routedAgency: r.routedAgency,
    timestamp: line.timestamp,
    transcriptLineId: line.id,
    rationale: r.rationale,
  }));
}
