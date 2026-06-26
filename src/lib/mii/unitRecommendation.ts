import type { IncidentContext, Unit, UnitRecommendation } from './types';
import { makeId } from './util';

// Deterministic, explainable unit recommendation.
// 1. Only AVAILABLE units.
// 2. Prefer units in the incident zone.
// 3. Then AtLarge units.
// 4. Then other AVAILABLE units.
// 5. Stable tie-breaker by unit number.
// 6. Top 3 with clear rationale.
export function recommendUnits(
  incident: IncidentContext,
  units: Unit[],
  sourceTranscriptLineIds: string[] = []
): UnitRecommendation[] {
  const available = units.filter((u) => u.status === 'AVAILABLE');

  const tier = (u: Unit): number => {
    if (u.zone === incident.zone && incident.zone !== 'Unknown' && incident.zone !== 'AtLarge') {
      return 0; // zone match
    }
    if (u.isAtLarge) return 1; // AtLarge fallback
    return 2; // available but outside zone
  };

  const rationaleFor = (u: Unit): string => {
    switch (tier(u)) {
      case 0:
        return `Zone match (${u.zone}) + AVAILABLE`;
      case 1:
        return 'AtLarge fallback + AVAILABLE';
      default:
        return `Available but outside zone (${u.zone})`;
    }
  };

  // Confidence scales down by tier; stable and explainable.
  const confidenceFor = (u: Unit): number => {
    switch (tier(u)) {
      case 0:
        return 0.9;
      case 1:
        return 0.78;
      default:
        return 0.66;
    }
  };

  const unitNumber = (u: Unit): number => {
    const m = u.displayName.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  };

  const sorted = [...available].sort((a, b) => {
    const t = tier(a) - tier(b);
    if (t !== 0) return t;
    return unitNumber(a) - unitNumber(b); // stable tie-break by unit number
  });

  return sorted.slice(0, 3).map((u, i) => ({
    id: makeId('rec'),
    incidentId: incident.id,
    unitId: u.id,
    rank: i + 1,
    confidence: confidenceFor(u),
    rationale: rationaleFor(u),
    sourceTranscriptLineIds,
  }));
}
