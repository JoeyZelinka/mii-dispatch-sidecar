'use client';

import { Box, Button, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { miiStore } from '@/lib/mii/store';
import { downloadJson } from '@/lib/mii/auditExport';

export default function IncidentAuditExportButton({ incidentId }: { incidentId: string }) {
  const handleDownload = () => {
    const data = miiStore.buildAuditExport(incidentId);
    downloadJson(`mii-audit-${incidentId}.json`, data);
  };

  return (
    <Box>
      <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={handleDownload}>
        Download Audit JSON
      </Button>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        Exports local demo audit/provenance only. No data is uploaded.
      </Typography>
    </Box>
  );
}
