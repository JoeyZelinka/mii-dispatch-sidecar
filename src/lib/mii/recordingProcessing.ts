import type { MiiState } from './processor';
import type {
  AuditAction,
  HumanCheckpoint,
  HumanCheckpointKind,
  RecordingProcessingSession,
} from './types';
import { makeAuditEvent, newCorrelationId } from './audit';
import { makeId, nowIso } from './util';

// Phase 3A — Play-to-Process recording session orchestration. Automated
// preparation runs to explicit human checkpoints; nothing here signs off,
// attaches, processes incidents, or submits mock CAD automatically. Local only.

const SESSION_ACTOR = 'Dispatcher (you)';

const CHECKPOINT_DEFS: { kind: HumanCheckpointKind; label: string; required: boolean }[] = [
  { kind: 'START_PROCESSING', label: 'Human starts Play & Process', required: true },
  { kind: 'REVIEW_TRANSCRIPT', label: 'Human reviews PENNY transcript package', required: true },
  { kind: 'SIGN_OFF_REVIEW', label: 'Human signs off transcript review', required: true },
  { kind: 'ATTACH_TRANSCRIPT', label: 'Human attaches reviewed transcript', required: true },
  { kind: 'PROCESS_INCIDENT', label: 'Human processes attached transcript', required: true },
  { kind: 'REVIEW_SAFETY_GATES', label: 'Human reviews incident safety gates', required: true },
  { kind: 'SUBMIT_MOCK_CAD', label: 'Human submits Mock CAD if gates allow', required: false },
  { kind: 'EXPORT_AUDIT', label: 'Human exports/verifies local audit', required: false },
];

function sessionAudit(
  draft: MiiState,
  action: AuditAction,
  actor: string,
  summary: string,
  correlationId: string,
  after?: unknown
): void {
  draft.audit.push(makeAuditEvent({ correlationId, action, actor, summary, after }));
}

function completeCheckpoint(
  session: RecordingProcessingSession,
  kind: HumanCheckpointKind,
  actor: string,
  summary?: string
): boolean {
  const cp = session.checkpoints.find((c) => c.kind === kind);
  if (!cp || cp.completed) return false;
  cp.completed = true;
  cp.completedAt = nowIso();
  cp.actor = actor;
  if (summary) cp.summary = summary;
  return true;
}

function assetFilename(draft: MiiState, audioAssetId: string): string {
  return draft.audioAssets.find((a) => a.id === audioAssetId)?.filename ?? 'recording';
}

export function createRecordingProcessingSession(
  draft: MiiState,
  input: { audioAssetId: string; actor?: string; notes?: string }
): RecordingProcessingSession {
  const actor = input.actor ?? SESSION_ACTOR;
  const checkpoints: HumanCheckpoint[] = CHECKPOINT_DEFS.map((d) => ({
    id: makeId('cp'),
    kind: d.kind,
    label: d.label,
    required: d.required,
    completed: false,
  }));

  const session: RecordingProcessingSession = {
    id: makeId('rps'),
    audioAssetId: input.audioAssetId,
    status: 'READY',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    checkpoints,
    notes: input.notes,
  };
  draft.recordingProcessingSessions.push(session);

  sessionAudit(
    draft,
    'RECORDING_PROCESSING_SESSION_CREATED',
    actor,
    `Play-to-Process session created for ${assetFilename(draft, input.audioAssetId)}.`,
    session.id,
    { sessionId: session.id, audioAssetId: input.audioAssetId }
  );
  return session;
}

export function markRecordingCheckpoint(
  draft: MiiState,
  input: { sessionId: string; kind: HumanCheckpointKind; actor?: string; summary?: string }
): RecordingProcessingSession | undefined {
  const actor = input.actor ?? SESSION_ACTOR;
  const session = draft.recordingProcessingSessions.find((s) => s.id === input.sessionId);
  if (!session) return undefined;
  const changed = completeCheckpoint(session, input.kind, actor, input.summary);
  session.updatedAt = nowIso();
  if (changed) {
    sessionAudit(
      draft,
      'RECORDING_PROCESSING_CHECKPOINT_COMPLETED',
      actor,
      `Human checkpoint completed: ${input.kind.replace(/_/g, ' ')}.`,
      session.id,
      { sessionId: session.id, kind: input.kind }
    );
  }
  return session;
}

export function startRecordingProcessingSession(
  draft: MiiState,
  input: { sessionId: string; actor?: string }
): RecordingProcessingSession | undefined {
  const actor = input.actor ?? SESSION_ACTOR;
  const session = draft.recordingProcessingSessions.find((s) => s.id === input.sessionId);
  if (!session) return undefined;
  session.status = 'PROCESSING_STARTED';
  if (!session.startedAt) session.startedAt = nowIso();
  completeCheckpoint(session, 'START_PROCESSING', actor, 'Play & Process started.');
  session.updatedAt = nowIso();
  sessionAudit(
    draft,
    'RECORDING_PROCESSING_STARTED',
    actor,
    `Play-to-Process started for ${assetFilename(draft, session.audioAssetId)}.`,
    session.id,
    { sessionId: session.id }
  );
  return session;
}

