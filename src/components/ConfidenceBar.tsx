'use client';

import { Box, LinearProgress, Typography } from '@mui/material';

export default function ConfidenceBar({
  value,
  label,
  width = 140,
}: {
  value: number;
  label?: string;
  width?: number | string;
}) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? 'success' : pct >= 70 ? 'warning' : 'error';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width }}>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={color}
        sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 56 }}>
        {label ? `${label} ` : ''}
        {pct}%
      </Typography>
    </Box>
  );
}
