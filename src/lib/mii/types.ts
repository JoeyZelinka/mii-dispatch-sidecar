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
  | 'PENNY_TRANSCRIPT_ATTACHED';

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
