'use client';

import { useSyncExternalStore } from 'react';
import type {
  AsrJob,
  AsrProvider,
  AsrTranscriptResult,
  AudioAsset,
  AudioTranscriptAttachment,
  AuditEvent,
  IncidentContext,
  MockCadPayload,
  PennyReviewActionType,
  PennyReviewState,
  PennyTranscriptPackage,
  PennyTranscriptionPlan,
  ReplayState,
  SignOffPolicyGateResult,
  TranscriptReviewGateResult,
  TranscriptLine,
  Unit,
  UnitRecommendation,
} from './types';
import { SEED_UNITS } from './seed';
import type { MockCadOptions } from './mockCad';
import {
  type AddAudioAssetInput,
  type MiiState,
  addAudioAsset as engineAddAudioAsset,
  advanceAsrJob as engineAdvanceAsrJob,
  applySuggestedFields as engineApplyFields,
  assignUnit as engineAssignUnit,
  attachAsrResultToAudio as engineAttachAsrResult,
  attachTranscriptToAudio as engineAttachTranscript,
  cancelAsrJob as engineCancelAsrJob,
  clearAudioIntake as engineClearAudioIntake,
  clearScenarioReplay as engineClearReplay,
  closeIncident as engineCloseIncident,
  confirmAsr as engineConfirmAsr,
  confirmSensitiveField as engineConfirmSensitive,
  processAudioTranscriptAttachment as engineProcessAudioAttachment,
  processScenarioReplayNext as engineReplayNext,
  requestAsrJob as engineRequestAsrJob,
  runAsrJobToCompletion as engineRunAsrJobToCompletion,
  runMockAsrForAudio as engineRunMockAsr,
  rejectField as engineRejectField,
  resolveFieldConflict as engineResolveConflict,
  runScenario as engineRunScenario,
  startScenarioReplay as engineStartReplay,
  submitMockCad as engineSubmitMockCad,
} from './processor';
import {
  type PennyQualityGateResult,
  createPennyPlan as engineCreatePennyPlan,
  evaluateAsrResultForPenny as engineEvaluatePenny,
  evaluatePennyQualityGate as engineEvaluateQualityGate,
  evaluatePennyReviewReadiness as engineEvaluateReviewReadiness,
  getOrCreatePennyReviewState as engineGetOrCreateReview,
  pennyAdvanceAsrJob as enginePennyAdvance,
  pennyAttachTranscriptPackage as enginePennyAttach,
  pennyRequestAsrJob as enginePennyRequest,
  pennyRunAsrToCompletion as enginePennyRunToCompletion,
  recordPennyReviewAction as engineRecordReviewAction,
  signOffPennyReview as engineSignOffReview,
} from './penny';
import { evaluateTranscriptReviewGateForIncident as engineTranscriptReviewGate } from './transcriptReviewGate';
import {
  defaultDemoPolicy,
  evaluateSignOffPolicyGateForIncident as engineSignOffPolicyGate,
  updateDemoPolicy as engineUpdateDemoPolicy,
} from './signOffPolicy';
import { buildIncidentAuditExport, type IncidentAuditExport } from './auditExport';
import {
  cancelRecordingProcessingSession as engineCancelRecordingSession,
  completeRecordingProcessingSession as engineCompleteRecordingSession,
  createRecordingProcessingSession as engineCreateRecordingSession,
  linkRecordingSessionToPennyPlan as engineLinkRecordingSession,
  markRecordingCheckpoint as engineMarkRecordingCheckpoint,
  refreshRecordingProcessingSessionLinks as engineRefreshRecordingSession,
  startRecordingProcessingSession as engineStartRecordingSession,
} from './recordingProcessing';

const STORAGE_KEY = 'mii_lite_state_v1';
const REVIEWER = 'Dispatcher (you)';

