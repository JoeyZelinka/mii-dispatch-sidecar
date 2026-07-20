'use client';

import { Card, CardContent, Typography, Box, Chip, Divider } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import type {
  AsrTranscriptResult,
  AudioAsset,
  AudioTimelineMarker,
  AudioTranscriptAttachment,
  IncidentContext,
} from '@/lib/mii/types';
import {
  createDeterministicWaveform,
  estimateDurationFromSegments,
  fieldProvenanceToTimelineMarkers,
  segmentsToTimelineMarkers,
  transcriptAttachmentToMarkers,
} from '@/lib/mii/audioTimeline';

const KIND_COLOR: Record<AudioTimelineMarker['kind'], 'info' | 'secondary' | 'success' | 'default'> = {
  ASR_SEGMENT: 'info',
  TRANSCRIPT_LINE: 'secondary',
  INCIDENT_FIELD: 'success',
  SYSTEM: 'default',
};

function fmtRange(m: AudioTimelineMarker): string {
  const start = `${m.startSeconds.toFixed(1)}s`;
  return m.endSeconds != null ? `${start}–${m.endSeconds.toFixed(1)}s` : start;
}

export default function AudioTimelineCard({
  asset,
  asrResult,
  attachment,
  incident,
  compact = false,
}: {
  asset?: AudioAsset;
  asrResult?: AsrTranscriptResult;
  attachment?: AudioTranscriptAttachment;
  incident?: IncidentContext;
  compact?: boolean;
}) {
  const duration =
    asset?.durationSeconds ?? estimateDurationFromSegments(asrResult?.segments ?? []);

  const waveform =
    asset?.waveform && asset.waveform.length > 0
      ? asset.waveform
      : duration && duration > 0
        ? createDeterministicWaveform(duration)
        : [];

  const asrMarkers = asrResult ? segmentsToTimelineMarkers(asrResult.segments) : [];
  const lineMarkers =
    attachment && asrMarkers.length === 0
      ? transcriptAttachmentToMarkers(attachment, duration)
      : [];
  const fieldMarkers = incident ? fieldProvenanceToTimelineMarkers(incident, duration) : [];
  const markers = [...asrMarkers, ...lineMarkers, ...fieldMarkers];

  const maxAmp = waveform.reduce((m, p) => Math.max(m, p.amplitude), 0) || 1;

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <TimelineIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
            Audio Timeline
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            label={duration && duration > 0 ? `Duration: ${duration.toFixed(1)}s` : 'Duration unavailable'}
          />
        </Box>

        {/* Waveform-style bars (display-only, no charting library / canvas). */}
        {waveform.length > 0 ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '2px',
              height: 56,
              px: 0.5,
              py: 0.5,
              borderRadius: 1,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            {waveform.map((p, i) => (
              <Box
                key={i}
                title={`${p.t.toFixed(1)}s`}
                sx={{
                  flex: 1,
                  minWidth: 2,
                  height: `${Math.max(6, (p.amplitude / maxAmp) * 100)}%`,
                  borderRadius: 0.5,
                  backgroundColor: 'primary.main',
                  opacity: 0.6,
                }}
              />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No waveform available for this asset.
          </Typography>
        )}

        {/* Legend */}
        {markers.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
            {asrMarkers.length > 0 && (
              <Chip size="small" color="info" variant="outlined" label={`${asrMarkers.length} ASR segments`} />
            )}
            {lineMarkers.length > 0 && (
              <Chip size="small" color="secondary" variant="outlined" label={`${lineMarkers.length} transcript lines`} />
            )}
            {fieldMarkers.length > 0 && (
              <Chip size="small" color="success" variant="outlined" label={`${fieldMarkers.length} incident fields`} />
            )}
          </Box>
        )}

        {!compact && markers.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {markers.map((m) => (
                <Box key={m.id} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                  <Chip size="small" color={KIND_COLOR[m.kind]} variant="outlined" label={m.kind.replace(/_/g, ' ')} />
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 92 }}>
                    {fmtRange(m)}
                  </Typography>
                  <Typography variant="caption" sx={{ flexGrow: 1 }}>
                    {m.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Timeline is local/demo provenance only. It is not forensic audio analysis.
        </Typography>
      </CardContent>
    </Card>
  );
}
