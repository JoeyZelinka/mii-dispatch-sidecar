import type {
  AuditEntry,
  CodeEntry,
  Incident,
  Suggestion,
  TranscriptEvent,
  Unit,
  Zone,
} from '@/types/mii';

interface Store {
  incidents: Incident[];
  units: Unit[];
  suggestions: Suggestion[];
  transcripts: TranscriptEvent[];
  codes: CodeEntry[];
  audit: AuditEntry[];
}

const baseTime = new Date('2026-04-27T18:42:00.000Z').getTime();
const ago = (minutes: number) =>
  new Date(baseTime - minutes * 60_000).toISOString();
const future = (minutes: number) =>
  new Date(baseTime + minutes * 60_000).toISOString();

const ZONES: Zone[] = ['North', 'Center', 'South', 'Beach', 'AtLarge'];

const seedUnits = (): Unit[] => [
  { id: 'U-101', officerName: 'M. Alvarez', zone: 'North', status: 'AVAILABLE', lastUpdateTs: ago(2) },
  { id: 'U-103', officerName: 'R. Patel', zone: 'North', status: 'EN_ROUTE', lastUpdateTs: ago(1), currentIncidentId: 'INC-2031' },
  { id: 'U-104', officerName: 'T. Nguyen', zone: 'North', status: 'BUSY', lastUpdateTs: ago(8), currentIncidentId: 'INC-2025' },
  { id: 'U-110', officerName: 'A. Brooks', zone: 'North', status: 'OFF_DUTY', lastUpdateTs: ago(120) },
  { id: 'U-201', officerName: 'J. Suarez', zone: 'Center', status: 'AVAILABLE', lastUpdateTs: ago(3) },
  { id: 'U-202', officerName: 'L. Goldberg', zone: 'Center', status: 'ARRIVED', lastUpdateTs: ago(4), currentIncidentId: 'INC-2032' },
  { id: 'U-205', officerName: 'P. Henderson', zone: 'Center', status: 'TRVL', lastUpdateTs: ago(6) },
  { id: 'U-209', officerName: 'D. Cole', zone: 'Center', status: 'BUSY', lastUpdateTs: ago(18), currentIncidentId: 'INC-2027' },
  { id: 'U-301', officerName: 'C. Ramirez', zone: 'South', status: 'AVAILABLE', lastUpdateTs: ago(2) },
  { id: 'U-303', officerName: 'V. Park', zone: 'South', status: 'EN_ROUTE', lastUpdateTs: ago(1), currentIncidentId: 'INC-2033' },
  { id: 'U-305', officerName: 'F. Levine', zone: 'South', status: 'AVAILABLE', lastUpdateTs: ago(5) },
  { id: 'U-309', officerName: 'B. Cho', zone: 'South', status: 'OUT_OF_SERVICE', lastUpdateTs: ago(40) },
  { id: 'U-401', officerName: 'K. Diaz', zone: 'Beach', status: 'AVAILABLE', lastUpdateTs: ago(2) },
  { id: 'U-402', officerName: 'S. Williams', zone: 'Beach', status: 'ARRIVED', lastUpdateTs: ago(6), currentIncidentId: 'INC-2030' },
  { id: 'U-403', officerName: 'O. Boateng', zone: 'Beach', status: 'BUSY', lastUpdateTs: ago(11), currentIncidentId: 'INC-2026' },
  { id: 'U-405', officerName: 'N. Ortiz', zone: 'Beach', status: 'EN_ROUTE', lastUpdateTs: ago(1), currentIncidentId: 'INC-2034' },
  { id: 'U-501', officerName: 'H. Singh', zone: 'AtLarge', status: 'AVAILABLE', lastUpdateTs: ago(3) },
  { id: 'U-502', officerName: 'E. Reyes', zone: 'AtLarge', status: 'TRVL', lastUpdateTs: ago(7) },
  { id: 'U-503', officerName: 'G. Park', zone: 'AtLarge', status: 'AVAILABLE', lastUpdateTs: ago(9) },
  { id: 'U-510', officerName: 'W. Bauer', zone: 'AtLarge', status: 'OFF_DUTY', lastUpdateTs: ago(220) },
];

