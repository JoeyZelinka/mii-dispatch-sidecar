'use client';

import { Card, CardContent, Typography, Box, Chip, Divider, Alert } from '@mui/material';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import type {
  AsrJob,
  AsrTranscriptResult,
  AudioAsset,
  AudioTranscriptAttachment,
} from '@/lib/mii/types';
import type {
  IncidentContext,
  PennyTranscriptPackage,
  PennyTranscriptionPlan,
} from '@/lib/mii/types';
import { formatDateTime } from '@/lib/format';
import { formatBytes } from './AudioAssetCard';
import { averageConfidence } from './AsrResultCard';
import AudioTimelineCard from './AudioTimelineCard';
import { getAsrProviderDefinition } from '@/lib/mii/asr/providerRegistry';

const SOURCE_LABEL: Record<AudioAsset['sourceType'], string> = {
  SIMULATED_UPLOAD: 'Simulated Upload',
  AUTHORIZED_RECORDING: 'Authorized Recording',
  SYNTHETIC_TTS: 'Synthetic TTS',
  MANUAL_PLACEHOLDER: 'Manual Placeholder',
};

// Resolve the ASR result behind an attachment: prefer the explicit link, then
// an exact transcript match on the same asset, then the nearest completed result.
function resolveAsrResult(
  attachment: AudioTranscriptAttachment,
  asrResults: AsrTranscriptResult[]
): AsrTranscriptResult | undefined {
  if (attachment.asrResultId) {
    const linked = asrResults.find((r) => r.id === attachment.asrResultId);
    if (linked) return linked;
  }
  const sameAsset = asrResults.filter(
    (r) => r.audioAssetId === attachment.audioAssetId && r.status === 'COMPLETED'
  );
  return (
    sameAsset.find((r) => r.transcriptText === attachment.transcriptText) ?? sameAsset[0]
  );
}

