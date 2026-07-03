'use client';

import { Card, CardContent, Typography, Stack, Button, Alert, Box, Chip } from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import BlockIcon from '@mui/icons-material/Block';
import type { IncidentContext } from '@/lib/mii/types';

export default function HumanReviewActions({
  incident,
  blockReasons,
  hasUnconfirmedSensitive,
  warnings = [],
  onConfirmAsr,
  onApplyFields,
  onSubmitCad,
  onClose,
}: {
  incident: IncidentContext;
  blockReasons: string[];
  hasUnconfirmedSensitive: boolean;
  warnings?: string[];
  onConfirmAsr: () => void;
  onApplyFields: () => void;
  onSubmitCad: () => void;
  onClose: () => void;
}) {
  const cadDisabled = blockReasons.length > 0;
  const closed = incident.status === 'CLOSED';

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          Human Review Actions
        </Typography>

        <Stack spacing={1.25}>
          <Button
            variant={incident.asrConfirmed ? 'outlined' : 'contained'}
            color="success"
            startIcon={<VerifiedIcon />}
            disabled={incident.asrConfirmed || closed}
            onClick={onConfirmAsr}
          >
            {incident.asrConfirmed ? 'ASR Confirmed' : 'Confirm ASR'}
          </Button>

          <Button
            variant="outlined"
            startIcon={<PlaylistAddCheckIcon />}
            disabled={closed}
            onClick={onApplyFields}
          >
            Apply Suggested Fields
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={<SendIcon />}
            disabled={cadDisabled}
            onClick={onSubmitCad}
          >
            Submit Mock CAD
          </Button>

          <Button
            variant="outlined"
            color="error"
            startIcon={<CloseIcon />}
            disabled={closed}
            onClick={onClose}
          >
            Close Incident
          </Button>
        </Stack>

        {cadDisabled && (
          <Alert severity="error" icon={<BlockIcon />} sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Submit blocked because:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {blockReasons.map((r) => (
                <li key={r}>
                  <Typography variant="body2">{r}</Typography>
                </li>
              ))}
            </Box>
          </Alert>
        )}

        {!cadDisabled && !closed && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2">
              All blocking safety gates pass. Submitting builds a <b>mock</b> CAD payload only — it is
              never sent to any external system.
            </Typography>
          </Alert>
        )}

        {warnings.length > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {warnings.map((w) => (
                <li key={w}>
                  <Typography variant="body2">{w}</Typography>
                </li>
              ))}
            </Box>
          </Alert>
        )}

        {hasUnconfirmedSensitive && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Sensitive field(s) present and <b>not confirmed</b>. They will be{' '}
              <Chip size="small" label="REDACTED" color="warning" variant="outlined" /> from the mock
              CAD payload unless confirmed in Suggested Fields.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
