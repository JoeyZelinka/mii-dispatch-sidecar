'use client';

import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Divider,
  Chip,
  LinearProgress,
} from '@mui/material';
import { Stack } from '@/components/Stack';
import Link from 'next/link';
import { useIncidents } from '@/hooks/useIncidents';
import { useUnits } from '@/hooks/useUnits';
import { useSuggestions } from '@/hooks/useSuggestions';
import { useTranscripts } from '@/hooks/useTranscripts';
import {
  IncidentStatusChip,
  SemanticBadge,
  UnitStatusChip,
  ZoneChip,
} from '@/components/Badges';
import { formatRelative } from '@/lib/format';
import type { Zone } from '@/types/mii';
import { ZONES_LIST } from '@/services/store';

const KPI = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) => (
  <Card sx={{ flex: 1, minWidth: 200 }}>
    <CardContent>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 700 }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {hint}
        </Typography>
      )}
    </CardContent>
  </Card>
);

export default function DashboardClient() {
  const incidents = useIncidents();
  const units = useUnits();
  const suggestions = useSuggestions();
  const transcripts = useTranscripts();

  const active = (incidents.data ?? []).filter((i) => i.status === 'ACTIVE');
  const pending = (incidents.data ?? []).filter((i) => i.status === 'PENDING_REVIEW');
  const available = (units.data ?? []).filter((u) => u.status === 'AVAILABLE');
  const pendingSugs = (suggestions.data ?? []).filter((s) => s.state === 'PENDING');

  const unitsByZone = (units.data ?? []).reduce<Record<Zone, number>>(
    (acc, u) => {
      acc[u.zone] = (acc[u.zone] ?? 0) + 1;
      return acc;
    },
    { North: 0, Center: 0, South: 0, Beach: 0, AtLarge: 0 }
  );

  const recentlyUpdatedIds = new Set(
    (incidents.data ?? [])
      .filter((i) => i.status !== 'CLOSED')
      .slice(0, 3)
      .map((i) => i.id)
  );

  const liveFeed = (transcripts.data ?? []).slice(0, 8);

  return (
    <Stack spacing={3}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Dispatcher Overview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time view of incidents, units, suggestions, and the live radio feed.
          </Typography>
        </Box>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <KPI
          label="Active Incidents"
          value={active.length}
          hint={`${pending.length} pending review`}
        />
        <KPI
          label="Available Units"
          value={available.length}
          hint={`${(units.data ?? []).length} total on roster`}
        />
        <KPI
          label="Pending Suggestions"
          value={pendingSugs.length}
          hint="Awaiting dispatcher approval"
        />
        <KPI label="Avg Suggestion Time" value="3.4s" hint="Across last 50 events" />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Zone Coverage
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {ZONES_LIST.map((z) => {
                const total = unitsByZone[z];
                const avail = (units.data ?? []).filter(
                  (u) => u.zone === z && u.status === 'AVAILABLE'
                ).length;
                const pct = total ? Math.round((avail / total) * 100) : 0;
                return (
                  <Box key={z}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <ZoneChip zone={z} />
                      <Typography variant="body2" color="text.secondary">
                        {avail}/{total} available
                      </Typography>
                      <Box sx={{ flexGrow: 1 }} />
                      <Typography variant="caption" color="text.secondary">
                        {pct}%
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                    />
                  </Box>
                );
              })}
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ flex: 2 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="overline" color="text.secondary">
                Live Radio Feed
              </Typography>
              <Chip size="small" color="success" label="LIVE" sx={{ ml: 1 }} />
            </Stack>
            <Divider sx={{ my: 1.5 }} />
            <Stack spacing={1.25}>
              {liveFeed.map((t) => (
                <Box key={t.id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ width: 70 }}>
                      {formatRelative(t.ts)}
                    </Typography>
                    <Chip size="small" variant="outlined" label={t.speaker} />
                    <SemanticBadge type={t.semanticType} />
                    {t.codesDetected.map((c) => (
                      <Chip key={c} size="small" label={c} color="primary" variant="outlined" />
                    ))}
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 0.25, ml: 9 }}>
                    {t.text}
                  </Typography>
                  {t.plainTalk && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 9, fontStyle: 'italic' }}
                    >
                      → {t.plainTalk}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="overline" color="text.secondary">
              Active Incidents — Quick View
            </Typography>
          </Stack>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1.25}>
            {(incidents.data ?? [])
              .filter((i) => i.status !== 'CLOSED')
              .slice(0, 6)
              .map((i) => {
                const recently = recentlyUpdatedIds.has(i.id);
                return (
                  <Box
                    key={i.id}
                    component={Link}
                    href={`/incidents/${i.id}`}
                    sx={{
                      display: 'block',
                      textDecoration: 'none',
                      color: 'inherit',
                      p: 1.5,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'background-color 120ms',
                      '&:hover': { backgroundColor: 'rgba(78,161,255,0.08)' },
                      position: 'relative',
                      ...(recently && {
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 3,
                          borderRadius: '4px 0 0 4px',
                          backgroundColor: 'primary.main',
                          animation: 'pulse 2s ease-in-out infinite',
                        },
                        '@keyframes pulse': {
                          '0%, 100%': { opacity: 0.4 },
                          '50%': { opacity: 1 },
                        },
                      }),
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={i.natureCode} color="primary" />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {i.naturePlain}
                      </Typography>
                      <ZoneChip zone={i.zone} />
                      <IncidentStatusChip status={i.status} />
                      <Box sx={{ flexGrow: 1 }} />
                      <Typography variant="caption" color="text.secondary">
                        {formatRelative(i.updatedTs)}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {i.address}
                      {i.apt ? ` · ${i.apt}` : ''} · {i.eventNumber}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
                      {i.assignedUnits.map((u) => {
                        const unit = (units.data ?? []).find((x) => x.id === u);
                        return (
                          <Stack key={u} direction="row" spacing={0.5} alignItems="center">
                            <Chip size="small" label={u} variant="outlined" />
                            {unit && <UnitStatusChip status={unit.status} />}
                          </Stack>
                        );
                      })}
                    </Stack>
                  </Box>
                );
              })}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
