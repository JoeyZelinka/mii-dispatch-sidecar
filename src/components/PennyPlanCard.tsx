'use client';

import { Card, CardContent, Typography, Box, Chip, Divider, Alert } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import type {
  PennyTranscriptPackage,
  PennyTranscriptionPlan,
  TranscriptQualityIssueSeverity,
} from '@/lib/mii/types';
import { formatDateTime } from '@/lib/format';
import { getAsrProviderDefinition } from '@/lib/mii/asr/providerRegistry';

const STATUS_COLOR: Record<
  PennyTranscriptionPlan['status'],
  'default' | 'info' | 'primary' | 'success' | 'error' | 'warning' | 'secondary'
> = {
  DRAFT: 'default',
  ASR_JOB_REQUESTED: 'info',
  ASR_JOB_RUNNING: 'info',
  ASR_COMPLETED: 'primary',
  REVIEW_READY: 'primary',
  READY_FOR_ATTACHMENT: 'success',
  NEEDS_REVIEW: 'warning',
  ATTACHED: 'secondary',
  FAILED: 'error',
  CANCELLED: 'warning',
};

const SEVERITY_COLOR: Record<TranscriptQualityIssueSeverity, 'default' | 'warning' | 'error'> = {
  INFO: 'default',
  WARNING: 'warning',
  BLOCKING: 'error',
};

export default function PennyPlanCard({
  plan,
  pkg,
  filename,
  compact = false,
  children,
}: {
  plan: PennyTranscriptionPlan;
  pkg?: PennyTranscriptPackage;
  filename?: string;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const providerDef = getAsrProviderDefinition(plan.provider);
  const ids: [string, string | undefined][] = [
    ['job', plan.asrJobId],
    ['result', plan.asrResultId],
    ['package', plan.transcriptPackageId],
    ['attachment', plan.attachmentId],
  ];

  return (
    <Card variant="outlined" sx={{ borderColor: 'primary.main' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
          <SmartToyIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
            P.E.N.N.Y. Transcription Orchestrator
          </Typography>
          <Chip size="small" color={STATUS_COLOR[plan.status]} label={plan.status.replace(/_/g, ' ')} />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Provenance Engine for Normalized Narrative Yield
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
          <Chip size="small" variant="outlined" label={providerDef.label} />
          {filename && <Chip size="small" variant="outlined" label={filename} />}
          {plan.scenarioId && <Chip size="small" variant="outlined" label={`scenario: ${plan.scenarioId}`} />}
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 0.5 }}>
          {ids
            .filter(([, v]) => Boolean(v))
            .map(([label, v]) => (
              <Typography key={label} variant="caption" color="text.secondary">
                {label}: {v}
              </Typography>
            ))}
        </Box>

        {pkg && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 0.5 }}>
              <Chip
                size="small"
                color={pkg.readyForAttachment ? 'success' : 'warning'}
                label={pkg.readyForAttachment ? 'Ready for attachment' : 'Needs review'}
              />
              <Chip size="small" variant="outlined" label={`${pkg.segmentCount} segments`} />
              {pkg.averageConfidence != null && (
                <Chip size="small" variant="outlined" label={`avg ${Math.round(pkg.averageConfidence * 100)}%`} />
              )}
              {pkg.lowestConfidence != null && (
                <Chip size="small" variant="outlined" label={`min ${Math.round(pkg.lowestConfidence * 100)}%`} />
              )}
            </Box>
            {pkg.qualityIssues.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
                {pkg.qualityIssues.map((iss) => (
                  <Box key={iss.id} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                    <Chip size="small" color={SEVERITY_COLOR[iss.severity]} variant="outlined" label={iss.severity} />
                    <Typography variant="caption" sx={{ flexGrow: 1 }}>
                      {iss.summary}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}

        {!compact && plan.decisions.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="overline" color="text.secondary">
              Decisions
            </Typography>
            {plan.decisions.map((d) => (
              <Box key={d.id} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                <Chip size="small" variant="outlined" label={d.type.replace(/_/g, ' ')} />
                <Typography variant="caption" sx={{ flexGrow: 1 }}>
                  {d.summary}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(d.createdAt)}
                </Typography>
              </Box>
            ))}
          </>
        )}

        <Alert severity="info" icon={false} sx={{ mt: 1, py: 0.25 }}>
          PENNY coordinates transcription readiness only. It does not perform real ASR, create
          incidents, or write CAD.
        </Alert>

        {children && <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>{children}</Box>}
      </CardContent>
    </Card>
  );
}
