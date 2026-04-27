import type { SemanticType, Speaker, TranscriptEvent } from '@/types/mii';
import { store } from './store';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export interface TranscriptFilter {
  semanticType?: SemanticType;
  speaker?: Speaker;
  cueOnly?: boolean;
  incidentId?: string;
}

export const transcriptsService = {
  async list(filter?: TranscriptFilter): Promise<TranscriptEvent[]> {
    let result = store.transcripts.slice();
    if (filter?.semanticType) result = result.filter((t) => t.semanticType === filter.semanticType);
    if (filter?.speaker) result = result.filter((t) => t.speaker === filter.speaker);
    if (filter?.cueOnly) result = result.filter((t) => Boolean(t.cueDetected));
    if (filter?.incidentId) result = result.filter((t) => t.incidentId === filter.incidentId);
    return clone(result.sort((a, b) => b.ts.localeCompare(a.ts)));
  },
  async markCue(id: string, cue: boolean): Promise<TranscriptEvent> {
    const idx = store.transcripts.findIndex((t) => t.id === id);
    if (idx < 0) throw new Error(`Transcript ${id} not found`);
    store.transcripts[idx] = { ...store.transcripts[idx], cueDetected: cue };
    return clone(store.transcripts[idx]);
  },
};
