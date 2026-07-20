'use client';

import { Card, CardContent, Typography, Box, Chip, Button, Alert, LinearProgress } from '@mui/material';
import ScienceIcon from '@mui/icons-material/Science';
import type {
  LocalOfflineAsrCapabilityCheck,
  LocalOfflineAsrStatus,
} from '@/lib/mii/asr/localOfflineTypes';

const STATUS_COLOR: Record<LocalOfflineAsrStatus, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  UNAVAILABLE: 'default',
  MODEL_MISSING: 'warning',
  READY: 'success',
  LOADING_MODEL: 'info',
  TRANSCRIBING: 'info',
  COMPLETED: 'success',
  FAILED: 'error',
};

export default function LocalOfflineAsrCard({
  capability,
  status,
  progressSummary,
  errorMessage,
  transcriptResultId,
  canRun,
  onCheckModel,
  onRunAsr,
}: {
  capability?: LocalOfflineAsrCapabilityCheck;
  status: LocalOfflineAsrStatus;
  progressSummary?: string;
  errorMessage?: string;
  transcriptResultId?: string;
  canRun?: boolean;
  onCheckModel?: () => void;
  onRunAsr?: () => void;
}) {
  const modelMissing = capability?.status === 'MODEL_MISSING' || status === 'MODEL_MISSING';
  const busy = status === 'LOADING_MODEL' || status === 'TRANSCRIBING';

  return (
    <Card variant="outlined" sx={{ borderColor: 'secondary.main' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
          <ScienceIcon color="secondary" fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
            Local Offline ASR — Experimental
          </Typography>
          <Chip size="small" color={STATUS_COLOR[status]} label={status.replace(/_/g, ' ')} />
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
          <Chip size="small" variant="outlined" label="LOCAL_OFFLINE_WHISPER" />
          <Chip size="small" variant="outlined" color="success" label="No cloud upload" />
        </Box>

        <Alert severity="warning" sx={{ mb: 1, py: 0.25 }}>
          Experimental ASR is not public-safety-grade. Human review/sign-off remains required.
        </Alert>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Local Offline ASR is experimental and runs against local model assets in the browser. It is
          not public-safety-grade transcription. Human review and sign-off remain required before any
          transcript can be attached or processed.
        </Typography>

        {capability && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {capability.summary}
          </Typography>
        )}

        {modelMissing && (
          <Alert severity="info" sx={{ mb: 1 }}>
            Local ASR model assets are not installed. Add a compatible Transformers.js ASR model under{' '}
            <code>public/models/Xenova/whisper-tiny.en/</code>, or choose a mock provider.
          </Alert>
        )}

        {busy && (
          <Box sx={{ mb: 1 }}>
            <LinearProgress />
            {progressSummary && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {progressSummary}
              </Typography>
            )}
          </Box>
        )}

        {status === 'FAILED' && errorMessage && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {errorMessage}
          </Alert>
        )}

        {status === 'COMPLETED' && transcriptResultId && (
          <Alert severity="success" sx={{ mb: 1 }}>
            Local transcription complete. Continue to PENNY human review below.
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" onClick={() => onCheckModel?.()} disabled={busy}>
            Check Local Model
          </Button>
          <Button
            size="small"
            variant="contained"
            color="secondary"
            onClick={() => onRunAsr?.()}
            disabled={busy || modelMissing || canRun === false}
          >
            Run Local Offline ASR
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
