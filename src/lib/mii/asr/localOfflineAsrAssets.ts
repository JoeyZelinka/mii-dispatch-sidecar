import type {
  LocalOfflineAsrCapabilityCheck,
  LocalOfflineAsrModelConfig,
} from './localOfflineTypes';

// Phase 3B — local/offline ASR model asset configuration + presence check.
// Everything here is same-origin and read-only; no remote model loading, no
// external network, no uploads.

export const LOCAL_OFFLINE_ASR_MODEL_ID = 'Xenova/whisper-tiny.en';
export const LOCAL_OFFLINE_ASR_LOCAL_MODEL_PATH = '/models/';
export const LOCAL_OFFLINE_ASR_PROVIDER = 'LOCAL_OFFLINE_WHISPER' as const;

// The deterministic config the adapter uses to force local-only loading.
export const LOCAL_OFFLINE_ASR_MODEL_CONFIG: LocalOfflineAsrModelConfig = {
  provider: LOCAL_OFFLINE_ASR_PROVIDER,
  modelId: LOCAL_OFFLINE_ASR_MODEL_ID,
  localModelPath: LOCAL_OFFLINE_ASR_LOCAL_MODEL_PATH,
  task: 'automatic-speech-recognition',
  remoteModelsAllowed: false,
  experimental: true,
};

// Minimal set of files we probe for. Kept conservative: config + tokenizer are
// enough to detect a plausibly-installed model. The actual pipeline load will
// surface a clear error if other required files are missing.
const REQUIRED_RELATIVE_FILES = [
  `${LOCAL_OFFLINE_ASR_MODEL_ID}/config.json`,
  `${LOCAL_OFFLINE_ASR_MODEL_ID}/tokenizer.json`,
];

function basePath(): string {
  // LOCAL_OFFLINE_ASR_LOCAL_MODEL_PATH is '/models/'.
  return LOCAL_OFFLINE_ASR_LOCAL_MODEL_PATH.replace(/\/$/, '');
}

// Same-origin HEAD/GET probe. Never throws; returns a safe capability result.
export async function checkLocalOfflineAsrAssets(): Promise<LocalOfflineAsrCapabilityCheck> {
  const modelId = LOCAL_OFFLINE_ASR_MODEL_ID;
  const localModelPath = LOCAL_OFFLINE_ASR_LOCAL_MODEL_PATH;

  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return {
      available: false,
      status: 'UNAVAILABLE',
      summary: 'Local offline ASR is only available in the browser.',
      modelId,
      localModelPath,
    };
  }

  const missingFiles: string[] = [];
  for (const rel of REQUIRED_RELATIVE_FILES) {
    const url = `${basePath()}/${rel}`;
    try {
      let ok = false;
      try {
        const head = await fetch(url, { method: 'HEAD' });
        ok = head.ok;
      } catch {
        ok = false;
      }
      // Some static servers do not support HEAD; fall back to a ranged GET.
      if (!ok) {
        const get = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
        ok = get.ok;
      }
      if (!ok) missingFiles.push(rel);
    } catch {
      missingFiles.push(rel);
    }
  }

  if (missingFiles.length > 0) {
    return {
      available: false,
      status: 'MODEL_MISSING',
      summary: `Local ASR model assets are not installed under public${localModelPath}${modelId}/.`,
      modelId,
      localModelPath,
      missingFiles,
    };
  }

  return {
    available: true,
    status: 'READY',
    summary: 'Local offline ASR model assets appear to be present.',
    modelId,
    localModelPath,
  };
}