export default function AudioProvenanceCard({
  attachments,
  assets,
  asrResults = [],
  asrJobs = [],
  pennyPlans = [],
  pennyPackages = [],
  incident,
}: {
  attachments: AudioTranscriptAttachment[];
  assets: AudioAsset[];
  asrResults?: AsrTranscriptResult[];
  asrJobs?: AsrJob[];
  pennyPlans?: PennyTranscriptionPlan[];
  pennyPackages?: PennyTranscriptPackage[];
  incident?: IncidentContext;
}) {
  if (attachments.length === 0) return null;

  return (
    <Card variant="outlined" sx={{ borderColor: 'secondary.main' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <GraphicEqIcon color="secondary" fontSize="small" />
          <Typography variant="h6">Audio Provenance</Typography>
        </Box>

        <Alert severity="info" icon={false} sx={{ mb: 1.5, py: 0.5 }}>
          Transcript-first processing: the attached transcript drove this incident. ASR is not
          enabled in Phase 2A.
        </Alert>

        {attachments.map((att, idx) => {
          const asset = assets.find((a) => a.id === att.audioAssetId);
          const asr = resolveAsrResult(att, asrResults);
          const job = asr ? asrJobs.find((j) => j.resultId === asr.id) : undefined;
          const pennyPlan = pennyPlans.find((p) => p.attachmentId === att.id);
          const pennyPkg = pennyPlan?.transcriptPackageId
            ? pennyPackages.find((p) => p.id === pennyPlan.transcriptPackageId)
            : undefined;
          const latestDecision = pennyPlan?.decisions[pennyPlan.decisions.length - 1];
          return (
            <Box key={att.id}>
              {idx > 0 && <Divider sx={{ my: 1.5 }} />}
              <Typography variant="subtitle2" sx={{ wordBreak: 'break-all' }}>
                {asset?.filename ?? att.audioAssetId}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, my: 1 }}>
                {asset && <Chip size="small" variant="outlined" label={SOURCE_LABEL[asset.sourceType]} />}
                {asset && (
                  <Chip size="small" variant="outlined" label={asset.status.replace(/_/g, ' ')} />
                )}
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${att.transcriptLineIds.length} transcript line${att.transcriptLineIds.length === 1 ? '' : 's'}`}
                />
                {asset && asset.sizeBytes > 0 && (
                  <Chip size="small" variant="outlined" label={formatBytes(asset.sizeBytes)} />
                )}
              </Box>

              {att.processedAt && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Processed {formatDateTime(att.processedAt)}
                </Typography>
              )}
              {asset?.notes && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Notes / provenance: {asset.notes}
                </Typography>
              )}

              {asr && (
                <Box
                  sx={{
                    mt: 1,
                    p: 1,
                    borderRadius: 1,
                    border: '1px solid rgba(78,161,255,0.3)',
                    background: 'rgba(78,161,255,0.06)',
                  }}
                >
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 0.5 }}>
                    <Chip size="small" color="info" variant="outlined" label={`ASR Provider: ${asr.provider}`} />
                    <Chip size="small" color="info" variant="outlined" label={`ASR Status: ${asr.status}`} />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${asr.segments.length} segment${asr.segments.length === 1 ? '' : 's'}`}
                    />
                    {asr.segments.length > 0 && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`avg conf ${Math.round(averageConfidence(asr) * 100)}%`}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Mock ASR only — no real audio transcription occurred.
                  </Typography>
                </Box>
              )}

              {job && (
                <Box
                  sx={{
                    mt: 1,
                    p: 1,
                    borderRadius: 1,
                    border: '1px solid rgba(206,147,216,0.3)',
                    background: 'rgba(206,147,216,0.06)',
                  }}
                >
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 0.5 }}>
                    <Chip
                      size="small"
                      color="secondary"
                      variant="outlined"
                      label={`ASR Job: ${getAsrProviderDefinition(job.provider).label}`}
                    />
                    <Chip size="small" color="secondary" variant="outlined" label={`Status: ${job.status}`} />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${job.events.length} event${job.events.length === 1 ? '' : 's'}`}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Requested {formatDateTime(job.requestedAt)}
                    {job.completedAt
                      ? ` · Completed ${formatDateTime(job.completedAt)}`
                      : job.failedAt
                        ? ` · Failed ${formatDateTime(job.failedAt)}`
                        : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ASR job lifecycle was simulated locally. No real transcription or external
                    service was used.
                  </Typography>
                </Box>
              )}

              {pennyPlan && (
                <Box
                  sx={{
                    mt: 1,
                    p: 1,
                    borderRadius: 1,
                    border: '1px solid rgba(78,161,255,0.3)',
                    background: 'rgba(78,161,255,0.06)',
                  }}
                >
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 0.5 }}>
                    <Chip size="small" color="primary" variant="outlined" label="P.E.N.N.Y. Review" />
                    <Chip size="small" color="primary" variant="outlined" label={pennyPlan.status.replace(/_/g, ' ')} />
                    {pennyPkg && (
                      <Chip
                        size="small"
                        color={pennyPkg.readyForAttachment ? 'success' : 'warning'}
                        variant="outlined"
                        label={pennyPkg.readyForAttachment ? 'ready' : 'needs review'}
                      />
                    )}
                    {pennyPkg && (
                      <Chip size="small" variant="outlined" label={`${pennyPkg.segmentCount} segments`} />
                    )}
                    {pennyPkg?.averageConfidence != null && (
                      <Chip size="small" variant="outlined" label={`avg ${Math.round(pennyPkg.averageConfidence * 100)}%`} />
                    )}
                    {pennyPkg?.lowestConfidence != null && (
                      <Chip size="small" variant="outlined" label={`min ${Math.round(pennyPkg.lowestConfidence * 100)}%`} />
                    )}
                    {pennyPkg && (
                      <Chip size="small" variant="outlined" label={`${pennyPkg.qualityIssues.length} quality notes`} />
                    )}
                  </Box>
                  {latestDecision && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Latest decision: {latestDecision.summary}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    PENNY coordinated transcription readiness only. The existing MII pipeline created
                    the incident context from the attached transcript.
                  </Typography>
                </Box>
              )}

              {asset?.objectUrl && (
                <Box sx={{ mt: 1 }}>
                  {/* Session-local blob preview only; never uploaded. */}
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={asset.objectUrl} style={{ width: '100%' }} />
                </Box>
              )}

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Audio preview is session-local and may not survive refresh. Transcript and audit
                provenance remain available.
              </Typography>

              <Box sx={{ mt: 1.5 }}>
                <AudioTimelineCard
                  asset={asset}
                  asrResult={asr}
                  attachment={att}
                  incident={incident}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  This timeline shows demo provenance from local audio metadata, ASR-shaped segments,
                  and transcript-derived incident fields. No real ASR or external service was used.
                </Typography>
              </Box>
            </Box>
          );
        })}
      </CardContent>
    </Card>
  );
}
