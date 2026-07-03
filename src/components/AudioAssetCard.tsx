'use client';

import { Card, CardContent, Typography, Box, Chip, Button, Divider } from '@mui/material';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Link from 'next/link';
import type { AudioAsset } from '@/lib/mii/types';
import { formatDateTime } from '@/lib/format';

const SOURCE_LABEL: Record<AudioAsset['sourceType'], string> = {
  SIMULATED_UPLOAD: 'Simulated Upload',
  AUTHORIZED_RECORDING: 'Authorized Recording',
  SYNTHETIC_TTS: 'Synthetic TTS',
  MANUAL_PLACEHOLDER: 'Manual Placeholder',
};

const STATUS_COLOR: Record<AudioAsset['status'], 'default' | 'info' | 'success'> = {
  UPLOADED: 'default',
  TRANSCRIPT_ATTACHED: 'info',
  PROCESSED: 'success',
};

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function AudioAssetCard({
  asset,
  linkedIncidentId,
}: {
  asset: AudioAsset;
  linkedIncidentId?: string;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <GraphicEqIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1, wordBreak: 'break-all' }}>
            {asset.filename}
          </Typography>
          <Chip size="small" color={STATUS_COLOR[asset.status]} label={asset.status.replace(/_/g, ' ')} />
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
          <Chip size="small" variant="outlined" label={SOURCE_LABEL[asset.sourceType]} />
          <Chip size="small" variant="outlined" label={asset.mimeType || 'unknown/type'} />
          <Chip size="small" variant="outlined" label={formatBytes(asset.sizeBytes)} />
          {typeof asset.durationSeconds === 'number' && (
            <Chip size="small" variant="outlined" label={`${asset.durationSeconds.toFixed(1)}s`} />
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          Created {formatDateTime(asset.createdAt)}
        </Typography>

        {asset.notes && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Notes / provenance: {asset.notes}
          </Typography>
        )}

        {asset.objectUrl ? (
          <Box sx={{ mt: 1.5 }}>
            {/* Local, session-only preview via a blob URL. Never uploaded. */}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={asset.objectUrl} style={{ width: '100%' }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Preview is session-local only — it will not survive a page reload.
            </Typography>
          </Box>
        ) : (
          asset.sourceType !== 'MANUAL_PLACEHOLDER' && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              No local preview available for this asset.
            </Typography>
          )
        )}

        {linkedIncidentId && asset.status === 'PROCESSED' && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Button
              component={Link}
              href={`/incidents/${linkedIncidentId}`}
              size="small"
              variant="contained"
              startIcon={<OpenInNewIcon />}
            >
              See Incident Report
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
