'use client';

import { Card, CardContent, CardActions, Typography, Button, Chip, Box } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import type { Scenario } from '@/lib/mii/types';
import { SemanticBadge } from './StatusChip';

export default function ScenarioCard({
  scenario,
  onRun,
  running,
}: {
  scenario: Scenario;
  onRun: (id: string) => void;
  running?: boolean;
}) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {scenario.title}
          </Typography>
          <SemanticBadge type={scenario.expectedSemantic} />
        </Box>
        <Chip
          size="small"
          variant="outlined"
          label={`${scenario.lines.length} transcript lines`}
          sx={{ mb: 1.5 }}
        />
        <Typography variant="body2" color="text.secondary">
          {scenario.blurb}
        </Typography>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2 }}>
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={() => onRun(scenario.id)}
          disabled={running}
          fullWidth
        >
          {scenario.title}
        </Button>
      </CardActions>
    </Card>
  );
}
