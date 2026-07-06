// Phase 3B — experimental local/offline ASR adapter types. Client/browser only.
// No cloud ASR, no external upload, no server routes.

export type LocalOfflineAsrStatus =
  | 'UNAVAILABLE'
  | 'MODEL_MISSING'
  | 'READY'
  | 'LOADING_MODEL'
  | 'TRANSCRIBING'
  | 'COMPLETED'
  | 'FAILED';

export interface LocalOfflineAsrModelConfig {
  provider: 'LOCAL_OFFLINE_WHISPER';
  modelId: string;
  localModelPath: string;
  task: 'automatic-speech-recognition';
  remoteModelsAllowed: false;
  experimental: true;
}

export interface LocalOfflineAsrCapabilityCheck {
  available: boolean;
  status: LocalOfflineAsrStatus;
  summary: string;
  modelId: string;
  localModelPath: string;
  missingFiles?: string[];
}

export interface LocalOfflineAsrSegment {
  id: string;
  startSec?: number;
  endSec?: number;
  text: string;
  confidence?: number;
}

export interface LocalOfflineAsrRunResult {
  status: 'COMPLETED' | 'FAILED';
  transcriptText?: string;
  segments?: LocalOfflineAsrSegment[];
  averageConfidence?: number;
  errorMessage?: string;
  durationMs: number;
}