export function linkRecordingSessionToPennyPlan(
  draft: MiiState,
  input: { sessionId: string; pennyPlanId: string; actor?: string }
): RecordingProcessingSession | undefined {
  const session = draft.recordingProcessingSessions.find((s) => s.id === input.sessionId);
  if (!session) return undefined;
  const plan = draft.pennyPlans.find((p) => p.id === input.pennyPlanId);
  session.pennyPlanId = input.pennyPlanId;
  if (plan) {
    session.asrJobId = plan.asrJobId ?? session.asrJobId;
    session.asrResultId = plan.asrResultId ?? session.asrResultId;
    session.transcriptPackageId = plan.transcriptPackageId ?? session.transcriptPackageId;
    session.attachmentId = plan.attachmentId ?? session.attachmentId;
  }
  session.status = session.transcriptPackageId ? 'AWAITING_HUMAN_REVIEW' : 'PENNY_PLAN_CREATED';
  session.updatedAt = nowIso();
  return session;
}

// Pull the latest linked ids from the PENNY plan/package/review/attachment and
// advance the session status + human checkpoints accordingly. Read-only w.r.t.
// unrelated state; only mutates this session.
export function refreshRecordingProcessingSessionLinks(
  draft: MiiState,
  sessionId: string
): RecordingProcessingSession | undefined {
  const session = draft.recordingProcessingSessions.find((s) => s.id === sessionId);
  if (!session || !session.pennyPlanId) return session;
  if (session.status === 'COMPLETED' || session.status === 'CANCELLED') return session;

  const plan = draft.pennyPlans.find((p) => p.id === session.pennyPlanId);
  if (!plan) return session;

  session.asrJobId = plan.asrJobId ?? session.asrJobId;
  session.asrResultId = plan.asrResultId ?? session.asrResultId;
  session.transcriptPackageId = plan.transcriptPackageId ?? session.transcriptPackageId;
  session.attachmentId = plan.attachmentId ?? session.attachmentId;

  const reviewState = plan.transcriptPackageId
    ? draft.pennyReviewStates.find(
        (r) => r.planId === plan.id && r.packageId === plan.transcriptPackageId
      )
    : undefined;
  if (reviewState) session.reviewStateId = reviewState.id;

  // Advance status from the most-progressed linked artifact downward.
  let status = session.status;
  if (session.transcriptPackageId) status = 'AWAITING_HUMAN_REVIEW';
  if (reviewState?.signedOffAt) {
    status = 'REVIEW_SIGNED_OFF';
    completeCheckpoint(session, 'SIGN_OFF_REVIEW', reviewState.signedOffBy ?? SESSION_ACTOR);
  }

  if (session.attachmentId) {
    status = 'TRANSCRIPT_ATTACHED';
    completeCheckpoint(session, 'ATTACH_TRANSCRIPT', SESSION_ACTOR);
    const attachment = draft.audioTranscriptAttachments.find((a) => a.id === session.attachmentId);
    if (attachment?.activeIncidentId) {
      session.incidentId = attachment.activeIncidentId;
      status = 'INCIDENT_PROCESSED';
      completeCheckpoint(session, 'PROCESS_INCIDENT', SESSION_ACTOR);
    }
  }

  session.status = status;
  session.updatedAt = nowIso();
  return session;
}

export function completeRecordingProcessingSession(
  draft: MiiState,
  sessionId: string,
  actor: string = SESSION_ACTOR
): RecordingProcessingSession | undefined {
  const session = draft.recordingProcessingSessions.find((s) => s.id === sessionId);
  if (!session) return undefined;
  session.status = 'COMPLETED';
  session.completedAt = nowIso();
  session.updatedAt = nowIso();
  sessionAudit(
    draft,
    'RECORDING_PROCESSING_SESSION_COMPLETED',
    actor,
    `Play-to-Process session completed for ${assetFilename(draft, session.audioAssetId)}.`,
    session.id,
    { sessionId: session.id }
  );
  return session;
}

export function cancelRecordingProcessingSession(
  draft: MiiState,
  sessionId: string,
  actor: string = SESSION_ACTOR
): RecordingProcessingSession | undefined {
  const session = draft.recordingProcessingSessions.find((s) => s.id === sessionId);
  if (!session) return undefined;
  session.status = 'CANCELLED';
  session.updatedAt = nowIso();
  sessionAudit(
    draft,
    'RECORDING_PROCESSING_SESSION_CANCELLED',
    actor,
    `Play-to-Process session cancelled for ${assetFilename(draft, session.audioAssetId)}.`,
    session.id,
    { sessionId: session.id }
  );
  return session;
}
