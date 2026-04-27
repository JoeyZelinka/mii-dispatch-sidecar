'use client';

import Link from 'next/link';
import { Box, Typography, Button } from '@mui/material';

export default function NotFound() {
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        404 · Not Found
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        The page or incident you’re looking for doesn’t exist.
      </Typography>
      <Button component={Link} href="/" variant="contained" sx={{ mt: 2 }}>
        Back to dashboard
      </Button>
    </Box>
  );
}
