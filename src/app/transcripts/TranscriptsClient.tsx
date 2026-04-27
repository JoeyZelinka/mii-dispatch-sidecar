'use client';

import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Stack } from '@/components/Stack';
import { useTranscripts } from '@/hooks/useTranscripts';
import { ConfidenceChip, SemanticBadge } from '@/components/Badges';
import { formatTime } from '@/lib/format';
import type { SemanticType, Speaker } from '@/types/mii';

const SEMANTIC: SemanticType[] = ['NEW_EVENT', 'UPDATE', 'CONFIRMATION', 'ADMIN_CHATTER'];
const SPEAKERS: Speaker[] = ['MDSO', 'SIBPD', 'UNIT', 'UNKNOWN'];

const CUE_RE = /sunny isles\s*(?:fifty|50)/i;

const HighlightedText = ({ text }: { text: string }) => {
  const m = text.match(CUE_RE);
  if (!m) return <>{text}</>;
  const start = m.index ?? 0;
  const end = start + m[0].length;
  return (
    <>
      {text.slice(0, start)}
      <Box
        component="span"
        sx={{
          backgroundColor: 'rgba(78,161,255,0.18)',
          color: 'primary.light',
          px: 0.5,
          borderRadius: 0.5,
          fontWeight: 600,
        }}
      >
        {text.slice(start, end)}
      </Box>
      {text.slice(end)}
    </>
  );
};

export default function TranscriptsClient() {
  const [semantic, setSemantic] = React.useState<SemanticType | 'ALL'>('ALL');
  const [speaker, setSpeaker] = React.useState<Speaker | 'ALL'>('ALL');
  const [cueOnly, setCueOnly] = React.useState(false);

  const { data } = useTranscripts({
    semanticType: semantic === 'ALL' ? undefined : semantic,
    speaker: speaker === 'ALL' ? undefined : speaker,
    cueOnly,
  });

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Radio Transcripts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Live ASR feed with semantic classification and code translation.
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Type</InputLabel>
          <Select
            label="Type"
            value={semantic}
            onChange={(e) => setSemantic(e.target.value as SemanticType | 'ALL')}
          >
            <MenuItem value="ALL">All types</MenuItem>
            {SEMANTIC.map((s) => (
              <MenuItem key={s} value={s}>
                {s.replace('_', ' ')}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Speaker</InputLabel>
          <Select
            label="Speaker"
            value={speaker}
            onChange={(e) => setSpeaker(e.target.value as Speaker | 'ALL')}
          >
            <MenuItem value="ALL">All speakers</MenuItem>
            {SPEAKERS.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Switch checked={cueOnly} onChange={(e) => setCueOnly(e.target.checked)} />
          }
          label="Cue only"
        />
      </Stack>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 90 }}>Time</TableCell>
                <TableCell sx={{ width: 90 }}>Speaker</TableCell>
                <TableCell sx={{ width: 130 }}>Type</TableCell>
                <TableCell>Transcript</TableCell>
                <TableCell sx={{ width: 110 }}>Codes</TableCell>
                <TableCell sx={{ width: 80 }}>ASR</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data ?? []).map((t) => (
                <TableRow
                  key={t.id}
                  sx={{
                    backgroundColor: t.cueDetected ? 'rgba(78,161,255,0.04)' : 'transparent',
                  }}
                >
                  <TableCell sx={{ verticalAlign: 'top' }}>
                    <Typography variant="caption">{formatTime(t.ts)}</Typography>
                  </TableCell>
                  <TableCell sx={{ verticalAlign: 'top' }}>
                    <Chip size="small" variant="outlined" label={t.speaker} />
                  </TableCell>
                  <TableCell sx={{ verticalAlign: 'top' }}>
                    <Stack direction="row" spacing={0.5}>
                      <SemanticBadge type={t.semanticType} />
                      {t.cueDetected && (
                        <Chip size="small" color="primary" variant="outlined" label="CUE" />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ verticalAlign: 'top' }}>
                    <Typography variant="body2">
                      <HighlightedText text={t.text} />
                    </Typography>
                    {t.plainTalk && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontStyle: 'italic', display: 'block' }}
                      >
                        → {t.plainTalk}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ verticalAlign: 'top' }}>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5}>
                      {t.codesDetected.map((c) => (
                        <Chip key={c} size="small" label={c} variant="outlined" />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ verticalAlign: 'top' }}>
                    <ConfidenceChip value={t.asrConfidence} />
                  </TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary" sx={{ p: 2 }}>
                      No transcript events match the filter.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  );
}
