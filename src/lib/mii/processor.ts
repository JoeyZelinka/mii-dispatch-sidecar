import type {
  CueEvent,
  IncidentContext,
  MockCadPayload,
  SuggestedField,
  TranscriptLine,
  Unit,
  UnitRecommendation,
} from './types';
import { AGENCY, TENANT, getScenario } from './seed';
import { detectCues } from './cueDetector';
import { extractFields } from './extractor';
import { classifyLine, type ClassifierState } from './semanticClassifier';
import { resolveZone } from './zoneMapper';
import { recommendUnits } from './unitRecommendation';
import { buildMockCadPayload, type MockCadOptions } from './mockCad';
import { makeAuditEvent, newCorrelationId } from './audit';
import {
  findOpenConflict,
  hasOpenConflicts,
  isMaterialField,
  makeFieldConflict,
  stampResolution,
} from './conflictDetector';
import { clampConfidence, makeId, nowIso } from './util';

// The mutable world the engine operates on. The store owns/persists it; the
// engine mutates a structured-cloned draft so React always sees fresh refs.
export interface MiiState {
  incidents: IncidentContext[];
  units: Unit[];
  transcriptLines: TranscriptLine[];
  recommendations: UnitRecommendation[];
  audit: import('./types').AuditEvent[];
  mockCadPayloads: Record<string, MockCadPayload>;
}

const SYSTEM_ACTOR = 'MII_lite engine';

// --- small helpers -------------------------------------------------------

function avgConfidence(fields: SuggestedField[]): number {
  if (fields.length === 0) return 0.8;
  return fields.reduce((s, f) => s + f.confidence, 0) / fields.length;
}

function fieldValue(fields: SuggestedField[], key: string): string | undefined {
  return fields.find((f) => f.key === key)?.value;
}

function knownValues(incident: IncidentContext): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of incident.suggestedFields) out[f.key] = f.value;
  return out;
}

function unitByNumber(units: Unit[], num: string): Unit | undefined {
  return units.find((u) => new RegExp(`\\b${num}\\b`).test(u.displayName));
}

function buildSummary(incident: IncidentContext): string {
  const parts: string[] = [];
  if (incident.natureCode) parts.push(incident.natureCode);
  if (incident.naturePlain) parts.push(incident.naturePlain);
  const loc =
    incident.address ?? fieldValue(incident.suggestedFields, 'crossStreet') ?? undefined;
  if (loc) parts.push(`at ${loc}`);
  if (incident.apartment) parts.push(incident.apartment);
  const vehicle = fieldValue(incident.suggestedFields, 'vehicle');
  if (vehicle) parts.push(`— ${vehicle}`);
  parts.push(`(${incident.zone})`);
  return parts.join(' ');
}

function reSyncCanonicalFields(incident: IncidentContext): void {
  incident.natureCode = fieldValue(incident.suggestedFields, 'natureCode') ?? incident.natureCode;
  incident.naturePlain =
    fieldValue(incident.suggestedFields, 'naturePlain') ?? incident.naturePlain;
  incident.address = fieldValue(incident.suggestedFields, 'address') ?? incident.address;
  incident.apartment = fieldValue(incident.suggestedFields, 'apartment') ?? incident.apartment;

  // Re-resolve zone from the strongest available location text.
  const locText =
    incident.address ?? fieldValue(incident.suggestedFields, 'crossStreet') ?? '';
  if (locText) {
    const z = resolveZone(locText);
    if (z.zone !== 'Unknown') incident.zone = z.zone;
  }

  incident.confidence = avgConfidence(incident.suggestedFields);
  incident.currentSummary = buildSummary(incident);
  incident.updatedAt = nowIso();
}

function pushTimeline(incident: IncidentContext, label: string, detail?: string): void {
  incident.timeline.push({ id: makeId('tl'), timestamp: nowIso(), label, detail });
}

function audit(draft: MiiState, input: Parameters<typeof makeAuditEvent>[0]): void {
  draft.audit.push(makeAuditEvent(input));
}

