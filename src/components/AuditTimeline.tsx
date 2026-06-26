'use client';

import { Card, CardContent, Typography, Box, Divider, Chip, Tooltip } from '@mui/material';
import type { AuditAction, AuditEvent } from '@/lib/mii/types';
import { formatDateTime } from '@/lib/format';

const actionColor: Partial<Record<AuditAction, 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary'>> = {
  SCENARIO_STARTED: 'primary',
  TRANSCRIPT_PROCESSED: 'default',
  CUE_DETECTED: 'info',
  INCIDENT_CREATED: 'error',
  INCIDENT_UPDATED: 'info',
  CONFIRMATION_APPLIED: 'success',
  FIELDS_APPLIED: 'success',
  UNIT_RECOMMENDED: 'secondary',
  UNIT_ASSIGNED: 'primary',
  MOCK_CAD_SUBMITTED: 'warning',
  FIELD_REJECTED: 'warning',
  CONFLICT_RAISED: 'error',
  CONFLICT_RESOLVED: 'success',
};

export default function AuditTimeline({
  events,
  title = 'Audit Timeline',
  showCorrelation = true,
}: {
  events: AuditEvent[];
  title?: string;
  showCorrelation?: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          {title}
        </Typography>
        {events.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No audit events.
          </Typography>
        )}
        {events.map((e, idx) => (
          <Box key={e.id}>
            {idx > 0 && <Divider sx={{ my: 1 }} />}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                color={actionColor[e.action] ?? 'default'}
                label={e.action.replace(/_/g, ' ')}
                variant={e.action === 'TRANSCRIPT_PROCESSED' ? 'outlined' : 'filled'}
              />
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(e.timestamp)}
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Typography variant="caption" color="text.secondary">
                {e.actor}
              </Typography>
              {showCorrelation && (
                <Tooltip title="Correlation ID (groups one processing run)">
                  <Chip size="small" variant="outlined" label={e.correlationId} />
                </Tooltip>
              )}
            </Box>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {e.summary}
            </Typography>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}
