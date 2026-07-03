'use client';

import * as React from 'react';
import { Box, Button, Typography, Tooltip } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import Link from 'next/link';
import { miiStore } from '@/lib/mii/store';
import { buildSignedIncidentAuditExport, downloadJson } from '@/lib/mii/auditExport';

export default function IncidentAuditExportButton({ incidentId }: { incidentId: string }) {
  const [busy, setBusy] = React.useState(false);
  const [hash, setHash] = React.useState<string | null>(null);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const data = await buildSignedIncidentAuditExport(miiStore.getSnapshot(), incidentId);
      setHash(data.integrity?.hash ?? null);
      downloadJson(`mii-audit-${incidentId}.json`, data);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
          disabled={busy}
        >
          {busy ? 'Preparing Audit JSON…' : 'Download Audit JSON'}
        </Button>
        <Button
          component={Link}
          href="/audit/verify"
          variant="text"
          size="small"
          startIcon={<VerifiedUserIcon />}
        >
          Verify an Audit JSON
        </Button>
      </Box>
      {hash && (
        <Tooltip title={hash}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontFamily: 'ui-monospace, monospace' }}>
            SHA-256: {hash.slice(0, 12)}…
          </Typography>
        </Tooltip>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        Exports local demo audit/provenance with a SHA-256 integrity hash. No data is uploaded.
      </Typography>
    </Box>
  );
}
