import type { AsrProvider, AsrTranscriptResult, AudioAsset } from '../types';

// ASR adapter contract — the plug where a real ASR engine can later connect.
//
// Phase 2B ships a deterministic, synchronous mock adapter (no audio content is
// transcribed, no network is used). The contract is intentionally minimal so a
// future real adapter can implement the same shape.
//
// NOTE: a future real ASR adapter will almost certainly be asynchronous
// (network / worker / streaming). When that happens, change `transcribe` to
// return `Promise<AsrTranscriptResult>` and make callers await it. It is kept
// synchronous here only because the mock is fully local and deterministic.

export interface AsrAdapterInput {
  audioAsset: AudioAsset;
  scenarioId?: string;
  freeformTranscriptText?: string;
}

export interface AsrAdapter {
  provider: AsrProvider;
  transcribe(input: AsrAdapterInput): AsrTranscriptResult;
}
