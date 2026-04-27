export type Zone = 'North' | 'Center' | 'South' | 'Beach' | 'AtLarge';

export type UnitStatus =
  | 'AVAILABLE'
  | 'BUSY'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'OUT_OF_SERVICE'
  | 'TRVL'
  | 'OFF_DUTY';

export type SemanticType =
  | 'NEW_EVENT'
  | 'UPDATE'
  | 'CONFIRMATION'
  | 'ADMIN_CHATTER';

export type IncidentStatus = 'ACTIVE' | 'PENDING_REVIEW' | 'CLOSED';

export type Speaker = 'MDSO' | 'SIBPD' | 'UNIT' | 'UNKNOWN';

export type ActionType =
  | 'APPROVE'
  | 'REJECT'
  | 'EDIT'
  | 'CONFIRM_ASR'
  | 'SUBMIT_TO_CAD';

export type SuggestionState = 'PENDING' | 'APPROVED' | 'REJECTED';

export type SensitiveCategory =
  | 'callerInfo'
  | 'plates'
  | 'suspectDetails'
  | 'weapons';

export interface Unit {
  id: string;
  officerName?: string;
  zone: Zone;
  status: UnitStatus;
  lastUpdateTs: string;
  currentIncidentId?: string;
}

export interface Incident {
  id: string;
  eventNumber: string;
  status: IncidentStatus;
  natureCode: string;
  naturePlain: string;
  address: string;
  apt?: string;
  crossStreets?: string;
  zone: Zone;
  createdTs: string;
  updatedTs: string;
  assignedUnits: string[];
}

export interface ExtractedField {
  key: string;
  label: string;
  value: string;
  confidence: number;
  sensitive?: boolean;
  category?: SensitiveCategory;
  sourceSpan?: string;
}

export interface UnitRecommendation {
  unitId: string;
  score: number;
  rationale: string;
}

export interface Suggestion {
  id: string;
  incidentId: string;
  fields: ExtractedField[];
  unitRecommendations: UnitRecommendation[];
  state: SuggestionState;
  lastActionTs: string;
}

export interface TranscriptEvent {
  id: string;
  ts: string;
  speaker: Speaker;
  text: string;
  semanticType: SemanticType;
  codesDetected: string[];
  plainTalk?: string;
  asrConfidence: number;
  cueDetected?: boolean;
  incidentId?: string;
}

export interface AuditEntry {
  id: string;
  ts: string;
  actor: string;
  actionType: ActionType;
  correlationId: string;
  incidentId: string;
  before?: unknown;
  after?: unknown;
  payload?: unknown;
}

export interface CodeEntry {
  code: string;
  category: '10-codes' | 'Q-codes';
  meaning: string;
  plainTalk: string;
  localOverride?: boolean;
}
