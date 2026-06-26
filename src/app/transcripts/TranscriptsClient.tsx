'use client';

import * as React from 'react';
import { Box, Button, Alert } from '@mui/material';
import { SCENARIOS } from '@/lib/mii/seed';
import { miiStore, useTranscriptLines } from '@/lib/mii/store';
import PageHeader from '@/components/PageHeader';
import TranscriptTimeline from '@/components/TranscriptTimeline';
import CueStatusStrip from '@/components/CueStatusStrip';

export default function TranscriptsClient() {
  const lines = useTranscriptLines();
  const ordered = [...lines].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const allCues = ordered.flatMap((l) => l.cueEvents);

  return (
    <Box>
      <PageHeader
        title="Transcripts"
        subtitle="Live/simulated dispatch transcript feed — each line shows speaker, time, ASR confidence, detected cues, and semantic type"
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        Transcripts are seeded simulations. Run scenarios to append lines to the feed.
      </Alert>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {SCENARIOS.map((s) => (
          <Button key={s.id} variant="outlined" onClick={() => miiStore.runScenario(s.id)}>
            {s.title}
          </Button>
        ))}
      </Box>

      <Box sx={{ mb: 2 }}>
        <CueStatusStrip cues={allCues} />
      </Box>

      <TranscriptTimeline lines={ordered} title="Transcript Feed" />
    </Box>
  );
}
