/**
 * Permanent MII_lite verification harness.
 *
 * Drives the deterministic engine (no React, no DOM, no network) to guard
 * Phase 1 (scenarios, safety gates, replay) and Phase 2A (audio intake) against
 * silent regressions in later phases.
 *
 * Run: npm run verify:mii
 *
 * This exercises the real engine functions in src/lib/mii/processor.ts plus the
 * shared safety-gate and mock-CAD logic — the same code the UI calls.
 */
import {
  type MiiState,
  addAudioAsset,
  advanceAsrJob,
  applySuggestedFields,
  assignUnit,
  attachAsrResultToAudio,
  attachTranscriptToAudio,
  cancelAsrJob,
  clearAudioIntake,
  confirmAsr,
  confirmSensitiveField,
  processAudioTranscriptAttachment,
  processScenarioReplayNext,
  requestAsrJob,
  resolveFieldConflict,
  runAsrJobToCompletion,
  runMockAsrForAudio,
  runScenario,
  startScenarioReplay,
  submitMockCad,
} from '@/lib/mii/processor';
import { SEED_UNITS } from '@/lib/mii/seed';
import { buildMockCadPayload } from '@/lib/mii/mockCad';
import { submitBlockReasons, canSubmitMockCad, hasUnconfirmedSensitive } from '@/lib/mii/safetyGates';
import type { IncidentContext } from '@/lib/mii/types';

// Mirror the store's freshState() exactly (freshState is store-internal).
function fresh(): MiiState {
  return {
    incidents: [],
    units: structuredClone(SEED_UNITS),
    transcriptLines: [],
    recommendations: [],
    audit: [],
    mockCadPayloads: {},
    replay: null,
    audioAssets: [],
    audioTranscriptAttachments: [],
    asrTranscriptResults: [],
    asrJobs: [],
  };
}

const ACTOR = 'verify-mii';

