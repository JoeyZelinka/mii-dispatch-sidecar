'use client';

import { Card, CardContent, Typography, Box, Chip, Divider, Alert } from '@mui/material';
import WorkHistoryIcon from '@mui/icons-material/WorkHistory';
import type { AsrJob } from '@/lib/mii/types';
import { formatDateTime } from '@/lib/format';
import { getAsrProviderDefinition } from '@/lib/mii/asr/providerRegistry';

const STATUS_COLOR: Record<AsrJob['status'], 'default' | 'info' | 'primary' | 'success' | 'error' | 'warning'> = {
  REQUESTED: 'primary',
  QUEUED: 'info',
  TRANSCRIBING: 'info',
  COMPLETED: 'success',
  FAILED: 'error',
  CANCELLED: 'warning',
};

export default function AsrJobCard({
  job,
  filename,
  compact = false,
  children,
}: {
  job: AsrJob;
  filename?: string;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const providerDef = getAsrProviderDefinition(job.provider);
  const times: [string, string | undefined][] = [
    ['requested', job.requestedAt],
    ['queued', job.queuedAt],
    ['started', job.startedAt],
    ['completed', job.completedAt],
    ['failed', job.failedAt],
    ['cancelled', job.cancelledAt],
  ];

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <WorkHistoryIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
            ASR Job
          </Typography>
          <Chip size="small" color={STATUS_COLOR[job.status]} label={job.status} />
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
          <Chip size="small" variant="outlined" label={providerDef.label} />
          {filename && <Chip size="small" variant="outlined" label={filename} />}
          {job.scenarioId && (
            <Chip size="small" variant="outlined" label={`scenario: ${job.scenarioId}`} />
          )}
          <Chip
            size="small"
            variant="outlined"
            label={`${job.events.length} event${job.events.length === 1 ? '' : 's'}`}
          />
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 0.5 }}>
          {times
            .filter(([, v]) => Boolean(v))
            .map(([label, v]) => (
              <Typography key={label} variant="caption" color="text.secondary">
                {label}: {formatDateTime(v as string)}
              </Typography>
            ))}
        </Box>

        {job.resultId && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            result: {job.resultId}
          </Typography>
        )}

        {job.error && (
          <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
            {job.error}
          </Alert>
        )}

        {!compact && job.events.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="overline" color="text.secondary">
              Lifecycle
            </Typography>
            {job.events.map((e) => (
              <Box key={e.id} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                <Chip size="small" variant="outlined" color={STATUS_COLOR[e.status]} label={e.status} />
                {e.step && (
                  <Typography variant="caption" color="text.secondary">
                    {e.step}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ flexGrow: 1 }}>
                  {e.summary}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(e.createdAt)}
                </Typography>
              </Box>
            ))}
          </>
        )}

        <Alert severity="info" icon={false} sx={{ mt: 1, py: 0.25 }}>
          Simulated ASR job lifecycle — mock/local provider only. No real transcription, no upload.
        </Alert>

        {children && <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>{children}</Box>}
      </CardContent>
    </Card>
  );
}
