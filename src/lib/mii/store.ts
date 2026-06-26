'use client';

import { useSyncExternalStore } from 'react';
import type {
  AuditEvent,
  IncidentContext,
  MockCadPayload,
  ReplayState,
  TranscriptLine,
  Unit,
  UnitRecommendation,
} from './types';
import { SEED_UNITS } from './seed';
import type { MockCadOptions } from './mockCad';
import {
  type MiiState,
  applySuggestedFields as engineApplyFields,
  assignUnit as engineAssignUnit,
  clearScenarioReplay as engineClearReplay,
  closeIncident as engineCloseIncident,
  confirmAsr as engineConfirmAsr,
  confirmSensitiveField as engineConfirmSensitive,
  processScenarioReplayNext as engineReplayNext,
  rejectField as engineRejectField,
  resolveFieldConflict as engineResolveConflict,
  runScenario as engineRunScenario,
  startScenarioReplay as engineStartReplay,
  submitMockCad as engineSubmitMockCad,
} from './processor';

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
