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
  | 'ASR_JOB_CANCELLED';

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