// Detect a contradiction on a material field. Returns true when the incoming
// value conflicts with an existing field — in which case the caller must NOT
// overwrite the canonical value; the incident enters CONFLICT for human review.
function maybeRaiseConflict(
  draft: MiiState,
  incident: IncidentContext,
  existing: SuggestedField,
  incomingValue: string,
  line: TranscriptLine,
  correlationId: string
): boolean {
  if (!isMaterialField(existing.key)) return false;
  if (existing.value === incomingValue) return false;

  const open = findOpenConflict(incident, existing.key);
  if (open) {
    // Same conflict re-heard — append incoming provenance, do not duplicate.
    open.incomingValue = incomingValue;
    if (!open.incomingSourceTranscriptLineIds.includes(line.id)) {
      open.incomingSourceTranscriptLineIds.push(line.id);
    }
    return true;
  }

  const conflict = makeFieldConflict(existing, incomingValue, line.id);
  incident.conflicts.push(conflict);
  incident.status = 'CONFLICT';
  incident.updatedAt = nowIso();
  pushTimeline(incident, `Conflict raised: ${existing.label}`, `${existing.value} vs ${incomingValue}`);
  audit(draft, {
    correlationId,
    action: 'CONFLICT_RAISED',
    actor: SYSTEM_ACTOR,
    incidentId: incident.id,
    summary: `Conflict raised for ${existing.label}: existing "${existing.value}" vs incoming "${incomingValue}".`,
    before: { value: existing.value },
    after: { value: incomingValue },
  });
  return true;
}

// --- incident lifecycle --------------------------------------------------

export function createOrUpdateIncident(
  draft: MiiState,
  line: TranscriptLine,
  cues: CueEvent[],
  fields: SuggestedField[],
  semanticType: TranscriptLine['semanticType'],
  ctx: ScenarioCtx,
  correlationId: string
): IncidentContext | undefined {
  const active = ctx.activeIncidentId
    ? draft.incidents.find((i) => i.id === ctx.activeIncidentId)
    : undefined;

  if (semanticType === 'NEW_EVENT' && !active) {
    // Only create once incident-defining facts exist; routing-only lines just
    // open the routing context.
    const hasFacts = fields.some((f) =>
      ['natureCode', 'address', 'vehicle', 'plate', 'crossStreet'].includes(f.key)
    );
    if (!hasFacts) {
      ctx.routingOpened = true;
      return undefined;
    }

    const seq = String(draft.incidents.length + 1).padStart(4, '0');
    const incident: IncidentContext = {
      id: makeId('inc'),
      eventNumber: `SIB-2026-${seq}`,
      status: 'PENDING_REVIEW',
      tenant: TENANT,
      agency: AGENCY,
      zone: resolveZone(line.text).zone,
      assignedUnits: [],
      suggestedFields: fields,
      conflicts: [],
      transcriptLineIds: [line.id],
      timeline: [],
      confidence: avgConfidence(fields),
      currentSummary: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      asrConfirmed: false,
    };
    reSyncCanonicalFields(incident);
    pushTimeline(incident, 'Incident created', line.text);
    draft.incidents.push(incident);
    ctx.activeIncidentId = incident.id;

    audit(draft, {
      correlationId,
      action: 'INCIDENT_CREATED',
      actor: SYSTEM_ACTOR,
      incidentId: incident.id,
      summary: `Created ${incident.eventNumber}: ${incident.currentSummary}`,
      after: { eventNumber: incident.eventNumber, zone: incident.zone },
    });
    return incident;
  }

  if (!active) return undefined;

  // Merge fields into the existing incident.
  if (semanticType === 'UPDATE') {
    const before = knownValues(active);
    const added: string[] = [];
    let conflicted = false;
    for (const f of fields) {
      const existing = active.suggestedFields.find((e) => e.key === f.key);
      if (!existing) {
        active.suggestedFields.push(f);
        added.push(f.key);
      } else if (existing.value !== f.value) {
        // Material contradiction → raise conflict, do not overwrite.
        if (maybeRaiseConflict(draft, active, existing, f.value, line, correlationId)) {
          conflicted = true;
          continue;
        }
        existing.value = f.value;
        existing.confidence = f.confidence;
        existing.sourceTranscriptLineIds.push(line.id);
        added.push(`${f.key}(changed)`);
      } else {
        // same value — light confirmation boost
        existing.confidence = clampConfidence(existing.confidence + 0.08);
        if (!existing.sourceTranscriptLineIds.includes(line.id)) {
          existing.sourceTranscriptLineIds.push(line.id);
        }
      }
    }
    if (!active.transcriptLineIds.includes(line.id)) active.transcriptLineIds.push(line.id);
    reSyncCanonicalFields(active);
    // The CONFLICT_RAISED audit already covers conflict-only updates.
    if (added.length > 0 || !conflicted) {
      pushTimeline(active, 'Incident updated', line.text);
      audit(draft, {
        correlationId,
        action: 'INCIDENT_UPDATED',
        actor: SYSTEM_ACTOR,
        incidentId: active.id,
        summary: `Updated ${active.eventNumber}${added.length ? ` — fields: ${added.join(', ')}` : ''}`,
        before,
        after: knownValues(active),
      });
    }
  }

  return active;
}

