import type { MiiState } from './processor';
import type {
  AsrJob,
  AsrTranscriptResult,
  AudioAsset,
  AudioTranscriptAttachment,
  AuditEvent,
  IncidentContext,
  PennyReviewState,
  PennyTranscriptPackage,
  PennyTranscriptionPlan,
  SignOffPolicyGateResult,
  TranscriptReviewGateResult,
} from './types';
import { evaluateTranscriptReviewGateForIncident } from './transcriptReviewGate';
import { evaluateSignOffPolicyGateForIncident } from './signOffPolicy';
import { evaluateIncidentSafetyReadiness } from './safetyGates';
import { nowIso } from './util';

export interface IncidentAuditExport {
  exportVersion: 'MII_LITE_AUDIT_EXPORT_V1';
  exportedAt: string;
  incident: IncidentContext;
  transcriptReviewGate: TranscriptReviewGateResult;
  signOffPolicyGate: SignOffPolicyGateResult;
  safetyReadiness: ReturnType<typeof evaluateIncidentSafetyReadiness>;
  audioAttachments: AudioTranscriptAttachment[];
  audioAssets: AudioAsset[];
  asrJobs: AsrJob[];
  asrResults: AsrTranscriptResult[];
  pennyPlans: PennyTranscriptionPlan[];
  pennyPackages: PennyTranscriptPackage[];
  pennyReviews: PennyReviewState[];
  auditEvents: AuditEvent[];
  mockCadPayload?: unknown;
}

// Build a deterministic, local audit/provenance export for an incident. Pure /
// read-only: never mutates state and never contacts any external system.
export function buildIncidentAuditExport(
  state: MiiState,
  incidentId: string
): IncidentAuditExport {
  const incident = state.incidents.find((i) => i.id === incidentId);
  const transcriptReviewGate = evaluateTranscriptReviewGateForIncident(state, incidentId);
  const signOffPolicyGate = evaluateSignOffPolicyGateForIncident(state, incidentId);
  const safetyReadiness = incident
    ? evaluateIncidentSafetyReadiness(incident, transcriptReviewGate, signOffPolicyGate)
    : { gates: [], transcriptReviewGate, signOffPolicyGate, blockingReasons: [], warnings: [], canSubmit: false };

  const audioAttachments = state.audioTranscriptAttachments.filter(
    (a) => a.activeIncidentId === incidentId
  );
  const attachmentIds = new Set(audioAttachments.map((a) => a.id));

  const audioAssetIds = new Set(audioAttachments.map((a) => a.audioAssetId));
  const audioAssets = state.audioAssets.filter((a) => audioAssetIds.has(a.id));

  const pennyPlans = state.pennyPlans.filter(
    (p) => p.attachmentId && attachmentIds.has(p.attachmentId)
  );
  const packageIds = new Set(pennyPlans.map((p) => p.transcriptPackageId).filter(Boolean) as string[]);
  const pennyPackages = state.pennyTranscriptPackages.filter((p) => packageIds.has(p.id));
  const pennyReviews = state.pennyReviewStates.filter((r) => packageIds.has(r.packageId));

  // Collect ASR result ids from attachments, plans, and packages, then jobs.
  const asrResultIds = new Set<string>();
  for (const a of audioAttachments) if (a.asrResultId) asrResultIds.add(a.asrResultId);
  for (const p of pennyPlans) if (p.asrResultId) asrResultIds.add(p.asrResultId);
  for (const p of pennyPackages) if (p.asrResultId) asrResultIds.add(p.asrResultId);
  const asrResults = state.asrTranscriptResults.filter((r) => asrResultIds.has(r.id));

  const asrJobIds = new Set<string>();
  for (const p of pennyPlans) if (p.asrJobId) asrJobIds.add(p.asrJobId);
  for (const j of state.asrJobs) if (j.resultId && asrResultIds.has(j.resultId)) asrJobIds.add(j.id);
  const asrJobs = state.asrJobs.filter((j) => asrJobIds.has(j.id));

  // Correlation ids: PENNY audits are grouped by plan id; ASR job audits by job id.
  const correlationIds = new Set<string>([...pennyPlans.map((p) => p.id), ...asrJobs.map((j) => j.id)]);
  const auditEvents = state.audit.filter(
    (e) =>
      e.incidentId === incidentId ||
      (e.correlationId ? correlationIds.has(e.correlationId) : false)
  );

  return {
    exportVersion: 'MII_LITE_AUDIT_EXPORT_V1',
    exportedAt: nowIso(),
    incident: incident as IncidentContext,
    transcriptReviewGate,
    signOffPolicyGate,
    safetyReadiness,
    audioAttachments,
    audioAssets,
    asrJobs,
    asrResults,
    pennyPlans,
    pennyPackages,
    pennyReviews,
    auditEvents,
    // Include the already-built mock CAD payload if one was submitted. Never
    // fabricate or submit a payload here.
    mockCadPayload: state.mockCadPayloads[incidentId],
  };
}

// Browser-only local download of JSON. No upload, no network.
export function downloadJson(filename: string, data: unknown): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
