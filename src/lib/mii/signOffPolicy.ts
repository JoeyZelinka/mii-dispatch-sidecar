import type { MiiState } from './processor';
import type { MiiDemoPolicy, SignOffPolicyGateResult, SignOffPolicyMode } from './types';
import { makeAuditEvent, newCorrelationId } from './audit';
import { nowIso } from './util';

const LABEL = 'Sign-Off Policy';

export function defaultDemoPolicy(): MiiDemoPolicy {
  return {
    id: 'policy_demo_default',
    name: 'Demo Municipality Policy',
    signOffPolicyMode: 'REQUIRED_FOR_PENNY',
    updatedAt: nowIso(),
  };
}

// Resolve audio/PENNY linkage and sign-off status for an incident. Read-only.
function resolveLinkage(state: MiiState, incidentId: string) {
  const attachments = state.audioTranscriptAttachments.filter(
    (a) => a.activeIncidentId === incidentId
  );
  const audioLinked = attachments.length > 0;

  let plan;
  for (const att of attachments) {
    const p = state.pennyPlans.find((pp) => pp.attachmentId === att.id);
    if (p) {
      plan = p;
      break;
    }
  }
  const pennyLinked = Boolean(plan);

  // Prefer the incident snapshot; fall back to the live review state.
  const incident = state.incidents.find((i) => i.id === incidentId);
  let signedOffBy = incident?.transcriptReviewSnapshot?.signedOffBy;
  let signedOffAt = incident?.transcriptReviewSnapshot?.signedOffAt;
  if (!signedOffBy && plan?.transcriptPackageId) {
    const rs = state.pennyReviewStates.find(
      (r) => r.planId === plan!.id && r.packageId === plan!.transcriptPackageId
    );
    if (rs?.signedOffBy) {
      signedOffBy = rs.signedOffBy;
      signedOffAt = rs.signedOffAt;
    }
  }

  return { audioLinked, pennyLinked, signedOff: Boolean(signedOffBy), signedOffBy, signedOffAt };
}

// Pure/read-only evaluation of the configurable sign-off policy gate.
export function evaluateSignOffPolicyGateForIncident(
  state: MiiState,
  incidentId: string
): SignOffPolicyGateResult {
  const mode = state.demoPolicy.signOffPolicyMode;
  const { audioLinked, pennyLinked, signedOff, signedOffBy, signedOffAt } = resolveLinkage(
    state,
    incidentId
  );

  const base = {
    label: LABEL,
    policyMode: mode,
    signedOff,
    signedOffBy,
    signedOffAt,
  };

  if (mode === 'NOT_REQUIRED') {
    return {
      ...base,
      status: 'NOT_APPLICABLE',
      required: false,
      appliesToIncident: false,
      summary: 'Transcript sign-off is not required by current demo policy.',
    };
  }

  if (mode === 'ADVISORY') {
    const applies = audioLinked || pennyLinked;
    if (!applies) {
      return {
        ...base,
        status: 'NOT_APPLICABLE',
        required: false,
        appliesToIncident: false,
        summary: 'Transcript sign-off is not applicable to this incident.',
      };
    }
    return {
      ...base,
      status: signedOff ? 'PASS' : 'ADVISORY',
      required: false,
      appliesToIncident: true,
      summary: signedOff
        ? 'Transcript review was signed off.'
        : 'Transcript sign-off is advisory under current demo policy.',
    };
  }

  if (mode === 'REQUIRED_FOR_PENNY') {
    if (!pennyLinked) {
      return {
        ...base,
        status: 'NOT_APPLICABLE',
        required: false,
        appliesToIncident: false,
        summary: 'Incident is not a PENNY-reviewed transcript; sign-off policy does not apply.',
      };
    }
    return {
      ...base,
      status: signedOff ? 'PASS' : 'BLOCKED',
      required: true,
      appliesToIncident: true,
      summary: signedOff
        ? 'Required PENNY transcript sign-off is complete.'
        : 'PENNY transcript sign-off is required before Mock CAD submission.',
    };
  }

  // REQUIRED_FOR_ALL_AUDIO
  if (!audioLinked) {
    return {
      ...base,
      status: 'NOT_APPLICABLE',
      required: false,
      appliesToIncident: false,
      summary: 'Incident has no audio transcript; sign-off policy does not apply.',
    };
  }
  return {
    ...base,
    status: signedOff ? 'PASS' : 'BLOCKED',
    required: true,
    appliesToIncident: true,
    summary: signedOff
      ? 'Required audio transcript sign-off is complete.'
      : 'Audio transcript sign-off is required before Mock CAD submission.',
  };
}

export function updateDemoPolicy(
  state: MiiState,
  mode: SignOffPolicyMode,
  actor: string = 'Dispatcher (you)'
): MiiDemoPolicy {
  state.demoPolicy.signOffPolicyMode = mode;
  state.demoPolicy.updatedAt = nowIso();
  state.audit.push(
    makeAuditEvent({
      correlationId: newCorrelationId(),
      action: 'DEMO_POLICY_UPDATED',
      actor,
      summary: `Demo sign-off policy updated to ${mode}.`,
      after: { signOffPolicyMode: mode },
    })
  );
  return state.demoPolicy;
}
