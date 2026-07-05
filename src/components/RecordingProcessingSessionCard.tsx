'use client';

import { Card, CardContent, Typography, Box, Chip, Divider, Button, Alert } from '@mui/material';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import type {
  AudioAsset,
  HumanCheckpointKind,
  RecordingProcessingSession,
  RecordingProcessingSessionStatus,
} from '@/lib/mii/types';
import { formatDateTime } from '@/lib/format';

const STATUS_COLOR: Record<
  RecordingProcessingSessionStatus,
  'default' | 'info' | 'primary' | 'success' | 'error' | 'warning' | 'secondary'
> = {
  DRAFT: 'default',
  READY: 'info',
  PLAYING: 'info',
  PROCESSING_STARTED: 'info',
  PENNY_PLAN_CREATED: 'primary',
  AWAITING_HUMAN_REVIEW: 'warning',
  REVIEW_SIGNED_OFF: 'secondary',
  TRANSCRIPT_ATTACHED: 'secondary',
  INCIDENT_PROCESSED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'warning',
  FAILED: 'error',
};

export default function RecordingProcessingSessionCard({
  session,
  audioAsset,
  onStart,
  onRefresh,
  onCompleteCheckpoint,
  onCompleteSession,
  onCancel,
}: {
  session: RecordingProcessingSession;
  audioAsset?: AudioAsset;
  onStart?: () => void;
  onRefresh?: () => void;
  onCompleteCheckpoint?: (kind: HumanCheckpointKind, summary?: string) => void;
  onCompleteSession?: () => void;
  onCancel?: () => void;
}) {
  const terminal = session.status === 'COMPLETED' || session.status === 'CANCELLED';
  const started = session.status !== 'READY' && session.status !== 'DRAFT';
  const ids: [string, string | undefined][] = [
    ['plan', session.pennyPlanId],
    ['asr job', session.asrJobId],
    ['asr result', session.asrResultId],
    ['package', session.transcriptPackageId],
    ['review', session.reviewStateId],
    ['attachment', session.attachmentId],
    ['incident', session.incidentId],
  ];

  return (
    <Card variant="outlined" sx={{ borderColor: 'primary.main' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
          <GraphicEqIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
            Play-to-Process Recording
          </Typography>
          <Chip size="small" color={STATUS_COLOR[session.status]} label={session.status.replace(/_/g, ' ')} />
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
          {audioAsset && <Chip size="small" variant="outlined" label={audioAsset.filename} />}
          {audioAsset?.sourceLabel && <Chip size="small" variant="outlined" label={audioAsset.sourceLabel} />}
          {audioAsset?.sourceDevice && <Chip size="small" variant="outlined" label={audioAsset.sourceDevice} />}
        </Box>

        {(session.startedAt || session.completedAt) && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 0.5 }}>
            {session.startedAt && (
              <Typography variant="caption" color="text.secondary">
                started: {formatDateTime(session.startedAt)}
              </Typography>
            )}
            {session.completedAt && (
              <Typography variant="caption" color="text.secondary">
                completed: {formatDateTime(session.completedAt)}
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 1 }}>
          {ids
            .filter(([, v]) => Boolean(v))
            .map(([label, v]) => (
              <Typography key={label} variant="caption" color="text.secondary">
                {label}: {v}
              </Typography>
            ))}
        </Box>

        <Divider sx={{ my: 1 }} />
        <Typography variant="overline" color="text.secondary">
          Human checkpoints
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
          {session.checkpoints.map((cp) => (
            <Box key={cp.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {cp.completed ? (
                <CheckCircleIcon fontSize="small" color="success" />
              ) : (
                <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
              )}
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                {cp.label}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                color={cp.required ? 'default' : 'info'}
                label={cp.required ? 'required' : 'optional'}
              />
              {cp.completed && cp.completedAt && (
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(cp.completedAt)}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        <Divider sx={{ my: 1 }} />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<PlayCircleIcon />}
            onClick={() => onStart?.()}
            disabled={started || terminal}
          >
            Play &amp; Process Recording
          </Button>
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={() => onRefresh?.()} disabled={terminal}>
            Refresh Session Links
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onCompleteCheckpoint?.('REVIEW_SAFETY_GATES', 'Safety gates reviewed on Incident Report.')}
            disabled={terminal}
          >
            Mark Safety Gates Reviewed
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onCompleteCheckpoint?.('EXPORT_AUDIT', 'Audit exported/verified.')}
            disabled={terminal}
          >
            Mark Audit Exported
          </Button>
          <Button size="small" variant="outlined" color="success" onClick={() => onCompleteSession?.()} disabled={terminal}>
            Complete Session
          </Button>
          <Button size="small" variant="outlined" color="error" onClick={() => onCancel?.()} disabled={terminal}>
            Cancel
          </Button>
        </Box>

        <Alert severity="info" icon={false} sx={{ mt: 1, py: 0.25 }}>
          Play-to-Process starts automated preparation, but transcript review, sign-off, attachment,
          incident processing, Mock CAD, and audit export remain human checkpoints.
        </Alert>
      </CardContent>
    </Card>
  );
}
