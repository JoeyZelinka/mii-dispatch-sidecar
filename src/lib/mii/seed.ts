import type { Scenario, Unit } from './types';

// Seeded simulated transcripts only. NOT real radio, CAD, or agency data.

export const SCENARIOS: Scenario[] = [
  {
    id: 'medical-3-41',
    title: 'Run Medical 3-41',
    blurb:
      'Dispatcher-initiated medical call. Demonstrates routing cue, signal translation (3-41 → sick/injured person), address + apartment extraction, Center zone resolution, Center unit recommendation, and QSL confirmation boosting confidence without duplicating the incident.',
    expectedSemantic: 'NEW_EVENT',
    lines: [
      { speaker: 'MDSO', text: 'Sunny Isles fifty.', confidence: 0.95 },
      { speaker: 'SIBPD', text: 'Sunny Isles fifty QSK.', confidence: 0.93 },
      {
        speaker: 'MDSO',
        text:
          'You have a 3-41 at 210 174th Street Apartment 123, reference a 50 year old male with chest pains.',
        confidence: 0.9,
      },
      { speaker: 'SIBPD', text: 'QSL assign Sunny Isles 421 the signal.', confidence: 0.92 },
      { speaker: 'Unit 421', text: 'Sunny Isles 421 QSL en route.', confidence: 0.91 },
      { speaker: 'Unit 421', text: 'Sunny Isles 421 arrival.', confidence: 0.91 },
    ],
  },
  {
    id: 'traffic-19',
    title: 'Run Traffic Stop 19',
    blurb:
      'Officer-initiated traffic stop. Demonstrates OFFICER_OPENER cue, signal translation (19 → traffic stop), vehicle + cross-street extraction, and a SENSITIVE plate that is gated out of the mock CAD payload until explicitly confirmed.',
    expectedSemantic: 'NEW_EVENT',
    lines: [
      { speaker: 'Unit 121', text: 'Sunny Isles 121, 19.', confidence: 0.92 },
      { speaker: 'SIBPD', text: 'Sunny Isles 121 QSK.', confidence: 0.93 },
      {
        speaker: 'Unit 121',
        text: '19 on a red Honda, Florida tag 123ABC, Collins and 180th.',
        confidence: 0.88,
      },
      {
        speaker: 'SIBPD',
        text: 'QSL red Honda Florida tag 123ABC, Collins and 180th.',
        confidence: 0.9,
      },
    ],
  },
  {
    id: 'conflict-address',
    title: 'Run Address Conflict',
    blurb:
      'Medical call with conflicting address transmissions. Demonstrates conflict detection, CAD submit blocking, provenance display, and human conflict resolution.',
    expectedSemantic: 'NEW_EVENT',
    lines: [
      { speaker: 'MDSO', text: 'Sunny Isles fifty.', confidence: 0.95 },
      { speaker: 'SIBPD', text: 'Sunny Isles fifty QSK.', confidence: 0.93 },
      {
        speaker: 'MDSO',
        text:
          'You have a 3-41 at 210 174th Street Apartment 123, reference a 50 year old male with chest pains.',
        confidence: 0.9,
      },
      {
        speaker: 'SIBPD',
        text: 'QSL 210 174th Street Apartment 123, assign Sunny Isles 421.',
        confidence: 0.92,
      },
      {
        speaker: 'MDSO',
        text: 'Correction, location is 250 174th Street Apartment 123.',
        confidence: 0.89,
      },
      { speaker: 'SIBPD', text: 'QSL 250 174th Street Apartment 123.', confidence: 0.9 },
      { speaker: 'Unit 421', text: 'Sunny Isles 421 QSL en route.', confidence: 0.91 },
    ],
  },
  {
    id: 'admin-chatter',
    title: 'Run Admin Chatter',
    blurb:
      'Routine administrative traffic. Demonstrates ADMIN_CHATTER classification: no incident is created, simple unit-state cues are surfaced, and the audit log records that the chatter was processed and ignored for incident creation.',
    expectedSemantic: 'ADMIN_CHATTER',
    lines: [
      { speaker: 'SIBPD', text: 'What units are still in service?', confidence: 0.94 },
      { speaker: 'Unit 421', text: 'Sunny Isles 421 available.', confidence: 0.93 },
      { speaker: 'Unit 122', text: 'Sunny Isles 122 out of service.', confidence: 0.93 },
    ],
  },
];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export const SEED_UNITS: Unit[] = [
  {
    id: 'SI-421',
    displayName: 'Sunny Isles 421',
    officerName: 'Officer Martinez',
    zone: 'Center',
    status: 'AVAILABLE',
    isAtLarge: false,
  },
  {
    id: 'SI-422',
    displayName: 'Sunny Isles 422',
    officerName: 'Officer Ariaz',
    zone: 'Center',
    status: 'AVAILABLE',
    isAtLarge: false,
  },
  {
    id: 'SI-121',
    displayName: 'Sunny Isles 121',
    officerName: 'Officer Rivera',
    zone: 'South',
    status: 'AVAILABLE',
    isAtLarge: false,
  },
  {
    id: 'SI-122',
    displayName: 'Sunny Isles 122',
    officerName: 'Officer Smith',
    zone: 'North',
    status: 'OUT_OF_SERVICE',
    isAtLarge: false,
  },
  {
    id: 'SI-120',
    displayName: 'Sunny Isles 120',
    officerName: 'Officer Johnson',
    zone: 'AtLarge',
    status: 'AVAILABLE',
    isAtLarge: true,
  },
  {
    id: 'SI-430',
    displayName: 'Sunny Isles 430',
    officerName: 'Officer Chen',
    zone: 'Beach',
    status: 'BUSY',
    isAtLarge: false,
  },
];

export const TENANT = 'Sunny Isles Beach';
export const AGENCY = 'SIBPD';
