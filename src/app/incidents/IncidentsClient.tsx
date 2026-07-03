'use client';

import {
  Box,
  Card,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Typography,
  Button,
  Chip,
  Link as MuiLink,
} from '@mui/material';
import Link from 'next/link';
import { useIncidents, useUnits } from '@/lib/mii/store';
import PageHeader from '@/components/PageHeader';
import { IncidentStatusChip, ZoneChip, ConfidenceChip } from '@/components/StatusChip';
import { formatRelative } from '@/lib/format';
import type { TranscriptReviewGateStatus } from '@/lib/mii/types';

const REVIEW_CHIP_COLOR: Record<
  TranscriptReviewGateStatus,
  'success' | 'warning' | 'error' | 'default'
> = {
  PASS: 'success',
  WARNING: 'warning',
  BLOCKED: 'error',
  NOT_APPLICABLE: 'default',
};

export default function IncidentsClient() {
  const incidents = useIncidents();
  const units = useUnits();

  const sorted = [...incidents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <Box>
      <PageHeader
        title="Incidents"
        subtitle="Active and historical simulated incident contexts"
      />
      <Card>
        <CardContent>
          {sorted.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                No incidents yet.
              </Typography>
              <Button component={Link} href="/" variant="contained">
                Run a scenario
              </Button>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Event #</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Nature</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Zone</TableCell>
                  <TableCell>Units</TableCell>
                  <TableCell>Confidence</TableCell>
                  <TableCell>Transcript Review</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((inc) => {
                  const unitNames = inc.assignedUnits
                    .map((id) => units.find((u) => u.id === id)?.displayName ?? id)
                    .join(', ');
                  return (
                    <TableRow key={inc.id} hover>
                      <TableCell>
                        <MuiLink component={Link} href={`/incidents/${inc.id}`} underline="hover">
                          {inc.eventNumber}
                        </MuiLink>
                      </TableCell>
                      <TableCell>
                        <IncidentStatusChip status={inc.status} />
                      </TableCell>
                      <TableCell>
                        {inc.natureCode ? `${inc.natureCode} — ${inc.naturePlain}` : '—'}
                      </TableCell>
                      <TableCell>
                        {inc.address ?? '—'}
                        {inc.apartment ? `, ${inc.apartment}` : ''}
                      </TableCell>
                      <TableCell>
                        <ZoneChip zone={inc.zone} />
                      </TableCell>
                      <TableCell>{unitNames || '—'}</TableCell>
                      <TableCell>
                        <ConfidenceChip value={inc.confidence} />
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const st = inc.transcriptReviewSnapshot?.status;
                          return (
                            <Chip
                              size="small"
                              variant="outlined"
                              color={st ? REVIEW_CHIP_COLOR[st] : 'default'}
                              label={st ? st.replace(/_/g, ' ') : 'N/A'}
                            />
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {formatRelative(inc.updatedAt)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
