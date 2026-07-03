'use client';

import { Card, CardContent, Typography, Box, Chip, Divider, Alert } from '@mui/material';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import type { AsrTranscriptResult } from '@/lib/mii/types';
import { formatDateTime } from '@/lib/format';

const STATUS_COLOR: Record<AsrTranscriptResult['status'], 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  NOT_REQUESTED: 'default',
  QUEUED: 'info',
  TRANSCRIBING: 'info',
  COMPLETED: 'success',
  FAILED: 'error',
};

export function averageConfidence(result: AsrTranscriptResult): number {
  if (result.segments.length === 0) return 0;
  return result.segments.reduce((s, seg) => s + seg.confidence, 0) / result.segments.length;
}

export default function AsrResultCard({
  result,
  filename,
  compact = false,
  children,
}: {
  result: AsrTranscriptResult;
  filename?: string;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const avg = averageConfidence(result);

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <GraphicEqIcon color="info" fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
            Mock ASR Result
          </Typography>
          <Chip size="small" color={STATUS_COLOR[result.status]} label={result.status} />
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
          <Chip size="small" variant="outlined" label={`provider: ${result.provider}`} />
          {filename && <Chip size="small" variant="outlined" label={filename} />}
          {result.scenarioId && (
            <Chip size="small" variant="outlined" label={`scenario: ${result.scenarioId}`} />
          )}
          <Chip
            size="small"
            variant="outlined"
            label={`${result.segments.length} segment${result.segments.length === 1 ? '' : 's'}`}
          />
          {result.segments.length > 0 && (
            <Chip size="small" variant="outlined" label={`avg conf ${Math.round(avg * 100)}%`} />
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          Created {formatDateTime(result.createdAt)}
          {result.completedAt ? ` · Completed ${formatDateTime(result.completedAt)}` : ''}
        </Typography>

        {result.error && (
          <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
            {result.error}
          </Alert>
        )}

        {result.status === 'COMPLETED' && result.transcriptText && !compact && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="overline" color="text.secondary">
              Transcript preview
            </Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                mt: 0.5,
                p: 1,
                maxHeight: 160,
                overflow: 'auto',
                fontSize: 12,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                whiteSpace: 'pre-wrap',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 1,
              }}
            >
              {result.transcriptText}
            </Box>
          </>
        )}

        <Alert severity="info" icon={false} sx={{ mt: 1, py: 0.25 }}>
          Mock ASR only — no real audio transcription occurred.
        </Alert>

        {children && <Box sx={{ mt: 1.5 }}>{children}</Box>}
      </CardContent>
    </Card>
  );
}
