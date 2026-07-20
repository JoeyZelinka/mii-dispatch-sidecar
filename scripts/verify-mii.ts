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
  createPlaceholderAudioAssetInput,
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
import {
  submitBlockReasons,
  canSubmitMockCad,
  hasUnconfirmedSensitive,
  evaluateIncidentSafetyReadiness,
} from '@/lib/mii/safetyGates';
import { evaluateTranscriptReviewGateForIncident } from '@/lib/mii/transcriptReviewGate';
import {
  defaultDemoPolicy,
  evaluateSignOffPolicyGateForIncident,
  updateDemoPolicy,
} from '@/lib/mii/signOffPolicy';
import {
  buildIncidentAuditExport,
  buildSignedIncidentAuditExport,
  verifyIncidentAuditExport,
} from '@/lib/mii/auditExport';
import { canonicalizeForHash, stripAuditIntegrity } from '@/lib/mii/canonicalJson';
import { sha256Hex } from '@/lib/mii/hash';
import {
  cancelRecordingProcessingSession,
  completeRecordingProcessingSession,
  createRecordingProcessingSession,
  linkRecordingSessionToPennyPlan,
  refreshRecordingProcessingSessionLinks,
  startRecordingProcessingSession,
} from '@/lib/mii/recordingProcessing';
import { ASR_PROVIDER_REGISTRY, getAsrProviderDefinition } from '@/lib/mii/asr/providerRegistry';
import {
  LOCAL_OFFLINE_ASR_MODEL_CONFIG,
  checkLocalOfflineAsrAssets,
} from '@/lib/mii/asr/localOfflineAsrAssets';
import {
  completeLocalOfflineAsrForPlan,
  recordLocalOfflineAsrFailed,
  recordLocalOfflineAsrStarted,
} from '@/lib/mii/asr/localOfflineHandoff';
import {
  createDeterministicWaveform,
  estimateDurationFromSegments,
  fieldProvenanceToTimelineMarkers,
  segmentsToTimelineMarkers,
} from '@/lib/mii/audioTimeline';
import {
  createPennyPlan,
  evaluateAsrResultForPenny,
  evaluatePennyQualityGate,
  evaluatePennyReviewReadiness,
  pennyAttachTranscriptPackage,
  pennyRequestAsrJob,
  pennyRunAsrToCompletion,
  recordPennyReviewAction,
  signOffPennyReview,
} from '@/lib/mii/penny';
import type { AsrSegment, AsrTranscriptResult, IncidentContext } from '@/lib/mii/types';

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
    pennyPlans: [],
    pennyTranscriptPackages: [],
    pennyReviewStates: [],
    demoPolicy: defaultDemoPolicy(),
    recordingProcessingSessions: [],
  };
}

// Build a PENNY package deterministically from a custom ASR result so review
// tests can target specific warning/blocking severities.
let _customResultSeq = 0;
function buildPennyPackageFromSegments(
  s: MiiState,
  segments: AsrSegment[]
): { planId: string; packageId: string } {
  const assetId = addAudioAsset(s, createPlaceholderAudioAssetInput()).id;
  const plan = createPennyPlan(s, {
    audioAssetId: assetId,
    provider: 'MOCK_SCENARIO',
    scenarioId: 'medical-3-41',
    actor: ACTOR,
  });
  _customResultSeq += 1;
  const result: AsrTranscriptResult = {
    id: `asr_custom_${_customResultSeq}`,
    audioAssetId: assetId,
    provider: 'MOCK_SCENARIO',
    status: 'COMPLETED',
    transcriptText: segments.map((seg) => `${seg.speaker}: ${seg.text}`).join('\n'),
    segments,
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:00:00.000Z',
    scenarioId: 'medical-3-41',
  };
  s.asrTranscriptResults.push(result);
  plan.asrResultId = result.id;
  plan.status = 'ASR_COMPLETED';
  const pkg = evaluateAsrResultForPenny(s, plan.id, ACTOR)!;
  return { planId: plan.id, packageId: pkg.id };
}

