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
  | 'CONFLICT_RESOLVED';

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