// CONFIRMATION: boost confidence + add provenance, never duplicate the incident.
export function applyConfirmation(
  draft: MiiState,
  incidentId: string,
  fields: SuggestedField[],
  line: TranscriptLine,
  correlationId: string
): void {
  const incident = draft.incidents.find((i) => i.id === incidentId);
  if (!incident) return;

  const boosted: string[] = [];
  let conflicted = false;
  for (const f of fields) {
    const existing = incident.suggestedFields.find((e) => e.key === f.key);
    if (!existing) continue;
    if (existing.value === f.value) {
      existing.confidence = clampConfidence(existing.confidence + 0.08);
      if (!existing.sourceTranscriptLineIds.includes(line.id)) {
        existing.sourceTranscriptLineIds.push(line.id);
      }
      existing.provenanceText = `${existing.provenanceText} | readback: "${line.text}"`;
      boosted.push(existing.key);
    } else if (maybeRaiseConflict(draft, incident, existing, f.value, line, correlationId)) {
      // A "readback" that contradicts an existing fact is a conflict, not a boost.
      conflicted = true;
    }
  }
  if (!incident.transcriptLineIds.includes(line.id)) incident.transcriptLineIds.push(line.id);
  reSyncCanonicalFields(incident);
  pushTimeline(incident, 'Confirmation applied (readback)', line.text);

  // Avoid a misleading "acknowledgement" audit when the readback actually
  // surfaced a conflict (the CONFLICT_RAISED audit already covers it).
  if (boosted.length > 0 || !conflicted) {
    audit(draft, {
      correlationId,
      action: 'CONFIRMATION_APPLIED',
      actor: SYSTEM_ACTOR,
      incidentId: incident.id,
      summary: boosted.length
        ? `QSL readback boosted confidence on: ${boosted.join(', ')} (no duplicate created)`
        : 'QSL acknowledgement recorded (no new facts, no duplicate created)',
    });
  }
}

function applyUnitStatusCues(
  draft: MiiState,
  line: TranscriptLine,
  cues: CueEvent[],
  incidentId: string | undefined,
  correlationId: string
): void {
  const statusCue = cues.find((c) => c.cueType === 'UNIT_STATUS');
  if (!statusCue) return;
  const numMatch = line.text.match(/\b(\d{2,3})\b/);
  if (!numMatch) return;
  const unit = unitByNumber(draft.units, numMatch[1]);
  if (!unit) return;

  const map: Record<string, Unit['status']> = {
    'en route': 'EN_ROUTE',
    arrival: 'ARRIVED',
    available: 'AVAILABLE',
    'out of service': 'OUT_OF_SERVICE',
  };
  const next = map[statusCue.phrase];
  if (!next) return;
  unit.status = next;

  if (incidentId && (next === 'EN_ROUTE' || next === 'ARRIVED')) {
    const incident = draft.incidents.find((i) => i.id === incidentId);
    if (incident) {
      if (!incident.assignedUnits.includes(unit.id)) incident.assignedUnits.push(unit.id);
      // Always log the transition so the unit timeline reads EN_ROUTE → ARRIVED.
      pushTimeline(incident, `Unit ${unit.displayName} ${next.replace('_', ' ').toLowerCase()}`);
    }
  }
}