// A completed mock Medical ASR result for helper-level checks.
function medicalAsrResult() {
  const s = fresh();
  const assetId = newAudio(s, 'medical.wav');
  const job = requestAsrJob(s, assetId, { provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  const final = runAsrJobToCompletion(s, job.id, ACTOR)!;
  return s.asrTranscriptResults.find((r) => r.id === final.resultId)!;
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
// Phase 2D — local audio metadata + timeline provenance
// =========================================================================

check('createDeterministicWaveform is deterministic', () => {
  const a = createDeterministicWaveform(18);
  const b = createDeterministicWaveform(18);
  ok(a.length > 0, 'non-empty');
  eq(JSON.stringify(a), JSON.stringify(b), 'identical across calls');
  ok(a.every((p) => p.amplitude >= 0 && p.amplitude <= 1), 'amplitudes within 0..1');
  eq(createDeterministicWaveform(0).length, 0, 'zero duration → empty');
});

check('estimateDurationFromSegments matches max segment end', () => {
  const result = medicalAsrResult();
  const dur = estimateDurationFromSegments(result.segments)!;
  ok(dur > 0, 'duration > 0');
  const maxEnd = Math.max(...result.segments.map((s) => (s.endMs ?? 0) / 1000));
  ok(Math.abs(dur - maxEnd) < 0.2, `duration ~= max segment end (dur ${dur}, maxEnd ${maxEnd})`);
});

check('segmentsToTimelineMarkers maps segments', () => {
  const result = medicalAsrResult();
  const markers = segmentsToTimelineMarkers(result.segments);
  eq(markers.length, result.segments.length, 'marker count equals segment count');
  eq(markers[0].kind, 'ASR_SEGMENT', 'first marker kind ASR_SEGMENT');
  ok(!!markers[0].label, 'marker has label');
  ok(!!markers[0].sourceId, 'marker has sourceId');
});

check('placeholder audio gets duration and waveform', () => {
  const s = fresh();
  const input = createPlaceholderAudioAssetInput();
  const asset = addAudioAsset(s, input);
  ok(asset.durationSeconds != null && asset.durationSeconds > 0, `durationSeconds set (got ${asset.durationSeconds})`);
  ok(!!asset.waveform && asset.waveform.length > 0, 'waveform non-empty');
});

check('ASR completion backfills duration/waveform', () => {
  const s = fresh();
  // Audio asset with no duration/waveform.
  const asset = addAudioAsset(s, {
    filename: 'medical.wav',
    sourceType: 'SIMULATED_UPLOAD',
    mimeType: 'audio/wav',
    sizeBytes: 100,
  });
  ok(asset.durationSeconds == null, 'starts with no duration');
  ok(asset.waveform == null, 'starts with no waveform');
  const job = requestAsrJob(s, asset.id, { provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  runAsrJobToCompletion(s, job.id, ACTOR);
  const updated = s.audioAssets.find((a) => a.id === asset.id)!;
  ok(updated.durationSeconds != null && updated.durationSeconds > 0, `duration backfilled (got ${updated.durationSeconds})`);
  ok(!!updated.waveform && updated.waveform.length > 0, 'waveform backfilled');
  ok(s.audit.some((a) => a.action === 'AUDIO_METADATA_DERIVED'), 'audit has AUDIO_METADATA_DERIVED');
});

check('ASR-attached incident has timeline provenance', () => {
  const s = fresh();
  const assetId = newAudio(s, 'medical.wav');
  const job = requestAsrJob(s, assetId, { provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  const final = runAsrJobToCompletion(s, job.id, ACTOR)!;
  const result = s.asrTranscriptResults.find((r) => r.id === final.resultId)!;
  const att = attachAsrResultToAudio(s, final.resultId!, ACTOR)!;
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incidentId)!;
  const asrMarkers = segmentsToTimelineMarkers(result.segments);
  const fieldMarkers = fieldProvenanceToTimelineMarkers(inc);
  ok(asrMarkers.length > 0, 'ASR markers exist');
  ok(fieldMarkers.length > 0, 'field markers exist');
  ok(fieldMarkers.every((m) => m.kind === 'INCIDENT_FIELD'), 'field markers kind INCIDENT_FIELD');
});

// =========================================================================
// Phase 2E — P.E.N.N.Y. transcription orchestrator
// =========================================================================

function placeholderAudio(s: MiiState): string {
  return addAudioAsset(s, createPlaceholderAudioAssetInput()).id;
}

check('PENNY creates transcription plan', () => {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  eq(plan.status, 'DRAFT', 'status DRAFT');
  eq(plan.provider, 'MOCK_SCENARIO', 'provider');
  ok(plan.decisions.some((d) => d.type === 'PROVIDER_SELECTED'), 'decision PROVIDER_SELECTED');
  ok(s.audit.some((a) => a.action === 'PENNY_PLAN_CREATED'), 'audit PENNY_PLAN_CREATED');
});

check('PENNY requests ASR job', () => {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  pennyRequestAsrJob(s, plan.id, ACTOR);
  const p = s.pennyPlans.find((x) => x.id === plan.id)!;
  eq(p.status, 'ASR_JOB_REQUESTED', 'status ASR_JOB_REQUESTED');
  ok(!!p.asrJobId, 'asrJobId set');
  ok(s.audit.some((a) => a.action === 'PENNY_ASR_JOB_REQUESTED'), 'audit PENNY_ASR_JOB_REQUESTED');
});

check('PENNY runs ASR to completion', () => {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  pennyRunAsrToCompletion(s, plan.id, ACTOR);
  const p = s.pennyPlans.find((x) => x.id === plan.id)!;
  eq(p.status, 'ASR_COMPLETED', 'status ASR_COMPLETED');
  ok(!!p.asrResultId, 'asrResultId set');
  const result = s.asrTranscriptResults.find((r) => r.id === p.asrResultId)!;
  eq(result.status, 'COMPLETED', 'result COMPLETED');
});

check('PENNY evaluates Medical transcript as ready', () => {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  pennyRunAsrToCompletion(s, plan.id, ACTOR);
  const pkg = evaluateAsrResultForPenny(s, plan.id, ACTOR)!;
  ok(!!pkg, 'package exists');
  ok(pkg.readyForAttachment, 'readyForAttachment true');
  ok(pkg.normalizedTranscriptText.includes('3-41'), 'normalized text includes 3-41');
  ok((pkg.averageConfidence ?? 0) > 0.8, `avg confidence > 0.8 (got ${pkg.averageConfidence})`);
  ok(!pkg.qualityIssues.some((i) => i.severity === 'BLOCKING'), 'no BLOCKING issues');
  const p = s.pennyPlans.find((x) => x.id === plan.id)!;
  eq(p.status, 'READY_FOR_ATTACHMENT', 'plan status READY_FOR_ATTACHMENT');
  ok(s.audit.some((a) => a.action === 'PENNY_TRANSCRIPT_READY'), 'audit PENNY_TRANSCRIPT_READY');
});

check('PENNY attaches ready transcript but does not process incident', () => {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  pennyRunAsrToCompletion(s, plan.id, ACTOR);
  evaluateAsrResultForPenny(s, plan.id, ACTOR);
  const att = pennyAttachTranscriptPackage(s, plan.id, ACTOR)!;
  ok(!!att, 'attachment exists');
  const p = s.pennyPlans.find((x) => x.id === plan.id)!;
  eq(p.status, 'ATTACHED', 'plan status ATTACHED');
  eq(s.incidents.length, 0, 'no incident created by PENNY');
  // Human step processes the attachment.
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incidentId)!;
  eq(inc.natureCode, '3-41', 'natureCode');
  eq(inc.address, '210 174th Street', 'address');
  ok(assignedNames(s, inc).some((n) => n.includes('421')), 'Sunny Isles 421 assigned');
});

check('PENNY Address Conflict path → CONFLICT', () => {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'MOCK_SCENARIO', scenarioId: 'conflict-address', actor: ACTOR });
  pennyRunAsrToCompletion(s, plan.id, ACTOR);
  evaluateAsrResultForPenny(s, plan.id, ACTOR);
  const att = pennyAttachTranscriptPackage(s, plan.id, ACTOR)!;
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incidentId)!;
  eq(inc.status, 'CONFLICT', 'status CONFLICT');
});

check('PENNY Admin Chatter path → no incident + admin flag', () => {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'MOCK_SCENARIO', scenarioId: 'admin-chatter', actor: ACTOR });
  pennyRunAsrToCompletion(s, plan.id, ACTOR);
  const pkg = evaluateAsrResultForPenny(s, plan.id, ACTOR)!;
  ok(pkg.qualityIssues.some((i) => i.kind === 'POSSIBLE_ADMIN_CHATTER'), 'has POSSIBLE_ADMIN_CHATTER info');
  const att = pennyAttachTranscriptPackage(s, plan.id, ACTOR)!;
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  eq(incidentId, undefined, 'no incident id');
  eq(s.incidents.length, 0, 'incident count');
});

check('PENNY Freeform path → Medical 3-41', () => {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const text = [
    'MDSO: Sunny Isles fifty.',
    'MDSO: You have a 3-41 at 210 174th Street Apartment 123, reference a 50 year old male with chest pains.',
    'SIBPD: QSL assign Sunny Isles 421 the signal.',
  ].join('\n');
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'MOCK_FREEFORM', freeformTranscriptText: text, actor: ACTOR });
  pennyRunAsrToCompletion(s, plan.id, ACTOR);
  const pkg = evaluateAsrResultForPenny(s, plan.id, ACTOR)!;
  ok(pkg.readyForAttachment, 'ready');
  const att = pennyAttachTranscriptPackage(s, plan.id, ACTOR)!;
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incidentId);
  ok(!!inc, 'incident created');
  eq(inc!.natureCode, '3-41', 'natureCode');
});

check('PENNY failed provider needs review', () => {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'LOCAL_PLACEHOLDER', actor: ACTOR });
  pennyRunAsrToCompletion(s, plan.id, ACTOR);
  const pkg = evaluateAsrResultForPenny(s, plan.id, ACTOR)!;
  ok(!pkg.readyForAttachment, 'not ready');
  ok(pkg.qualityIssues.some((i) => i.severity === 'BLOCKING'), 'has BLOCKING issue');
  const p = s.pennyPlans.find((x) => x.id === plan.id)!;
  ok(p.status === 'NEEDS_REVIEW' || p.status === 'FAILED', `status NEEDS_REVIEW/FAILED (got ${p.status})`);
  ok(s.audit.some((a) => a.action === 'PENNY_TRANSCRIPT_NEEDS_REVIEW'), 'audit PENNY_TRANSCRIPT_NEEDS_REVIEW');
  // Attach must be refused for a not-ready package.
  eq(pennyAttachTranscriptPackage(s, plan.id, ACTOR), undefined, 'attach refused when not ready');
});

