import type { AsrSegment, AsrTranscriptResult } from '../types';
import type { AsrAdapter, AsrAdapterInput } from './types';
import { getScenario } from '../seed';
import { makeId, nowIso } from '../util';

// Deterministic, local, synchronous mock ASR adapter.
//
// It does NOT transcribe any audio content. It fabricates an ASR-shaped
// transcript result from either a seeded scenario or freeform text so the
// integration point (audio artifact → ASR → transcript attachment → pipeline)
// can be exercised safely. No network, no file reads beyond AudioAsset metadata.

const SEGMENT_STEP_MS = 2500;
const SEGMENT_LEN_MS = 1800;

// Per-line confidence tiers, chosen deterministically from the line content so
// the mock feels ASR-like without any real recognition.
function lineConfidence(text: string, scenarioId: string): number {
  if (scenarioId === 'admin-chatter') return 0.82; // admin chatter
  if (/correction/i.test(text)) return 0.86; // correction / conflict line
  const hasFacts =
    /\b(3-41|41|19)\b/.test(text) || // signal code
    /\b\d+\s+\d{1,3}(?:st|nd|rd|th)\s+street\b/i.test(text) || // address
    /\btag\s+[a-z0-9]{4,8}\b/i.test(text) || // plate/tag
    /\b(red|blue|black|white|silver|gray|grey|green|gold)\s+\w+/i.test(text); // vehicle
  if (hasFacts) return 0.88; // incident facts line
  return 0.93; // routing / protocol / opener
}

function timing(idx: number): { startMs: number; endMs: number } {
  const startMs = idx * SEGMENT_STEP_MS;
  return { startMs, endMs: startMs + SEGMENT_LEN_MS };
}

function toTranscriptText(segments: AsrSegment[]): string {
  return segments.map((s) => `${s.speaker}: ${s.text}`).join('\n');
}

// Same best-effort parsing rule used by the transcript-first freeform path.
function parseFreeform(text: string): { speaker: string; text: string }[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => {
      const idx = l.indexOf(':');
      if (idx > 0 && idx <= 24) {
        const speaker = l.slice(0, idx).trim();
        const body = l.slice(idx + 1).trim();
        if (speaker && body) return { speaker, text: body };
      }
      return { speaker: 'UNKNOWN', text: l };
    });
}

export function createMockAsrAdapter(): AsrAdapter {
  return {
    provider: 'MOCK_SCENARIO',
    transcribe(input: AsrAdapterInput): AsrTranscriptResult {
      const base = {
        id: makeId('asr'),
        audioAssetId: input.audioAsset.id,
        createdAt: nowIso(),
      };

      // Mode 1 — seeded scenario.
      const scenario = input.scenarioId ? getScenario(input.scenarioId) : undefined;
      if (input.scenarioId && scenario) {
        const segments: AsrSegment[] = scenario.lines.map((line, idx) => {
          const { startMs, endMs } = timing(idx);
          return {
            id: makeId('seg'),
            speaker: line.speaker,
            text: line.text,
            startMs,
            endMs,
            confidence: lineConfidence(line.text, scenario.id),
          };
        });
        return {
          ...base,
          provider: 'MOCK_SCENARIO',
          status: 'COMPLETED',
          transcriptText: toTranscriptText(segments),
          segments,
          completedAt: nowIso(),
          scenarioId: scenario.id,
          notes: `Mock scenario transcript (${scenario.title}). No real transcription performed.`,
        };
      }

      // Mode 2 — freeform text.
      if (input.freeformTranscriptText && input.freeformTranscriptText.trim()) {
        const parsed = parseFreeform(input.freeformTranscriptText);
        const segments: AsrSegment[] = parsed.map((p, idx) => {
          const { startMs, endMs } = timing(idx);
          return {
            id: makeId('seg'),
            speaker: p.speaker,
            text: p.text,
            startMs,
            endMs,
            confidence: 0.75,
          };
        });
        return {
          ...base,
          provider: 'MOCK_FREEFORM',
          status: 'COMPLETED',
          transcriptText: toTranscriptText(segments),
          segments,
          completedAt: nowIso(),
          notes: 'Mock freeform transcript. No real transcription performed.',
        };
      }

      // Mode 3 — nothing to work with.
      return {
        ...base,
        provider: 'UNCONFIGURED',
        status: 'FAILED',
        transcriptText: '',
        segments: [],
        error: 'Mock ASR requires a seeded scenario or freeform transcript text.',
      };
    },
  };
}

// Shared singleton — the mock is stateless.
export const mockAsrAdapter = createMockAsrAdapter();