// --- per-line + scenario driving ----------------------------------------

export interface ScenarioCtx {
  routingOpened: boolean;
  activeIncidentId?: string;
}

export function processTranscriptLine(
  draft: MiiState,
  line: TranscriptLine,
  ctx: ScenarioCtx,
  correlationId: string
): void {
  const cues = detectCues(line);
  const fields = extractFields(line);
  line.cueEvents = cues;

  const active = ctx.activeIncidentId
    ? draft.incidents.find((i) => i.id === ctx.activeIncidentId)
    : undefined;
  const classifierState: ClassifierState = {
    hasActiveIncident: Boolean(active),
    routingOpened: ctx.routingOpened,
    knownFieldValues: active ? knownValues(active) : {},
  };

  const { semanticType, rationale } = classifyLine(line.text, cues, fields, classifierState);
  line.semanticType = semanticType;
  line.processed = true;

  audit(draft, {
    correlationId,
    action: 'TRANSCRIPT_PROCESSED',
    actor: SYSTEM_ACTOR,
    incidentId: ctx.activeIncidentId,
    summary: `Line by ${line.speaker} classified ${semanticType}: ${rationale}`,
  });

  for (const cue of cues) {
    audit(draft, {
      correlationId,
      action: 'CUE_DETECTED',
      actor: SYSTEM_ACTOR,
      incidentId: ctx.activeIncidentId,
      summary: `Cue ${cue.cueType} "${cue.phrase}" @ ${Math.round(cue.confidence * 100)}% — ${cue.rationale}`,
    });
  }

  if (semanticType === 'ADMIN_CHATTER') {
    applyUnitStatusCues(draft, line, cues, undefined, correlationId);
    return;
  }

  if (semanticType === 'CONFIRMATION' && ctx.activeIncidentId) {
    applyConfirmation(draft, ctx.activeIncidentId, fields, line, correlationId);
    applyUnitStatusCues(draft, line, cues, ctx.activeIncidentId, correlationId);
    return;
  }

  const incident = createOrUpdateIncident(
    draft,
    line,
    cues,
    fields,
    semanticType,
    ctx,
    correlationId
  );

  applyUnitStatusCues(draft, line, cues, ctx.activeIncidentId, correlationId);

  // Recommend units as soon as we have an incident with a resolved-ish zone.
  if (incident && incident.assignedUnits.length === 0) {
    recommendUnitsFor(draft, incident.id, correlationId, [line.id]);
  }
}

export function runScenario(
  draft: MiiState,
  scenarioId: string,
  actor: string = SYSTEM_ACTOR
): { correlationId: string; incidentId?: string } {
  const scenario = getScenario(scenarioId);
  const correlationId = newCorrelationId();
  if (!scenario) return { correlationId };

  audit(draft, {
    correlationId,
    action: 'SCENARIO_STARTED',
    actor,
    summary: `Scenario started: ${scenario.title}`,
  });

  const ctx: ScenarioCtx = { routingOpened: false };
  const baseTime = Date.parse(nowIso());

  scenario.lines.forEach((seed, idx) => {
    const line: TranscriptLine = {
      id: makeId('line'),
      speaker: seed.speaker,
      text: seed.text,
      timestamp: new Date(baseTime + idx * 4000).toISOString(),
      confidence: seed.confidence,
      processed: false,
      cueEvents: [],
    };
    draft.transcriptLines.push(line);
    processTranscriptLine(draft, line, ctx, correlationId);
  });

  if (ctx.activeIncidentId) {
    recommendUnitsFor(draft, ctx.activeIncidentId, correlationId);
  }

  return { correlationId, incidentId: ctx.activeIncidentId };
}

// --- recommendations -----------------------------------------------------