check('PENNY low-confidence blocking threshold', () => {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  // Inject a result with a segment below the blocking confidence threshold.
  const result: AsrTranscriptResult = {
    id: 'asr_lowconf_test',
    audioAssetId: assetId,
    provider: 'MOCK_SCENARIO',
    status: 'COMPLETED',
    transcriptText: 'MDSO: You have a 3-41 at 210 174th Street.',
    segments: [
      { id: 'seg_a', speaker: 'MDSO', text: 'You have a 3-41 at 210 174th Street.', startMs: 0, endMs: 1800, confidence: 0.4 },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:00:00.000Z',
    scenarioId: 'medical-3-41',
  };
  s.asrTranscriptResults.push(result);
  plan.asrResultId = result.id;
  plan.status = 'ASR_COMPLETED';
  const pkg = evaluateAsrResultForPenny(s, plan.id, ACTOR)!;
  ok(
    pkg.qualityIssues.some((i) => i.kind === 'LOW_CONFIDENCE_SEGMENT' && i.severity === 'BLOCKING'),
    'BLOCKING LOW_CONFIDENCE_SEGMENT present'
  );
  ok(!pkg.readyForAttachment, 'not ready');
});

// =========================================================================
// Phase 2F — PENNY human review + transcript quality gate
// =========================================================================

const WARN_SEG: AsrSegment = { id: 'seg_warn', speaker: 'MDSO', text: 'You have a 3-41 at 210 174th Street.', startMs: 0, endMs: 1800, confidence: 0.7 };
const BLOCK_SEG: AsrSegment = { id: 'seg_block', speaker: 'MDSO', text: 'You have a 3-41 at 210 174th Street.', startMs: 0, endMs: 1800, confidence: 0.4 };

check('PENNY quality gate passes clean Medical package', () => {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  pennyRunAsrToCompletion(s, plan.id, ACTOR);
  const pkg = evaluateAsrResultForPenny(s, plan.id, ACTOR)!;
  const gate = evaluatePennyQualityGate(s, plan.id, pkg.id);
  eq(gate.status, 'PASS', 'gate PASS');
  eq(gate.unresolvedBlockingCount, 0, 'no unresolved blocking');
  eq(gate.unresolvedWarningCount, 0, 'no unresolved warnings');
  ok(gate.readyForAttachment, 'readyForAttachment true');
});

check('PENNY warning issue requires acknowledgement', () => {
  const s = fresh();
  const { planId, packageId } = buildPennyPackageFromSegments(s, [WARN_SEG]);
  let gate = evaluatePennyQualityGate(s, planId, packageId);
  eq(gate.status, 'WARNING', 'gate WARNING');
  eq(gate.unresolvedWarningCount, 1, 'unresolvedWarningCount 1');
  // Acknowledge by the actual issue id (LOW_CONFIDENCE_SEGMENT).
  const pkg = s.pennyTranscriptPackages.find((p) => p.id === packageId)!;
  const warnIssue = pkg.qualityIssues.find((i) => i.severity === 'WARNING')!;
  recordPennyReviewAction(s, { planId, packageId, issueId: warnIssue.id, actionType: 'ACKNOWLEDGE_WARNING', actor: ACTOR });
  evaluatePennyReviewReadiness(s, planId, packageId, ACTOR);
  gate = evaluatePennyQualityGate(s, planId, packageId);
  eq(gate.unresolvedWarningCount, 0, 'unresolvedWarningCount 0 after ack');
  const rs = s.pennyReviewStates.find((r) => r.planId === planId && r.packageId === packageId)!;
  ok(rs.reviewReady, 'reviewReady true');
  ok(rs.readyForAttachment, 'readyForAttachment true');
});

check('PENNY blocking issue blocks attachment', () => {
  const s = fresh();
  const { planId, packageId } = buildPennyPackageFromSegments(s, [BLOCK_SEG]);
  const gate = evaluatePennyQualityGate(s, planId, packageId);
  eq(gate.status, 'BLOCKED', 'gate BLOCKED');
  eq(pennyAttachTranscriptPackage(s, planId, ACTOR), undefined, 'attach refused');
});

check('PENNY blocking override requires note', () => {
  const s = fresh();
  const { planId, packageId } = buildPennyPackageFromSegments(s, [BLOCK_SEG]);
  const pkg = s.pennyTranscriptPackages.find((p) => p.id === packageId)!;
  const blockIssue = pkg.qualityIssues.find((i) => i.severity === 'BLOCKING')!;
  let threw = false;
  try {
    recordPennyReviewAction(s, { planId, packageId, issueId: blockIssue.id, actionType: 'OVERRIDE_BLOCKING', actor: ACTOR });
  } catch {
    threw = true;
  }
  ok(threw, 'override without note throws');
  recordPennyReviewAction(s, { planId, packageId, issueId: blockIssue.id, actionType: 'OVERRIDE_BLOCKING', note: 'Confirmed by dispatcher on readback.', actor: ACTOR });
  evaluatePennyReviewReadiness(s, planId, packageId, ACTOR);
  const gate = evaluatePennyQualityGate(s, planId, packageId);
  eq(gate.unresolvedBlockingCount, 0, 'unresolvedBlockingCount 0 after override');
  const rs = s.pennyReviewStates.find((r) => r.planId === planId && r.packageId === packageId)!;
  ok(rs.reviewReady, 'reviewReady true');
  ok(rs.readyForAttachment, 'readyForAttachment true (transcript non-empty)');
  ok(s.audit.some((a) => a.action === 'PENNY_REVIEW_OVERRIDE_RECORDED'), 'audit PENNY_REVIEW_OVERRIDE_RECORDED');
});

check('PENNY review note is audited', () => {
  const s = fresh();
  const { planId, packageId } = buildPennyPackageFromSegments(s, [WARN_SEG]);
  recordPennyReviewAction(s, { planId, packageId, actionType: 'ADD_REVIEW_NOTE', note: 'Cross-checked address with caller.', actor: ACTOR });
  const rs = s.pennyReviewStates.find((r) => r.planId === planId && r.packageId === packageId)!;
  eq(rs.reviewNotes.length, 1, 'one review note');
  ok(s.audit.some((a) => a.action === 'PENNY_REVIEW_NOTE_ADDED'), 'audit PENNY_REVIEW_NOTE_ADDED');
});

check('PENNY failed provider stays blocked (empty transcript) even if overridden', () => {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'LOCAL_PLACEHOLDER', actor: ACTOR });
  pennyRunAsrToCompletion(s, plan.id, ACTOR);
  const pkg = evaluateAsrResultForPenny(s, plan.id, ACTOR)!;
  const blockIssue = pkg.qualityIssues.find((i) => i.severity === 'BLOCKING')!;
  recordPennyReviewAction(s, { planId: plan.id, packageId: pkg.id, issueId: blockIssue.id, actionType: 'OVERRIDE_BLOCKING', note: 'Override attempt.', actor: ACTOR });
  const rs = evaluatePennyReviewReadiness(s, plan.id, pkg.id, ACTOR)!;
  ok(!rs.readyForAttachment, 'not ready — transcript is empty');
  eq(pennyAttachTranscriptPackage(s, plan.id, ACTOR), undefined, 'attach refused for empty transcript');
});

