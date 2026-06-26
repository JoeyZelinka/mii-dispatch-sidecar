'use client';

import * as React from 'react';
import { Box, Typography, Button, Chip, Alert, Snackbar } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Link from 'next/link';
import {
  miiStore,
  useIncident,
  useUnits,
  useAllRecommendations,
  useAudit,
  useTranscriptLines,
  useMockCadPayload,
} from '@/lib/mii/store';
import { IncidentStatusChip, ConfidenceChip } from '@/components/StatusChip';
import IncidentContextBundleCard from '@/components/IncidentContextBundleCard';
import SuggestedFieldsCard from '@/components/SuggestedFieldsCard';
import TranscriptTimeline from '@/components/TranscriptTimeline';
import AuditTimeline from '@/components/AuditTimeline';
import UnitRecommendationCard from '@/components/UnitRecommendationCard';
import HumanReviewActions from '@/components/HumanReviewActions';
import MockCadPayloadCard from '@/components/MockCadPayloadCard';
import SafetyGatesCard from '@/components/SafetyGatesCard';
import ConflictResolutionCard from '@/components/ConflictResolutionCard';
import { submitBlockReasons, hasUnconfirmedSensitive } from '@/lib/mii/safetyGates';

export default function IncidentDetailClient({ id }: { id: string }) {
  const incident = useIncident(id);
  const units = useUnits();
  const allRecs = useAllRecommendations();
  const audit = useAudit();
  const allLines = useTranscriptLines();
  const payload = useMockCadPayload(id);
  const [toast, setToast] = React.useState<string | null>(null);

  if (!incident) {
    return (
      <Box>
        <Button component={Link} href="/incidents" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
          Back to incidents
        </Button>
        <Alert severity="warning">
          Incident not found. It may have been cleared by “Reset Demo Data”.
        </Alert>
      </Box>
    );
  }

  const recommendations = allRecs.filter((r) => r.incidentId === id);
  const incidentLines = allLines.filter((l) => incident.transcriptLineIds.includes(l.id));
  const incidentAudit = audit.filter((e) => e.incidentId === id);
  const unconfirmedSensitive = hasUnconfirmedSensitive(incident);
  const blockReasons = submitBlockReasons(incident);

  const handleSubmitCad = () => {
    miiStore.submitMockCad(id, { includeSensitive: true });
    setToast('MOCK CAD payload built (NOT SENT). No external system was contacted.');
  };

  return (
    <Box>
      <Button component={Link} href="/incidents" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
        Back to incidents
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {incident.eventNumber}
        </Typography>
        <IncidentStatusChip status={incident.status} />
        <Chip variant="outlined" label={incident.agency} />
        <ConfidenceChip value={incident.confidence} />
        <Chip size="small" color="warning" variant="outlined" label="Simulated Data Only" />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.6fr 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        {/* Main column */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <ConflictResolutionCard
            incident={incident}
            lines={allLines}
            onResolve={(conflictId, selected) =>
              miiStore.resolveFieldConflict(id, conflictId, selected)
            }
          />
          <IncidentContextBundleCard incident={incident} units={units} />
          <SuggestedFieldsCard
            fields={incident.suggestedFields}
            onReject={(fid) => miiStore.rejectField(id, fid)}
            onConfirmSensitive={(fid) => miiStore.confirmSensitiveField(id, fid)}
          />
          <TranscriptTimeline lines={incidentLines} />
          <AuditTimeline events={incidentAudit} title="Incident Audit Timeline" />
        </Box>

        {/* Right column */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <UnitRecommendationCard
            incident={incident}
            recommendations={recommendations}
            units={units}
            onAssign={(unitId) => miiStore.assignUnit(id, unitId)}
          />
          <SafetyGatesCard incident={incident} units={units} payload={payload} />
          <HumanReviewActions
            incident={incident}
            blockReasons={blockReasons}
            hasUnconfirmedSensitive={unconfirmedSensitive}
            onConfirmAsr={() => miiStore.confirmAsr(id)}
            onApplyFields={() => miiStore.applySuggestedFields(id)}
            onSubmitCad={handleSubmitCad}
            onClose={() => miiStore.closeIncident(id)}
          />
          <MockCadPayloadCard payload={payload} hasUnconfirmedSensitive={unconfirmedSensitive} />
        </Box>
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
