import type { ExtractedField, Suggestion, SuggestionState } from '@/types/mii';
import { store } from './store';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export const suggestionsService = {
  async getForIncident(incidentId: string): Promise<Suggestion | undefined> {
    const s = store.suggestions.find((s) => s.incidentId === incidentId);
    return s ? clone(s) : undefined;
  },
  async list(): Promise<Suggestion[]> {
    return clone(store.suggestions.slice());
  },
  async setState(suggestionId: string, state: SuggestionState): Promise<Suggestion> {
    const idx = store.suggestions.findIndex((s) => s.id === suggestionId);
    if (idx < 0) throw new Error(`Suggestion ${suggestionId} not found`);
    store.suggestions[idx] = {
      ...store.suggestions[idx],
      state,
      lastActionTs: new Date().toISOString(),
    };
    return clone(store.suggestions[idx]);
  },
  async editField(
    suggestionId: string,
    fieldKey: string,
    nextValue: string
  ): Promise<{ suggestion: Suggestion; before: ExtractedField; after: ExtractedField }> {
    const idx = store.suggestions.findIndex((s) => s.id === suggestionId);
    if (idx < 0) throw new Error(`Suggestion ${suggestionId} not found`);
    const current = store.suggestions[idx];
    const fIdx = current.fields.findIndex((f) => f.key === fieldKey);
    if (fIdx < 0) throw new Error(`Field ${fieldKey} not found`);
    const before = clone(current.fields[fIdx]);
    const after: ExtractedField = { ...before, value: nextValue, confidence: 1 };
    const nextFields = current.fields.slice();
    nextFields[fIdx] = after;
    const nextSug: Suggestion = {
      ...current,
      fields: nextFields,
      lastActionTs: new Date().toISOString(),
    };
    store.suggestions[idx] = nextSug;
    return { suggestion: clone(nextSug), before, after: clone(after) };
  },
};