check('PENNY reviewed warning package attaches but does not process incident', () => {
  const s = fresh();
  const { planId, packageId } = buildPennyPackageFromSegments(s, [WARN_SEG]);
  const pkg = s.pennyTranscriptPackages.find((p) => p.id === packageId)!;
  const warnIssue = pkg.qualityIssues.find((i) => i.severity === 'WARNING')!;
  recordPennyReviewAction(s, { planId, packageId, issueId: warnIssue.id, actionType: 'ACKNOWLEDGE_WARNING', actor: ACTOR });
  recordPennyReviewAction(s, { planId, packageId, actionType: 'MARK_READY_FOR_ATTACHMENT', actor: ACTOR });
  const att = pennyAttachTranscriptPackage(s, planId, ACTOR)!;
  ok(!!att, 'attachment exists');
  eq(s.incidents.length, 0, 'no incident until processed');
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  const inc = s.incidents.find((i) => i.id === incidentId)!;
  eq(inc.natureCode, '3-41', 'natureCode after manual processing');
});

// =========================================================================
// Phase 2G — transcript review safety gate
// =========================================================================

check('Transcript review gate NOT_APPLICABLE for non-PENNY incident', () => {
  const { s, incident } = runInstant('medical-3-41');
  const gate = evaluateTranscriptReviewGateForIncident(s, incident!.id);
  eq(gate.status, 'NOT_APPLICABLE', 'status NOT_APPLICABLE');
});

check('Transcript review gate PASS for clean PENNY Medical', () => {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  pennyRunAsrToCompletion(s, plan.id, ACTOR);
  evaluateAsrResultForPenny(s, plan.id, ACTOR);
  const att = pennyAttachTranscriptPackage(s, plan.id, ACTOR)!;
  processAudioTranscriptAttachment(s, att.id, ACTOR);
  const p = s.pennyPlans.find((x) => x.id === plan.id)!;
  const incidentId = s.audioTranscriptAttachments.find((a) => a.id === att.id)!.activeIncidentId!;
  const gate = evaluateTranscriptReviewGateForIncident(s, incidentId);
  eq(gate.status, 'PASS', 'status PASS');
  eq(gate.linkedPlanId, p.id, 'linkedPlanId');
  eq(gate.linkedPackageId, p.transcriptPackageId, 'linkedPackageId');
  ok(Boolean(gate.readyForAttachment), 'readyForAttachment true');
});

check('Transcript review gate WARNING for unresolved warning package', () => {
  const s = fresh();
  const { planId } = buildPennyPackageFromSegments(s, [WARN_SEG]);
  // No review state → Phase 2E fallback allows attach of a warning package.
  const att = pennyAttachTranscriptPackage(s, planId, ACTOR)!;
  ok(!!att, 'attached via fallback');
  processAudioTranscriptAttachment(s, att.id, ACTOR);
  const incidentId = s.audioTranscriptAttachments.find((a) => a.id === att.id)!.activeIncidentId!;
  const gate = evaluateTranscriptReviewGateForIncident(s, incidentId);
  eq(gate.status, 'WARNING', 'status WARNING');
  ok(gate.unresolvedWarningCount > 0, 'unresolvedWarningCount > 0');
  const incident = s.incidents.find((i) => i.id === incidentId)!;
  const readiness = evaluateIncidentSafetyReadiness(incident, gate);
  ok(readiness.warnings.length > 0, 'readiness surfaces warning');
  ok(!readiness.blockingReasons.includes('Transcript review is blocked'), 'warning does not block');
});

check('Transcript review gate BLOCKED for unresolved blocking package', () => {
  const s = fresh();
  const { planId } = buildPennyPackageFromSegments(s, [BLOCK_SEG]);
  const plan = s.pennyPlans.find((x) => x.id === planId)!;
  const pkg = s.pennyTranscriptPackages.find((p) => p.id === plan.transcriptPackageId)!;
  // Construct a linked-but-blocked incident directly (normal attach would refuse).
  const att = attachTranscriptToAudio(s, plan.audioAssetId, pkg.normalizedTranscriptText, 'medical-3-41');
  plan.attachmentId = att.id;
  processAudioTranscriptAttachment(s, att.id, ACTOR);
  const incidentId = s.audioTranscriptAttachments.find((a) => a.id === att.id)!.activeIncidentId!;
  const gate = evaluateTranscriptReviewGateForIncident(s, incidentId);
  eq(gate.status, 'BLOCKED', 'status BLOCKED');
  ok(gate.unresolvedBlockingCount > 0, 'unresolvedBlockingCount > 0');
  const incident = s.incidents.find((i) => i.id === incidentId)!;
  const readiness = evaluateIncidentSafetyReadiness(incident, gate);
  ok(!readiness.canSubmit, 'canSubmit false');
  ok(readiness.blockingReasons.includes('Transcript review is blocked'), 'includes transcript block reason');
});

check('Transcript review gate PASS after warning acknowledged (+ sign-off)', () => {
  const s = fresh();
  const { planId, packageId } = buildPennyPackageFromSegments(s, [WARN_SEG]);
  const pkg = s.pennyTranscriptPackages.find((p) => p.id === packageId)!;
  const warnIssue = pkg.qualityIssues.find((i) => i.severity === 'WARNING')!;
  recordPennyReviewAction(s, { planId, packageId, issueId: warnIssue.id, actionType: 'ACKNOWLEDGE_WARNING', actor: ACTOR });
  evaluatePennyReviewReadiness(s, planId, packageId, ACTOR);
  const att = pennyAttachTranscriptPackage(s, planId, ACTOR)!;
  ok(!!att, 'attached after review');
  processAudioTranscriptAttachment(s, att.id, ACTOR);
  const incidentId = s.audioTranscriptAttachments.find((a) => a.id === att.id)!.activeIncidentId!;
  const gate = evaluateTranscriptReviewGateForIncident(s, incidentId);
  eq(gate.status, 'PASS', 'status PASS');
  ok(!!gate.latestReviewer, 'latestReviewer present');
  ok(!!gate.latestReviewAt, 'latestReviewAt present');
});

check('Transcript review sign-off is recorded on readiness', () => {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  pennyRunAsrToCompletion(s, plan.id, ACTOR);
  const pkg = evaluateAsrResultForPenny(s, plan.id, ACTOR)!;
  const rs = evaluatePennyReviewReadiness(s, plan.id, pkg.id, ACTOR)!;
  ok(rs.readyForAttachment, 'readyForAttachment true');
  ok(!!rs.signedOffBy, 'signedOffBy set');
  ok(!!rs.signedOffAt, 'signedOffAt set');
});

// =========================================================================
// Phase 2H — incident audit linkage + reviewer sign-off
// =========================================================================

// Run a full clean PENNY flow through sign-off, attach, and process.
function runPennySignedFlow(scenarioId: string): { s: MiiState; incidentId?: string } {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'MOCK_SCENARIO', scenarioId, actor: ACTOR });
  pennyRunAsrToCompletion(s, plan.id, ACTOR);
  const pkg = evaluateAsrResultForPenny(s, plan.id, ACTOR)!;
  signOffPennyReview(s, { planId: plan.id, packageId: pkg.id, actor: ACTOR });
  const att = pennyAttachTranscriptPackage(s, plan.id, ACTOR)!;
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  return { s, incidentId };
}