const seedIncidents = (): Incident[] => [
  {
    id: 'INC-2025',
    eventNumber: 'SI-2026-04-27-0042',
    status: 'ACTIVE',
    natureCode: '10-50',
    naturePlain: 'Vehicle Accident',
    address: '17800 Collins Ave',
    crossStreets: '178th St / Collins Ave',
    zone: 'North',
    createdTs: ago(35),
    updatedTs: ago(2),
    assignedUnits: ['U-104'],
  },
  {
    id: 'INC-2026',
    eventNumber: 'SI-2026-04-27-0043',
    status: 'ACTIVE',
    natureCode: '10-16',
    naturePlain: 'Domestic Disturbance',
    address: '17500 Collins Ave',
    apt: 'PH-3',
    zone: 'Beach',
    createdTs: ago(28),
    updatedTs: ago(11),
    assignedUnits: ['U-403'],
  },
  {
    id: 'INC-2027',
    eventNumber: 'SI-2026-04-27-0044',
    status: 'ACTIVE',
    natureCode: '10-31',
    naturePlain: 'Crime in Progress',
    address: '300 Sunny Isles Blvd',
    crossStreets: 'Collins / Sunny Isles',
    zone: 'Center',
    createdTs: ago(20),
    updatedTs: ago(4),
    assignedUnits: ['U-209'],
  },
  {
    id: 'INC-2030',
    eventNumber: 'SI-2026-04-27-0047',
    status: 'PENDING_REVIEW',
    natureCode: 'Q-9',
    naturePlain: 'Suspicious Person',
    address: '16000 Collins Ave (boardwalk)',
    zone: 'Beach',
    createdTs: ago(14),
    updatedTs: ago(6),
    assignedUnits: ['U-402'],
  },
  {
    id: 'INC-2031',
    eventNumber: 'SI-2026-04-27-0048',
    status: 'PENDING_REVIEW',
    natureCode: '10-54',
    naturePlain: 'Possible Fight',
    address: '19200 Collins Ave',
    crossStreets: '192nd / Collins',
    zone: 'North',
    createdTs: ago(9),
    updatedTs: ago(1),
    assignedUnits: ['U-103'],
  },
  {
    id: 'INC-2032',
    eventNumber: 'SI-2026-04-27-0049',
    status: 'ACTIVE',
    natureCode: '10-90',
    naturePlain: 'Alarm — Commercial',
    address: '18001 Collins Ave',
    zone: 'Center',
    createdTs: ago(7),
    updatedTs: ago(4),
    assignedUnits: ['U-202'],
  },
  {
    id: 'INC-2033',
    eventNumber: 'SI-2026-04-27-0050',
    status: 'ACTIVE',
    natureCode: '10-62',
    naturePlain: 'Theft from Vehicle',
    address: '15000 Collins Ave',
    zone: 'South',
    createdTs: ago(5),
    updatedTs: ago(1),
    assignedUnits: ['U-303'],
  },
  {
    id: 'INC-2034',
    eventNumber: 'SI-2026-04-27-0051',
    status: 'PENDING_REVIEW',
    natureCode: '10-32',
    naturePlain: 'Person with Weapon',
    address: '17475 Collins Ave (lobby)',
    zone: 'Beach',
    createdTs: ago(3),
    updatedTs: ago(1),
    assignedUnits: ['U-405'],
  },
  {
    id: 'INC-2018',
    eventNumber: 'SI-2026-04-27-0034',
    status: 'CLOSED',
    natureCode: 'Q-3',
    naturePlain: 'Welfare Check',
    address: '19355 Collins Ave',
    zone: 'North',
    createdTs: ago(180),
    updatedTs: ago(140),
    assignedUnits: ['U-110'],
  },
];

