'use client';

import { Card, CardContent, Typography, Box, Divider, Chip } from '@mui/material';
import type { IncidentContext, Unit } from '@/lib/mii/types';
import { IncidentStatusChip, ZoneChip } from './StatusChip';
import ConfidenceBar from './ConfidenceBar';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
        {label}
      </Typography>
      <Box sx={{ flexGrow: 1 }}>
        {typeof value === 'string' ? <Typography variant="body2">{value}</Typography> : value}
      </Box>
    </Box>
  );
}

export default function IncidentContextBundleCard({
  incident,
  units,
}: {
  incident: IncidentContext;
  units: Unit[];
}) {
  const assigned = incident.assignedUnits
    .map((id) => units.find((u) => u.id === id)?.displayName ?? id)
    .join(', ');

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Incident Context Bundle
          </Typography>
          <IncidentStatusChip status={incident.status} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {incident.currentSummary}
        </Typography>
        <Divider sx={{ mb: 1 }} />
        <Row label="Event Number" value={incident.eventNumber} />
        <Row label="Agency / Tenant" value={`${incident.agency} — ${incident.tenant}`} />
        <Row
          label="Nature"
          value={
            incident.natureCode
              ? `${incident.natureCode} — ${incident.naturePlain ?? ''}`
              : 'Unknown'
          }
        />
        <Row label="Address" value={incident.address ?? '—'} />
        <Row label="Apartment" value={incident.apartment ?? '—'} />
        <Row label="Zone" value={<ZoneChip zone={incident.zone} />} />
        <Row
          label="Assigned Units"
          value={assigned || <Chip size="small" variant="outlined" label="None assigned" />}
        />
        <Row
          label="ASR Confirmed"
          value={
            <Chip
              size="small"
              color={incident.asrConfirmed ? 'success' : 'warning'}
              variant={incident.asrConfirmed ? 'filled' : 'outlined'}
              label={incident.asrConfirmed ? 'Confirmed' : 'Pending'}
            />
          }
        />
        <Row label="Confidence" value={<ConfidenceBar value={incident.confidence} width={200} />} />
      </CardContent>
    </Card>
  );
}
