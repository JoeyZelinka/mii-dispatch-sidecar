'use client';

import { Card, CardContent, Typography, Box, Chip, TextField, MenuItem } from '@mui/material';
import PolicyIcon from '@mui/icons-material/Policy';
import type { MiiDemoPolicy, SignOffPolicyMode } from '@/lib/mii/types';

const MODE_OPTIONS: { value: SignOffPolicyMode; label: string; description: string }[] = [
  { value: 'NOT_REQUIRED', label: 'Not required', description: 'Transcript sign-off is never required.' },
  { value: 'ADVISORY', label: 'Advisory', description: 'Sign-off is encouraged but does not block Mock CAD.' },
  {
    value: 'REQUIRED_FOR_PENNY',
    label: 'Required for PENNY transcripts',
    description: 'PENNY-reviewed incidents require sign-off before Mock CAD.',
  },
  {
    value: 'REQUIRED_FOR_ALL_AUDIO',
    label: 'Required for all audio transcripts',
    description: 'Any audio-linked incident requires sign-off before Mock CAD.',
  },
];

export default function DemoPolicyCard({
  policy,
  onChangeMode,
}: {
  policy: MiiDemoPolicy;
  onChangeMode?: (mode: SignOffPolicyMode) => void;
}) {
  const current = MODE_OPTIONS.find((m) => m.value === policy.signOffPolicyMode);

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
          <PolicyIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
            Demo Policy
          </Typography>
          <Chip size="small" color="primary" variant="outlined" label={policy.signOffPolicyMode} />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {policy.name}
        </Typography>

        {current && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {current.description}
          </Typography>
        )}

        <TextField
          select
          size="small"
          label="Sign-off policy mode"
          value={policy.signOffPolicyMode}
          onChange={(e) => onChangeMode?.(e.target.value as SignOffPolicyMode)}
          fullWidth
        >
          {MODE_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Policy changes are local to this demo session and do not call external systems.
        </Typography>
      </CardContent>
    </Card>
  );
}
