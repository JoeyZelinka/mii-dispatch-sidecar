import type { IncidentContext, MockCadPayload, Unit } from './types';
import { nowIso } from './util';

export interface MockCadOptions {
  // When true, confirmed sensitive fields (e.g. plate) are allowed into the payload.
  includeSensitive: boolean;
}

// Build a MOCK CAD payload. This object is NEVER sent anywhere — it is rendered
// as pretty JSON in the UI for human review only.
export function buildMockCadPayload(
  incident: IncidentContext,
  units: Unit[],
  options: MockCadOptions
): MockCadPayload {
  const byKey = (key: string) => incident.suggestedFields.find((f) => f.key === key);

  const nature = byKey('naturePlain')?.value ?? incident.naturePlain ?? 'Unknown';
  const address = incident.address ?? byKey('address')?.value ?? '';
  const crossStreet = byKey('crossStreet')?.value ?? '';
  const location = address || crossStreet || 'Unknown';
  const apartment = incident.apartment ?? byKey('apartment')?.value ?? '';

  const assignedNames = incident.assignedUnits.map(
    (id) => units.find((u) => u.id === id)?.displayName ?? id
  );

  // Only confirmed sensitive fields are eligible, and only when includeSensitive is on.
  const eligibleSensitive = incident.suggestedFields.filter(
    (f) => f.sensitive && f.confirmed && options.includeSensitive
  );

  const noteParts: string[] = [];
  const vehicle = byKey('vehicle');
  if (vehicle) noteParts.push(`Vehicle: ${vehicle.value}`);
  if (crossStreet && location !== crossStreet) noteParts.push(`Cross street: ${crossStreet}`);
  for (const f of eligibleSensitive) {
    noteParts.push(`${f.label}: ${f.value}`);
  }
  const excludedSensitive = incident.suggestedFields.filter(
    (f) => f.sensitive && !(f.confirmed && options.includeSensitive)
  );
  for (const f of excludedSensitive) {
    noteParts.push(`${f.label}: [REDACTED — sensitive, not confirmed for CAD]`);
  }

  return {
    eventNumber: incident.eventNumber,
    nature,
    location,
    apartment,
    assignedUnits: assignedNames,
    notes: noteParts.join(' | ') || 'No additional notes.',
    sensitiveFieldsIncluded: eligibleSensitive.length > 0,
    submittedAt: nowIso(),
  };
}