export function recommendUnitsFor(
  draft: MiiState,
  incidentId: string,
  correlationId: string,
  sourceLineIds: string[] = []
): UnitRecommendation[] {
  const incident = draft.incidents.find((i) => i.id === incidentId);
  if (!incident) return [];
  const recs = recommendUnits(incident, draft.units, sourceLineIds);
  draft.recommendations = draft.recommendations.filter((r) => r.incidentId !== incidentId);
  draft.recommendations.push(...recs);

  if (recs.length) {
    // Once a unit is already responding, later runs surface *backup* options.
    const label =
      incident.assignedUnits.length > 0
        ? 'Available backup recommendations'
        : 'Recommended';
    audit(draft, {
      correlationId,
      action: 'UNIT_RECOMMENDED',
      actor: SYSTEM_ACTOR,
      incidentId,
      summary: `${label}: ${recs
        .map((r) => `${draft.units.find((u) => u.id === r.unitId)?.displayName} (${r.rationale})`)
        .join('; ')}`,
    });
  }
  return recs;
}

// --- human review actions -----------------------------------------------

export function confirmAsr(draft: MiiState, incidentId: string, actor: string): void {
  const incident = draft.incidents.find((i) => i.id === incidentId);
  if (!incident || incident.asrConfirmed) return;
  incident.asrConfirmed = true;
  incident.updatedAt = nowIso();
  pushTimeline(incident, 'ASR confirmed by dispatcher');
  audit(draft, {
    correlationId: newCorrelationId(),
    action: 'CONFIRMATION_APPLIED',
    actor,
    incidentId,
    summary: 'ASR confirmed by human reviewer — mock CAD submit now permitted.',
  });
}

export function applySuggestedFields(draft: MiiState, incidentId: string, actor: string): void {
  const incident = draft.incidents.find((i) => i.id === incidentId);
  if (!incident) return;
  const applied: string[] = [];
  for (const f of incident.suggestedFields) {
    // Sensitive fields require their own explicit confirmation; not auto-applied.
    if (f.sensitive) continue;
    if (!f.confirmed) {
      f.confirmed = true;
      applied.push(f.key);
    }
  }
  if (incident.status === 'PENDING_REVIEW') incident.status = 'ACTIVE';
  reSyncCanonicalFields(incident);
  pushTimeline(incident, 'Suggested fields applied', applied.join(', '));
  audit(draft, {
    correlationId: newCorrelationId(),
    action: 'FIELDS_APPLIED',
    actor,
    incidentId,
    summary: `Applied non-sensitive suggested fields: ${applied.join(', ') || 'none pending'}`,
    after: applied,
  });
}

export function confirmSensitiveField(
  draft: MiiState,
  incidentId: string,
  fieldId: string,
  actor: string
): void {
  const incident = draft.incidents.find((i) => i.id === incidentId);
  if (!incident) return;
  const field = incident.suggestedFields.find((f) => f.id === fieldId);
  if (!field) return;
  field.confirmed = true;
  incident.updatedAt = nowIso();
  pushTimeline(incident, `Sensitive field confirmed: ${field.label}`);
  audit(draft, {
    correlationId: newCorrelationId(),
    action: 'CONFIRMATION_APPLIED',
    actor,
    incidentId,
    summary: `Sensitive field confirmed for mock CAD: ${field.label} (${field.value}).`,
  });
}

export function rejectField(
  draft: MiiState,
  incidentId: string,
  fieldId: string,
  actor: string
): void {
  const incident = draft.incidents.find((i) => i.id === incidentId);
  if (!incident) return;
  const field = incident.suggestedFields.find((f) => f.id === fieldId);
  if (!field) return;
  incident.suggestedFields = incident.suggestedFields.filter((f) => f.id !== fieldId);
  reSyncCanonicalFields(incident);
  pushTimeline(incident, `Field rejected: ${field.label}`, field.value);
  audit(draft, {
    correlationId: newCorrelationId(),
    action: 'FIELD_REJECTED',
    actor,
    incidentId,
    summary: `Rejected field "${field.label}" (${field.value}).`,
    before: { key: field.key, value: field.value },
  });
}

