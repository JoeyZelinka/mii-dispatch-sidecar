import { Box, Typography } from '@mui/material';
import PageHeader from '@/components/PageHeader';
import AuditExportVerifierCard from '@/components/AuditExportVerifierCard';

export default function Page() {
  return (
    <Box>
      <PageHeader
        title="Audit Export Verification"
        subtitle="Locally verify the integrity of an exported MII audit JSON file."
      />
      <AuditExportVerifierCard />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        This verifies local demo JSON integrity only. It is not a legal chain-of-custody system.
      </Typography>
    </Box>
  );
}
