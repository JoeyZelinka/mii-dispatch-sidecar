'use client';

import { Card, CardContent, Typography, Box, Button, Alert, Divider, Chip } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { FieldConflict, IncidentContext, TranscriptLine } from '@/lib/mii/types';
import { formatTime } from '@/lib/format';

function Provenance({
  label,
  lineIds,
  lines,
}: {
  label: string;
  lineIds: string[];
  lines: TranscriptLine[];
}) {
  const resolved = lineIds
    .map((id) => lines.find((l) => l.id === id))
    .filter((l): l is TranscriptLine => Boolean(l));
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      {resolved.length === 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          (source line unavailable)
        </Typography>
      ) : (
        resolved.map((l) => (
          <Typography key={l.id} variant="caption" sx={{ display: 'block' }}>
            {l.speaker} {formatTime(l.timestamp)} — “{l.text}”
          </Typography>
        ))
      )}
    </Box>
  );
}

function ConflictRow({
  conflict,
  lines,
  onResolve,
}: {
  conflict: FieldConflict;
  lines: TranscriptLine[];
  onResolve: (conflictId: string, selected: 'existing' | 'incoming') => void;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'error.main',
        backgroundColor: 'rgba(255,107,107,0.08)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <WarningAmberIcon color="error" fontSize="small" />
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          {conflict.label}
        </Typography>
        <Chip size="small" color="error" label="OPEN" />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            p: 1,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Chip size="small" variant="outlined" label="Existing" />
            <Typography variant="body1" sx={{ fontWeight: 700 }}>
              {conflict.existingValue}
            </Typography>
          </Box>
          <Provenance
            label="Heard on:"
            lineIds={conflict.existingSourceTranscriptLineIds}
            lines={lines}
          />
          <Button
            size="small"
            variant="contained"
            color="inherit"
            sx={{ mt: 1 }}
            onClick={() => onResolve(conflict.id, 'existing')}
          >
            Keep Existing
          </Button>
        </Box>

        <Box
          sx={{
            p: 1,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Chip size="small" variant="outlined" color="warning" label="Incoming" />
            <Typography variant="body1" sx={{ fontWeight: 700 }}>
              {conflict.incomingValue}
            </Typography>
          </Box>
          <Provenance
            label="Heard on:"
            lineIds={conflict.incomingSourceTranscriptLineIds}
            lines={lines}
          />
          <Button
            size="small"
            variant="contained"
            color="primary"
            sx={{ mt: 1 }}
            onClick={() => onResolve(conflict.id, 'incoming')}
          >
            Use Incoming
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default function ConflictResolutionCard({
  incident,
  lines,
  onResolve,
}: {
  incident: IncidentContext;
  lines: TranscriptLine[];
  onResolve: (conflictId: string, selected: 'existing' | 'incoming') => void;
}) {
  const open = incident.conflicts.filter((c) => c.status === 'OPEN');
  if (open.length === 0) return null;

  return (
    <Card sx={{ borderColor: 'error.main', borderWidth: 1, borderStyle: 'solid' }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Open Conflicts
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Conflicting incident facts block mock CAD submission until resolved.
        </Typography>

        <Alert severity="error" sx={{ mb: 1.5 }}>
          Conflict state blocks mock CAD submission. Resolve the conflict to continue.
        </Alert>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {open.map((c, idx) => (
            <Box key={c.id}>
              {idx > 0 && <Divider sx={{ mb: 1.5 }} />}
              <ConflictRow conflict={c} lines={lines} onResolve={onResolve} />
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
