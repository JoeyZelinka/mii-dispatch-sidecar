'use client';

import * as React from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Chip } from '@mui/material';
import { useAudit } from '@/lib/mii/store';
import PageHeader from '@/components/PageHeader';
import AuditTimeline from '@/components/AuditTimeline';

export default function AuditClient() {
  const audit = useAudit();
  const [order, setOrder] = React.useState<'newest' | 'oldest'>('newest');

  const events = React.useMemo(() => {
    const copy = [...audit];
    return order === 'newest' ? copy.reverse() : copy;
  }, [audit, order]);

  return (
    <Box>
      <PageHeader
        title="Audit Log"
        subtitle="Chronological, defensible record of every meaningful action. Correlation IDs group one processing run."
        action={
          <ToggleButtonGroup
            size="small"
            exclusive
            value={order}
            onChange={(_, v) => v && setOrder(v)}
          >
            <ToggleButton value="newest">Newest first</ToggleButton>
            <ToggleButton value="oldest">Oldest first</ToggleButton>
          </ToggleButtonGroup>
        }
      />
      <Box sx={{ mb: 2 }}>
        <Chip variant="outlined" label={`${audit.length} total events`} />
      </Box>
      <AuditTimeline events={events} title="System Audit Log" />
    </Box>
  );
}