const seedSuggestions = (): Suggestion[] => [
  {
    id: 'SUG-2025',
    incidentId: 'INC-2025',
    state: 'PENDING',
    lastActionTs: ago(2),
    fields: [
      { key: 'natureCode', label: 'Nature Code', value: '10-50', confidence: 0.97 },
      { key: 'naturePlain', label: 'Nature (Plain)', value: 'Vehicle Accident', confidence: 0.95 },
      { key: 'address', label: 'Address', value: '17800 Collins Ave', confidence: 0.93 },
      { key: 'callerName', label: 'Caller Name', value: 'Maria Alvarez', confidence: 0.71, sensitive: true, category: 'callerInfo' },
      { key: 'callerPhone', label: 'Caller Phone', value: '305-555-0144', confidence: 0.68, sensitive: true, category: 'callerInfo' },
      { key: 'plate1', label: 'Vehicle 1 Plate', value: 'FL · KJD-3902', confidence: 0.82, sensitive: true, category: 'plates' },
      { key: 'plate2', label: 'Vehicle 2 Plate', value: 'FL · 7QV-118', confidence: 0.74, sensitive: true, category: 'plates' },
      { key: 'injuries', label: 'Injuries Reported', value: 'No (per RP)', confidence: 0.86 },
    ],
    unitRecommendations: [
      { unitId: 'U-101', score: 0.92, rationale: 'Available, North zone match, 0.6 mi away' },
      { unitId: 'U-103', score: 0.74, rationale: 'En route nearby, North zone' },
      { unitId: 'U-501', score: 0.6, rationale: 'AtLarge, available — backup option' },
    ],
  },
  {
    id: 'SUG-2030',
    incidentId: 'INC-2030',
    state: 'PENDING',
    lastActionTs: ago(6),
    fields: [
      { key: 'natureCode', label: 'Nature Code', value: 'Q-9', confidence: 0.91 },
      { key: 'naturePlain', label: 'Nature (Plain)', value: 'Suspicious Person', confidence: 0.9 },
      { key: 'address', label: 'Address', value: '16000 Collins Ave (boardwalk)', confidence: 0.88 },
      { key: 'suspectDesc', label: 'Suspect Description', value: 'M / 30s / red hoodie / black backpack', confidence: 0.79, sensitive: true, category: 'suspectDetails' },
      { key: 'callerInitials', label: 'Caller Initials', value: 'J.M.', confidence: 0.62, sensitive: true, category: 'callerInfo' },
    ],
    unitRecommendations: [
      { unitId: 'U-401', score: 0.9, rationale: 'Beach zone, available, on-foot patrol nearby' },
      { unitId: 'U-405', score: 0.55, rationale: 'Beach zone, currently en route — possible reroute' },
      { unitId: 'U-501', score: 0.5, rationale: 'AtLarge, available' },
    ],
  },
  {
    id: 'SUG-2031',
    incidentId: 'INC-2031',
    state: 'PENDING',
    lastActionTs: ago(1),
    fields: [
      { key: 'natureCode', label: 'Nature Code', value: '10-54', confidence: 0.83 },
      { key: 'naturePlain', label: 'Nature (Plain)', value: 'Possible Fight', confidence: 0.81 },
      { key: 'address', label: 'Address', value: '19200 Collins Ave', confidence: 0.94 },
      { key: 'partyCount', label: 'Parties Involved', value: '4–5', confidence: 0.67 },
      { key: 'weaponSeen', label: 'Weapon Seen', value: 'Reported "bat"', confidence: 0.58, sensitive: true, category: 'weapons' },
    ],
    unitRecommendations: [
      { unitId: 'U-101', score: 0.88, rationale: 'North zone, available' },
      { unitId: 'U-103', score: 0.86, rationale: 'En route, currently primary' },
      { unitId: 'U-501', score: 0.55, rationale: 'AtLarge backup' },
    ],
  },
  {
    id: 'SUG-2034',
    incidentId: 'INC-2034',
    state: 'PENDING',
    lastActionTs: ago(1),
    fields: [
      { key: 'natureCode', label: 'Nature Code', value: '10-32', confidence: 0.94 },
      { key: 'naturePlain', label: 'Nature (Plain)', value: 'Person with Weapon', confidence: 0.93 },
      { key: 'address', label: 'Address', value: '17475 Collins Ave (lobby)', confidence: 0.96 },
      { key: 'weaponType', label: 'Weapon Type', value: 'Handgun (per witness)', confidence: 0.84, sensitive: true, category: 'weapons' },
      { key: 'suspectDesc', label: 'Suspect Description', value: 'M / 6\'0" / dark jacket / fled E', confidence: 0.78, sensitive: true, category: 'suspectDetails' },
      { key: 'plate1', label: 'Vehicle Plate', value: 'FL · 8RL-022', confidence: 0.71, sensitive: true, category: 'plates' },
    ],
    unitRecommendations: [
      { unitId: 'U-401', score: 0.95, rationale: 'Beach zone, available, closest' },
      { unitId: 'U-405', score: 0.82, rationale: 'Beach zone, en route — primary' },
      { unitId: 'U-501', score: 0.6, rationale: 'AtLarge backup' },
    ],
  },
];

