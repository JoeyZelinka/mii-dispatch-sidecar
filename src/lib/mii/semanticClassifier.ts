import type { CueEvent, SemanticType, SuggestedField } from './types';

export interface ClassifierState {
  hasActiveIncident: boolean;
  routingOpened: boolean;
  // Existing field values on the active incident, keyed by field key.
  knownFieldValues: Record<string, string>;
}

export interface Classification {
  semanticType: SemanticType;
  rationale: string;
}

const INCIDENT_DEFINING_KEYS = ['natureCode', 'address', 'vehicle', 'plate', 'crossStreet'];

function isAdminQuery(text: string): boolean {
  const t = text.toLowerCase();
  return /\bwhat units\b/.test(t) || /\bin service\b/.test(t) || /\bstatus check\b/.test(t);
}

function hasNewOrChangedFacts(
  fields: SuggestedField[],
  known: Record<string, string>
): boolean {
  return fields.some(
    (f) => INCIDENT_DEFINING_KEYS.includes(f.key) && known[f.key] !== f.value
  );
}

function repeatsKnownFacts(
  fields: SuggestedField[],
  known: Record<string, string>
): boolean {
  const defining = fields.filter((f) => INCIDENT_DEFINING_KEYS.includes(f.key));
  return defining.length > 0 && defining.every((f) => known[f.key] === f.value);
}

// Deterministic semantic classification. Explainable via rationale.
export function classifyLine(
  text: string,
  cues: CueEvent[],
  fields: SuggestedField[],
  state: ClassifierState
): Classification {
  const hasOpener = cues.some((c) => c.cueType === 'OFFICER_OPENER');
  const hasRouting = cues.some((c) => c.cueType === 'ROUTING');
  const hasQSL = cues.some((c) => c.phrase === 'QSL');
  const hasUnitStatus = cues.some((c) => c.cueType === 'UNIT_STATUS');
  const hasFacts = fields.some((f) => INCIDENT_DEFINING_KEYS.includes(f.key));

  // 1. Admin queries about unit state never create an incident.
  if (isAdminQuery(text)) {
    return {
      semanticType: 'ADMIN_CHATTER',
      rationale: 'Line asks about units in service and carries no incident facts → ADMIN_CHATTER.',
    };
  }

  // 2. Officer opener with 19 always starts a new event.
  if (hasOpener) {
    return {
      semanticType: 'NEW_EVENT',
      rationale: 'Officer-opener cue (unit + 19) → officer-initiated NEW_EVENT.',
    };
  }

  if (!state.hasActiveIncident) {
    if (hasFacts && (state.routingOpened || hasRouting)) {
      return {
        semanticType: 'NEW_EVENT',
        rationale:
          'Routing context is open and the line carries incident code/address details → NEW_EVENT.',
      };
    }
    if (hasRouting) {
      return {
        semanticType: 'NEW_EVENT',
        rationale: 'Routing cue opens a Sunny Isles routing context for a new event → NEW_EVENT.',
      };
    }
    // Protocol handshake or loose unit-status with no incident context.
    return {
      semanticType: 'ADMIN_CHATTER',
      rationale: 'No routing context and no incident facts → treated as ADMIN_CHATTER.',
    };
  }

  // 3. Active incident exists.
  if (hasUnitStatus) {
    return {
      semanticType: 'UPDATE',
      rationale: 'Unit status cue changes unit state on the active incident → UPDATE.',
    };
  }
  if (hasQSL || repeatsKnownFacts(fields, state.knownFieldValues)) {
    return {
      semanticType: 'CONFIRMATION',
      rationale:
        'QSL readback / repeats existing facts → CONFIRMATION (boost confidence, add provenance, no duplicate).',
    };
  }
  if (hasNewOrChangedFacts(fields, state.knownFieldValues)) {
    return {
      semanticType: 'UPDATE',
      rationale: 'Line adds new or changed field data to the active incident → UPDATE.',
    };
  }
  return {
    semanticType: 'CONFIRMATION',
    rationale: 'No new facts; line acknowledges existing incident → CONFIRMATION.',
  };
}
