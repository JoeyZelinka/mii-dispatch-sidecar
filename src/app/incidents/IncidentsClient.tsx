'use client';

import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import { Stack } from '@/components/Stack';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PersonIcon from '@mui/icons-material/Person';
import GppMaybeIcon from '@mui/icons-material/GppMaybe';
import Link from 'next/link';
import { useIncidents } from '@/hooks/useIncidents';
import { useSuggestions } from '@/hooks/useSuggestions';
import { useUnits } from '@/hooks/useUnits';
import {
  ConfidenceChip,
  IncidentStatusChip,
  UnitStatusChip,
  ZoneChip,
} from '@/components/Badges';
import { formatRelative } from '@/lib/format';
import type { IncidentStatus } from '@/types/mii';

const STATUS_OPTIONS: { value: IncidentStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'CLOSED', label: 'Closed' },
];

export default function IncidentsClient() {
  const [filter, setFilter] = React.useState<IncidentStatus | 'ALL'>('ALL');
  const incidents = useIncidents(filter === 'ALL' ? undefined : filter);
  const suggestions = useSuggestions();
  const units = useUnits();

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Active Incidents
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click an incident to review AI suggestions and dispatch units.
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <ToggleButtonGroup
          size="small"
          value={filter}
          exclusive
          onChange={(_, v) => v && setFilter(v)}
        >
          {STATUS_OPTIONS.map((o) => (
            <ToggleButton key={o.value} value={o.value} sx={{ px: 1.5 }}>
              {o.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr' },
          gap: 2,
        }}
      >
        {(incidents.data ?? []).map((inc) => {
          const sug = (suggestions.data ?? []).find((s) => s.incidentId === inc.id);
          const top = sug?.fields.reduce<number>(
            (m, f) => Math.max(m, f.confidence),
            0
          );
          const hasVehicle = sug?.fields.some((f) => /plate|vehicle/i.test(f.label));
          const hasSuspect = sug?.fields.some((f) => /suspect/i.test(f.label));
          const hasWeapons = sug?.fields.some(
            (f) => f.category === 'weapons' || /weapon/i.test(f.label)
          );

          return (
            <Card
              key={inc.id}
              component={Link}
              href={`/incidents/${inc.id}`}
              sx={{
                textDecoration: 'none',
                color: 'inherit',
                cursor: 'pointer',
                transition: 'transform 120ms, border-color 120ms',
                '&:hover': {
                  borderColor: 'primary.main',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Chip size="small" color="primary" label={inc.natureCode} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {inc.naturePlain}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <IncidentStatusChip status={inc.status} />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {inc.address}
                  {inc.apt ? ` · ${inc.apt}` : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {inc.eventNumber} · updated {formatRelative(inc.updatedTs)}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
                  <ZoneChip zone={inc.zone} />
                  {top !== undefined && top > 0 && <ConfidenceChip value={top} />}
                  {hasVehicle && (
                    <Tooltip title="Vehicle / plate cue">
                      <DirectionsCarIcon fontSize="small" color="info" />
                    </Tooltip>
                  )}
                  {hasSuspect && (
                    <Tooltip title="Suspect description cue">
                      <PersonIcon fontSize="small" color="warning" />
                    </Tooltip>
                  )}
                  {hasWeapons && (
                    <Tooltip title="Weapon cue">
                      <GppMaybeIcon fontSize="small" color="error" />
                    </Tooltip>
                  )}
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 0.5 }}>
                  {inc.assignedUnits.map((u) => {
                    const unit = (units.data ?? []).find((x) => x.id === u);
                    return (
                      <Stack key={u} direction="row" spacing={0.5} alignItems="center">
                        <Chip size="small" label={u} variant="outlined" />
                        {unit && <UnitStatusChip status={unit.status} />}
                      </Stack>
                    );
                  })}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
        {!incidents.isLoading && (incidents.data ?? []).length === 0 && (
          <Typography color="text.secondary">No incidents match the filter.</Typography>
        )}
      </Box>
    </Stack>
  );
}
