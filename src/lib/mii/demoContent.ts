import type { IncidentContext, TranscriptLine } from './types';

// Presentation-only content for the Guided Demo. No business logic here — the
// engine remains the source of truth; this just narrates what it does.

export const DEMO_SCENARIO_ORDER = [
  'medical-3-41',
  'traffic-19',
  'conflict-address',
  'admin-chatter',
] as const;

export const DEMO_TITLES: Record<string, string> = {
  'medical-3-41': 'Medical 3-41',
  'traffic-19': 'Traffic Stop 19',
  'conflict-address': 'Address Conflict',
  'admin-chatter': 'Admin Chatter',
};

export const SCENARIO_PURPOSE: Record<string, string> = {
  'medical-3-41':
    'Shows cue-based routing, signal translation, incident context creation, Center-zone unit assignment, backup recommendations, and mock CAD payload generation.',
  'traffic-19':
    'Shows officer-opener cue detection, vehicle extraction, sensitive plate/tag gating, redaction, explicit confirmation, and audit logging.',
  'conflict-address':
    'Shows contradictory address detection, CONFLICT state, Safety Gate E blocking mock CAD, provenance display, and dispatcher resolution.',
  'admin-chatter':
    'Shows ADMIN_CHATTER classification and proves routine traffic does not create false incidents.',
};

export const WHAT_TO_WATCH: Record<string, string[]> = {
  'medical-3-41': [
    '“Sunny Isles fifty” opens a routing context',
    '3-41 → “Sick or injured person”',
    'Address 210 174th Street resolves to Center zone',
    'Sunny Isles 421 becomes assigned/responding; backups update',
    'Mock CAD unlocks only after ASR confirmation',
  ],
  'traffic-19': [
    '“Sunny Isles 121, 19” is an officer-opener',
    'Vehicle (red Honda) and plate are extracted',
    'Plate is flagged SENSITIVE and redacted by default',
    'Only explicit confirmation includes the plate',
    'The confirmation is recorded in the audit log',
  ],
  'conflict-address': [
    'First address captured as 210 174th Street',
    'Correction transmits 250 174th Street',
    'System raises CONFLICT instead of overwriting',
    'Safety Gate E blocks mock CAD submission',
    'Dispatcher resolves: keep existing or use incoming',
  ],
  'admin-chatter': [
    '“What units are still in service?” is routine',
    'Lines classify as ADMIN_CHATTER',
    'Simple unit-status cues may update the board',
    'No incident is created (false-positive suppression)',
  ],
};

export const DEMO_SCRIPTS: Record<string, string[]> = {
  'medical-3-41': [
    'The system hears “Sunny Isles fifty” and opens a Sunny Isles routing context.',
    '3-41 is translated to Sick or injured person.',
    'The address resolves to Center zone.',
    'Sunny Isles 421 becomes the assigned/responding unit.',
    'The recommendation panel switches to available backup units.',
    'After ASR confirmation, mock CAD submission is allowed.',
    'The payload is clearly marked MOCK CAD PAYLOAD — NOT SENT.',
  ],
  'traffic-19': [
    'The officer opener “Sunny Isles 121, 19” creates an officer-initiated event.',
    'The system extracts vehicle and plate.',
    'The plate is marked SENSITIVE.',
    'Unconfirmed sensitive data is redacted from the mock CAD payload.',
    'Only explicit confirmation includes the plate.',
    'The audit log records the sensitive-field confirmation.',
  ],
  'conflict-address': [
    'The first address is captured as 210 174th Street.',
    'A later correction says 250 174th Street.',
    'The system does not guess or silently overwrite.',
    'It raises CONFLICT and blocks mock CAD submission.',
    'The UI shows both values with transcript provenance.',
    'The dispatcher resolves the conflict by choosing existing or incoming.',
    'The audit trail records both conflict raised and conflict resolved.',
  ],
  'admin-chatter': [
    'The system hears routine unit-status chatter.',
    'It classifies the line as ADMIN_CHATTER.',
    'It may update simple unit status cues, but it does not create an incident.',
    'This demonstrates false-positive suppression.',
  ],
};

export const PATENT_MAPPING: Record<string, string[]> = {
  'medical-3-41': [
    'Cue-based jurisdiction routing',
    'ASR/transcript segment processing (simulated, transcript-first)',
    'Code/Q-code translation',
    'Semantic classification',
    'Incident Context Bundle',
    'Zone + CAD-availability-style unit recommendation',
    'Assigned/responding vs available backup units',
    'Human-in-loop mock CAD submission',
    'Audit/provenance',
  ],
  'traffic-19': [
    'Officer-opener cue',
    'Semantic classification',
    'Vehicle/entity extraction',
    'Sensitive-field policy',
    'Explicit sensitive-field confirmation',
    'Redacted mock CAD payload',
    'Audit/provenance',
  ],
  'conflict-address': [
    'Field-level confidence/provenance',
    'Contradictory fact detection',
    'CONFLICT incident state',
    'Safety Gate E submit blocking',
    'Human conflict resolution',
    'CONFLICT_RAISED / CONFLICT_RESOLVED audit trail',
  ],
  'admin-chatter': [
    'ADMIN_CHATTER semantic classification',
    'False-positive suppression',
    'Unit state cue processing without incident creation',
    'Audit/provenance',
  ],
};

export const DEMO_READINESS_CHECKLIST: string[] = [
  'Reset data before demo',
  'Run Medical 3-41',
  'Confirm ASR',
  'Submit mock CAD',
  'Run Traffic Stop 19',
  'Confirm sensitive plate',
  'Run Address Conflict',
  'Resolve conflict',
  'Run Admin Chatter',
  'Verify no incident created',
  'Review audit log',
];

// Deterministic, presentation-only narration of a single processed line.
export function explainLine(line: TranscriptLine, incident?: IncidentContext): string[] {
  const out: string[] = [];
  const cueTypes = new Set(line.cueEvents.map((c) => c.cueType));

  if (cueTypes.has('ROUTING')) out.push('Routing cue found → Sunny Isles routing context');
  if (cueTypes.has('OFFICER_OPENER')) out.push('Officer-opener cue → officer-initiated event');
  if (line.cueEvents.some((c) => c.phrase === 'QSK')) out.push('QSK protocol token (go ahead)');
  if (line.cueEvents.some((c) => c.phrase === 'QSL'))
    out.push('QSL protocol token (acknowledge / readback)');
  if (cueTypes.has('UNIT_STATUS')) out.push('Unit status cue processed');

  const raisedHere = incident?.conflicts.some(
    (c) => c.incomingSourceTranscriptLineIds[0] === line.id
  );

  if (raisedHere) {
    out.push('CONFLICT raised — value not overwritten');
    return out;
  }

  switch (line.semanticType) {
    case 'NEW_EVENT':
      if (incident && incident.transcriptLineIds[0] === line.id) {
        out.push('NEW_EVENT — incident context created');
      } else {
        out.push('Routing context opened (incident pending facts)');
      }
      break;
    case 'UPDATE':
      out.push('UPDATE applied to incident context');
      break;
    case 'CONFIRMATION':
      out.push('CONFIRMATION boosted confidence / provenance');
      break;
    case 'ADMIN_CHATTER':
      out.push('ADMIN_CHATTER — ignored for incident creation');
      break;
    default:
      break;
  }
  return out;
}