function freshState(): MiiState {
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

function loadState(): MiiState {
  if (typeof window === 'undefined') return freshState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as MiiState;
    // Basic shape guard; fall back to fresh on anything unexpected.
    if (!parsed.units || !Array.isArray(parsed.units)) return freshState();
    // Forward-compat: older persisted state predates the replay slice.
    if (parsed.replay === undefined) parsed.replay = null;
    // Forward-compat: older persisted state predates the audio intake slices.
    if (!Array.isArray(parsed.audioAssets)) parsed.audioAssets = [];
    if (!Array.isArray(parsed.audioTranscriptAttachments)) {
      parsed.audioTranscriptAttachments = [];
    }
    // Forward-compat: older persisted state predates the ASR results slice.
    if (!Array.isArray(parsed.asrTranscriptResults)) parsed.asrTranscriptResults = [];
    // Forward-compat: older persisted state predates the ASR jobs slice.
    if (!Array.isArray(parsed.asrJobs)) parsed.asrJobs = [];
    // Forward-compat: older persisted state predates the PENNY slices.
    if (!Array.isArray(parsed.pennyPlans)) parsed.pennyPlans = [];
    if (!Array.isArray(parsed.pennyTranscriptPackages)) parsed.pennyTranscriptPackages = [];
    if (!Array.isArray(parsed.pennyReviewStates)) parsed.pennyReviewStates = [];
    // Forward-compat: older persisted state predates the demo policy.
    if (!parsed.demoPolicy || !parsed.demoPolicy.signOffPolicyMode) {
      parsed.demoPolicy = defaultDemoPolicy();
    }
    // Forward-compat: older persisted state predates recording sessions.
    if (!Array.isArray(parsed.recordingProcessingSessions)) {
      parsed.recordingProcessingSessions = [];
    }
    return parsed;
  } catch {
    return freshState();
  }
}

let state: MiiState = freshState();
let hydrated = false;
const listeners = new Set<() => void>();

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // best-effort persistence only
  }
}

function emit(): void {
  for (const l of listeners) l();
}

// Every mutation runs against a structured clone so React sees fresh refs.
function update<T>(fn: (draft: MiiState) => T): T {
  const draft = structuredClone(state);
  const result = fn(draft);
  state = draft;
  persist();
  emit();
  return result;
}

function ensureHydrated(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  const loaded = loadState();
  state = loaded;
  emit();
}

