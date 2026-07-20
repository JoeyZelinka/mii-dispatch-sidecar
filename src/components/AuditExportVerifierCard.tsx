'use client';

import * as React from 'react';
import { Card, CardContent, Typography, Box, Button, Alert, Chip } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { verifyIncidentAuditExport, type AuditExportVerificationResult } from '@/lib/mii/auditExport';

const STATUS_SEVERITY: Record<
  AuditExportVerificationResult['status'],
  'success' | 'error' | 'warning'
> = {
  VALID: 'success',
  MODIFIED: 'error',
  INVALID_FORMAT: 'warning',
};

export default function AuditExportVerifierCard() {
  const [result, setResult] = React.useState<AuditExportVerificationResult | null>(null);
  const [filename, setFilename] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file later.
    e.target.value = '';
    if (!file) return;
    setFilename(file.name);
    setBusy(true);
    setResult(null);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setResult({ status: 'INVALID_FORMAT', summary: 'File is not valid JSON.' });
        return;
      }
      const verification = await verifyIncidentAuditExport(parsed);
      setResult(verification);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Verify Audit JSON
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Select a previously exported MII audit JSON file. Verification happens locally in your
          browser — the file is never uploaded.
        </Typography>

        <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} disabled={busy}>
          {busy ? 'Verifying…' : 'Choose audit JSON'}
          <input hidden type="file" accept=".json,application/json" onChange={handleFile} />
        </Button>
        {filename && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            File: {filename}
          </Typography>
        )}

        {result && (
          <Box sx={{ mt: 1.5 }}>
            <Alert severity={STATUS_SEVERITY[result.status]} sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip size="small" color={STATUS_SEVERITY[result.status]} label={result.status.replace(/_/g, ' ')} />
                <Typography variant="body2">{result.summary}</Typography>
              </Box>
            </Alert>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {result.incidentId && (
                <Typography variant="caption" color="text.secondary">
                  Incident: {result.incidentId}
                </Typography>
              )}
              {result.exportedAt && (
                <Typography variant="caption" color="text.secondary">
                  Exported: {result.exportedAt}
                </Typography>
              )}
              {result.expectedHash && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>
                  Expected: {result.expectedHash}
                </Typography>
              )}
              {result.actualHash && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>
                  Actual: {result.actualHash}
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
