import type {
  AsrProvider,
  AsrTranscriptResult,
  AudioTranscriptAttachment,
  AuditAction,
  PennyDecision,
  PennyDecisionType,
  PennyTranscriptPackage,
  PennyTranscriptionPlan,
  TranscriptQualityIssue,
  TranscriptQualityIssueKind,
  TranscriptQualityIssueSeverity,
} from './types';
import {
  type MiiState,
  advanceAsrJob,
  attachAsrResultToAudio,
  attachTranscriptToAudio,
  requestAsrJob,
  runAsrJobToCompletion,
} from './processor';
import { getAsrProviderDefinition } from './asr/providerRegistry';
import { makeAuditEvent, newCorrelationId } from './audit';
import { makeId, nowIso } from './util';

// P.E.N.N.Y. — Provenance Engine for Normalized Narrative Yield.
//
// Deterministic, local transcription orchestrator. PENNY coordinates provider
// selection, the ASR job lifecycle, transcript normalization, quality review,
// and handoff readiness. It NEVER performs real ASR, NEVER creates or mutates
// incidents, and NEVER writes CAD. It only prepares a reviewed transcript
// package for attachment into the existing (human-driven) MII pipeline.

export const PENNY_LOW_CONFIDENCE_THRESHOLD = 0.8;
export const PENNY_BLOCKING_CONFIDENCE_THRESHOLD = 0.55;

const PENNY_ACTOR = 'P.E.N.N.Y. orchestrator';

// --- small local helpers -------------------------------------------------

function pennyAudit(
  draft: MiiState,
  action: AuditAction,
  actor: string,
  summary: string,
  correlationId: string,
  after?: unknown
): void {
  draft.audit.push(
    makeAuditEvent({ correlationId, action, actor, summary, after })
  );
}

function addDecision(
  plan: PennyTranscriptionPlan,
  type: PennyDecisionType,
  summary: string,
  sourceId?: string
): void {
  plan.decisions.push({
    id: makeId('pdec'),
    planId: plan.id,
    type,
    summary,
    createdAt: nowIso(),
    sourceId,
  });
  plan.updatedAt = nowIso();
}

function makeIssue(
  kind: TranscriptQualityIssueKind,
  severity: TranscriptQualityIssueSeverity,
  summary: string,
  extra?: { segmentId?: string; confidence?: number }
): TranscriptQualityIssue {
  return {
    id: makeId('pqi'),
    kind,
    severity,
    summary,
    segmentId: extra?.segmentId,
    confidence: extra?.confidence,
    createdAt: nowIso(),
  };
}

function assetFilename(draft: MiiState, audioAssetId: string): string {
  return draft.audioAssets.find((a) => a.id === audioAssetId)?.filename ?? 'audio asset';
}