export const miiStore = {
  subscribe(listener: () => void): () => void {
    ensureHydrated();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): MiiState {
    return state;
  },
  getServerSnapshot(): MiiState {
    return state;
  },

  // --- actions ---
  runScenario(scenarioId: string) {
    return update((d) => engineRunScenario(d, scenarioId, REVIEWER));
  },
  startReplay(scenarioId: string) {
    return update((d) => engineStartReplay(d, scenarioId, REVIEWER));
  },
  stepReplay() {
    return update((d) => engineReplayNext(d));
  },
  clearReplay() {
    update((d) => engineClearReplay(d));
  },
  confirmAsr(incidentId: string) {
    update((d) => engineConfirmAsr(d, incidentId, REVIEWER));
  },
  applySuggestedFields(incidentId: string) {
    update((d) => engineApplyFields(d, incidentId, REVIEWER));
  },
  confirmSensitiveField(incidentId: string, fieldId: string) {
    update((d) => engineConfirmSensitive(d, incidentId, fieldId, REVIEWER));
  },
  rejectField(incidentId: string, fieldId: string) {
    update((d) => engineRejectField(d, incidentId, fieldId, REVIEWER));
  },
  resolveFieldConflict(
    incidentId: string,
    conflictId: string,
    selectedValue: 'existing' | 'incoming'
  ) {
    update((d) => engineResolveConflict(d, incidentId, conflictId, selectedValue, REVIEWER));
  },
  assignUnit(incidentId: string, unitId: string) {
    update((d) => engineAssignUnit(d, incidentId, unitId, REVIEWER));
  },
  submitMockCad(incidentId: string, options: MockCadOptions): MockCadPayload | undefined {
    return update((d) => engineSubmitMockCad(d, incidentId, options, REVIEWER));
  },
  closeIncident(incidentId: string) {
    update((d) => engineCloseIncident(d, incidentId, REVIEWER));
  },

  // --- Phase 2A audio intake actions ---
  addAudioAsset(input: AddAudioAssetInput): AudioAsset {
    return update((d) => engineAddAudioAsset(d, input));
  },
  attachTranscriptToAudio(
    audioAssetId: string,
    transcriptText: string,
    scenarioId?: string
  ): AudioTranscriptAttachment {
    return update((d) => engineAttachTranscript(d, audioAssetId, transcriptText, scenarioId));
  },
  processAudioTranscriptAttachment(attachmentId: string): { incidentId?: string } {
    return update((d) => engineProcessAudioAttachment(d, attachmentId, REVIEWER));
  },
  runMockAsrForAudio(
    audioAssetId: string,
    options: { scenarioId?: string; freeformTranscriptText?: string }
  ): AsrTranscriptResult {
    return update((d) => engineRunMockAsr(d, audioAssetId, { ...options, actor: REVIEWER }));
  },
  attachAsrResultToAudio(asrResultId: string): AudioTranscriptAttachment | undefined {
    return update((d) => engineAttachAsrResult(d, asrResultId, REVIEWER));
  },
  requestAsrJob(
    audioAssetId: string,
    options: { provider: AsrProvider; scenarioId?: string; freeformTranscriptText?: string }
  ): AsrJob {
    return update((d) => engineRequestAsrJob(d, audioAssetId, { ...options, actor: REVIEWER }));
  },
  advanceAsrJob(jobId: string): AsrJob | undefined {
    return update((d) => engineAdvanceAsrJob(d, jobId, REVIEWER));
  },
  runAsrJobToCompletion(jobId: string): AsrJob | undefined {
    return update((d) => engineRunAsrJobToCompletion(d, jobId, REVIEWER));
  },
  cancelAsrJob(jobId: string): AsrJob | undefined {
    return update((d) => engineCancelAsrJob(d, jobId, REVIEWER));
  },

  // --- Phase 2E PENNY orchestration actions ---
  createPennyPlan(input: {
    audioAssetId: string;
    provider: AsrProvider;
    scenarioId?: string;
    freeformTranscriptText?: string;
    notes?: string;
  }): PennyTranscriptionPlan {
    return update((d) => engineCreatePennyPlan(d, { ...input, actor: REVIEWER }));
  },
  pennyRequestAsrJob(planId: string): PennyTranscriptionPlan | undefined {
    return update((d) => enginePennyRequest(d, planId, REVIEWER));
  },
  pennyAdvanceAsrJob(planId: string): PennyTranscriptionPlan | undefined {
    return update((d) => enginePennyAdvance(d, planId, REVIEWER));
  },
  pennyRunAsrToCompletion(planId: string): PennyTranscriptionPlan | undefined {
    return update((d) => enginePennyRunToCompletion(d, planId, REVIEWER));
  },
  evaluateAsrResultForPenny(planId: string): PennyTranscriptPackage | undefined {
    return update((d) => engineEvaluatePenny(d, planId, REVIEWER));
  },
  pennyAttachTranscriptPackage(planId: string): AudioTranscriptAttachment | undefined {
    return update((d) => enginePennyAttach(d, planId, REVIEWER));
  },

  // --- Phase 2F PENNY human review actions ---
  getOrCreatePennyReviewState(planId: string, packageId: string): PennyReviewState {
    return update((d) => engineGetOrCreateReview(d, planId, packageId, REVIEWER));
  },
  recordPennyReviewAction(input: {
    planId: string;
    packageId: string;
    issueId?: string;
    actionType: PennyReviewActionType;
    note?: string;
  }): PennyReviewState | undefined {
    return update((d) => engineRecordReviewAction(d, { ...input, actor: REVIEWER }));
  },
  evaluatePennyReviewReadiness(planId: string, packageId: string): PennyReviewState | undefined {
    return update((d) => engineEvaluateReviewReadiness(d, planId, packageId, REVIEWER));
  },
  signOffPennyReview(
    planId: string,
    packageId: string,
    note?: string
  ): PennyReviewState | undefined {
    return update((d) => engineSignOffReview(d, { planId, packageId, note, actor: REVIEWER }));
  },
  // Read-only transcript-readiness gate — computed against the current snapshot.
  pennyQualityGate(planId: string, packageId: string): PennyQualityGateResult {
    return engineEvaluateQualityGate(state, planId, packageId);
  },
  // Read-only transcript review safety gate for an incident.
  transcriptReviewGate(incidentId: string): TranscriptReviewGateResult {
    return engineTranscriptReviewGate(state, incidentId);
  },
  // Read-only sign-off policy gate for an incident.
  signOffPolicyGate(incidentId: string): SignOffPolicyGateResult {
    return engineSignOffPolicyGate(state, incidentId);
  },
  updateDemoPolicy(mode: import('./types').SignOffPolicyMode) {
    return update((d) => engineUpdateDemoPolicy(d, mode, REVIEWER));
  },
  // Read-only local audit export builder for an incident.
  buildAuditExport(incidentId: string): IncidentAuditExport {
    return buildIncidentAuditExport(state, incidentId);
  },

  // --- Phase 3A Play-to-Process recording session actions ---
  createRecordingProcessingSession(input: { audioAssetId: string; notes?: string }) {
    return update((d) => engineCreateRecordingSession(d, { ...input, actor: REVIEWER }));
  },
  startRecordingProcessingSession(sessionId: string) {
    return update((d) => engineStartRecordingSession(d, { sessionId, actor: REVIEWER }));
  },
  markRecordingCheckpoint(
    sessionId: string,
    kind: import('./types').HumanCheckpointKind,
    summary?: string
  ) {
    return update((d) => engineMarkRecordingCheckpoint(d, { sessionId, kind, summary, actor: REVIEWER }));
  },
  linkRecordingSessionToPennyPlan(sessionId: string, pennyPlanId: string) {
    return update((d) => engineLinkRecordingSession(d, { sessionId, pennyPlanId, actor: REVIEWER }));
  },
  refreshRecordingProcessingSessionLinks(sessionId: string) {
    return update((d) => engineRefreshRecordingSession(d, sessionId));
  },
  completeRecordingProcessingSession(sessionId: string) {
    return update((d) => engineCompleteRecordingSession(d, sessionId, REVIEWER));
  },
  cancelRecordingProcessingSession(sessionId: string) {
    return update((d) => engineCancelRecordingSession(d, sessionId, REVIEWER));
  },
  clearAudioIntake() {
    update((d) => engineClearAudioIntake(d));
  },
  reset() {
    state = freshState();
    persist();
    emit();
  },
};

