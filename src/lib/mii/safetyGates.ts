import type {
  IncidentContext,
  SignOffPolicyGateResult,
  SuggestedField,
  TranscriptReviewGateResult,
} from './types';

// Deterministic, explainable human-in-the-loop safety model. This is the single
// source of truth shared by SafetyGatesCard and the Submit Mock CAD gating, so
// the visible gates and the disabled-button reasons can never diverge.

export type GateStatus = 'pass' | 'warning' | 'fail';

export interface SafetyGate {
  id: 'A' | 'B' | 'C' | 'D' | 'E';
  key: 'asr' | 'unit' | 'core' | 'sensitive' | 'conflict';
  title: string;
  status: GateStatus;
  blocking: boolean; // does a failure of this gate block submission?
  message: string; // explanation shown under the gate
  blockReason?: string; // short reason listed under "Submit blocked because:"
}

function suggestedValue(incident: IncidentContext, key: string): string | undefined {
  return incident.suggestedFields.find((f) => f.key === key)?.value;
}

export function sensitiveFields(incident: IncidentContext): SuggestedField[] {
  return incident.suggestedFields.filter((f) => f.sensitive);
}

export function hasUnconfirmedSensitive(incident: IncidentContext): boolean {
  return sensitiveFields(incident).some((f) => !f.confirmed);
}

// Whether this incident type requires a responding unit before CAD submission.
export function requiresUnit(incident: IncidentContext): boolean {
  return Boolean(
    incident.natureCode ||
      incident.naturePlain ||
      suggestedValue(incident, 'natureCode') ||
      suggestedValue(incident, 'naturePlain')
  );
}

export function evaluateGates(incident: IncidentContext): SafetyGate[] {
  // Gate A — ASR Confirmed
  const gateA: SafetyGate = incident.asrConfirmed
    ? {
        id: 'A',
        key: 'asr',
        title: 'ASR Confirmed',
        status: 'pass',
        blocking: true,
        message: 'Dispatcher has confirmed the automatic speech recognition output.',
      }
    : {
        id: 'A',
        key: 'asr',
        title: 'ASR Confirmed',
        status: 'fail',
        blocking: true,
        message: 'Dispatcher must confirm ASR before mock CAD submission.',
        blockReason: 'ASR not confirmed',
      };

  // Gate B — Required Unit Assignment
  const needsUnit = requiresUnit(incident);
  const hasUnit = incident.assignedUnits.length > 0;
  const gateB: SafetyGate = !needsUnit
    ? {
        id: 'B',
        key: 'unit',
        title: 'Responding Unit',
        status: 'pass',
        blocking: false,
        message: 'No responding unit is required for this incident type.',
      }
    : hasUnit
      ? {
          id: 'B',
          key: 'unit',
          title: 'Responding Unit',
          status: 'pass',
          blocking: true,
          message: `${incident.assignedUnits.length} responding unit(s) assigned.`,
        }
      : {
          id: 'B',
          key: 'unit',
          title: 'Responding Unit',
          status: 'fail',
          blocking: true,
          message: 'At least one responding unit must be assigned before mock CAD submission.',
          blockReason: 'No responding unit assigned',
        };

  // Gate C — Required Core Fields
  const naturePresent = Boolean(
    incident.naturePlain ||
      incident.natureCode ||
      suggestedValue(incident, 'naturePlain') ||
      suggestedValue(incident, 'natureCode')
  );
  const locationPresent = Boolean(
    incident.address || suggestedValue(incident, 'address') || suggestedValue(incident, 'crossStreet')
  );
  const gateC: SafetyGate =
    naturePresent && locationPresent
      ? {
          id: 'C',
          key: 'core',
          title: 'Core Fields',
          status: 'pass',
          blocking: true,
          message: 'Nature and location/cross-street are present.',
        }
      : {
          id: 'C',
          key: 'core',
          title: 'Core Fields',
          status: 'fail',
          blocking: true,
          message: 'Nature and location/cross-street are required for mock CAD submission.',
          blockReason: 'Missing nature/location',
        };

  // Gate D — Sensitive Field Policy (warning only, never blocks)
  const sensitive = sensitiveFields(incident);
  const gateD: SafetyGate =
    sensitive.length === 0
      ? {
          id: 'D',
          key: 'sensitive',
          title: 'Sensitive Field Policy',
          status: 'pass',
          blocking: false,
          message: 'No sensitive fields detected on this incident.',
        }
      : hasUnconfirmedSensitive(incident)
        ? {
            id: 'D',
            key: 'sensitive',
            title: 'Sensitive Field Policy',
            status: 'warning',
            blocking: false,
            message: 'Unconfirmed sensitive fields will be excluded from the mock CAD payload.',
          }
        : {
            id: 'D',
            key: 'sensitive',
            title: 'Sensitive Field Policy',
            status: 'pass',
            blocking: false,
            message: 'All sensitive fields selected for inclusion have been explicitly confirmed.',
          };

  // Gate E — Conflict State
  const gateE: SafetyGate =
    incident.status !== 'CONFLICT'
      ? {
          id: 'E',
          key: 'conflict',
          title: 'Conflict State',
          status: 'pass',
          blocking: true,
          message: 'Incident is not in a conflict state.',
        }
      : {
          id: 'E',
          key: 'conflict',
          title: 'Conflict State',
          status: 'fail',
          blocking: true,
          message: 'Conflict state blocks mock CAD submission.',
          blockReason: 'Incident is in conflict',
        };

  return [gateA, gateB, gateC, gateD, gateE];
}

