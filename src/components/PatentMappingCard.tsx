'use client';

import { Card, CardContent, Typography, Box, Chip, Alert } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScienceIcon from '@mui/icons-material/Science';
import { PATENT_MAPPING } from '@/lib/mii/demoContent';

export default function PatentMappingCard({
  scenarioId,
  scenarioTitle,
}: {
  scenarioId: string;
  scenarioTitle: string;
}) {
  const concepts = PATENT_MAPPING[scenarioId] ?? [];
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <ScienceIcon color="primary" fontSize="small" />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Patent Mapping
          </Typography>
          <Chip size="small" variant="outlined" label={scenarioTitle} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Invention concepts demonstrated by this scenario.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
          {concepts.map((c) => (
            <Chip
              key={c}
              size="small"
              color="success"
              variant="outlined"
              icon={<CheckCircleIcon />}
              label={c}
            />
          ))}
        </Box>
        <Alert severity="info" variant="outlined">
          This panel maps demo behavior to the technical invention concepts. It is not legal advice or
          claim language.
        </Alert>
      </CardContent>
    </Card>
  );
}
