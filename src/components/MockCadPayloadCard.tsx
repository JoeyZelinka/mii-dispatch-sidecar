'use client';

import { Card, CardContent, Typography, Box, Chip, Alert } from '@mui/material';
import type { MockCadPayload } from '@/lib/mii/types';

export default function MockCadPayloadCard({
  payload,
  hasUnconfirmedSensitive = false,
}: {
  payload?: MockCadPayload;
  hasUnconfirmedSensitive?: boolean;
}) {
  return (
    <Card sx={{ borderColor: 'warning.main', borderWidth: 1, borderStyle: 'solid' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            MOCK CAD PAYLOAD — NOT SENT
          </Typography>
          <Chip color="warning" label="NOT SENT" size="small" sx={{ fontWeight: 700 }} />
        </Box>
        <Alert severity="warning" sx={{ mb: 1.5 }} variant="outlined">
          MOCK CAD PAYLOAD — NOT SENT. No external CAD/agency call is ever made.
        </Alert>
        {hasUnconfirmedSensitive && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            Sensitive fields are present but unconfirmed. They are excluded from this mock payload.
          </Alert>
        )}
        {payload ? (
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1.5,
              borderRadius: 1,
              backgroundColor: 'rgba(0,0,0,0.35)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12.5,
              lineHeight: 1.5,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {JSON.stringify(payload, null, 2)}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No payload built yet. Use “Submit Mock CAD” to generate a preview.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