const seedTranscripts = (): TranscriptEvent[] => {
  const lines: Omit<TranscriptEvent, 'id'>[] = [
    { ts: ago(40), speaker: 'MDSO', text: 'Sunny Isles fifty, you have a 10-50 17800 Collins.', semanticType: 'NEW_EVENT', codesDetected: ['10-50'], plainTalk: 'Vehicle accident at 17800 Collins.', asrConfidence: 0.96, cueDetected: true, incidentId: 'INC-2025' },
    { ts: ago(39), speaker: 'SIBPD', text: '50 copies, who is responding?', semanticType: 'CONFIRMATION', codesDetected: [], asrConfidence: 0.94, cueDetected: true },
    { ts: ago(38), speaker: 'UNIT', text: 'Unit 104, show me en route.', semanticType: 'UPDATE', codesDetected: [], asrConfidence: 0.97, incidentId: 'INC-2025' },
    { ts: ago(30), speaker: 'MDSO', text: 'Sunny Isles 50, Q-9 16000 Collins, white male red hoodie, possible loitering.', semanticType: 'NEW_EVENT', codesDetected: ['Q-9'], plainTalk: 'Suspicious person at 16000 Collins.', asrConfidence: 0.92, cueDetected: true, incidentId: 'INC-2030' },
    { ts: ago(28), speaker: 'UNIT', text: 'Unit 402 arriving, show me 10-23.', semanticType: 'UPDATE', codesDetected: ['10-23'], plainTalk: 'Unit arrived on scene.', asrConfidence: 0.95, incidentId: 'INC-2030' },
    { ts: ago(25), speaker: 'SIBPD', text: 'Any units available, 10-31 at 300 Sunny Isles Blvd.', semanticType: 'NEW_EVENT', codesDetected: ['10-31'], plainTalk: 'Crime in progress.', asrConfidence: 0.93, incidentId: 'INC-2027' },
    { ts: ago(24), speaker: 'UNIT', text: '209 responding, ETA two.', semanticType: 'CONFIRMATION', codesDetected: [], asrConfidence: 0.97, incidentId: 'INC-2027' },
    { ts: ago(20), speaker: 'UNKNOWN', text: 'Did anyone copy the address again?', semanticType: 'ADMIN_CHATTER', codesDetected: [], asrConfidence: 0.78 },
    { ts: ago(18), speaker: 'MDSO', text: 'Sunny Isles 50 copy, 17500 Collins, PH-3, 10-16 in progress.', semanticType: 'NEW_EVENT', codesDetected: ['10-16'], plainTalk: 'Domestic disturbance.', asrConfidence: 0.9, cueDetected: true, incidentId: 'INC-2026' },
    { ts: ago(17), speaker: 'UNIT', text: '403 in route, advise on weapons.', semanticType: 'UPDATE', codesDetected: [], asrConfidence: 0.91, incidentId: 'INC-2026' },
    { ts: ago(15), speaker: 'SIBPD', text: 'Negative on weapons per RP.', semanticType: 'CONFIRMATION', codesDetected: [], asrConfidence: 0.94, incidentId: 'INC-2026' },
    { ts: ago(14), speaker: 'UNIT', text: '402 show me 10-23 at boardwalk.', semanticType: 'UPDATE', codesDetected: ['10-23'], asrConfidence: 0.95, incidentId: 'INC-2030' },
    { ts: ago(12), speaker: 'MDSO', text: 'Stand by all units, 10-32 lobby 17475 Collins, fled east.', semanticType: 'NEW_EVENT', codesDetected: ['10-32'], plainTalk: 'Person with weapon, fled east.', asrConfidence: 0.93, cueDetected: true, incidentId: 'INC-2034' },
    { ts: ago(11), speaker: 'UNIT', text: '401 responding, hot.', semanticType: 'CONFIRMATION', codesDetected: [], asrConfidence: 0.96, incidentId: 'INC-2034' },
    { ts: ago(11), speaker: 'UNIT', text: '405 also responding.', semanticType: 'CONFIRMATION', codesDetected: [], asrConfidence: 0.96, incidentId: 'INC-2034' },
    { ts: ago(10), speaker: 'SIBPD', text: 'Plate FL 8RL-022, advise on direction.', semanticType: 'UPDATE', codesDetected: [], asrConfidence: 0.84, incidentId: 'INC-2034' },
    { ts: ago(9), speaker: 'MDSO', text: 'Sunny Isles 50, 10-54 at 19200 Collins, party of four to five.', semanticType: 'NEW_EVENT', codesDetected: ['10-54'], plainTalk: 'Possible fight.', asrConfidence: 0.89, cueDetected: true, incidentId: 'INC-2031' },
    { ts: ago(9), speaker: 'UNIT', text: '103 inbound from north.', semanticType: 'CONFIRMATION', codesDetected: [], asrConfidence: 0.95, incidentId: 'INC-2031' },
    { ts: ago(8), speaker: 'UNKNOWN', text: '...static... copy that...', semanticType: 'ADMIN_CHATTER', codesDetected: [], asrConfidence: 0.45 },
    { ts: ago(7), speaker: 'MDSO', text: '10-90 commercial alarm 18001 Collins.', semanticType: 'NEW_EVENT', codesDetected: ['10-90'], plainTalk: 'Commercial alarm.', asrConfidence: 0.94, incidentId: 'INC-2032' },
    { ts: ago(6), speaker: 'UNIT', text: '202 arriving, perimeter check.', semanticType: 'UPDATE', codesDetected: [], asrConfidence: 0.94, incidentId: 'INC-2032' },
    { ts: ago(6), speaker: 'SIBPD', text: 'Anyone on the boardwalk subject?', semanticType: 'UPDATE', codesDetected: [], asrConfidence: 0.86, incidentId: 'INC-2030' },
    { ts: ago(5), speaker: 'UNIT', text: '402 negative contact, walking the boardwalk now.', semanticType: 'UPDATE', codesDetected: [], asrConfidence: 0.93, incidentId: 'INC-2030' },
    { ts: ago(5), speaker: 'MDSO', text: '10-62 at 15000 Collins, RP says window broken.', semanticType: 'NEW_EVENT', codesDetected: ['10-62'], plainTalk: 'Theft from vehicle.', asrConfidence: 0.92, incidentId: 'INC-2033' },
    { ts: ago(4), speaker: 'UNIT', text: '303 en route, three out.', semanticType: 'CONFIRMATION', codesDetected: [], asrConfidence: 0.95, incidentId: 'INC-2033' },
    { ts: ago(4), speaker: 'SIBPD', text: 'Channel check, all units 10-4?', semanticType: 'ADMIN_CHATTER', codesDetected: ['10-4'], asrConfidence: 0.95 },
    { ts: ago(3), speaker: 'UNIT', text: '209 on scene, two parties separated.', semanticType: 'UPDATE', codesDetected: [], asrConfidence: 0.93, incidentId: 'INC-2027' },
    { ts: ago(3), speaker: 'MDSO', text: 'Sunny Isles 50 advise: subject in 10-32 may be armed handgun.', semanticType: 'UPDATE', codesDetected: ['10-32'], plainTalk: 'Subject may have a handgun.', asrConfidence: 0.9, cueDetected: true, incidentId: 'INC-2034' },
    { ts: ago(2), speaker: 'UNIT', text: '101 available, where do you want me?', semanticType: 'ADMIN_CHATTER', codesDetected: [], asrConfidence: 0.96 },
    { ts: ago(2), speaker: 'SIBPD', text: '101 head toward 10-50 at 17800 Collins for traffic.', semanticType: 'UPDATE', codesDetected: ['10-50'], asrConfidence: 0.94, incidentId: 'INC-2025' },
    { ts: ago(2), speaker: 'UNIT', text: '101 copy, en route.', semanticType: 'CONFIRMATION', codesDetected: [], asrConfidence: 0.97, incidentId: 'INC-2025' },
    { ts: ago(1), speaker: 'UNIT', text: '405 two minutes from lobby.', semanticType: 'UPDATE', codesDetected: [], asrConfidence: 0.94, incidentId: 'INC-2034' },
    { ts: ago(1), speaker: 'MDSO', text: 'All units, plate of interest FL 8RL-022.', semanticType: 'UPDATE', codesDetected: [], asrConfidence: 0.88, incidentId: 'INC-2034' },
    { ts: ago(1), speaker: 'UNIT', text: '103 arriving 19200 Collins, party scattering.', semanticType: 'UPDATE', codesDetected: [], asrConfidence: 0.93, incidentId: 'INC-2031' },
    { ts: ago(1), speaker: 'SIBPD', text: 'Need a Q-3 at 19355 — already CLEAR.', semanticType: 'ADMIN_CHATTER', codesDetected: ['Q-3'], asrConfidence: 0.79 },
    { ts: ago(1), speaker: 'UNIT', text: '303 on scene, RP outside.', semanticType: 'UPDATE', codesDetected: [], asrConfidence: 0.96, incidentId: 'INC-2033' },
    { ts: future(0), speaker: 'MDSO', text: 'Sunny Isles 50, channel reset on the half hour.', semanticType: 'ADMIN_CHATTER', codesDetected: [], asrConfidence: 0.92, cueDetected: true },
    { ts: ago(35), speaker: 'UNIT', text: '104 on scene, both vehicles drivable.', semanticType: 'UPDATE', codesDetected: [], asrConfidence: 0.94, incidentId: 'INC-2025' },
    { ts: ago(33), speaker: 'SIBPD', text: '10-4, will run plates.', semanticType: 'CONFIRMATION', codesDetected: ['10-4'], asrConfidence: 0.95, incidentId: 'INC-2025' },
    { ts: ago(32), speaker: 'UNIT', text: '104 — plate one FL Kilo-Juliet-Delta-3902.', semanticType: 'UPDATE', codesDetected: [], asrConfidence: 0.81, incidentId: 'INC-2025' },
  ];
  return lines.map((l, i) => ({ id: `T-${String(i + 1).padStart(4, '0')}`, ...l }));
};