// Human resolution of a field conflict. Deterministic and audited.
export function resolveFieldConflict(
  draft: MiiState,
  incidentId: string,
  conflictId: string,
  selectedValue: 'existing' | 'incoming',
  actor: string
): void {
  const incident = draft.incidents.find((i) => i.id === incidentId);
  if (!incident) return;
  const conflict = incident.conflicts.find((c) => c.id === conflictId);
  if (!conflict || conflict.status === 'RESOLVED') return;

  const chosen = selectedValue === 'incoming' ? conflict.incomingValue : conflict.existingValue;

  if (selectedValue === 'incoming') {
    const field = incident.suggestedFields.find((f) => f.key === conflict.fieldKey);
    if (field) {
      field.value = conflict.incomingValue;
      for (const lineId of conflict.incomingSourceTranscriptLineIds) {
        if (!field.sourceTranscriptLineIds.includes(lineId)) {
          field.sourceTranscriptLineIds.push(lineId);
        }
      }
    }
  }

  stampResolution(conflict, chosen, actor);

  // Return the incident to a reviewable state once all conflicts are resolved.
  if (!hasOpenConflicts(incident) && incident.status === 'CONFLICT') {
    incident.status = 'PENDING_REVIEW';
  }
  // Recompute canonical address/zone/summary/confidence/updatedAt.
  reSyncCanonicalFields(incident);
  pushTimeline(incident, `Conflict resolved: ${conflict.label}`, `→ ${chosen}`);

  audit(draft, {
    correlationId: newCorrelationId(),
    action: 'CONFLICT_RESOLVED',
    actor,
    incidentId,
    summary:
      selectedValue === 'existing'
        ? `Conflict resolved for ${conflict.label}: kept existing "${conflict.existingValue}".`
        : `Conflict resolved for ${conflict.label}: used incoming "${conflict.incomingValue}".`,
    after: { fieldKey: conflict.fieldKey, value: chosen },
  });
}

export function assignUnit(
  draft: MiiState,
  incidentId: string,
  unitId: string,
  actor: string
): void {
  const incident = draft.incidents.find((i) => i.id === incidentId);
  const unit = draft.units.find((u) => u.id === unitId);
  if (!incident || !unit) return;
  if (!incident.assignedUnits.includes(unitId)) incident.assignedUnits.push(unitId);
  unit.status = 'EN_ROUTE';
  if (incident.status === 'PENDING_REVIEW') incident.status = 'ACTIVE';
  incident.updatedAt = nowIso();
  pushTimeline(incident, `Unit assigned: ${unit.displayName}`);
  audit(draft, {
    correlationId: newCorrelationId(),
    action: 'UNIT_ASSIGNED',
    actor,
    incidentId,
    summary: `Assigned ${unit.displayName} (${unit.officerName}) to ${incident.eventNumber}.`,
    after: { unitId, status: unit.status },
  });
}

export function submitMockCad(
  draft: MiiState,
  incidentId: string,
  options: MockCadOptions,
  actor: string
): MockCadPayload | undefined {
  const incident = draft.incidents.find((i) => i.id === incidentId);
  if (!incident) return undefined;
  const payload = buildMockCadPayload(incident, draft.units, options);
  draft.mockCadPayloads[incidentId] = payload;
  pushTimeline(incident, 'Mock CAD payload submitted (NOT SENT)');
  audit(draft, {
    correlationId: newCorrelationId(),
    action: 'MOCK_CAD_SUBMITTED',
    actor,
    incidentId,
    summary: `MOCK CAD payload built for ${incident.eventNumber} (sensitive included: ${payload.sensitiveFieldsIncluded}). NOT SENT to any external system.`,
    after: payload,
  });
  return payload;
}

export function closeIncident(draft: MiiState, incidentId: string, actor: string): void {
  const incident = draft.incidents.find((i) => i.id === incidentId);
  if (!incident) return;
  incident.status = 'CLOSED';
  incident.updatedAt = nowIso();
  pushTimeline(incident, 'Incident closed');
  audit(draft, {
    correlationId: newCorrelationId(),
    action: 'INCIDENT_UPDATED',
    actor,
    incidentId,
    summary: `Incident ${incident.eventNumber} closed by reviewer.`,
  });
}
