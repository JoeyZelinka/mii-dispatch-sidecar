'use client';

import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import type { Unit, Zone } from '@/lib/mii/types';
import { UnitStatusChip } from './StatusChip';

const ZONE_ORDER: Zone[] = ['North', 'Center', 'South', 'Beach', 'AtLarge', 'Unknown'];

function UnitCard({ unit }: { unit: Unit }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 220 }}>
      <CardContent sx={{ pb: '12px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" sx={{ flexGrow: 1, fontWeight: 600 }}>
            {unit.displayName}
          </Typography>
          {unit.isAtLarge && <Chip size="small" label="At-Large" variant="outlined" />}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {unit.officerName}
        </Typography>
        <UnitStatusChip status={unit.status} />
      </CardContent>
    </Card>
  );
}

export default function UnitBoard({ units }: { units: Unit[] }) {
  const grouped = ZONE_ORDER.map((zone) => ({
    zone,
    units: units.filter((u) => u.zone === zone),
  })).filter((g) => g.units.length > 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {grouped.map((group) => (
        <Box key={group.zone}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="overline" sx={{ letterSpacing: 1.2 }}>
              {group.zone} Zone
            </Typography>
            <Chip size="small" variant="outlined" label={`${group.units.length} units`} />
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {group.units.map((u) => (
              <UnitCard key={u.id} unit={u} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
