// Core domain models for MII_lite.
// Everything here is simulated/local. No external systems, no AI/LLM.

export type SemanticType = 'NEW_EVENT' | 'UPDATE' | 'CONFIRMATION' | 'ADMIN_CHATTER';

export type CueType = 'ROUTING' | 'OFFICER_OPENER' | 'PROTOCOL_TOKEN' | 'UNIT_STATUS';

export type UnitStatus =
  | 'AVAILABLE'
  | 'BUSY'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'OUT_OF_SERVICE'
  | 'OFF_DUTY';

export type Zone = 'North' | 'Center' | 'South' | 'Beach' | 'AtLarge' | 'Unknown';

export type IncidentStatus = 'ACTIVE' | 'PENDING_REVIEW' | 'CLOSED' | 'CONFLICT';

export interface CueEvent {
  id: string;
  phrase: string;
  cueType: CueType;
  confidence: number;
  routedAgency?: string;
  timestamp: string;
  transcriptLineId: string;
  rationale: string;
}

export interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  confidence: number;
  processed: boolean;
  semanticType?: SemanticType;
  cueEvents: CueEvent[];
}

export interface SuggestedField {
  id: string;
  key: string;
  label: string;
  value: string;
  confidence: number;
  sensitive: boolean;
  confirmed: boolean;
  provenanceText: string;
  sourceTranscriptLineIds: string[];
}

export interface IncidentTimelineEvent {
  id: string;
  timestamp: string;
  label: string;
  detail?: string;
}

