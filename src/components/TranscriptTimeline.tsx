'use client';

import { Card, CardContent, Typography, Box, Divider, Chip } from '@mui/material';
import type { TranscriptLine } from '@/lib/mii/types';
import { SemanticBadge, CueChip, ConfidenceChip } from './StatusChip';
import { formatTime } from '@/lib/format';

export default function TranscriptTimeline({
  lines,
  title = 'Transcript Timeline',
  dense,
}: {
  lines: TranscriptLine[];
  title?: string;
  dense?: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          {title}
        </Typography>
        {lines.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No transcript lines.
          </Typography>
        )}
        {lines.map((line, idx) => (
          <Box key={line.id}>
            {idx > 0 && <Divider sx={{ my: 1 }} />}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" variant="outlined" label={line.speaker} color="primary" />
              <Typography variant="caption" color="text.secondary">
                {formatTime(line.timestamp)}
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              {line.semanticType && <SemanticBadge type={line.semanticType} />}
              <ConfidenceChip value={line.confidence} />
            </Box>
            <Typography variant="body1" sx={{ my: 0.5 }}>
              “{line.text}”
            </Typography>
            {!dense && line.cueEvents.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {line.cueEvents.map((c) => (
                  <CueChip key={c.id} cueType={c.cueType} phrase={c.phrase} />
                ))}
              </Box>
            )}
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}
