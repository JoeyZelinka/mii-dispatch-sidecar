'use client';

import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Alert,
  LinearProgress,
  Chip,
} from '@mui/material';
import { Stack } from '@/components/Stack';
import type { ExtractedField, SensitiveCategory } from '@/types/mii';
import { useSubmitToCad } from '@/hooks/useSuggestions';

const CATEGORY_LABEL: Record<SensitiveCategory, string> = {
  callerInfo: 'Caller Info',
  plates: 'Plates',
  suspectDetails: 'Suspect Details',
  weapons: 'Weapons',
};

type Phase = 'idle' | 'submitting' | 'success' | 'error';

export default function CadSubmitDialog({
  open,
  onClose,
  incidentId,
  eventNumber,
  fields,
  basePayload,
  correlationId,
  actor,
}: {
  open: boolean;
  onClose: () => void;
  incidentId: string;
  eventNumber: string;
  fields: ExtractedField[];
  basePayload: unknown;
  correlationId: string;
  actor: string;
}) {
  const submit = useSubmitToCad();
  const [phase, setPhase] = React.useState<Phase>('idle');

  const sensitiveCats = React.useMemo(() => {
    const set = new Set<SensitiveCategory>();
    for (const f of fields) {
      if (f.sensitive && f.category) set.add(f.category);
    }
    return Array.from(set);
  }, [fields]);

  const [allowed, setAllowed] = React.useState<Record<SensitiveCategory, boolean>>({
    callerInfo: false,
    plates: false,
    suspectDetails: false,
    weapons: false,
  });

  React.useEffect(() => {
    if (open) {
      setPhase('idle');
      setAllowed({ callerInfo: false, plates: false, suspectDetails: false, weapons: false });
    }
  }, [open]);

  const filteredFields = fields.filter(
    (f) => !f.sensitive || (f.category && allowed[f.category])
  );

  const finalPayload = {
    ...(basePayload as object),
    fields: filteredFields.map((f) => ({
      key: f.key,
      label: f.label,
      value: f.value,
      sensitive: Boolean(f.sensitive),
      category: f.category,
    })),
    sensitiveAllowed: allowed,
  };

  const handleSubmit = () => {
    setPhase('submitting');
    submit.mutate(
      {
        incidentId,
        actor,
        correlationId,
        payload: finalPayload,
      },
      {
        onSuccess: () => setPhase('success'),
        onError: () => setPhase('error'),
      }
    );
  };

  return (
    <Dialog open={open} onClose={phase === 'submitting' ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Submit to CAD · {eventNumber}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Sensitive fields require explicit confirmation
            </Typography>
            {sensitiveCats.length === 0 ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                No sensitive fields detected in this submission.
              </Alert>
            ) : (
              <FormGroup row sx={{ mt: 1 }}>
                {sensitiveCats.map((c) => (
                  <FormControlLabel
                    key={c}
                    control={
                      <Checkbox
                        checked={allowed[c]}
                        onChange={(e) =>
                          setAllowed((prev) => ({ ...prev, [c]: e.target.checked }))
                        }
                      />
                    }
                    label={`Include ${CATEGORY_LABEL[c]}`}
                  />
                ))}
              </FormGroup>
            )}
          </Box>

          <Box>
            <Typography variant="overline" color="text.secondary">
              Fields to write
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {filteredFields.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No fields will be submitted.
                </Typography>
              )}
              {filteredFields.map((f) => (
                <Stack key={f.key} direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={f.label} variant="outlined" />
                  <Typography variant="body2">{f.value}</Typography>
                  {f.sensitive && f.category && (
                    <Chip size="small" color="warning" label={CATEGORY_LABEL[f.category]} />
                  )}
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="overline" color="text.secondary">
              Final Payload
            </Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                mt: 1,
                p: 1.5,
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: 12,
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: 1,
                maxHeight: 220,
                overflow: 'auto',
              }}
            >
              {JSON.stringify(finalPayload, null, 2)}
            </Box>
          </Box>

          {phase === 'submitting' && (
            <Box>
              <LinearProgress />
              <Typography variant="caption" color="text.secondary">
                Submitting…
              </Typography>
            </Box>
          )}
          {phase === 'success' && (
            <Alert severity="success">
              Submitted to CAD. Audit entry created with correlation <code>{correlationId}</code>.
            </Alert>
          )}
          {phase === 'error' && (
            <Alert severity="error">CAD submission failed. Try again.</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={phase === 'submitting'}>
          {phase === 'success' ? 'Close' : 'Cancel'}
        </Button>
        {phase !== 'success' && (
          <Button
            variant="contained"
            color="success"
            onClick={handleSubmit}
            disabled={phase === 'submitting'}
          >
            Submit to CAD
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
