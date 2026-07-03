'use client';

import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import type {
  IncidentContext,
  TranscriptReviewGateResult,
  TranscriptReviewGateStatus,
} from '@/lib/mii/types';
import { formatDateTime } from '@/lib/format';

const STATUS_COLOR: Record<
  TranscriptReviewGateStatus,
  'success' | 'warning' | 'error' | 'default'
> = {
  PASS: 'success',
  WARNING: 'warning',
  BLOCKED: 'error',
  NOT_APPLICABLE: 'default',
};

export default function IncidentTranscriptReviewCard({
  incident,
  liveGate,
}: {
  incident: IncidentContext;
  liveGate?: TranscriptReviewGateResult;
}) {
  const snapshot = incident.transcriptReviewSnapshot;
  const liveApplicable = liveGate && liveGate.status !== 'NOT_APPLICABLE';

  // Render only when there's something to show.
  if (!snapshot && !liveApplicable) return null;

  return (
    <Card variant="outlined" sx={{ borderColor: 'secondary.main' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <HistoryEduIcon color="secondary" fontSize="small" />
          <Typography variant="h6">Incident Transcript Review</Typography>
        </Box>

        {liveGate && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Live gate:
            </Typography>
            <Chip size="small" color={STATUS_COLOR[liveGate.status]} label={liveGate.status.replace(/_/g, ' ')} />
          </Box>
        )}

        {snapshot ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Captured at processing:
              </Typography>
              <Chip size="small" color={STATUS_COLOR[snapshot.status]} label={snapshot.status.replace(/_/g, ' ')} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
              {snapshot.summary}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
              <Chip size="small" variant="outlined" label={`${snapshot.blockingCount} blocking`} />
              <Chip size="small" variant="outlined" label={`${snapshot.warningCount} warnings`} />
              <Chip size="small" variant="outlined" label={`${snapshot.unresolvedWarningCount} unresolved warn`} />
              <Chip size="small" variant="outlined" label={`${snapshot.unresolvedBlockingCount} unresolved block`} />
            </Box>
            {snapshot.signedOffBy && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Signed off by {snapshot.signedOffBy}
                {snapshot.signedOffAt ? ` · ${formatDateTime(snapshot.signedOffAt)}` : ''}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Captured {formatDateTime(snapshot.capturedAt)}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No processing-time snapshot recorded for this incident.
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
          Snapshot records the transcript review state at incident processing time. Live gate may
          reflect later review changes.
        </Typography>
      </CardContent>
    </Card>
  );
}