check('PENNY review sign-off requires readiness', () => {
  const s = fresh();
  const { planId, packageId } = buildPennyPackageFromSegments(s, [WARN_SEG]);
  let threw = false;
  try {
    signOffPennyReview(s, { planId, packageId, actor: ACTOR });
  } catch {
    threw = true;
  }
  ok(threw, 'sign-off before resolving warning throws');
  const pkg = s.pennyTranscriptPackages.find((p) => p.id === packageId)!;
  const warnIssue = pkg.qualityIssues.find((i) => i.severity === 'WARNING')!;
  recordPennyReviewAction(s, { planId, packageId, issueId: warnIssue.id, actionType: 'ACKNOWLEDGE_WARNING', actor: ACTOR });
  const rs = signOffPennyReview(s, { planId, packageId, actor: ACTOR })!;
  ok(!!rs.signedOffBy, 'signedOffBy set');
  ok(!!rs.signedOffAt, 'signedOffAt set');
  ok(s.audit.some((a) => a.action === 'PENNY_REVIEW_SIGNED_OFF'), 'audit PENNY_REVIEW_SIGNED_OFF');
});

check('PENNY sign-off does not attach or process', () => {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  pennyRunAsrToCompletion(s, plan.id, ACTOR);
  const pkg = evaluateAsrResultForPenny(s, plan.id, ACTOR)!;
  signOffPennyReview(s, { planId: plan.id, packageId: pkg.id, actor: ACTOR });
  eq(s.audioTranscriptAttachments.length, 0, 'no attachment created by sign-off');
  eq(s.incidents.length, 0, 'no incident created by sign-off');
});

check('Incident captures transcript review snapshot on PENNY processing', () => {
  const { s, incidentId } = runPennySignedFlow('medical-3-41');
  const inc = s.incidents.find((i) => i.id === incidentId)!;
  ok(!!inc.transcriptReviewSnapshot, 'snapshot exists');
  eq(inc.transcriptReviewSnapshot!.status, 'PASS', 'snapshot status PASS');
  ok(!!inc.transcriptReviewSnapshot!.signedOffBy, 'snapshot signedOffBy present');
  ok(s.audit.some((a) => a.action === 'INCIDENT_TRANSCRIPT_REVIEW_LINKED'), 'audit LINKED');
  ok(s.audit.some((a) => a.action === 'INCIDENT_TRANSCRIPT_REVIEW_SNAPSHOT'), 'audit SNAPSHOT');
});

check('Incident records transcript signoff audit', () => {
  const { s, incidentId } = runPennySignedFlow('medical-3-41');
  const signOffAudit = s.audit.filter(
    (a) => a.action === 'INCIDENT_TRANSCRIPT_SIGNOFF_RECORDED' && a.incidentId === incidentId
  );
  ok(signOffAudit.length > 0, 'audit INCIDENT_TRANSCRIPT_SIGNOFF_RECORDED');
});

check('Incident snapshot does not apply to direct scenario', () => {
  const { incident } = runInstant('medical-3-41');
  eq(incident!.transcriptReviewSnapshot, undefined, 'no snapshot for direct scenario');
});

check('Transcript review snapshot survives conflict path', () => {
  const { s, incidentId } = runPennySignedFlow('conflict-address');
  const inc = s.incidents.find((i) => i.id === incidentId)!;
  eq(inc.status, 'CONFLICT', 'incident status CONFLICT');
  ok(!!inc.transcriptReviewSnapshot, 'snapshot exists');
  eq(inc.transcriptReviewSnapshot!.status, 'PASS', 'snapshot status PASS');
  // Conflict still blocks mock CAD submission.
  const gate = evaluateTranscriptReviewGateForIncident(s, incidentId!);
  const readiness = evaluateIncidentSafetyReadiness(inc, gate);
  ok(!readiness.canSubmit, 'conflict still blocks submit');
});

// =========================================================================
// Phase 2I — configurable sign-off policy + local audit export
// =========================================================================

// Run a clean PENNY flow WITHOUT sign-off, attach (2E fallback), and process.
function runPennyUnsignedFlow(scenarioId: string): { s: MiiState; incidentId?: string } {
  const s = fresh();
  const assetId = placeholderAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'MOCK_SCENARIO', scenarioId, actor: ACTOR });
  pennyRunAsrToCompletion(s, plan.id, ACTOR);
  evaluateAsrResultForPenny(s, plan.id, ACTOR);
  const att = pennyAttachTranscriptPackage(s, plan.id, ACTOR)!;
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  return { s, incidentId };
}

check('Default demo policy requires PENNY sign-off', () => {
  const s = fresh();
  eq(s.demoPolicy.signOffPolicyMode, 'REQUIRED_FOR_PENNY', 'default policy mode');
});

check('Sign-off policy gate NOT_APPLICABLE for direct scenario', () => {
  const { s, incident } = runInstant('medical-3-41');
  const gate = evaluateSignOffPolicyGateForIncident(s, incident!.id);
  eq(gate.status, 'NOT_APPLICABLE', 'status NOT_APPLICABLE');
});

check('Sign-off policy gate BLOCKED for unsigned PENNY incident', () => {
  const { s, incidentId } = runPennyUnsignedFlow('medical-3-41');
  const gate = evaluateSignOffPolicyGateForIncident(s, incidentId!);
  eq(gate.status, 'BLOCKED', 'status BLOCKED');
  const inc = s.incidents.find((i) => i.id === incidentId)!;
  const trg = evaluateTranscriptReviewGateForIncident(s, incidentId!);
  const readiness = evaluateIncidentSafetyReadiness(inc, trg, gate);
  ok(!readiness.canSubmit, 'canSubmit false');
  ok(readiness.blockingReasons.includes('Transcript sign-off is required by policy'), 'policy block reason present');
});

check('Sign-off policy gate PASS for signed PENNY incident', () => {
  const { s, incidentId } = runPennySignedFlow('medical-3-41');
  const gate = evaluateSignOffPolicyGateForIncident(s, incidentId!);
  eq(gate.status, 'PASS', 'status PASS');
  ok(!!gate.signedOffBy, 'signedOffBy present');
  const inc = s.incidents.find((i) => i.id === incidentId)!;
  const trg = evaluateTranscriptReviewGateForIncident(s, incidentId!);
  const readiness = evaluateIncidentSafetyReadiness(inc, trg, gate);
  ok(!readiness.blockingReasons.includes('Transcript sign-off is required by policy'), 'policy does not block');
});

check('ADVISORY policy warns but does not block', () => {
  const { s, incidentId } = runPennyUnsignedFlow('medical-3-41');
  updateDemoPolicy(s, 'ADVISORY', ACTOR);
  const gate = evaluateSignOffPolicyGateForIncident(s, incidentId!);
  eq(gate.status, 'ADVISORY', 'status ADVISORY');
  const inc = s.incidents.find((i) => i.id === incidentId)!;
  const trg = evaluateTranscriptReviewGateForIncident(s, incidentId!);
  const readiness = evaluateIncidentSafetyReadiness(inc, trg, gate);
  ok(readiness.warnings.includes('Transcript sign-off is advisory and not yet complete'), 'advisory warning present');
  ok(!readiness.blockingReasons.includes('Transcript sign-off is required by policy'), 'advisory does not block');
});