const seedCodes = (): CodeEntry[] => [
  { code: '10-4', category: '10-codes', meaning: 'Acknowledgment', plainTalk: 'Copy / understood' },
  { code: '10-7', category: '10-codes', meaning: 'Out of service', plainTalk: 'Unit out of service' },
  { code: '10-8', category: '10-codes', meaning: 'In service', plainTalk: 'Unit available' },
  { code: '10-16', category: '10-codes', meaning: 'Domestic disturbance', plainTalk: 'Domestic disturbance', localOverride: true },
  { code: '10-20', category: '10-codes', meaning: 'Location', plainTalk: 'Provide your location' },
  { code: '10-23', category: '10-codes', meaning: 'Arrived on scene', plainTalk: 'On scene' },
  { code: '10-31', category: '10-codes', meaning: 'Crime in progress', plainTalk: 'Crime in progress' },
  { code: '10-32', category: '10-codes', meaning: 'Person with weapon', plainTalk: 'Armed subject', localOverride: true },
  { code: '10-50', category: '10-codes', meaning: 'Vehicle accident', plainTalk: 'Traffic accident' },
  { code: '10-54', category: '10-codes', meaning: 'Possible fight', plainTalk: 'Fight call' },
  { code: '10-62', category: '10-codes', meaning: 'Theft from vehicle', plainTalk: 'Vehicle burglary' },
  { code: '10-66', category: '10-codes', meaning: 'Suspicious vehicle', plainTalk: 'Suspicious vehicle' },
  { code: '10-71', category: '10-codes', meaning: 'Shooting', plainTalk: 'Shooting reported' },
  { code: '10-80', category: '10-codes', meaning: 'Pursuit', plainTalk: 'Pursuit in progress' },
  { code: '10-90', category: '10-codes', meaning: 'Alarm', plainTalk: 'Alarm — verify type' },
  { code: '10-91', category: '10-codes', meaning: 'Animal complaint', plainTalk: 'Animal complaint' },
  { code: '10-94', category: '10-codes', meaning: 'Drag racing', plainTalk: 'Street racing' },
  { code: '10-99', category: '10-codes', meaning: 'Officer needs assistance', plainTalk: 'Officer needs help' },
  { code: '10-15', category: '10-codes', meaning: 'Prisoner in custody', plainTalk: 'Subject in custody' },
  { code: '10-19', category: '10-codes', meaning: 'Return to station', plainTalk: 'Return to station' },
  { code: '10-25', category: '10-codes', meaning: 'Meet officer', plainTalk: 'Meet officer at location' },
  { code: '10-27', category: '10-codes', meaning: 'License check', plainTalk: 'Run license' },
  { code: '10-28', category: '10-codes', meaning: 'Vehicle reg check', plainTalk: 'Run plate' },
  { code: '10-29', category: '10-codes', meaning: 'Wants/warrants check', plainTalk: 'Run wants/warrants' },
  { code: 'Q-3', category: 'Q-codes', meaning: 'Welfare check', plainTalk: 'Check on the well-being' },
  { code: 'Q-5', category: 'Q-codes', meaning: 'Civil matter', plainTalk: 'Civil dispute, no crime' },
  { code: 'Q-7', category: 'Q-codes', meaning: 'Found property', plainTalk: 'Found property report' },
  { code: 'Q-9', category: 'Q-codes', meaning: 'Suspicious person', plainTalk: 'Suspicious person', localOverride: true },
  { code: 'Q-11', category: 'Q-codes', meaning: 'Noise complaint', plainTalk: 'Noise complaint' },
  { code: 'Q-14', category: 'Q-codes', meaning: 'Parking complaint', plainTalk: 'Parking issue' },
];

