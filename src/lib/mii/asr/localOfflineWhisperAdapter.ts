import type { LocalOfflineAsrRunResult, LocalOfflineAsrSegment, LocalOfflineAsrStatus } from './localOfflineTypes';
import {
  LOCAL_OFFLINE_ASR_LOCAL_MODEL_PATH,
  LOCAL_OFFLINE_ASR_MODEL_ID,
} from './localOfflineAsrAssets';
import { blobToMonoFloat32Pcm } from './localOfflineAudio';

// Phase 3B — experimental local/offline Whisper ASR adapter. Client/browser
// only. Loads model assets from same-origin /models/ with remote loading
// disabled. No cloud ASR, no external upload, no server routes.

// Cache the pipeline across runs so the (slow) first model load is paid once.
let cachedTranscriber: unknown | undefined;

// Minimal structural typing of the pieces of Transformers.js we touch, so we
// never depend on library types at build time and never surface raw errors.
interface TransformersEnv {
  allowRemoteModels: boolean;
  allowLocalModels: boolean;
  localModelPath: string;
}
interface TransformersModule {
  env: TransformersEnv;
  pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<unknown>;
}
type TranscribeFn = (
  input: Float32Array,
  options?: Record<string, unknown>
) => Promise<{ text?: string; chunks?: { timestamp?: [number, number]; text?: string }[] }>;

export async function runLocalOfflineWhisperAsr(input: {
  audioBlob: Blob;
  audioAssetId: string;
  filename?: string;
  onProgress?: (event: {
    status: LocalOfflineAsrStatus;
    progress?: number;
    summary: string;
  }) => void;
}): Promise<LocalOfflineAsrRunResult> {
  const start = Date.now();
  const emit = (status: LocalOfflineAsrStatus, summary: string, progress?: number) =>
    input.onProgress?.({ status, summary, progress });

  if (typeof window === 'undefined') {
    return { status: 'FAILED', errorMessage: 'Local offline ASR only runs in the browser.', durationMs: 0 };
  }

  try {
    emit('LOADING_MODEL', 'Loading local ASR model assets…');

    const mod = (await import('@huggingface/transformers')) as unknown as TransformersModule;
    // Force strictly-local model loading.
    mod.env.allowRemoteModels = false;
    mod.env.allowLocalModels = true;
    mod.env.localModelPath = LOCAL_OFFLINE_ASR_LOCAL_MODEL_PATH;

    if (!cachedTranscriber) {
      // Conservative defaults: CPU/WASM, no WebGPU requirement.
      cachedTranscriber = await mod.pipeline(
        'automatic-speech-recognition',
        LOCAL_OFFLINE_ASR_MODEL_ID
      );
    }
    const transcribe = cachedTranscriber as TranscribeFn;

    emit('TRANSCRIBING', 'Decoding audio and running local transcription…');
    const { samples } = await blobToMonoFloat32Pcm(input.audioBlob, 16000);

    const output = await transcribe(samples, { return_timestamps: true, chunk_length_s: 30 });

    const transcriptText = (output?.text ?? '').trim();
    const segments: LocalOfflineAsrSegment[] = Array.isArray(output?.chunks)
      ? output.chunks.map((c, i) => ({
          id: `los_${i}`,
          startSec: Array.isArray(c.timestamp) ? c.timestamp[0] : undefined,
          endSec: Array.isArray(c.timestamp) ? c.timestamp[1] : undefined,
          text: (c.text ?? '').trim(),
          // Local Whisper does not expose field-level confidence.
        }))
      : [];

    emit('COMPLETED', 'Local transcription complete.');
    return {
      status: 'COMPLETED',
      transcriptText,
      segments: segments.length ? segments : undefined,
      // averageConfidence intentionally omitted — no field-level confidence.
      durationMs: Date.now() - start,
    };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    // Sanitize: keep it short and non-scary.
    const errorMessage = /local|model|fetch|404|not found|ENOENT/i.test(raw)
      ? 'Local ASR model assets could not be loaded. Ensure the model is installed under public/models.'
      : 'Local offline ASR failed to transcribe this recording.';
    emit('FAILED', errorMessage);
    return { status: 'FAILED', errorMessage, durationMs: Date.now() - start };
  }
}
