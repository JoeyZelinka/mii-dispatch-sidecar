'use client';

import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Drawer,
  TextField,
  Typography,
  Divider,
  Button,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  IconButton,
} from '@mui/material';
import { Stack } from '@/components/Stack';
import CloseIcon from '@mui/icons-material/Close';
import { useUnits, useUnitsSearch, useUpdateUnitStatus } from '@/hooks/useUnits';
import { useIncidents } from '@/hooks/useIncidents';
import { useAudit } from '@/hooks/useAudit';
import { UnitStatusChip, ZoneChip } from '@/components/Badges';
import { formatRelative } from '@/lib/format';
import type { Unit, UnitStatus, Zone } from '@/types/mii';
import { ZONES_LIST } from '@/services/store';

const STATUSES: UnitStatus[] = [
  'AVAILABLE',
  'BUSY',
  'EN_ROUTE',
  'ARRIVED',
  'OUT_OF_SERVICE',
  'TRVL',
  'OFF_DUTY',
];

const ACTOR = 'D. Rivera';

export default function UnitsClient() {
  const [q, setQ] = React.useState('');
  const allUnits = useUnits();
  const search = useUnitsSearch(q);
  const incidents = useIncidents();
  const audit = useAudit();
  const updateStatus = useUpdateUnitStatus();

  const [selected, setSelected] = React.useState<Unit | null>(null);
  const [draftStatus, setDraftStatus] = React.useState<UnitStatus>('AVAILABLE');

  const list = q ? (search.data ?? []) : (allUnits.data ?? []);

  const byZone = list.reduce<Record<Zone, Unit[]>>(
    (acc, u) => {
      (acc[u.zone] = acc[u.zone] ?? []).push(u);
      return acc;
    },
    { North: [], Center: [], South: [], Beach: [], AtLarge: [] }
  );

  const incidentFor = (id?: string) =>
    id ? (incidents.data ?? []).find((i) => i.id === id) : undefined;

  const unitHistory = (unit: Unit) =>
    (audit.data ?? []).filter(
      (a) =>
        (a.before as { unit?: string })?.unit === unit.id ||
        (a.after as { unit?: string; assigned?: string })?.unit === unit.id ||
        (a.after as { assigned?: string })?.assigned === unit.id
    );

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Unit Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Status board grouped by zone. Click a unit for history and quick status change.
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <TextField
          size="small"
          placeholder="Search unit # or officer"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ width: 280 }}
        />
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(5, 1fr)' },
          gap: 2,
        }}
      >
        {ZONES_LIST.map((z) => (
          <Card key={z}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <ZoneChip zone={z} />
                <Typography variant="caption" color="text.secondary">
                  {byZone[z].length} units
                </Typography>
              </Stack>
              <Divider sx={{ my: 1.5 }} />
              <Stack spacing={1}>
                {byZone[z].length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No units.
                  </Typography>
                )}
                {byZone[z].map((u) => {
                  const inc = incidentFor(u.currentIncidentId);
                  return (
                    <Box
                      key={u.id}
                      onClick={() => {
                        setSelected(u);
                        setDraftStatus(u.status);
                      }}
                      sx={{
                        p: 1.25,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        cursor: 'pointer',
                        '&:hover': { borderColor: 'primary.main' },
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip size="small" label={u.id} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {u.officerName}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, alignItems: 'center' }}>
                        <UnitStatusChip status={u.status} />
                        <Typography variant="caption" color="text.secondary">
                          {formatRelative(u.lastUpdateTs)}
                        </Typography>
                      </Stack>
                      {inc && (
                        <Typography variant="caption" color="primary.light" sx={{ display: 'block', mt: 0.5 }}>
                          On {inc.eventNumber} · {inc.naturePlain}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Drawer
        anchor="right"
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 420 } } } }}
      >
        {selected && (
          <Box sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Chip size="small" label={selected.id} />
              <Typography variant="h6">{selected.officerName}</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton size="small" onClick={() => setSelected(null)}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <ZoneChip zone={selected.zone} />
              <UnitStatusChip status={selected.status} />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Last update: {formatRelative(selected.lastUpdateTs)}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography variant="overline" color="text.secondary">
              Quick Status Change
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value as UnitStatus)}
                >
                  {STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s.replace('_', ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                disabled={updateStatus.isPending || draftStatus === selected.status}
                onClick={() =>
                  updateStatus.mutate(
                    { id: selected.id, status: draftStatus, actor: ACTOR },
                    {
                      onSuccess: (u) => setSelected(u),
                    }
                  )
                }
              >
                Apply
              </Button>
            </Stack>

            <Divider sx={{ my: 2 }} />
            <Typography variant="overline" color="text.secondary">
              Recent History
            </Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {unitHistory(selected).length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No audit entries yet.
                </Typography>
              )}
              {unitHistory(selected)
                .slice(0, 8)
                .map((a) => (
                  <Box key={a.id} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={a.actionType} />
                      <Typography variant="caption" color="text.secondary">
                        {formatRelative(a.ts)} · {a.actor}
                      </Typography>
                    </Stack>
                    {a.incidentId && a.incidentId !== '-' && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        Incident: {a.incidentId}
                      </Typography>
                    )}
                  </Box>
                ))}
            </Stack>
          </Box>
        )}
      </Drawer>
    </Stack>
  );
}