check('REQUIRED_FOR_ALL_AUDIO blocks unsigned manual audio incident', () => {
  const s = fresh();
  updateDemoPolicy(s, 'REQUIRED_FOR_ALL_AUDIO', ACTOR);
  const asset = addAudioAsset(s, createPlaceholderAudioAssetInput());
  const att = attachTranscriptToAudio(s, asset.id, '', 'medical-3-41');
  const { incidentId } = processAudioTranscriptAttachment(s, att.id, ACTOR);
  const gate = evaluateSignOffPolicyGateForIncident(s, incidentId!);
  eq(gate.status, 'BLOCKED', 'manual audio incident BLOCKED');
  // A direct non-audio scenario stays NOT_APPLICABLE under the same policy.
  const { incidentId: directId } = runScenario(s, 'traffic-19', ACTOR);
  const directGate = evaluateSignOffPolicyGateForIncident(s, directId!);
  eq(directGate.status, 'NOT_APPLICABLE', 'direct scenario NOT_APPLICABLE');
});

check('Policy update is audited', () => {
  const s = fresh();
  updateDemoPolicy(s, 'ADVISORY', ACTOR);
  ok(s.audit.some((a) => a.action === 'DEMO_POLICY_UPDATED'), 'audit DEMO_POLICY_UPDATED');
});

check('Incident audit export contains transcript/signoff provenance', () => {
  const { s, incidentId } = runPennySignedFlow('medical-3-41');
  const exp = buildIncidentAuditExport(s, incidentId!);
  eq(exp.exportVersion, 'MII_LITE_AUDIT_EXPORT_V1', 'exportVersion');
  eq(exp.incident.id, incidentId, 'incident id');
  eq(exp.transcriptReviewGate.status, 'PASS', 'transcriptReviewGate PASS');
  eq(exp.signOffPolicyGate.status, 'PASS', 'signOffPolicyGate PASS');
  ok(exp.pennyPlans.length > 0, 'pennyPlans present');
  ok(exp.pennyReviews.length > 0, 'pennyReviews present');
  ok(exp.audioAttachments.length > 0, 'audioAttachments present');
  ok(exp.auditEvents.some((a) => a.action === 'PENNY_REVIEW_SIGNED_OFF'), 'audit has PENNY_REVIEW_SIGNED_OFF');
  ok(exp.auditEvents.some((a) => a.action === 'INCIDENT_TRANSCRIPT_REVIEW_SNAPSHOT'), 'audit has INCIDENT_TRANSCRIPT_REVIEW_SNAPSHOT');
  ok(!!exp.safetyReadiness, 'safetyReadiness present');
});

check('Incident audit export for direct scenario is N/A-safe', () => {
  const { s, incident } = runInstant('medical-3-41');
  const exp = buildIncidentAuditExport(s, incident!.id);
  eq(exp.transcriptReviewGate.status, 'NOT_APPLICABLE', 'transcriptReviewGate NOT_APPLICABLE');
  eq(exp.signOffPolicyGate.status, 'NOT_APPLICABLE', 'signOffPolicyGate NOT_APPLICABLE');
  ok(exp.auditEvents.length > 0, 'auditEvents present');
});

// =========================================================================
// Phase 3A — Barix-style recording intake + Play-to-Process sessions
// =========================================================================

function barixAudio(s: MiiState): string {
  return addAudioAsset(s, {
    filename: 'barix-clip.wav',
    sourceType: 'BARIX_RECORDING',
    mimeType: 'audio/wav',
    sizeBytes: 4096,
    sourceLabel: 'Barix-style Authorized Recording',
    sourceDevice: 'Demo Barix Source',
    originalRecording: true,
    recordingProvenanceNote: 'Authorized original recording file provided for local demo processing.',
  }).id;
}

// Build a Barix asset + PENNY plan run to an evaluated package, linked to a session.
function barixSessionToReview(): {
  s: MiiState;
  sessionId: string;
  planId: string;
  packageId: string;
} {
  const s = fresh();
  const assetId = barixAudio(s);
  const session = createRecordingProcessingSession(s, { audioAssetId: assetId, actor: ACTOR });
  startRecordingProcessingSession(s, { sessionId: session.id, actor: ACTOR });
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'MOCK_SCENARIO', scenarioId: 'medical-3-41', actor: ACTOR });
  linkRecordingSessionToPennyPlan(s, { sessionId: session.id, pennyPlanId: plan.id, actor: ACTOR });
  pennyRunAsrToCompletion(s, plan.id, ACTOR);
  const pkg = evaluateAsrResultForPenny(s, plan.id, ACTOR)!;
  refreshRecordingProcessingSessionLinks(s, session.id);
  return { s, sessionId: session.id, planId: plan.id, packageId: pkg.id };
}

check('Barix-style audio asset preserves recording provenance', () => {
  const s = fresh();
  const id = barixAudio(s);
  const asset = s.audioAssets.find((a) => a.id === id)!;
  eq(asset.sourceType, 'BARIX_RECORDING', 'sourceType');
  eq(asset.originalRecording, true, 'originalRecording');
  eq(asset.sourceLabel, 'Barix-style Authorized Recording', 'sourceLabel');
  eq(asset.sourceDevice, 'Demo Barix Source', 'sourceDevice');
  ok(!!asset.recordingProvenanceNote, 'recordingProvenanceNote present');
});

check('Recording processing session creates human checkpoints', () => {
  const s = fresh();
  const assetId = barixAudio(s);
  const session = createRecordingProcessingSession(s, { audioAssetId: assetId, actor: ACTOR });
  eq(session.status, 'READY', 'status READY');
  const kinds = session.checkpoints.map((c) => c.kind);
  for (const k of ['START_PROCESSING', 'REVIEW_TRANSCRIPT', 'SIGN_OFF_REVIEW', 'ATTACH_TRANSCRIPT', 'PROCESS_INCIDENT', 'REVIEW_SAFETY_GATES', 'SUBMIT_MOCK_CAD', 'EXPORT_AUDIT']) {
    ok(kinds.includes(k as never), `checkpoint ${k} present`);
  }
  ok(s.audit.some((a) => a.action === 'RECORDING_PROCESSING_SESSION_CREATED'), 'audit session created');
});

check('Starting processing marks START_PROCESSING checkpoint', () => {
  const s = fresh();
  const assetId = barixAudio(s);
  const session = createRecordingProcessingSession(s, { audioAssetId: assetId, actor: ACTOR });
  startRecordingProcessingSession(s, { sessionId: session.id, actor: ACTOR });
  const sess = s.recordingProcessingSessions.find((x) => x.id === session.id)!;
  eq(sess.status, 'PROCESSING_STARTED', 'status PROCESSING_STARTED');
  ok(!!sess.startedAt, 'startedAt set');
  ok(sess.checkpoints.find((c) => c.kind === 'START_PROCESSING')!.completed, 'START_PROCESSING completed');
  ok(s.audit.some((a) => a.action === 'RECORDING_PROCESSING_STARTED'), 'audit started');
});

check('Session links to PENNY plan and awaits review', () => {
  const { s, sessionId, planId } = barixSessionToReview();
  const sess = s.recordingProcessingSessions.find((x) => x.id === sessionId)!;
  eq(sess.pennyPlanId, planId, 'pennyPlanId linked');
  ok(!!sess.transcriptPackageId, 'transcriptPackageId linked');
  eq(sess.status, 'AWAITING_HUMAN_REVIEW', 'status AWAITING_HUMAN_REVIEW');
});

