'use client';

import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import RadioIcon from '@mui/icons-material/Radio';
import LockIcon from '@mui/icons-material/Lock';
import { useRouter } from 'next/navigation';

const AUTH_ENABLED = process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED === 'true';

export default function DemoLoginClient({ next = '/demo' }: { next?: string }) {
  const router = useRouter();

  const [accessCode, setAccessCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/demo-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (res.ok && data.ok) {
        router.replace(next.startsWith('/') ? next : '/demo');
        router.refresh();
      } else {
        setError('Invalid access code.');
      }
    } catch {
      setError('Invalid access code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 440 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <RadioIcon color="primary" />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              MII_lite Guided Demo
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Private simulated demo. No real CAD, radio, agency systems, or external APIs.
          </Typography>

          {!AUTH_ENABLED ? (
            <Stack spacing={2}>
              <Alert severity="info">
                Demo authentication is disabled. You can continue directly.
              </Alert>
              <Button variant="contained" size="large" onClick={() => router.replace('/demo')}>
                Continue to demo
              </Button>
            </Stack>
          ) : (
            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                label="Access code"
                type="password"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                fullWidth
                autoFocus
                autoComplete="off"
                sx={{ mb: 2 }}
              />
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                startIcon={<LockIcon />}
                disabled={submitting || accessCode.length === 0}
              >
                Continue
              </Button>
            </Box>
          )}

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Chip size="small" variant="outlined" color="warning" label="Simulated Data Only" />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