// --- React hooks ---------------------------------------------------------

function useStore<T>(selector: (s: MiiState) => T): T {
  return useSyncExternalStore(
    miiStore.subscribe,
    () => selector(miiStore.getSnapshot()),
    () => selector(miiStore.getServerSnapshot())
  );
}

export function useIncidents(): IncidentContext[] {
  return useStore((s) => s.incidents);
}
export function useIncident(id: string): IncidentContext | undefined {
  return useStore((s) => s.incidents.find((i) => i.id === id));
}
export function useUnits(): Unit[] {
  return useStore((s) => s.units);
}
export function useTranscriptLines(): TranscriptLine[] {
  return useStore((s) => s.transcriptLines);
}
export function useAudit(): AuditEvent[] {
  return useStore((s) => s.audit);
}
// Returns the full, stable recommendations slice. Filter by incident in the
// component (filtering inside the selector would break getSnapshot caching).
export function useAllRecommendations(): UnitRecommendation[] {
  return useStore((s) => s.recommendations);
}
export function useMockCadPayload(incidentId: string): MockCadPayload | undefined {
  return useStore((s) => s.mockCadPayloads[incidentId]);
}
export function useReplay(): ReplayState | null {
  return useStore((s) => s.replay);
}
export function useAudioAssets(): AudioAsset[] {
  return useStore((s) => s.audioAssets);
}
export function useAudioTranscriptAttachments(): AudioTranscriptAttachment[] {
  return useStore((s) => s.audioTranscriptAttachments);
}
export function useAsrTranscriptResults(): AsrTranscriptResult[] {
  return useStore((s) => s.asrTranscriptResults);
}
export function useAsrJobs(): AsrJob[] {
  return useStore((s) => s.asrJobs);
}
export function usePennyPlans(): PennyTranscriptionPlan[] {
  return useStore((s) => s.pennyPlans);
}
export function usePennyTranscriptPackages(): PennyTranscriptPackage[] {
  return useStore((s) => s.pennyTranscriptPackages);
}
export function usePennyReviewStates(): PennyReviewState[] {
  return useStore((s) => s.pennyReviewStates);
}
export function useDemoPolicy(): import('./types').MiiDemoPolicy {
  return useStore((s) => s.demoPolicy);
}
export function useRecordingProcessingSessions(): import('./types').RecordingProcessingSession[] {
  return useStore((s) => s.recordingProcessingSessions);
}

// Re-export the pure placeholder builder so client components use one source.
export { createPlaceholderAudioAssetInput } from './processor';
