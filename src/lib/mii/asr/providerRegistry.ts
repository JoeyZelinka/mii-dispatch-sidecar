import type { AsrProvider } from '../types';

// Registry of ASR providers available in Phase 2C. All are mock/local; none
// perform real transcription or contact any external service. The registry is
// the single source of truth for provider capabilities so the UI selector and
// the job processor stay in sync.

export interface AsrProviderDefinition {
  provider: AsrProvider;
  label: string;
  description: string;
  realAsr: boolean;
  external: boolean;
  supportsScenario: boolean;
  supportsFreeform: boolean;
  // Phase 3B — experimental local/offline capability metadata (optional so
  // existing mock providers keep working unchanged).
  experimental?: boolean;
  requiresLocalModel?: boolean;
  externalNetwork?: boolean;
  supportsAudioFile?: boolean;
}

export const ASR_PROVIDER_REGISTRY: AsrProviderDefinition[] = [
  {
    provider: 'MOCK_SCENARIO',
    label: 'Mock Scenario ASR',
    description: 'Deterministically generates ASR-shaped segments from seeded demo scenarios.',
    realAsr: false,
    external: false,
    supportsScenario: true,
    supportsFreeform: false,
  },
  {
    provider: 'MOCK_FREEFORM',
    label: 'Mock Freeform ASR',
    description:
      'Deterministically generates ASR-shaped segments from manually supplied transcript text.',
    realAsr: false,
    external: false,
    supportsScenario: false,
    supportsFreeform: true,
  },
  {
    provider: 'LOCAL_PLACEHOLDER',
    label: 'Local Placeholder Adapter',
    description:
      'Reserved local adapter slot for future offline ASR or worker-based processing. Not active yet.',
    realAsr: false,
    external: false,
    supportsScenario: false,
    supportsFreeform: false,
  },
  {
    provider: 'LOCAL_OFFLINE_WHISPER',
    label: 'Local Offline Whisper (Experimental)',
    description:
      'Runs local browser ASR from local model assets only. No cloud ASR or external upload.',
    realAsr: true,
    external: false,
    supportsScenario: false,
    supportsFreeform: false,
    experimental: true,
    requiresLocalModel: true,
    externalNetwork: false,
    supportsAudioFile: true,
  },
  {
    provider: 'UNCONFIGURED',
    label: 'Unconfigured',
    description: 'No ASR provider configured.',
    realAsr: false,
    external: false,
    supportsScenario: false,
    supportsFreeform: false,
  },
];

const FALLBACK: AsrProviderDefinition = {
  provider: 'UNCONFIGURED',
  label: 'Unconfigured',
  description: 'No ASR provider configured.',
  realAsr: false,
  external: false,
  supportsScenario: false,
  supportsFreeform: false,
};

export function getAsrProviderDefinition(provider: AsrProvider): AsrProviderDefinition {
  return ASR_PROVIDER_REGISTRY.find((p) => p.provider === provider) ?? FALLBACK;
}
