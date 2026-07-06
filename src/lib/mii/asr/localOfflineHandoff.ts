import type { MiiState } from '../processor';
import type { AsrSegment, AsrTranscriptResult, AuditAction } from '../types';
import type { LocalOfflineAsrSegment, LocalOfflineAsrStatus } from './localOfflineTypes';
import { LOCAL_OFFLINE_ASR_MODEL_ID, LOCAL_OFFLINE_ASR_PROVIDER } from './localOfflineAsrAssets';
import { evaluateAsrResultForPenny } from '../penny';
import { makeAuditEvent, newCorrelationId } from '../audit';
import { makeId, nowIso } from '../util';

// Phase 3B — engine-level handoff from the browser local/offline ASR adapter
// into the existing ASR-result → PENNY package pipeline. Deterministic, mutates
// the passed draft only. Never attaches, processes, or signs off.

const LOCAL_ASR_ACTOR = 'Dispatcher (you)';

// Local Whisper does not expose field-level confidence. We record segments at a
// deliberately low "unknown" confidence so PENNY flags them for human review
// (WARNING tier — above the blocking threshold, below the review threshold).
const CONFIDENCE_WHEN_UNKNOWN = 0.7;

function localAudit(
  draft: MiiState,
  action: AuditAction,
  actor: string,
  summary: string,
  correlationId: string,
  after?: unknown
): void {
  draft.audit.push(makeAuditEvent({ correlationId, action, actor, summary, after }));
}

function assetFilename(draft: MiiState, audioAssetId: string, fallback?: string): string {
  return draft.audioAssets.find((a) => a.id === audioAssetId)?.filename ?? fallback ?? 'recording';
}

export function recordLocalOfflineAsrModelChecked(
  draft: MiiState,
  input: { available: boolean; status: LocalOfflineAsrStatus; actor?: string }
): void {
  const actor = input.actor ?? LOCAL_ASR_ACTOR;
  localAudit(
    draft,
    'LOCAL_OFFLINE_ASR_MODEL_CHECKED',
    actor,
    `Local offline ASR model checked: ${input.status} (${input.available ? 'available' : 'unavailable'}).`,
    newCorrelationId(),
    { provider: LOCAL_OFFLINE_ASR_PROVIDER, modelId: LOCAL_OFFLINE_ASR_MODEL_ID, status: input.status }
  );
}

export function recordLocalOfflineAsrStarted(
  draft: MiiState,
  input: { audioAssetId: string; filename?: string; actor?: string; correlationId?: string }
): void {
  const actor = input.actor ?? LOCAL_ASR_ACTOR;
  localAudit(
    draft,
    'LOCAL_OFFLINE_ASR_TRANSCRIPTION_STARTED',
    actor,
    `Local offline ASR transcription started for ${assetFilename(draft, input.audioAssetId, input.filename)}.`,
    input.correlationId ?? newCorrelationId(),
    {
      provider: LOCAL_OFFLINE_ASR_PROVIDER,
      modelId: LOCAL_OFFLINE_ASR_MODEL_ID,
      audioAssetId: input.audioAssetId,
      filename: input.filename,
    }
  );
}

export function recordLocalOfflineAsrFailed(
  draft: MiiState,
  input: {
    audioAssetId: string;
    filename?: string;
    errorMessage: string;
    durationMs?: number;
    actor?: string;
    correlationId?: string;
  }
): void {
  const actor = input.actor ?? LOCAL_ASR_ACTOR;
  localAudit(
    draft,
    'LOCAL_OFFLINE_ASR_TRANSCRIPTION_FAILED',
    actor,
    `Local offline ASR failed for ${assetFilename(draft, input.audioAssetId, input.filename)}: ${input.errorMessage}`,
    input.correlationId ?? newCorrelationId(),
    {
      provider: LOCAL_OFFLINE_ASR_PROVIDER,
      modelId: LOCAL_OFFLINE_ASR_MODEL_ID,
      audioAssetId: input.audioAssetId,
      filename: input.filename,
      durationMs: input.durationMs,
    }
  );
}

export interface CompleteLocalOfflineAsrInput {
  planId: string;
  audioAssetId: string;
  transcriptText: string;
  segments?: LocalOfflineAsrSegment[];
  averageConfidence?: number;
  durationMs?: number;
  filename?: string;
  actor?: string;
}

// Ingest a completed local/offline ASR transcript, store it as an
// AsrTranscriptResult, link it to the PENNY plan, and run PENNY evaluation so
// the flow lands at human review. Never attaches or processes.
export function completeLocalOfflineAsrForPlan(
  draft: MiiState,
  input: CompleteLocalOfflineAsrInput
): { resultId: string; packageId?: string } | undefined {
  const plan = draft.pennyPlans.find((p) => p.id === input.planId);
  if (!plan) return undefined;
  const actor = input.actor ?? LOCAL_ASR_ACTOR;

  const segments: AsrSegment[] = (input.segments ?? []).map((s) => ({
    id: makeId('seg'),
    speaker: 'UNKNOWN',
    text: s.text,
    startMs: s.startSec != null ? Math.round(s.startSec * 1000) : undefined,
    endMs: s.endSec != null ? Math.round(s.endSec * 1000) : undefined,
    confidence: s.confidence ?? CONFIDENCE_WHEN_UNKNOWN,
  }));
  // If the model returned text but no chunks, keep a single segment so the
  // transcript survives; still flagged low-confidence for review.
  if (segments.length === 0 && input.transcriptText.trim().length > 0) {
    segments.push({
      id: makeId('seg'),
      speaker: 'UNKNOWN',
      text: input.transcriptText.trim(),
      confidence: input.averageConfidence ?? CONFIDENCE_WHEN_UNKNOWN,
    });
  }

  const result: AsrTranscriptResult = {
    id: makeId('asr'),
    audioAssetId: input.audioAssetId,
    provider: 'LOCAL_OFFLINE_WHISPER',
    status: 'COMPLETED',
    transcriptText: input.transcriptText,
    segments,
    createdAt: nowIso(),
    completedAt: nowIso(),
    notes: 'Generated by experimental local/offline ASR using local browser model assets.',
  };
  draft.asrTranscriptResults.push(result);
  plan.asrResultId = result.id;
  plan.status = 'ASR_COMPLETED';
  plan.updatedAt = nowIso();

  localAudit(
    draft,
    'LOCAL_OFFLINE_ASR_TRANSCRIPTION_COMPLETED',
    actor,
    `Local offline ASR transcription completed for ${assetFilename(draft, input.audioAssetId, input.filename)}.`,
    plan.id,
    {
      provider: LOCAL_OFFLINE_ASR_PROVIDER,
      modelId: LOCAL_OFFLINE_ASR_MODEL_ID,
      audioAssetId: input.audioAssetId,
      filename: input.filename,
      durationMs: input.durationMs,
      segments: segments.length,
    }
  );

  const pkg = evaluateAsrResultForPenny(draft, plan.id, actor);
  return { resultId: result.id, packageId: pkg?.id };
}