const seedAudit = (): AuditEntry[] => {
  const entries: Omit<AuditEntry, 'id'>[] = [
    { ts: ago(60), actor: 'D. Rivera', actionType: 'APPROVE', correlationId: 'cor-9001', incidentId: 'INC-2018', before: { naturePlain: 'Welfare' }, after: { naturePlain: 'Welfare Check' } },
    { ts: ago(58), actor: 'D. Rivera', actionType: 'CONFIRM_ASR', correlationId: 'cor-9002', incidentId: 'INC-2018' },
    { ts: ago(55), actor: 'D. Rivera', actionType: 'SUBMIT_TO_CAD', correlationId: 'cor-9003', incidentId: 'INC-2018', payload: { eventNumber: 'SI-2026-04-27-0034', natureCode: 'Q-3' } },
    { ts: ago(40), actor: 'system', actionType: 'EDIT', correlationId: 'cor-9101', incidentId: 'INC-2025', before: { address: '17800 Colins Ave' }, after: { address: '17800 Collins Ave' } },
    { ts: ago(34), actor: 'D. Rivera', actionType: 'APPROVE', correlationId: 'cor-9102', incidentId: 'INC-2025', before: { natureCode: '' }, after: { natureCode: '10-50' } },
    { ts: ago(33), actor: 'D. Rivera', actionType: 'CONFIRM_ASR', correlationId: 'cor-9103', incidentId: 'INC-2025' },
    { ts: ago(28), actor: 'D. Rivera', actionType: 'APPROVE', correlationId: 'cor-9201', incidentId: 'INC-2026', after: { naturePlain: 'Domestic Disturbance' } },
    { ts: ago(20), actor: 'D. Rivera', actionType: 'EDIT', correlationId: 'cor-9301', incidentId: 'INC-2027', before: { zone: 'Beach' }, after: { zone: 'Center' } },
    { ts: ago(15), actor: 'D. Rivera', actionType: 'REJECT', correlationId: 'cor-9302', incidentId: 'INC-2027', before: { suspectDesc: 'unclear' } },
    { ts: ago(12), actor: 'D. Rivera', actionType: 'APPROVE', correlationId: 'cor-9401', incidentId: 'INC-2030', after: { natureCode: 'Q-9' } },
    { ts: ago(9), actor: 'D. Rivera', actionType: 'CONFIRM_ASR', correlationId: 'cor-9402', incidentId: 'INC-2030' },
    { ts: ago(7), actor: 'D. Rivera', actionType: 'APPROVE', correlationId: 'cor-9501', incidentId: 'INC-2032', after: { natureCode: '10-90' } },
    { ts: ago(5), actor: 'D. Rivera', actionType: 'EDIT', correlationId: 'cor-9601', incidentId: 'INC-2031', before: { partyCount: '3' }, after: { partyCount: '4–5' } },
    { ts: ago(3), actor: 'D. Rivera', actionType: 'APPROVE', correlationId: 'cor-9701', incidentId: 'INC-2034', after: { natureCode: '10-32' } },
    { ts: ago(2), actor: 'D. Rivera', actionType: 'CONFIRM_ASR', correlationId: 'cor-9702', incidentId: 'INC-2034' },
  ];
  return entries.map((e, i) => ({ id: `AUD-${String(i + 1).padStart(4, '0')}`, ...e }));
};

declare global {
  // eslint-disable-next-line no-var
  var __MII_STORE__: Store | undefined;
}

const buildStore = (): Store => ({
  incidents: seedIncidents(),
  units: seedUnits(),
  suggestions: seedSuggestions(),
  transcripts: seedTranscripts(),
  codes: seedCodes(),
  audit: seedAudit(),
});

export const store: Store =
  globalThis.__MII_STORE__ ?? (globalThis.__MII_STORE__ = buildStore());

export const ZONES_LIST: Zone[] = ZONES;

let auditCounter = store.audit.length;
let correlationCounter = 10_000;

export const nextAuditId = () =>
  `AUD-${String(++auditCounter).padStart(4, '0')}`;

export const nextCorrelationId = () => `cor-${++correlationCounter}`;