check('Session refresh tracks sign-off', () => {
  const { s, sessionId, planId, packageId } = barixSessionToReview();
  signOffPennyReview(s, { planId, packageId, actor: ACTOR });
  refreshRecordingProcessingSessionLinks(s, sessionId);
  const sess = s.recordingProcessingSessions.find((x) => x.id === sessionId)!;
  eq(sess.status, 'REVIEW_SIGNED_OFF', 'status REVIEW_SIGNED_OFF');
  ok(sess.checkpoints.find((c) => c.kind === 'SIGN_OFF_REVIEW')!.completed, 'SIGN_OFF_REVIEW completed');
});

check('Session refresh tracks attachment', () => {
  const { s, sessionId, planId, packageId } = barixSessionToReview();
  signOffPennyReview(s, { planId, packageId, actor: ACTOR });
  pennyAttachTranscriptPackage(s, planId, ACTOR);
  refreshRecordingProcessingSessionLinks(s, sessionId);
  const sess = s.recordingProcessingSessions.find((x) => x.id === sessionId)!;
  eq(sess.status, 'TRANSCRIPT_ATTACHED', 'status TRANSCRIPT_ATTACHED');
  ok(sess.checkpoints.find((c) => c.kind === 'ATTACH_TRANSCRIPT')!.completed, 'ATTACH_TRANSCRIPT completed');
});

check('Session refresh tracks incident processing', () => {
  const { s, sessionId, planId, packageId } = barixSessionToReview();
  signOffPennyReview(s, { planId, packageId, actor: ACTOR });
  const att = pennyAttachTranscriptPackage(s, planId, ACTOR)!;
  processAudioTranscriptAttachment(s, att.id, ACTOR);
  refreshRecordingProcessingSessionLinks(s, sessionId);
  const sess = s.recordingProcessingSessions.find((x) => x.id === sessionId)!;
  ok(!!sess.incidentId, 'incidentId set');
  eq(sess.status, 'INCIDENT_PROCESSED', 'status INCIDENT_PROCESSED');
  ok(sess.checkpoints.find((c) => c.kind === 'PROCESS_INCIDENT')!.completed, 'PROCESS_INCIDENT completed');
});

check('Session completion and cancellation are audited', () => {
  const s = fresh();
  const a1 = barixAudio(s);
  const s1 = createRecordingProcessingSession(s, { audioAssetId: a1, actor: ACTOR });
  completeRecordingProcessingSession(s, s1.id, ACTOR);
  const a2 = barixAudio(s);
  const s2 = createRecordingProcessingSession(s, { audioAssetId: a2, actor: ACTOR });
  cancelRecordingProcessingSession(s, s2.id, ACTOR);
  eq(s.recordingProcessingSessions.find((x) => x.id === s1.id)!.status, 'COMPLETED', 's1 COMPLETED');
  eq(s.recordingProcessingSessions.find((x) => x.id === s2.id)!.status, 'CANCELLED', 's2 CANCELLED');
  ok(s.audit.some((a) => a.action === 'RECORDING_PROCESSING_SESSION_COMPLETED'), 'audit completed');
  ok(s.audit.some((a) => a.action === 'RECORDING_PROCESSING_SESSION_CANCELLED'), 'audit cancelled');
});

// =========================================================================
// Phase 3B — experimental local/offline ASR provider + handoff
// =========================================================================

check('Local offline ASR provider is registered as experimental and local', () => {
  const def = ASR_PROVIDER_REGISTRY.find((p) => p.provider === 'LOCAL_OFFLINE_WHISPER');
  ok(!!def, 'provider registered');
  eq(def!.label, 'Local Offline Whisper (Experimental)', 'label');
  eq(def!.experimental, true, 'experimental');
  eq(def!.externalNetwork, false, 'externalNetwork false');
  eq(def!.requiresLocalModel, true, 'requiresLocalModel true');
  // Not default: MOCK_SCENARIO is first in the registry.
  eq(ASR_PROVIDER_REGISTRY[0].provider, 'MOCK_SCENARIO', 'default provider is a mock');
  // getAsrProviderDefinition resolves it.
  eq(getAsrProviderDefinition('LOCAL_OFFLINE_WHISPER').provider, 'LOCAL_OFFLINE_WHISPER', 'lookup');
});

check('Local offline ASR model config disables remote models', () => {
  eq(LOCAL_OFFLINE_ASR_MODEL_CONFIG.provider, 'LOCAL_OFFLINE_WHISPER', 'provider');
  eq(LOCAL_OFFLINE_ASR_MODEL_CONFIG.localModelPath, '/models/', 'localModelPath');
  eq(LOCAL_OFFLINE_ASR_MODEL_CONFIG.remoteModelsAllowed, false, 'remoteModelsAllowed false');
  eq(LOCAL_OFFLINE_ASR_MODEL_CONFIG.experimental, true, 'experimental');
});

function barixPlan(s: MiiState): { assetId: string; planId: string } {
  const assetId = barixAudio(s);
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'LOCAL_OFFLINE_WHISPER', actor: ACTOR });
  return { assetId, planId: plan.id };
}

check('Local ASR completed handoff creates ASR result and PENNY package', () => {
  const s = fresh();
  const { assetId, planId } = barixPlan(s);
  const out = completeLocalOfflineAsrForPlan(s, {
    planId,
    audioAssetId: assetId,
    transcriptText: 'Unit 5 responding to a 3-41 at 210 174th Street.',
    segments: [{ id: 'x', text: 'Unit 5 responding to a 3-41 at 210 174th Street.' }],
    durationMs: 1200,
    filename: 'barix-clip.wav',
    actor: ACTOR,
  })!;
  ok(!!out, 'handoff returned');
  const result = s.asrTranscriptResults.find((r) => r.id === out.resultId)!;
  ok(!!result, 'AsrTranscriptResult exists');
  eq(result.provider, 'LOCAL_OFFLINE_WHISPER', 'provider LOCAL_OFFLINE_WHISPER');
  const plan = s.pennyPlans.find((p) => p.id === planId)!;
  eq(plan.asrResultId, out.resultId, 'plan links result');
  ok(!!plan.transcriptPackageId, 'plan links package');
  ok(!!out.packageId, 'package created');
  eq(s.audioTranscriptAttachments.length, 0, 'no attachment auto-created');
  eq(s.incidents.length, 0, 'no incident auto-processed');
});

check('Local ASR empty transcript is blocked / needs review', () => {
  const s = fresh();
  const { assetId, planId } = barixPlan(s);
  const out = completeLocalOfflineAsrForPlan(s, {
    planId,
    audioAssetId: assetId,
    transcriptText: '',
    durationMs: 500,
    actor: ACTOR,
  })!;
  const pkg = s.pennyTranscriptPackages.find((p) => p.id === out.packageId)!;
  ok(!!pkg, 'package exists');
  ok(!pkg.readyForAttachment, 'empty transcript not ready for attachment');
});

