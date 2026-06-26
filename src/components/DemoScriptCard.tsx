'use client';

import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import { DEMO_SCRIPTS } from '@/lib/mii/demoContent';

export default function DemoScriptCard({
  scenarioId,
  scenarioTitle,
}: {
  scenarioId: string;
  scenarioTitle: string;
}) {
  const script = DEMO_SCRIPTS[scenarioId] ?? [];
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <AutoStoriesIcon color="primary" fontSize="small" />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Demo Script
          </Typography>
          <Chip size="small" variant="outlined" label={scenarioTitle} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Presenter notes — read these aloud as the scenario runs.
        </Typography>
        <Box component="ol" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.75 } }}>
          {script.map((step, i) => (
            <li key={i}>
              <Typography variant="body2">{step}</Typography>
            </li>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