export interface FieldConflict {
  id: string;
  fieldKey: string;
  label: string;
  existingValue: string;
  incomingValue: string;
  existingSourceTranscriptLineIds: string[];
  incomingSourceTranscriptLineIds: string[];
  status: 'OPEN' | 'RESOLVED';
  resolvedValue?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface IncidentContext {
  id: string;
  eventNumber: string;
  status: IncidentStatus;
  tenant: string;
  agency: string;
  natureCode?: string;
  naturePlain?: string;
  address?: string;
  apartment?: string;
  zone: Zone;
  assignedUnits: string[];
  suggestedFields: SuggestedField[];
  conflicts: FieldConflict[];
  transcriptLineIds: string[];
  timeline: IncidentTimelineEvent[];
  confidence: number;
  currentSummary: string;
  createdAt: string;
  updatedAt: string;
  asrConfirmed: boolean;
  // Phase 2H: point-in-time transcript review snapshot (audit/provenance only).
  transcriptReviewSnapshot?: IncidentTranscriptReviewSnapshot;
}

export interface Unit {
  id: string;
  displayName: string;
  officerName: string;
  zone: Zone;
  status: UnitStatus;
  isAtLarge: boolean;
}

export interface UnitRecommendation {
  id: string;
  incidentId: string;
  unitId: string;
  rank: number;
  confidence: number;
  rationale: string;
  sourceTranscriptLineIds: string[];
}

export type AuditAction =
  | 'SCENARIO_STARTED'
  | 'TRANSCRIPT_PROCESSED'
  | 'CUE_DETECTED'
  | 'INCIDENT_CREATED'
  | 'INCIDENT_UPDATED'
  | 'CONFIRMATION_APPLIED'
  | 'FIELDS_APPLIED'
  | 'UNIT_RECOMMENDED'
  | 'UNIT_ASSIGNED'
  | 'MOCK_CAD_SUBMITTED'
  | 'FIELD_REJECTED'
  | 'CONFLICT_RAISED'
  | 'CONFLICT_RESOLVED'
  | 'AUDIO_TRANSCRIPT_PROCESSED'
  | 'ASR_TRANSCRIPT_GENERATED'
  | 'ASR_TRANSCRIPT_ATTACHED'
  | 'ASR_JOB_REQUESTED'
  | 'ASR_JOB_COMPLETED'
  | 'ASR_JOB_FAILED'
  | 'ASR_JOB_CANCELLED'
  | 'AUDIO_METADATA_DERIVED'
  | 'PENNY_PLAN_CREATED'
  | 'PENNY_ASR_JOB_REQUESTED'
  | 'PENNY_REVIEW_COMPLETED'
  | 'PENNY_TRANSCRIPT_READY'
  | 'PENNY_TRANSCRIPT_NEEDS_REVIEW'
  | 'PENNY_TRANSCRIPT_ATTACHED'
  | 'PENNY_REVIEW_ACTION_RECORDED'
  | 'PENNY_REVIEW_READY'
  | 'PENNY_REVIEW_OVERRIDE_RECORDED'
  | 'PENNY_REVIEW_NOTE_ADDED'
  | 'PENNY_PACKAGE_MARKED_READY'
  | 'PENNY_RETRANSCRIPTION_REQUESTED'
  | 'PENNY_REVIEW_SIGNED_OFF'
  | 'INCIDENT_TRANSCRIPT_REVIEW_LINKED'
  | 'INCIDENT_TRANSCRIPT_REVIEW_SNAPSHOT'
  | 'INCIDENT_TRANSCRIPT_SIGNOFF_RECORDED';

export interface AuditEvent {
  id: string;
  correlationId: string;
  incidentId?: string;
  action: AuditAction;
  actor: string;
  timestamp: string;
  summary: string;
  before?: unknown;
  after?: unknown;
}

export interface MockCadPayload {
  eventNumber: string;
  nature: string;
  location: string;
  apartment: string;
  assignedUnits: string[];
  notes: string;
  sensitiveFieldsIncluded: boolean;
  submittedAt: string;
}

export interface CodeEntry {
  code: string;
  meaning: string;
  type: 'Signal' | 'Q-Code' | 'Plain-Talk';
  notes: string;
}

// --- Guided demo replay ---

export interface ReplayState {
  scenarioId: string;
  scenarioTitle: string;
  correlationId: string;
  baseTime: number;
  currentLineIndex: number; // lines processed so far
  totalLines: number;
  status: 'ready' | 'running' | 'paused' | 'completed';
  routingOpened: boolean;
  activeIncidentId?: string;
  lastLineId?: string;
  processedLineIds: string[];
  completed: boolean;
}

// --- Seed/scenario definitions ---

export interface SeedTranscriptLine {
  speaker: string;
  text: string;
  confidence: number;
}

export interface Scenario {
  id: string;
  title: string;
  blurb: string;
  expectedSemantic: SemanticType;
  lines: SeedTranscriptLine[];
}

// --- Phase 2A: Recorded audio intake (simulated/local only) ---
// Audio artifacts are a landing zone for transcript-first processing. No ASR,
// no uploads, no external systems. objectUrl (if any) is a session-local
// blob URL used for in-browser preview only; it does not survive reload.

export type AudioSourceType =
  | 'SIMULATED_UPLOAD'
  | 'AUTHORIZED_RECORDING'
  | 'SYNTHETIC_TTS'
  | 'MANUAL_PLACEHOLDER';

// Display-only waveform + timeline provenance (Phase 2D). Deterministic and
// local; NOT forensic audio analysis and NOT derived from real audio content.
export interface AudioWaveformPoint {
  t: number; // seconds from start
  amplitude: number; // 0..1 deterministic/display-only
}

export interface AudioTimelineMarker {
  id: string;
  label: string;
  startSeconds: number;
  endSeconds?: number;
  kind: 'ASR_SEGMENT' | 'TRANSCRIPT_LINE' | 'INCIDENT_FIELD' | 'SYSTEM';
  sourceId?: string;
}

export interface AudioAsset {
  id: string;
  filename: string;
  sourceType: AudioSourceType;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  objectUrl?: string;
  createdAt: string;
  notes?: string;
  status: 'UPLOADED' | 'TRANSCRIPT_ATTACHED' | 'PROCESSED';
  waveform?: AudioWaveformPoint[];
}

export interface AudioTranscriptAttachment {
  id: string;
  audioAssetId: string;
  scenarioId?: string;
  transcriptText: string;
  createdAt: string;
  processedAt?: string;
  activeIncidentId?: string;
  transcriptLineIds: string[];
  // Set when the attachment originated from a mock ASR transcript result.
  asrResultId?: string;
}

// --- Phase 2B: ASR adapter shell (mock/local only) ---
// A landing zone for a future real ASR adapter. Phase 2B ships a deterministic
// mock adapter only — no audio content is ever transcribed, no network is used.

export type AsrProvider =
  | 'MOCK_SCENARIO'
  | 'MOCK_FREEFORM'
  | 'LOCAL_PLACEHOLDER'
  | 'UNCONFIGURED';

export type AsrStatus =
  | 'NOT_REQUESTED'
  | 'QUEUED'
  | 'TRANSCRIBING'
  | 'COMPLETED'
  | 'FAILED';

export interface AsrSegment {
  id: string;
  speaker: string;
  text: string;
  startMs?: number;
  endMs?: number;
  confidence: number;
}

export interface AsrTranscriptResult {
  id: string;
  audioAssetId: string;
  provider: AsrProvider;
  status: AsrStatus;
  transcriptText: string;
  segments: AsrSegment[];
  createdAt: string;
  completedAt?: string;
  error?: string;
  scenarioId?: string;
  notes?: string;
}

// --- Phase 2C: async ASR job lifecycle (mock/local only) ---
// Models the request → queued → transcribing → completed/failed lifecycle a real
// async ASR provider would have, driven deterministically one step at a time.
// No real transcription, no network, no uploads.

export type AsrJobStatus =
  | 'REQUESTED'
  | 'QUEUED'
  | 'TRANSCRIBING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type AsrJobStep =
  | 'VALIDATE_AUDIO_ASSET'
  | 'SELECT_PROVIDER'
  | 'PREPARE_TRANSCRIPTION'
  | 'TRANSCRIBE'
  | 'NORMALIZE_SEGMENTS'
  | 'COMPLETE';

export interface AsrJobEvent {
  id: string;
  jobId: string;
  status: AsrJobStatus;
  step?: AsrJobStep;
  summary: string;
  createdAt: string;
}

export interface AsrJob {
  id: string;
  audioAssetId: string;
  provider: AsrProvider;
  status: AsrJobStatus;
  requestedAt: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  resultId?: string;
  scenarioId?: string;
  freeformTranscriptText?: string;
  error?: string;
  events: AsrJobEvent[];
}

// --- Phase 2E: P.E.N.N.Y. — Provenance Engine for Normalized Narrative Yield ---
// PENNY is a deterministic local orchestration layer for transcription workflow,
// provenance, quality review, and handoff readiness. PENNY never performs real
// ASR, never creates/mutates incidents, and never writes CAD. It prepares a
// reviewed transcript package for attachment into the existing MII pipeline.

export type PennyPlanStatus =
  | 'DRAFT'
  | 'ASR_JOB_REQUESTED'
  | 'ASR_JOB_RUNNING'
  | 'ASR_COMPLETED'
  | 'REVIEW_READY'
  | 'READY_FOR_ATTACHMENT'
  | 'NEEDS_REVIEW'
  | 'ATTACHED'
  | 'FAILED'
  | 'CANCELLED';

export type PennyDecisionType =
  | 'PROVIDER_SELECTED'
  | 'ASR_JOB_REQUESTED'
  | 'ASR_RESULT_EVALUATED'
  | 'LOW_CONFIDENCE_FLAGGED'
  | 'NORMALIZED_TRANSCRIPT_PREPARED'
  | 'READY_FOR_ATTACHMENT'
  | 'NEEDS_HUMAN_REVIEW'
  | 'TRANSCRIPT_ATTACHED';

export type TranscriptQualityIssueSeverity = 'INFO' | 'WARNING' | 'BLOCKING';

export type TranscriptQualityIssueKind =
  | 'LOW_CONFIDENCE_SEGMENT'
  | 'EMPTY_TRANSCRIPT'
  | 'MISSING_AUDIO_DURATION'
  | 'NO_ASR_RESULT'
  | 'FAILED_ASR_JOB'
  | 'UNSUPPORTED_PROVIDER'
  | 'POSSIBLE_ADMIN_CHATTER'
  | 'SENSITIVE_CONTENT_PRESENT'
  | 'TRANSCRIPT_READY';

export interface TranscriptQualityIssue {
  id: string;
  kind: TranscriptQualityIssueKind;
  severity: TranscriptQualityIssueSeverity;
  summary: string;
  segmentId?: string;
  confidence?: number;
  createdAt: string;
}

export interface PennyDecision {
  id: string;
  planId: string;
  type: PennyDecisionType;
  summary: string;
  createdAt: string;
  sourceId?: string;
}

export interface PennyTranscriptPackage {
  id: string;
  planId: string;
  audioAssetId: string;
  asrJobId?: string;
  asrResultId?: string;
  normalizedTranscriptText: string;
  segmentCount: number;
  averageConfidence?: number;
  lowestConfidence?: number;
  qualityIssues: TranscriptQualityIssue[];
  readyForAttachment: boolean;
  createdAt: string;
}

export interface PennyTranscriptionPlan {
  id: string;
  audioAssetId: string;
  provider: AsrProvider;
  status: PennyPlanStatus;
  createdAt: string;
  updatedAt: string;
  scenarioId?: string;
  freeformTranscriptText?: string;
  asrJobId?: string;
  asrResultId?: string;
  transcriptPackageId?: string;
  attachmentId?: string;
  decisions: PennyDecision[];
  notes?: string;
}

// --- Phase 2F: PENNY human review + transcript quality gate ---
// Makes the human-in-the-loop review of a PENNY transcript package explicit and
// auditable. Warnings require acknowledgement; blocking issues require an
// explicit override with a note. Review affects attachment readiness only — it
// never creates incidents or writes CAD.

export type PennyReviewActionType =
  | 'ACKNOWLEDGE_INFO'
  | 'ACKNOWLEDGE_WARNING'
  | 'OVERRIDE_BLOCKING'
  | 'REQUEST_RETRANSCRIPTION'
  | 'MARK_REVIEW_READY'
  | 'MARK_READY_FOR_ATTACHMENT'
  | 'ADD_REVIEW_NOTE'
  | 'SIGN_OFF_REVIEW';

export interface PennyReviewAction {
  id: string;
  planId: string;
  packageId: string;
  issueId?: string;
  actionType: PennyReviewActionType;
  actor: string;
  summary: string;
  note?: string;
  createdAt: string;
}

export interface PennyReviewState {
  id: string;
  planId: string;
  packageId: string;
  acknowledgedIssueIds: string[];
  overriddenIssueIds: string[];
  reviewNotes: string[];
  reviewReady: boolean;
  readyForAttachment: boolean;
  reviewer?: string;
  updatedAt: string;
  actions: PennyReviewAction[];
  // Human accountability trail: set once the package becomes ready for
  // attachment through review readiness evaluation.
  signedOffBy?: string;
  signedOffAt?: string;
}

// --- Phase 2G: transcript review safety gate ---
// A read-only readiness/provenance gate that surfaces PENNY transcript review
// status on the incident. NOT_APPLICABLE for incidents not created from a
// PENNY-reviewed transcript package (legacy/manual/direct scenario paths).

export type TranscriptReviewGateStatus =
  | 'NOT_APPLICABLE'
  | 'PASS'
  | 'WARNING'
  | 'BLOCKED';

export interface TranscriptReviewGateResult {
  status: TranscriptReviewGateStatus;
  label: string;
  summary: string;
  linkedPlanId?: string;
  linkedPackageId?: string;
  linkedReviewStateId?: string;
  reviewReady?: boolean;
  readyForAttachment?: boolean;
  blockingCount: number;
  warningCount: number;
  infoCount: number;
  unresolvedWarningCount: number;
  unresolvedBlockingCount: number;
  latestReviewer?: string;
  latestReviewAt?: string;
}

// --- Phase 2H: incident audit linkage + reviewer sign-off ---
// A point-in-time snapshot of the transcript review state captured onto the
// incident when it was created/updated from a PENNY-reviewed attachment. Used
// for audit/provenance; live gate evaluation remains the source of truth for
// current readiness.

export interface IncidentTranscriptReviewSnapshot {
  status: TranscriptReviewGateStatus;
  planId?: string;
  packageId?: string;
  reviewStateId?: string;
  signedOffBy?: string;
  signedOffAt?: string;
  summary: string;
  blockingCount: number;
  warningCount: number;
  unresolvedWarningCount: number;
  unresolvedBlockingCount: number;
  capturedAt: string;
}