// Trim lines, collapse duplicate blank lines, preserve "Speaker: text". Never
// rewrites facts and never strips sensitive content (later gates handle that).
function normalizeTranscript(text: string): string {
  const lines = text.split('\n').map((l) => l.trim());
  const out: string[] = [];
  let prevBlank = false;
  for (const l of lines) {
    const blank = l.length === 0;
    if (blank && prevBlank) continue;
    out.push(l);
    prevBlank = blank;
  }
  while (out.length && out[0] === '') out.shift();
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

function looksLikeAdminOnly(text: string, scenarioId?: string): boolean {
  if (scenarioId === 'admin-chatter') return true;
  const hasFacts =
    /\b(3-41|41|19)\b/.test(text) ||
    /\b\d+\s+\d{1,3}(?:st|nd|rd|th)\s+street\b/i.test(text);
  const hasAdmin = /(in service|out of service|available|what units)/i.test(text);
  return !hasFacts && hasAdmin;
}

function hasSensitiveContent(text: string): boolean {
  return /\btag\s+[a-z0-9]{4,8}\b/i.test(text) || /\bplate\b/i.test(text);
}

// Keep plan status in sync with its ASR job status.
function updatePlanFromJob(draft: MiiState, plan: PennyTranscriptionPlan): void {
  const job = draft.asrJobs.find((j) => j.id === plan.asrJobId);
  if (!job) return;
  if (job.status === 'COMPLETED') {
    plan.status = 'ASR_COMPLETED';
    plan.asrResultId = job.resultId;
  } else if (job.status === 'FAILED') {
    plan.status = 'FAILED';
    plan.asrResultId = job.resultId;
  } else if (job.status === 'CANCELLED') {
    plan.status = 'CANCELLED';
  } else {
    plan.status = 'ASR_JOB_RUNNING';
  }
  plan.updatedAt = nowIso();
}

// --- plan lifecycle ------------------------------------------------------

export function createPennyPlan(
  draft: MiiState,
  input: {
    audioAssetId: string;
    provider: AsrProvider;
    scenarioId?: string;
    freeformTranscriptText?: string;
    notes?: string;
    actor?: string;
  }
): PennyTranscriptionPlan {
  const actor = input.actor ?? PENNY_ACTOR;
  const filename = assetFilename(draft, input.audioAssetId);
  const providerLabel = getAsrProviderDefinition(input.provider).label;

  const plan: PennyTranscriptionPlan = {
    id: makeId('penny'),
    audioAssetId: input.audioAssetId,
    provider: input.provider,
    status: 'DRAFT',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    scenarioId: input.scenarioId,
    freeformTranscriptText: input.freeformTranscriptText,
    decisions: [],
    notes: input.notes,
  };
  addDecision(
    plan,
    'PROVIDER_SELECTED',
    `PENNY selected ${providerLabel} for transcription orchestration.`,
    input.provider
  );
  draft.pennyPlans.push(plan);

  pennyAudit(
    draft,
    'PENNY_PLAN_CREATED',
    actor,
    `PENNY transcription plan created for ${filename} using ${providerLabel}.`,
    plan.id,
    { planId: plan.id, provider: plan.provider }
  );
  return plan;
}

export function pennyRequestAsrJob(
  draft: MiiState,
  planId: string,
  actor: string = PENNY_ACTOR
): PennyTranscriptionPlan | undefined {
  const plan = draft.pennyPlans.find((p) => p.id === planId);
  if (!plan) return undefined;
  if (plan.asrJobId) return plan;

  const job = requestAsrJob(draft, plan.audioAssetId, {
    provider: plan.provider,
    scenarioId: plan.scenarioId,
    freeformTranscriptText: plan.freeformTranscriptText,
    actor,
  });
  plan.asrJobId = job.id;
  plan.status = 'ASR_JOB_REQUESTED';
  plan.updatedAt = nowIso();
  addDecision(plan, 'ASR_JOB_REQUESTED', `PENNY requested ASR job ${job.id}.`, job.id);

  pennyAudit(
    draft,
    'PENNY_ASR_JOB_REQUESTED',
    actor,
    `PENNY requested ASR job for ${assetFilename(draft, plan.audioAssetId)}.`,
    plan.id,
    { planId: plan.id, asrJobId: job.id }
  );
  return plan;
}

export function pennyAdvanceAsrJob(
  draft: MiiState,
  planId: string,
  actor: string = PENNY_ACTOR
): PennyTranscriptionPlan | undefined {
  const plan = draft.pennyPlans.find((p) => p.id === planId);
  if (!plan) return undefined;
  if (!plan.asrJobId) pennyRequestAsrJob(draft, planId, actor);
  if (plan.asrJobId) advanceAsrJob(draft, plan.asrJobId, actor);
  updatePlanFromJob(draft, plan);
  return plan;
}

export function pennyRunAsrToCompletion(
  draft: MiiState,
  planId: string,
  actor: string = PENNY_ACTOR
): PennyTranscriptionPlan | undefined {
  const plan = draft.pennyPlans.find((p) => p.id === planId);
  if (!plan) return undefined;
  if (!plan.asrJobId) pennyRequestAsrJob(draft, planId, actor);
  if (plan.asrJobId) runAsrJobToCompletion(draft, plan.asrJobId, actor);
  updatePlanFromJob(draft, plan);
  return plan;
}

// --- quality review + normalization --------------------------------------

export function evaluateAsrResultForPenny(
  draft: MiiState,
  planId: string,
  actor: string = PENNY_ACTOR
): PennyTranscriptPackage | undefined {
  const plan = draft.pennyPlans.find((p) => p.id === planId);
  if (!plan) return undefined;
  const filename = assetFilename(draft, plan.audioAssetId);
  const result: AsrTranscriptResult | undefined = plan.asrResultId
    ? draft.asrTranscriptResults.find((r) => r.id === plan.asrResultId)
    : undefined;

  const issues: TranscriptQualityIssue[] = [];
  let normalized = '';
  let segmentCount = 0;
  let averageConfidence: number | undefined;
  let lowestConfidence: number | undefined;

  if (!result) {
    issues.push(makeIssue('NO_ASR_RESULT', 'BLOCKING', 'No ASR result is available to review.'));
  } else if (result.status === 'FAILED') {
    issues.push(
      makeIssue('FAILED_ASR_JOB', 'BLOCKING', `ASR job failed: ${result.error ?? 'unknown error'}.`)
    );
  } else {
    normalized = normalizeTranscript(result.transcriptText);
    segmentCount = result.segments.length;
    if (segmentCount > 0) {
      const confidences = result.segments.map((s) => s.confidence);
      averageConfidence =
        Math.round((confidences.reduce((a, b) => a + b, 0) / segmentCount) * 1000) / 1000;
      lowestConfidence = Math.round(Math.min(...confidences) * 1000) / 1000;
    }

    if (normalized.length === 0) {
      issues.push(makeIssue('EMPTY_TRANSCRIPT', 'BLOCKING', 'Normalized transcript is empty.'));
    }

    // Per-segment confidence review.
    for (const seg of result.segments) {
      if (seg.confidence < PENNY_BLOCKING_CONFIDENCE_THRESHOLD) {
        issues.push(
          makeIssue(
            'LOW_CONFIDENCE_SEGMENT',
            'BLOCKING',
            `Segment "${seg.speaker}" is below the blocking confidence threshold (${Math.round(seg.confidence * 100)}%).`,
            { segmentId: seg.id, confidence: seg.confidence }
          )
        );
      } else if (seg.confidence < PENNY_LOW_CONFIDENCE_THRESHOLD) {
        issues.push(
          makeIssue(
            'LOW_CONFIDENCE_SEGMENT',
            'WARNING',
            `Segment "${seg.speaker}" is below the review confidence threshold (${Math.round(seg.confidence * 100)}%).`,
            { segmentId: seg.id, confidence: seg.confidence }
          )
        );
      }
    }

    if (looksLikeAdminOnly(normalized, result.scenarioId ?? plan.scenarioId)) {
      issues.push(
        makeIssue(
          'POSSIBLE_ADMIN_CHATTER',
          'INFO',
          'Transcript looks like administrative chatter; it may not create an incident.'
        )
      );
    }
    if (hasSensitiveContent(normalized)) {
      issues.push(
        makeIssue(
          'SENSITIVE_CONTENT_PRESENT',
          'INFO',
          'Transcript may contain sensitive content (plate/tag). Existing gates control CAD inclusion.'
        )
      );
    }
  }

  const hasBlocking = issues.some((i) => i.severity === 'BLOCKING');
  const readyForAttachment = !hasBlocking && normalized.length > 0;
  if (readyForAttachment) {
    issues.push(makeIssue('TRANSCRIPT_READY', 'INFO', 'Transcript passed PENNY review and is ready for attachment.'));
  }

  const pkg: PennyTranscriptPackage = {
    id: makeId('ppkg'),
    planId: plan.id,
    audioAssetId: plan.audioAssetId,
    asrJobId: plan.asrJobId,
    asrResultId: plan.asrResultId,
    normalizedTranscriptText: normalized,
    segmentCount,
    averageConfidence,
    lowestConfidence,
    qualityIssues: issues,
    readyForAttachment,
    createdAt: nowIso(),
  };
  draft.pennyTranscriptPackages.push(pkg);
  plan.transcriptPackageId = pkg.id;
  plan.status = readyForAttachment ? 'READY_FOR_ATTACHMENT' : 'NEEDS_REVIEW';
  plan.updatedAt = nowIso();

  addDecision(plan, 'ASR_RESULT_EVALUATED', `PENNY evaluated the ASR result (${segmentCount} segments).`, pkg.id);
  if (issues.some((i) => i.kind === 'LOW_CONFIDENCE_SEGMENT')) {
    addDecision(plan, 'LOW_CONFIDENCE_FLAGGED', 'PENNY flagged low-confidence segment(s) for review.');
  }
  addDecision(plan, 'NORMALIZED_TRANSCRIPT_PREPARED', 'PENNY normalized the transcript narrative.');
  addDecision(
    plan,
    readyForAttachment ? 'READY_FOR_ATTACHMENT' : 'NEEDS_HUMAN_REVIEW',
    readyForAttachment
      ? 'PENNY marked the transcript ready for attachment.'
      : 'PENNY flagged the transcript for human review before attachment.'
  );

  pennyAudit(
    draft,
    'PENNY_REVIEW_COMPLETED',
    actor,
    `PENNY review completed for ${filename} (${issues.filter((i) => i.severity !== 'INFO').length} issue(s)).`,
    plan.id,
    { planId: plan.id, packageId: pkg.id, readyForAttachment }
  );
  pennyAudit(
    draft,
    readyForAttachment ? 'PENNY_TRANSCRIPT_READY' : 'PENNY_TRANSCRIPT_NEEDS_REVIEW',
    actor,
    readyForAttachment
      ? `PENNY transcript ready for attachment for ${filename}.`
      : `PENNY transcript needs human review for ${filename}.`,
    plan.id,
    { planId: plan.id, packageId: pkg.id }
  );
  return pkg;
}

// --- handoff -------------------------------------------------------------

export function pennyAttachTranscriptPackage(
  draft: MiiState,
  planId: string,
  actor: string = PENNY_ACTOR
): AudioTranscriptAttachment | undefined {
  const plan = draft.pennyPlans.find((p) => p.id === planId);
  if (!plan || !plan.transcriptPackageId) return undefined;
  const pkg = draft.pennyTranscriptPackages.find((p) => p.id === plan.transcriptPackageId);
  if (!pkg || !pkg.readyForAttachment) return undefined;

  // Prefer the existing ASR attach path when the normalized transcript still
  // matches the ASR result verbatim; otherwise attach the normalized text.
  const result = plan.asrResultId
    ? draft.asrTranscriptResults.find((r) => r.id === plan.asrResultId)
    : undefined;

  let attachment: AudioTranscriptAttachment | undefined;
  if (result && result.transcriptText === pkg.normalizedTranscriptText) {
    attachment = attachAsrResultToAudio(draft, result.id, actor);
  }
  if (!attachment) {
    attachment = attachTranscriptToAudio(
      draft,
      plan.audioAssetId,
      pkg.normalizedTranscriptText,
      plan.scenarioId
    );
    if (plan.asrResultId) attachment.asrResultId = plan.asrResultId;
  }

  plan.attachmentId = attachment.id;
  plan.status = 'ATTACHED';
  plan.updatedAt = nowIso();
  addDecision(plan, 'TRANSCRIPT_ATTACHED', `PENNY attached the transcript (${attachment.id}).`, attachment.id);

  pennyAudit(
    draft,
    'PENNY_TRANSCRIPT_ATTACHED',
    actor,
    `PENNY attached the reviewed transcript for ${assetFilename(draft, plan.audioAssetId)}. Awaiting human processing.`,
    plan.id,
    { planId: plan.id, attachmentId: attachment.id }
  );
  return attachment;
}
