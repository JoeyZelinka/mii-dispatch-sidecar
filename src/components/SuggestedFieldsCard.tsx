'use client';

import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Divider,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { SuggestedField } from '@/lib/mii/types';
import ConfidenceBar from './ConfidenceBar';

export default function SuggestedFieldsCard({
  fields,
  onReject,
  onConfirmSensitive,
}: {
  fields: SuggestedField[];
  onReject: (fieldId: string) => void;
  onConfirmSensitive: (fieldId: string) => void;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Suggested Fields
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Extracted from transcript with provenance. Sensitive fields are gated from mock CAD until
          explicitly confirmed.
        </Typography>
        {fields.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No suggested fields.
          </Typography>
        )}
        {fields.map((f, idx) => {
          const sensitiveUnconfirmed = f.sensitive && !f.confirmed;
          return (
            <Box key={f.id}>
              {idx > 0 && <Divider sx={{ my: 1 }} />}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  ...(f.sensitive
                    ? {
                        p: 1,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: sensitiveUnconfirmed ? 'warning.main' : 'success.main',
                        backgroundColor: sensitiveUnconfirmed
                          ? 'rgba(255,182,72,0.10)'
                          : 'rgba(74,222,128,0.08)',
                      }
                    : {}),
                }}
              >
                <Box sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle2">{f.label}</Typography>
                    {f.sensitive && (
                      <Chip
                        size="small"
                        color="warning"
                        icon={<LockIcon />}
                        label="SENSITIVE"
                        sx={{ fontWeight: 700 }}
                      />
                    )}
                    {!f.sensitive && f.confirmed && (
                      <Chip size="small" color="success" icon={<CheckCircleIcon />} label="Applied" />
                    )}
                  </Box>
                  <Typography variant="body1" sx={{ fontWeight: 600, my: 0.25 }}>
                    {sensitiveUnconfirmed ? '•••••• (hidden until confirmed)' : f.value}
                  </Typography>
                  <ConfidenceBar value={f.confidence} width={180} />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}
                  >
                    provenance: “{f.provenanceText}”
                  </Typography>

                  {f.sensitive && (
                    <Box sx={{ mt: 1 }}>
                      {f.confirmed ? (
                        <Chip
                          size="small"
                          color="success"
                          icon={<CheckCircleIcon />}
                          label="Confirmed for Mock CAD payload"
                        />
                      ) : (
                        <>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                            <WarningAmberIcon fontSize="small" color="warning" />
                            <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
                              Excluded from mock CAD unless explicitly confirmed.
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            variant="contained"
                            color="warning"
                            startIcon={<LockIcon />}
                            onClick={() => onConfirmSensitive(f.id)}
                          >
                            Confirm for Mock CAD
                          </Button>
                        </>
                      )}
                    </Box>
                  )}
                </Box>
                <Tooltip title="Reject field">
                  <IconButton size="small" onClick={() => onReject(f.id)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          );
        })}
      </CardContent>
    </Card>
  );
}