check('Play-to-Process local ASR stops at human review', () => {
  const s = fresh();
  const assetId = barixAudio(s);
  const session = createRecordingProcessingSession(s, { audioAssetId: assetId, actor: ACTOR });
  startRecordingProcessingSession(s, { sessionId: session.id, actor: ACTOR });
  const plan = createPennyPlan(s, { audioAssetId: assetId, provider: 'LOCAL_OFFLINE_WHISPER', actor: ACTOR });
  linkRecordingSessionToPennyPlan(s, { sessionId: session.id, pennyPlanId: plan.id, actor: ACTOR });
  completeLocalOfflineAsrForPlan(s, {
    planId: plan.id,
    audioAssetId: assetId,
    transcriptText: 'You have a 3-41 at 210 174th Street.',
    segments: [{ id: 'x', text: 'You have a 3-41 at 210 174th Street.' }],
    durationMs: 900,
    actor: ACTOR,
  });
  refreshRecordingProcessingSessionLinks(s, session.id);
  const sess = s.recordingProcessingSessions.find((x) => x.id === session.id)!;
  eq(sess.status, 'AWAITING_HUMAN_REVIEW', 'status AWAITING_HUMAN_REVIEW');
  ok(!sess.checkpoints.find((c) => c.kind === 'SIGN_OFF_REVIEW')!.completed, 'SIGN_OFF not completed');
  ok(!sess.checkpoints.find((c) => c.kind === 'ATTACH_TRANSCRIPT')!.completed, 'ATTACH not completed');
  ok(!sess.checkpoints.find((c) => c.kind === 'PROCESS_INCIDENT')!.completed, 'PROCESS not completed');
});

check('Local ASR audit events are recorded', () => {
  const s = fresh();
  const { assetId, planId } = barixPlan(s);
  recordLocalOfflineAsrStarted(s, { audioAssetId: assetId, filename: 'barix-clip.wav', actor: ACTOR });
  completeLocalOfflineAsrForPlan(s, {
    planId,
    audioAssetId: assetId,
    transcriptText: 'Test transcript with a 3-41.',
    segments: [{ id: 'x', text: 'Test transcript with a 3-41.' }],
    durationMs: 700,
    actor: ACTOR,
  });
  const s2 = fresh();
  const a2 = barixAudio(s2);
  recordLocalOfflineAsrFailed(s2, { audioAssetId: a2, errorMessage: 'model missing', durationMs: 10, actor: ACTOR });
  ok(s.audit.some((a) => a.action === 'LOCAL_OFFLINE_ASR_TRANSCRIPTION_STARTED'), 'audit STARTED');
  ok(s.audit.some((a) => a.action === 'LOCAL_OFFLINE_ASR_TRANSCRIPTION_COMPLETED'), 'audit COMPLETED');
  ok(s2.audit.some((a) => a.action === 'LOCAL_OFFLINE_ASR_TRANSCRIPTION_FAILED'), 'audit FAILED');
});

// =========================================================================
// Phase 2J — tamper-evident audit export verification (async)
// =========================================================================

async function checkAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}: ${(e as Error).message}`);
  }
}

async function mainAsync(): Promise<void> {
  await checkAsync('canonicalizeForHash sorts object keys', async () => {
    eq(canonicalizeForHash({ b: 1, a: 2 }), canonicalizeForHash({ a: 2, b: 1 }), 'key order stable');
  });

  await checkAsync('canonicalizeForHash preserves array order', async () => {
    ok(canonicalizeForHash([2, 1]) !== canonicalizeForHash([1, 2]), 'array order matters');
  });

  await checkAsync('stripAuditIntegrity removes only top-level integrity', async () => {
    const input = { integrity: { hash: 'x' }, nested: { integrity: { keep: true } }, a: 1 };
    const out = stripAuditIntegrity(input) as Record<string, unknown>;
    eq((out as { integrity?: unknown }).integrity, undefined, 'top-level integrity removed');
    eq(((out.nested as Record<string, unknown>).integrity as Record<string, unknown>).keep, true, 'nested integrity preserved');
    // Original not mutated.
    ok(Boolean((input as { integrity?: unknown }).integrity), 'input not mutated');
  });

  await checkAsync('sha256Hex is deterministic', async () => {
    const a = await sha256Hex('MII_lite');
    const b = await sha256Hex('MII_lite');
    eq(a, b, 'same input same hash');
    eq(a.length, 64, 'hash length 64');
    ok(/^[0-9a-f]{64}$/.test(a), 'lowercase hex');
  });

  await checkAsync('buildSignedIncidentAuditExport adds integrity', async () => {
    const { s, incidentId } = runPennySignedFlow('medical-3-41');
    const exp = await buildSignedIncidentAuditExport(s, incidentId!);
    ok(!!exp.integrity, 'integrity exists');
    eq(exp.integrity!.hash.length, 64, 'hash length 64');
    eq(exp.integrity!.algorithm, 'SHA-256', 'algorithm SHA-256');
    eq(exp.integrity!.canonicalization, 'MII_LITE_CANONICAL_JSON_V1', 'canonicalization tag');
  });

  await checkAsync('verifyIncidentAuditExport VALID for untouched export', async () => {
    const { s, incidentId } = runPennySignedFlow('medical-3-41');
    const exp = await buildSignedIncidentAuditExport(s, incidentId!);
    const v = await verifyIncidentAuditExport(exp);
    eq(v.status, 'VALID', 'status VALID');
    eq(v.expectedHash, v.actualHash, 'hashes match');
  });

  await checkAsync('verifyIncidentAuditExport MODIFIED after content change', async () => {
    const { s, incidentId } = runPennySignedFlow('medical-3-41');
    const exp = await buildSignedIncidentAuditExport(s, incidentId!);
    const tampered = JSON.parse(JSON.stringify(exp));
    tampered.incident.naturePlain = 'TAMPERED VALUE';
    const v = await verifyIncidentAuditExport(tampered);
    eq(v.status, 'MODIFIED', 'status MODIFIED');
    ok(v.expectedHash !== v.actualHash, 'hashes differ');
  });

  await checkAsync('verifyIncidentAuditExport INVALID_FORMAT for missing integrity', async () => {
    const { s, incident } = runInstant('medical-3-41');
    const exp = buildIncidentAuditExport(s, incident!.id); // unsigned
    const v = await verifyIncidentAuditExport(exp);
    eq(v.status, 'INVALID_FORMAT', 'status INVALID_FORMAT');
  });

  await checkAsync('verifyIncidentAuditExport INVALID_FORMAT for non-export object', async () => {
    const v = await verifyIncidentAuditExport({ hello: 'world' });
    eq(v.status, 'INVALID_FORMAT', 'status INVALID_FORMAT');
  });

  await checkAsync('Missing local ASR model fails safely (server-side)', async () => {
    // Runs under Node (no window) → must return UNAVAILABLE, never throw.
    const cap = await checkLocalOfflineAsrAssets();
    ok(cap.status === 'UNAVAILABLE' || cap.status === 'MODEL_MISSING', `safe status (got ${cap.status})`);
    eq(cap.available, false, 'not available server-side');
    eq(cap.modelId, 'Xenova/whisper-tiny.en', 'model id');
    eq(cap.localModelPath, '/models/', 'local path');
  });

  await checkAsync('signed export preserves Phase 2I provenance', async () => {
    const { s, incidentId } = runPennySignedFlow('medical-3-41');
    const exp = await buildSignedIncidentAuditExport(s, incidentId!);
    ok(!!exp.transcriptReviewGate, 'transcriptReviewGate present');
    ok(!!exp.signOffPolicyGate, 'signOffPolicyGate present');
    ok(!!exp.safetyReadiness, 'safetyReadiness present');
    ok(exp.pennyReviews.length > 0, 'pennyReviews present');
    ok(exp.auditEvents.length > 0, 'auditEvents present');
  });

  console.log('');
  console.log(`MII verification complete: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

void mainAsync();