// --- tiny assertion + check harness --------------------------------------

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}: ${(e as Error).message}`);
  }
}

function eq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function ok(cond: boolean, label: string): void {
  if (!cond) throw new Error(label);
}

function includes(arr: string[], val: string, label: string): void {
  if (!arr.includes(val)) throw new Error(`${label}: ${JSON.stringify(arr)} does not include ${JSON.stringify(val)}`);
}

// --- shared helpers ------------------------------------------------------

function runInstant(scenarioId: string): { s: MiiState; incident?: IncidentContext } {
  const s = fresh();
  const { incidentId } = runScenario(s, scenarioId, ACTOR);
  return { s, incident: s.incidents.find((i) => i.id === incidentId) };
}

function assignedNames(s: MiiState, incident: IncidentContext): string[] {
  return incident.assignedUnits.map((id) => s.units.find((u) => u.id === id)?.displayName ?? id);
}

function fieldByKey(incident: IncidentContext, key: string) {
  return incident.suggestedFields.find((f) => f.key === key);
}

function replayToCompletion(scenarioId: string): { s: MiiState; incident?: IncidentContext } {
  const s = fresh();
  startScenarioReplay(s, scenarioId, ACTOR);
  let guard = 0;
  while (s.replay && !s.replay.completed && guard < 50) {
    processScenarioReplayNext(s);
    guard++;
  }
  const iid = s.replay?.activeIncidentId;
  return { s, incident: s.incidents.find((i) => i.id === iid) };
}

// =========================================================================
// Phase 1 — core scenarios
// =========================================================================

check('Medical 3-41 core facts', () => {
  const { s, incident } = runInstant('medical-3-41');
  ok(!!incident, 'incident created');
  const inc = incident!;
  eq(inc.natureCode, '3-41', 'natureCode');
  ok(/sick|injured/i.test(inc.naturePlain ?? ''), `naturePlain includes sick/injured (got ${inc.naturePlain})`);
  eq(inc.address, '210 174th Street', 'address');
  eq(inc.apartment, 'Apartment 123', 'apartment');
  eq(inc.zone, 'Center', 'zone');
  ok(assignedNames(s, inc).some((n) => n.includes('421')), `Sunny Isles 421 assigned (got ${assignedNames(s, inc).join(', ')})`);
});

check('Traffic Stop 19 core facts + sensitive plate', () => {
  const { incident } = runInstant('traffic-19');
  ok(!!incident, 'incident created');
  const inc = incident!;
  eq(inc.natureCode, '19', 'natureCode');
  eq(fieldByKey(inc, 'vehicle')?.value, 'Red Honda', 'vehicle');
  const plate = fieldByKey(inc, 'plate');
  ok(!!plate, 'plate field present');
  eq(plate!.value, '123ABC', 'plate value');
  ok(plate!.sensitive, 'plate is sensitive');
  ok(!plate!.confirmed, 'plate initially unconfirmed');
});

check('Address Conflict core facts', () => {
  const { incident } = runInstant('conflict-address');
  ok(!!incident, 'incident created');
  const inc = incident!;
  eq(inc.status, 'CONFLICT', 'status');
  const open = inc.conflicts.filter((c) => c.status === 'OPEN');
  eq(open.length, 1, 'one open conflict');
  const c = open[0];
  ok(/address/i.test(c.label) || c.fieldKey === 'address', `conflict is on address (got ${c.label})`);
  eq(c.existingValue, '210 174th Street', 'existing value');
  eq(c.incomingValue, '250 174th Street', 'incoming value');
  includes(submitBlockReasons(inc), 'Incident is in conflict', 'submitBlockReasons');
});

check('Admin Chatter creates no incident', () => {
  const { s } = runInstant('admin-chatter');
  eq(s.incidents.length, 0, 'incident count');
});

// =========================================================================
// Phase 1 — safety gates
// =========================================================================

check('Medical blocked before ASR confirmation', () => {
  const { incident } = runInstant('medical-3-41');
  includes(submitBlockReasons(incident!), 'ASR not confirmed', 'blockReasons');
  ok(!canSubmitMockCad(incident!), 'cannot submit before ASR');
});

check('Medical submittable after ASR confirmation', () => {
  const { s, incident } = runInstant('medical-3-41');
  confirmAsr(s, incident!.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incident!.id)!;
  eq(submitBlockReasons(inc).length, 0, `no block reasons (got ${submitBlockReasons(inc).join(', ')})`);
  ok(canSubmitMockCad(inc), 'submittable after ASR');
});

check('Address Conflict Gate E fails while conflict open', () => {
  const { incident } = runInstant('conflict-address');
  includes(submitBlockReasons(incident!), 'Incident is in conflict', 'blockReasons');
  ok(!canSubmitMockCad(incident!), 'cannot submit while in conflict');
});

check('Address Conflict submittable after resolve + ASR', () => {
  const { s, incident } = runInstant('conflict-address');
  const conflict = incident!.conflicts.find((c) => c.status === 'OPEN')!;
  resolveFieldConflict(s, incident!.id, conflict.id, 'incoming', ACTOR);
  confirmAsr(s, incident!.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incident!.id)!;
  ok(inc.status !== 'CONFLICT', `status left CONFLICT (got ${inc.status})`);
  eq(submitBlockReasons(inc).length, 0, `no block reasons (got ${submitBlockReasons(inc).join(', ')})`);
  ok(canSubmitMockCad(inc), 'submittable after resolve + ASR');
});

check('Traffic sensitive plate warning does not block submit', () => {
  const { s, incident } = runInstant('traffic-19');
  // Traffic stop needs a responding unit; plate stays unconfirmed (warning only).
  assignUnit(s, incident!.id, 'SI-121', ACTOR);
  confirmAsr(s, incident!.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incident!.id)!;
  ok(hasUnconfirmedSensitive(inc), 'plate still unconfirmed (sensitive warning present)');
  eq(submitBlockReasons(inc).length, 0, `no block reasons (got ${submitBlockReasons(inc).join(', ')})`);
  ok(canSubmitMockCad(inc), 'submittable despite unconfirmed sensitive plate');
});

check('Unconfirmed sensitive plate redacted from mock CAD', () => {
  const { s, incident } = runInstant('traffic-19');
  const payload = buildMockCadPayload(incident!, s.units, { includeSensitive: true });
  ok(!payload.notes.includes('123ABC'), `plate not in payload notes (got ${payload.notes})`);
  ok(/redacted/i.test(payload.notes), `redaction noted (got ${payload.notes})`);
  eq(payload.sensitiveFieldsIncluded, false, 'sensitiveFieldsIncluded false');
});

check('Confirmed sensitive plate included in mock CAD', () => {
  const { s, incident } = runInstant('traffic-19');
  const plate = fieldByKey(incident!, 'plate')!;
  confirmSensitiveField(s, incident!.id, plate.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incident!.id)!;
  const payload = buildMockCadPayload(inc, s.units, { includeSensitive: true });
  ok(payload.notes.includes('123ABC'), `plate present in payload notes (got ${payload.notes})`);
  eq(payload.sensitiveFieldsIncluded, true, 'sensitiveFieldsIncluded true');
});

// =========================================================================
// Phase 1 — replay parity
// =========================================================================

check('Replay Medical 3-41 matches instant facts', () => {
  const { s, incident } = replayToCompletion('medical-3-41');
  ok(!!incident, 'replay produced an incident');
  const inc = incident!;
  eq(inc.natureCode, '3-41', 'natureCode');
  eq(inc.address, '210 174th Street', 'address');
  eq(inc.apartment, 'Apartment 123', 'apartment');
  eq(inc.zone, 'Center', 'zone');
  ok(assignedNames(s, inc).some((n) => n.includes('421')), 'Sunny Isles 421 assigned');
});

check('Replay Address Conflict reaches CONFLICT', () => {
  const { incident } = replayToCompletion('conflict-address');
  ok(!!incident, 'replay produced an incident');
  eq(incident!.status, 'CONFLICT', 'status');
});

check('Replay Admin Chatter completes without incident', () => {
  const { s } = replayToCompletion('admin-chatter');
  ok(!!s.replay?.completed, 'replay completed');
  eq(s.incidents.length, 0, 'incident count');
});

// =========================================================================
// Phase 2A — audio intake
// =========================================================================

check('Audio manual placeholder asset created', () => {
  const s = fresh();
  const asset = addAudioAsset(s, {
    filename: 'simulated-radio-clip.wav',
    sourceType: 'MANUAL_PLACEHOLDER',
    mimeType: 'audio/wav',
    sizeBytes: 0,
    notes: 'Placeholder audio artifact for transcript-first processing.',
  });
  eq(s.audioAssets.length, 1, 'asset stored');
  eq(asset.status, 'UPLOADED', 'initial status UPLOADED');
});

check('Audio Intake seeded Medical matches core facts', () => {
  const s = fresh();
  const asset = addAudioAsset(s, {
    filename: 'medical.wav',
    sourceType: 'SIMULATED_UPLOAD',
    mimeType: 'audio/wav',
    sizeBytes: 2048,
  });
  eq(asset.status, 'UPLOADED', 'status UPLOADED after create');
  const att = attachTranscriptToAudio(s, asset.id, '', 'medical-3-41');
  eq(s.audioAssets[0].status, 'TRANSCRIPT_ATTACHED', 'status TRANSCRIPT_ATTACHED after attach');
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incidentId)!;
  ok(!!inc, 'incident created via audio');
  eq(inc.natureCode, '3-41', 'natureCode');
  ok(/sick|injured/i.test(inc.naturePlain ?? ''), 'naturePlain sick/injured');
  eq(inc.address, '210 174th Street', 'address');
  eq(inc.apartment, 'Apartment 123', 'apartment');
  eq(inc.zone, 'Center', 'zone');
  ok(assignedNames(s, inc).some((n) => n.includes('421')), 'Sunny Isles 421 assigned');
  // Status + provenance bookkeeping
  eq(s.audioAssets[0].status, 'PROCESSED', 'asset status PROCESSED');
  const stored = s.audioTranscriptAttachments[0];
  ok(stored.transcriptLineIds.length > 0, 'attachment stores transcriptLineIds');
  ok(!!stored.processedAt, 'attachment processedAt set');
  eq(stored.activeIncidentId, incidentId, 'attachment linked to incident');
  ok(s.audit.some((a) => a.action === 'AUDIO_TRANSCRIPT_PROCESSED'), 'audit has AUDIO_TRANSCRIPT_PROCESSED');
});

check('Audio Intake Address Conflict creates CONFLICT', () => {
  const s = fresh();
  const asset = addAudioAsset(s, { filename: 'conflict.wav', sourceType: 'SIMULATED_UPLOAD', mimeType: 'audio/wav', sizeBytes: 10 });
  const att = attachTranscriptToAudio(s, asset.id, '', 'conflict-address');
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incidentId)!;
  ok(!!inc, 'incident created');
  eq(inc.status, 'CONFLICT', 'status');
});

check('Audio Intake Admin Chatter creates no incident', () => {
  const s = fresh();
  const asset = addAudioAsset(s, { filename: 'admin.wav', sourceType: 'SIMULATED_UPLOAD', mimeType: 'audio/wav', sizeBytes: 10 });
  const att = attachTranscriptToAudio(s, asset.id, '', 'admin-chatter');
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  eq(incidentId, undefined, 'no incident id');
  eq(s.incidents.length, 0, 'incident count');
  eq(s.audioAssets[0].status, 'PROCESSED', 'asset still PROCESSED');
  ok(
    s.audit.some((a) => a.action === 'AUDIO_TRANSCRIPT_PROCESSED' && /no incident/i.test(a.summary)),
    'audit notes no incident produced'
  );
});

check('Audio Intake freeform parser creates Medical 3-41', () => {
  const s = fresh();
  const asset = addAudioAsset(s, { filename: 'freeform.wav', sourceType: 'AUTHORIZED_RECORDING', mimeType: 'audio/wav', sizeBytes: 99 });
  const text = [
    'MDSO: Sunny Isles fifty.',
    'SIBPD: Sunny Isles fifty QSK.',
    'MDSO: You have a 3-41 at 210 174th Street Apartment 123, reference a 50 year old male with chest pains.',
    'SIBPD: QSL assign Sunny Isles 421 the signal.',
  ].join('\n');
  const att = attachTranscriptToAudio(s, asset.id, text); // no scenarioId => freeform
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incidentId);
  ok(!!inc, 'freeform created an incident');
  eq(inc!.natureCode, '3-41', 'natureCode');
  eq(s.audioTranscriptAttachments[0].transcriptLineIds.length, 4, 'parsed 4 lines');
});

check('clearAudioIntake empties audio slices', () => {
  const s = fresh();
  addAudioAsset(s, { filename: 'x.wav', sourceType: 'SIMULATED_UPLOAD', mimeType: 'audio/wav', sizeBytes: 1 });
  clearAudioIntake(s);
  eq(s.audioAssets.length, 0, 'assets cleared');
  eq(s.audioTranscriptAttachments.length, 0, 'attachments cleared');
});

// Also exercise the applySuggestedFields path so a regression there is caught.
check('applySuggestedFields activates Medical incident', () => {
  const { s, incident } = runInstant('medical-3-41');
  applySuggestedFields(s, incident!.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incident!.id)!;
  eq(inc.status, 'ACTIVE', 'status ACTIVE after applying fields');
});

// =========================================================================
// Phase 2B — mock ASR adapter shell
// =========================================================================

function newAudio(s: MiiState, filename: string): string {
  return addAudioAsset(s, {
    filename,
    sourceType: 'SIMULATED_UPLOAD',
    mimeType: 'audio/wav',
    sizeBytes: 42,
  }).id;
}

function avgConf(segments: { confidence: number }[]): number {
  if (segments.length === 0) return 0;
  return segments.reduce((a, b) => a + b.confidence, 0) / segments.length;
}

check('Mock ASR seeded Medical produces completed result', () => {
  const s = fresh();
  const assetId = newAudio(s, 'medical.wav');
  const result = runMockAsrForAudio(s, assetId, { scenarioId: 'medical-3-41', actor: ACTOR });
  eq(result.status, 'COMPLETED', 'status');
  eq(result.provider, 'MOCK_SCENARIO', 'provider');
  ok(result.transcriptText.includes('3-41'), 'transcriptText includes 3-41');
  eq(result.segments.length, 6, 'segment count matches scenario lines');
  ok(avgConf(result.segments) > 0.8, `avg confidence > 0.8 (got ${avgConf(result.segments).toFixed(3)})`);
  ok(s.audit.some((a) => a.action === 'ASR_TRANSCRIPT_GENERATED'), 'audit has ASR_TRANSCRIPT_GENERATED');
});

check('Attach ASR result to audio', () => {
  const s = fresh();
  const assetId = newAudio(s, 'medical.wav');
  const result = runMockAsrForAudio(s, assetId, { scenarioId: 'medical-3-41', actor: ACTOR });
  const att = attachAsrResultToAudio(s, result.id, ACTOR)!;
  ok(!!att, 'attachment created');
  eq(att.asrResultId, result.id, 'attachment linked to asrResultId');
  eq(att.scenarioId, 'medical-3-41', 'attachment carries scenarioId');
  eq(s.audioAssets[0].status, 'TRANSCRIPT_ATTACHED', 'asset status TRANSCRIPT_ATTACHED');
  ok(s.audit.some((a) => a.action === 'ASR_TRANSCRIPT_GENERATED'), 'audit has ASR_TRANSCRIPT_GENERATED');
  ok(s.audit.some((a) => a.action === 'ASR_TRANSCRIPT_ATTACHED'), 'audit has ASR_TRANSCRIPT_ATTACHED');
});

check('Process ASR-attached Medical creates core facts', () => {
  const s = fresh();
  const assetId = newAudio(s, 'medical.wav');
  const result = runMockAsrForAudio(s, assetId, { scenarioId: 'medical-3-41', actor: ACTOR });
  const att = attachAsrResultToAudio(s, result.id, ACTOR)!;
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incidentId)!;
  ok(!!inc, 'incident created');
  eq(inc.natureCode, '3-41', 'natureCode');
  eq(inc.address, '210 174th Street', 'address');
  eq(inc.apartment, 'Apartment 123', 'apartment');
  eq(inc.zone, 'Center', 'zone');
  ok(assignedNames(s, inc).some((n) => n.includes('421')), 'Sunny Isles 421 assigned');
  eq(s.audioAssets[0].status, 'PROCESSED', 'asset PROCESSED after processing');
});

check('Mock ASR seeded Address Conflict → CONFLICT', () => {
  const s = fresh();
  const assetId = newAudio(s, 'conflict.wav');
  const result = runMockAsrForAudio(s, assetId, { scenarioId: 'conflict-address', actor: ACTOR });
  const att = attachAsrResultToAudio(s, result.id, ACTOR)!;
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incidentId)!;
  ok(!!inc, 'incident created');
  eq(inc.status, 'CONFLICT', 'status');
});

check('Mock ASR seeded Admin Chatter → no incident', () => {
  const s = fresh();
  const assetId = newAudio(s, 'admin.wav');
  const result = runMockAsrForAudio(s, assetId, { scenarioId: 'admin-chatter', actor: ACTOR });
  const att = attachAsrResultToAudio(s, result.id, ACTOR)!;
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  eq(incidentId, undefined, 'no incident id');
  eq(s.incidents.length, 0, 'incident count');
});

check('Mock ASR freeform → Medical 3-41 incident', () => {
  const s = fresh();
  const assetId = newAudio(s, 'freeform.wav');
  const text = [
    'MDSO: Sunny Isles fifty.',
    'SIBPD: Sunny Isles fifty QSK.',
    'MDSO: You have a 3-41 at 210 174th Street Apartment 123, reference a 50 year old male with chest pains.',
    'SIBPD: QSL assign Sunny Isles 421 the signal.',
  ].join('\n');
  const result = runMockAsrForAudio(s, assetId, { freeformTranscriptText: text, actor: ACTOR });
  eq(result.status, 'COMPLETED', 'status');
  eq(result.provider, 'MOCK_FREEFORM', 'provider');
  const att = attachAsrResultToAudio(s, result.id, ACTOR)!;
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incidentId);
  ok(!!inc, 'incident created');
  eq(inc!.natureCode, '3-41', 'natureCode');
});

check('Mock ASR with no input → FAILED + audit', () => {
  const s = fresh();
  const assetId = newAudio(s, 'clip.wav');
  const result = runMockAsrForAudio(s, assetId, { actor: ACTOR });
  eq(result.status, 'FAILED', 'status FAILED');
  ok(!!result.error, 'error present');
  ok(
    s.audit.some((a) => a.action === 'ASR_TRANSCRIPT_GENERATED' && /failed/i.test(a.summary)),
    'audit records the failure'
  );
  // A failed result cannot be attached.
  eq(attachAsrResultToAudio(s, result.id, ACTOR), undefined, 'failed result cannot be attached');
});

// =========================================================================
// Phase 2C — async ASR job lifecycle
// =========================================================================

check('ASR job request creates REQUESTED job', () => {
  const s = fresh();
  const assetId = newAudio(s, 'medical.wav');
  const job = requestAsrJob(s, assetId, { provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  eq(job.status, 'REQUESTED', 'status');
  eq(job.events.length, 1, 'one job event');
  ok(s.audit.some((a) => a.action === 'ASR_JOB_REQUESTED'), 'audit has ASR_JOB_REQUESTED');
});

check('ASR job advances REQUESTED → QUEUED', () => {
  const s = fresh();
  const assetId = newAudio(s, 'medical.wav');
  const job = requestAsrJob(s, assetId, { provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  advanceAsrJob(s, job.id, ACTOR);
  const j = s.asrJobs.find((x) => x.id === job.id)!;
  eq(j.status, 'QUEUED', 'status');
  ok(!!j.queuedAt, 'queuedAt set');
  ok(j.events.some((e) => /queued/i.test(e.summary)), 'event summary includes queued');
});

check('ASR job advances QUEUED → TRANSCRIBING', () => {
  const s = fresh();
  const assetId = newAudio(s, 'medical.wav');
  const job = requestAsrJob(s, assetId, { provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  advanceAsrJob(s, job.id, ACTOR); // QUEUED
  advanceAsrJob(s, job.id, ACTOR); // TRANSCRIBING
  const j = s.asrJobs.find((x) => x.id === job.id)!;
  eq(j.status, 'TRANSCRIBING', 'status');
  ok(!!j.startedAt, 'startedAt set');
});

check('ASR job completes from TRANSCRIBING', () => {
  const s = fresh();
  const assetId = newAudio(s, 'medical.wav');
  const job = requestAsrJob(s, assetId, { provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  advanceAsrJob(s, job.id, ACTOR); // QUEUED
  advanceAsrJob(s, job.id, ACTOR); // TRANSCRIBING
  advanceAsrJob(s, job.id, ACTOR); // COMPLETED
  const j = s.asrJobs.find((x) => x.id === job.id)!;
  eq(j.status, 'COMPLETED', 'status');
  ok(!!j.completedAt, 'completedAt set');
  ok(!!j.resultId, 'resultId set');
  const result = s.asrTranscriptResults.find((r) => r.id === j.resultId)!;
  ok(!!result, 'result stored');
  eq(result.status, 'COMPLETED', 'result status COMPLETED');
  ok(s.audit.some((a) => a.action === 'ASR_JOB_COMPLETED'), 'audit has ASR_JOB_COMPLETED');
});

check('ASR job run-to-completion Medical core facts', () => {
  const s = fresh();
  const assetId = newAudio(s, 'medical.wav');
  const job = requestAsrJob(s, assetId, { provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  const final = runAsrJobToCompletion(s, job.id, ACTOR)!;
  eq(final.status, 'COMPLETED', 'job completed');
  const att = attachAsrResultToAudio(s, final.resultId!, ACTOR)!;
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incidentId)!;
  ok(!!inc, 'incident created');
  eq(inc.natureCode, '3-41', 'natureCode');
  eq(inc.address, '210 174th Street', 'address');
  eq(inc.zone, 'Center', 'zone');
  ok(assignedNames(s, inc).some((n) => n.includes('421')), 'Sunny Isles 421 assigned');
});

check('ASR job run-to-completion Address Conflict → CONFLICT', () => {
  const s = fresh();
  const assetId = newAudio(s, 'conflict.wav');
  const job = requestAsrJob(s, assetId, { provider: 'MOCK_SCENARIO', scenarioId: 'conflict-address', actor: ACTOR });
  const final = runAsrJobToCompletion(s, job.id, ACTOR)!;
  const att = attachAsrResultToAudio(s, final.resultId!, ACTOR)!;
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incidentId)!;
  eq(inc.status, 'CONFLICT', 'status');
});

check('ASR job run-to-completion Admin Chatter → no incident', () => {
  const s = fresh();
  const assetId = newAudio(s, 'admin.wav');
  const job = requestAsrJob(s, assetId, { provider: 'MOCK_SCENARIO', scenarioId: 'admin-chatter', actor: ACTOR });
  const final = runAsrJobToCompletion(s, job.id, ACTOR)!;
  const att = attachAsrResultToAudio(s, final.resultId!, ACTOR)!;
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  eq(incidentId, undefined, 'no incident id');
  eq(s.incidents.length, 0, 'incident count');
});

check('ASR job Mock Freeform → Medical 3-41', () => {
  const s = fresh();
  const assetId = newAudio(s, 'freeform.wav');
  const text = [
    'MDSO: Sunny Isles fifty.',
    'MDSO: You have a 3-41 at 210 174th Street Apartment 123, reference a 50 year old male with chest pains.',
    'SIBPD: QSL assign Sunny Isles 421 the signal.',
  ].join('\n');
  const job = requestAsrJob(s, assetId, { provider: 'MOCK_FREEFORM', freeformTranscriptText: text, actor: ACTOR });
  const final = runAsrJobToCompletion(s, job.id, ACTOR)!;
  eq(final.status, 'COMPLETED', 'job completed');
  const result = s.asrTranscriptResults.find((r) => r.id === final.resultId)!;
  eq(result.provider, 'MOCK_FREEFORM', 'provider MOCK_FREEFORM');
  const att = attachAsrResultToAudio(s, final.resultId!, ACTOR)!;
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incidentId);
  ok(!!inc, 'incident created');
  eq(inc!.natureCode, '3-41', 'natureCode');
});

check('ASR job LOCAL_PLACEHOLDER fails safely', () => {
  const s = fresh();
  const assetId = newAudio(s, 'clip.wav');
  const job = requestAsrJob(s, assetId, { provider: 'LOCAL_PLACEHOLDER', actor: ACTOR });
  const final = runAsrJobToCompletion(s, job.id, ACTOR)!;
  eq(final.status, 'FAILED', 'status FAILED');
  ok(/reserved|future offline/i.test(final.error ?? ''), `error mentions reserved/future offline (got ${final.error})`);
  ok(s.audit.some((a) => a.action === 'ASR_JOB_FAILED'), 'audit has ASR_JOB_FAILED');
});

check('ASR job UNCONFIGURED fails safely', () => {
  const s = fresh();
  const assetId = newAudio(s, 'clip.wav');
  const job = requestAsrJob(s, assetId, { provider: 'UNCONFIGURED', actor: ACTOR });
  const final = runAsrJobToCompletion(s, job.id, ACTOR)!;
  eq(final.status, 'FAILED', 'status FAILED');
  ok(/no.*provider configured/i.test(final.error ?? ''), `error mentions no provider configured (got ${final.error})`);
});

check('ASR job cancel', () => {
  const s = fresh();
  const assetId = newAudio(s, 'medical.wav');
  const job = requestAsrJob(s, assetId, { provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  cancelAsrJob(s, job.id, ACTOR);
  const j = s.asrJobs.find((x) => x.id === job.id)!;
  eq(j.status, 'CANCELLED', 'status CANCELLED');
  ok(!!j.cancelledAt, 'cancelledAt set');
  ok(s.audit.some((a) => a.action === 'ASR_JOB_CANCELLED'), 'audit has ASR_JOB_CANCELLED');
  // Advancing a cancelled job leaves it cancelled.
  advanceAsrJob(s, job.id, ACTOR);
  eq(s.asrJobs.find((x) => x.id === job.id)!.status, 'CANCELLED', 'still CANCELLED after advance');
});

// =========================================================================

console.log('');
console.log(`MII verification complete: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
