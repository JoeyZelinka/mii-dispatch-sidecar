'use client';

import { Box, Alert } from '@mui/material';
import { useUnits } from '@/lib/mii/store';
import PageHeader from '@/components/PageHeader';
import UnitBoard from '@/components/UnitBoard';

export default function UnitsClient() {
  const units = useUnits();
  return (
    <Box>
      <PageHeader
        title="Units"
        subtitle="Unit availability board, grouped by zone"
      />
      <Alert severity="info" sx={{ mb: 2 }}>
        Unit states update as scenarios run (e.g. en route / arrival / out of service cues) and when
        you assign units on an incident.
      </Alert>
      <UnitBoard units={units} />
    </Box>
  );
}
