import type { FieldConflict, IncidentContext, SuggestedField } from './types';
import { makeId, nowIso } from './util';

// Material fields are the ones whose contradiction matters for CAD. A different
// incoming value on one of these does NOT silently overwrite — it raises a
// conflict for human resolution.
export const MATERIAL_CONFLICT_KEYS = [
  'address',
  'apartment',
  'natureCode',
  'naturePlain',
  'crossStreet',
  'plate',
] as const;

export function isMaterialField(key: string): boolean {
  return (MATERIAL_CONFLICT_KEYS as readonly string[]).includes(key);
}

export function findOpenConflict(
  incident: IncidentContext,
  fieldKey: string
): FieldConflict | undefined {
  return incident.conflicts.find((c) => c.fieldKey === fieldKey && c.status === 'OPEN');
}

// Build a FieldConflict from an existing field and a contradicting incoming one.
export function makeFieldConflict(
  existing: SuggestedField,
  incomingValue: string,
  incomingLineId: string
): FieldConflict {
  return {
    id: makeId('conflict'),
    fieldKey: existing.key,
    label: existing.label,
    existingValue: existing.value,
    incomingValue,
    existingSourceTranscriptLineIds: [...existing.sourceTranscriptLineIds],
    incomingSourceTranscriptLineIds: [incomingLineId],
    status: 'OPEN',
  };
}

export function openConflicts(incident: IncidentContext): FieldConflict[] {
  return incident.conflicts.filter((c) => c.status === 'OPEN');
}

export function hasOpenConflicts(incident: IncidentContext): boolean {
  return incident.conflicts.some((c) => c.status === 'OPEN');
}

export function stampResolution(
  conflict: FieldConflict,
  resolvedValue: string,
  resolvedBy: string
): void {
  conflict.status = 'RESOLVED';
  conflict.resolvedValue = resolvedValue;
  conflict.resolvedBy = resolvedBy;
  conflict.resolvedAt = nowIso();
}