// Reasons the Submit Mock CAD action is blocked. Closed incidents also block.
export function submitBlockReasons(incident: IncidentContext): string[] {
  const reasons = evaluateGates(incident)
    .filter((g) => g.blocking && g.status === 'fail' && g.blockReason)
    .map((g) => g.blockReason as string);
  if (incident.status === 'CLOSED') reasons.push('Incident is closed');
  return reasons;
}

export function canSubmitMockCad(incident: IncidentContext): boolean {
  return submitBlockReasons(incident).length === 0;
}

// Phase 2G — richer readiness for the Incident Report that folds the (optional)
// transcript review gate into blocking reasons/warnings WITHOUT changing the
// base canSubmitMockCad()/submitBlockReasons() used elsewhere. A BLOCKED
// transcript review blocks submission here; a WARNING is surfaced but does not
// block (consistent with the non-blocking sensitive-field policy).
export function evaluateIncidentSafetyReadiness(
  incident: IncidentContext,
  transcriptReviewGate?: TranscriptReviewGateResult,
  signOffPolicyGate?: SignOffPolicyGateResult
): {
  gates: SafetyGate[];
  transcriptReviewGate?: TranscriptReviewGateResult;
  signOffPolicyGate?: SignOffPolicyGateResult;
  blockingReasons: string[];
  warnings: string[];
  canSubmit: boolean;
} {
  const gates = evaluateGates(incident);
  const blockingReasons = [...submitBlockReasons(incident)];
  const warnings: string[] = [];

  if (transcriptReviewGate) {
    if (transcriptReviewGate.status === 'BLOCKED') {
      blockingReasons.push('Transcript review is blocked');
    } else if (transcriptReviewGate.status === 'WARNING') {
      warnings.push('Transcript review has unresolved warning issue(s)');
    }
  }

  if (signOffPolicyGate) {
    if (signOffPolicyGate.status === 'BLOCKED') {
      blockingReasons.push('Transcript sign-off is required by policy');
    } else if (signOffPolicyGate.status === 'ADVISORY') {
      warnings.push('Transcript sign-off is advisory and not yet complete');
    }
  }

  return {
    gates,
    transcriptReviewGate,
    signOffPolicyGate,
    blockingReasons,
    warnings,
    canSubmit: blockingReasons.length === 0,
  };
}
