'use client';

import { Box, Paper, Typography } from '@mui/material';
import type { CueEvent } from '@/lib/mii/types';
import { CueChip } from './StatusChip';

// Compact strip summarising the cues detected across a set of transcript lines.
export default function CueStatusStrip({ cues }: { cues: CueEvent[] }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        Cue Detection
      </Typography>
      {cues.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No cues detected yet.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {cues.map((c) => (
            <CueChip key={c.id} cueType={c.cueType} phrase={c.phrase} />
          ))}
        </Box>
      )}
    </Paper>
  );
}
