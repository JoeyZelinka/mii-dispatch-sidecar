import type { MiiState } from './processor';
import type { TranscriptReviewGateResult } from './types';
import { evaluatePennyQualityGate } from './penny';

const LABEL = 'Transcript Review';

function notApplicable(summary: string): TranscriptReviewGateResult {
  return {
    status: 'NOT_APPLICABLE',
    label: LABEL,
    summary,
    blockingCount: 0,
    warningCount: 0,
    infoCount: 0,
    unresolvedWarningCount: 0,
    unresolvedBlockingCount: 0,
  };
}

// Pure/read-only. Surfaces PENNY transcript review status for an incident by
// walking incident → attachment → PENNY plan → package → review state. Returns
// NOT_APPLICABLE for incidents not created from a PENNY-reviewed package.
export function evaluateTranscriptReviewGateForIncident(
  state: MiiState,
  incidentId: string
): TranscriptReviewGateResult {
  const incident = state.incidents.find((i) => i.id === incidentId);
  if (!incident) {
    return notApplicable('No PENNY-linked transcript review is attached to this incident.');
  }

  const linkedAttachments = state.audioTranscriptAttachments.filter(
    (a) => a.activeIncidentId === incident.id
  );
  if (linkedAttachments.length === 0) {
    return notApplicable('No PENNY-linked transcript review is attached to this incident.');
  }

  // Prefer an attachment that is linked to a PENNY plan.
  let plan;
  let attachment;
  for (const att of linkedAttachments) {
    const p = state.pennyPlans.find((pp) => pp.attachmentId === att.id);
    if (p) {
      plan = p;
      attachment = att;
      break;
    }
  }
  if (!plan || !attachment) {
    return notApplicable('Incident was not created from a PENNY-reviewed transcript package.');
  }

  const pkg = plan.transcriptPackageId
    ? state.pennyTranscriptPackages.find((p) => p.id === plan!.transcriptPackageId)
    : undefined;
  if (!pkg) {
    return notApplicable('Incident was not created from a PENNY-reviewed transcript package.');
  }

  const reviewState = state.pennyReviewStates.find(
    (r) => r.planId === plan!.id && r.packageId === pkg.id
  );
  const gate = evaluatePennyQualityGate(state, plan.id, pkg.id);

  const latestReviewer = reviewState?.signedOffBy ?? reviewState?.reviewer;
  const latestReviewAt = reviewState?.signedOffAt ?? reviewState?.updatedAt;

  const base = {
    label: LABEL,
    linkedPlanId: plan.id,
    linkedPackageId: pkg.id,
    linkedReviewStateId: reviewState?.id,
    reviewReady: reviewState?.reviewReady,
    readyForAttachment: reviewState?.readyForAttachment ?? pkg.readyForAttachment,
    blockingCount: gate.blockingCount,
    warningCount: gate.warningCount,
    infoCount: gate.infoCount,
    unresolvedWarningCount: gate.unresolvedWarningCount,
    unresolvedBlockingCount: gate.unresolvedBlockingCount,
    latestReviewer,
    latestReviewAt,
  };

  if (gate.status === 'BLOCKED') {
    return { ...base, status: 'BLOCKED', summary: 'PENNY transcript review has unresolved blocking issue(s).' };
  }
  if (gate.status === 'WARNING') {
    return { ...base, status: 'WARNING', summary: 'PENNY transcript review has unresolved warning issue(s).' };
  }

  // PASS. Distinguish the auto-clean (no review state) case.
  if (!reviewState) {
    return {
      ...base,
      status: 'PASS',
      summary: 'Transcript package was ready for attachment with no unresolved review issues.',
    };
  }
  return {
    ...base,
    status: 'PASS',
    summary: 'PENNY transcript review passed; package was ready for attachment before processing.',
  };
}
