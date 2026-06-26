'use client';

import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Alert,
  Divider,
  Snackbar,
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SCENARIOS } from '@/lib/mii/seed';
import { miiStore, useIncidents, useAudit, useUnits } from '@/lib/mii/store';
import ScenarioCard from '@/components/ScenarioCard';
import PageHeader from '@/components/PageHeader';
import { IncidentStatusChip, ZoneChip } from '@/components/StatusChip';
import AuditTimeline from '@/components/AuditTimeline';
import { formatRelative } from '@/lib/format';

export default function DashboardClient() {
  const incidents = useIncidents();
  const audit = useAudit();
  const units = useUnits();
  const router = useRouter();
  const [toast, setToast] = React.useState<string | null>(null);

  const runScenario = (id: string) => {
    const { incidentId } = miiStore.runScenario(id);
    if (incidentId) {
      router.push(`/incidents/${incidentId}`);
    } else {
      setToast('Admin chatter processed — no incident created (see Audit Log).');
    }
  };

  const recentIncidents = [...incidents]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const recentAudit = [...audit].slice(-6).reverse();

  return (
    <Box>
      <PageHeader
        title="MII_lite"
        subtitle="Local transcript-first Municipal Incident Intelligence POC"
      />

      <Alert severity="info" sx={{ mb: 3 }}>
        This is a local proof of concept. It uses <b>seeded simulated transcripts only</b> — no real
        radio, CAD, police systems, or external agencies. All logic is deterministic and explainable;
        no AI/LLM calls are made.
      </Alert>

      <Typography variant="overline" color="text.secondary">
        Run a seeded scenario
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 2,
          mt: 1,
          mb: 4,
        }}
      >
        {SCENARIOS.map((s) => (
          <ScenarioCard key={s.id} scenario={s} onRun={runScenario} />
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gap: 2,
        }}
      >
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                Recent Incidents
              </Typography>
              <Button component={Link} href="/incidents" size="small">
                View all
              </Button>
            </Box>
            {recentIncidents.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No incidents yet. Run a scenario above.
              </Typography>
            )}
            {recentIncidents.map((inc, idx) => (
              <Box key={inc.id}>
                {idx > 0 && <Divider sx={{ my: 1 }} />}
                <Box
                  component={Link}
                  href={`/incidents/${inc.id}`}
                  sx={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {inc.eventNumber}
                    </Typography>
                    <IncidentStatusChip status={inc.status} />
                    <ZoneChip zone={inc.zone} />
                    <Box sx={{ flexGrow: 1 }} />
                    <Typography variant="caption" color="text.secondary">
                      {formatRelative(inc.updatedAt)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {inc.currentSummary}
                  </Typography>
                  {inc.assignedUnits.length > 0 && (
                    <Typography variant="caption" color="success.main">
                      Responding:{' '}
                      {inc.assignedUnits
                        .map((id) => units.find((u) => u.id === id)?.displayName ?? id)
                        .join(', ')}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </CardContent>
        </Card>

        <Box>
          <AuditTimeline events={recentAudit} title="Recent Audit Activity" />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <Button component={Link} href="/audit" size="small">
              Full audit log
            </Button>
          </Box>
        </Box>
      </Box>

      <Box sx={{ mt: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip label={`${incidents.length} incidents`} variant="outlined" />
        <Chip label={`${audit.length} audit events`} variant="outlined" />
      </Box>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
