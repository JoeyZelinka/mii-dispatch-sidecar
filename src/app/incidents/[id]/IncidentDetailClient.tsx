'use client';

import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Divider,
  Button,
  IconButton,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Alert,
} from '@mui/material';
import { Stack } from '@/components/Stack';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import LockIcon from '@mui/icons-material/Lock';
import {
  ConfidenceChip,
  IncidentStatusChip,
  UnitStatusChip,
  ZoneChip,
  SemanticBadge,
} from '@/components/Badges';
import { useIncident, useAssignUnit } from '@/hooks/useIncidents';
import {
  useApproveSuggestion,
  useConfirmAsr,
  useEditSuggestionField,
  useRejectSuggestion,
  useSuggestionForIncident,
} from '@/hooks/useSuggestions';
import { useTranscripts } from '@/hooks/useTranscripts';
import { useUnits } from '@/hooks/useUnits';
import { formatRelative, formatTime } from '@/lib/format';
import type { ExtractedField, Unit } from '@/types/mii';
import CadSubmitDialog from './CadSubmitDialog';
import Link from 'next/link';

const ACTOR = 'D. Rivera';

const FieldRow = ({
  field,
  onEdit,
  editing,
  onChangeValue,
  draftValue,
  onCommit,
  onCancel,
}: {
  field: ExtractedField;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onChangeValue: (v: string) => void;
  draftValue: string;
  onCommit: () => void;
}) => (
  <TableRow
    sx={{
      backgroundColor: field.sensitive ? 'rgba(255,182,72,0.06)' : 'transparent',
    }}
  >
    <TableCell sx={{ width: 200 }}>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        {field.sensitive && (
          <Tooltip title={`Sensitive · ${field.category}`}>
            <LockIcon fontSize="inherit" color="warning" />
          </Tooltip>
        )}
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {field.label}
        </Typography>
      </Stack>
    </TableCell>
    <TableCell>
      {editing ? (
        <TextField
          size="small"
          value={draftValue}
          onChange={(e) => onChangeValue(e.target.value)}
          autoFocus
          fullWidth
        />
      ) : (
        <Typography variant="body2">{field.value}</Typography>
      )}
    </TableCell>
    <TableCell sx={{ width: 100 }}>
      <ConfidenceChip value={field.confidence} />
    </TableCell>
    <TableCell sx={{ width: 90, textAlign: 'right' }}>
      {editing ? (
        <>
          <IconButton size="small" color="success" onClick={onCommit}>
            <CheckIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onCancel}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </>
      ) : (
        <IconButton size="small" onClick={onEdit}>
          <EditIcon fontSize="small" />
        </IconButton>
      )}
    </TableCell>
  </TableRow>
);

export default function IncidentDetailClient({ id }: { id: string }) {
  const incidentQ = useIncident(id);
  const sugQ = useSuggestionForIncident(id);
  const transcriptsQ = useTranscripts({ incidentId: id });
  const unitsQ = useUnits();

  const approve = useApproveSuggestion();
  const reject = useRejectSuggestion();
  const editField = useEditSuggestionField();
  const confirmAsr = useConfirmAsr();
  const assignUnit = useAssignUnit();

  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [asrConfirmed, setAsrConfirmed] = React.useState(false);
  const [cadOpen, setCadOpen] = React.useState(false);
  const [correlationId] = React.useState(
    () => `cor-${Math.floor(10000 + Math.random() * 90000)}`
  );

  if (incidentQ.isLoading) return <Typography>Loading…</Typography>;
  if (!incidentQ.data) {
    return (
      <Stack spacing={2}>
        <Alert severity="warning">Incident not found.</Alert>
        <Button component={Link} href="/incidents" variant="outlined">
          Back to incidents
        </Button>
      </Stack>
    );
  }

  const inc = incidentQ.data;
  const sug = sugQ.data;
  const events = transcriptsQ.data ?? [];
  const allUnits = unitsQ.data ?? [];

  const cadPayload = {
    eventNumber: inc.eventNumber,
    natureCode: inc.natureCode,
    naturePlain: inc.naturePlain,
    address: inc.address,
    apt: inc.apt,
    zone: inc.zone,
    assignedUnits: inc.assignedUnits,
    fields: (sug?.fields ?? []).map((f) => ({
      key: f.key,
      label: f.label,
      value: f.value,
      sensitive: Boolean(f.sensitive),
      category: f.category,
    })),
    correlationId,
  };

  const recommendedUnits = (sug?.unitRecommendations ?? [])
    .map((r) => ({ rec: r, unit: allUnits.find((u) => u.id === r.unitId) }))
    .filter((x): x is { rec: typeof x.rec; unit: Unit } => Boolean(x.unit));

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Chip color="primary" label={inc.natureCode} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {inc.naturePlain}
            </Typography>
            <IncidentStatusChip status={inc.status} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {inc.eventNumber} · updated {formatRelative(inc.updatedTs)} · cor:{' '}
            <code>{correlationId}</code>
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Button component={Link} href="/incidents" variant="text">
          ← All incidents
        </Button>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Incident Summary
              </Typography>
              <Stack spacing={1} sx={{ mt: 1 }}>
                <Typography variant="body2">
                  <strong>Address:</strong> {inc.address}
                  {inc.apt ? ` · ${inc.apt}` : ''}
                </Typography>
                {inc.crossStreets && (
                  <Typography variant="body2">
                    <strong>Cross:</strong> {inc.crossStreets}
                  </Typography>
                )}
                <Stack direction="row" spacing={1}>
                  <ZoneChip zone={inc.zone} />
                  <Chip size="small" label={`Created ${formatTime(inc.createdTs)}`} variant="outlined" />
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
                  {inc.assignedUnits.map((uid) => {
                    const u = allUnits.find((x) => x.id === uid);
                    return (
                      <Stack key={uid} direction="row" spacing={0.5} alignItems="center">
                        <Chip size="small" label={uid} />
                        {u && <UnitStatusChip status={u.status} />}
                      </Stack>
                    );
                  })}
                  {inc.assignedUnits.length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                      No units assigned yet.
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Timeline · Related Radio Traffic
              </Typography>
              <Divider sx={{ my: 1.5 }} />
              <Stack spacing={1.25}>
                {events.length === 0 && (
                  <Typography color="text.secondary" variant="body2">
                    No related transcripts yet.
                  </Typography>
                )}
                {events.map((t) => (
                  <Box key={t.id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary" sx={{ width: 70 }}>
                        {formatTime(t.ts)}
                      </Typography>
                      <Chip size="small" variant="outlined" label={t.speaker} />
                      <SemanticBadge type={t.semanticType} />
                      {t.cueDetected && (
                        <Chip size="small" color="primary" label="CUE" variant="outlined" />
                      )}
                      {t.codesDetected.map((c) => (
                        <Chip key={c} size="small" label={c} variant="outlined" />
                      ))}
                    </Stack>
                    <Typography variant="body2" sx={{ ml: 9 }}>
                      {t.text}
                    </Typography>
                    {t.plainTalk && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 9, fontStyle: 'italic' }}
                      >
                        → {t.plainTalk}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="overline" color="text.secondary">
                  AI Suggestions
                </Typography>
                {sug && (
                  <Chip
                    size="small"
                    label={sug.state}
                    color={
                      sug.state === 'APPROVED'
                        ? 'success'
                        : sug.state === 'REJECTED'
                          ? 'error'
                          : 'warning'
                    }
                  />
                )}
                <Box sx={{ flexGrow: 1 }} />
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  disabled={!sug || approve.isPending || sug.state === 'APPROVED'}
                  onClick={() =>
                    sug &&
                    approve.mutate({
                      suggestionId: sug.id,
                      incidentId: inc.id,
                      actor: ACTOR,
                      correlationId,
                    })
                  }
                >
                  Approve
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  disabled={!sug || reject.isPending || sug.state === 'REJECTED'}
                  onClick={() =>
                    sug &&
                    reject.mutate({
                      suggestionId: sug.id,
                      incidentId: inc.id,
                      actor: ACTOR,
                      correlationId,
                    })
                  }
                >
                  Reject
                </Button>
              </Stack>
              <Divider sx={{ my: 1.5 }} />
              {!sug && (
                <Typography color="text.secondary" variant="body2">
                  No suggestion generated for this incident.
                </Typography>
              )}
              {sug && (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Field</TableCell>
                      <TableCell>Value</TableCell>
                      <TableCell>Conf</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sug.fields.map((f) => (
                      <FieldRow
                        key={f.key}
                        field={f}
                        editing={editingKey === f.key}
                        onEdit={() => {
                          setEditingKey(f.key);
                          setDraft(f.value);
                        }}
                        onCancel={() => setEditingKey(null)}
                        draftValue={draft}
                        onChangeValue={setDraft}
                        onCommit={() => {
                          editField.mutate(
                            {
                              suggestionId: sug.id,
                              incidentId: inc.id,
                              fieldKey: f.key,
                              value: draft,
                              actor: ACTOR,
                            },
                            { onSuccess: () => setEditingKey(null) }
                          );
                        }}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Unit Recommendation
              </Typography>
              <Divider sx={{ my: 1.5 }} />
              <Stack spacing={1}>
                {recommendedUnits.slice(0, 3).map(({ rec, unit }) => {
                  const already = inc.assignedUnits.includes(unit.id);
                  return (
                    <Stack
                      key={unit.id}
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{
                        p: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                      }}
                    >
                      <Chip size="small" label={unit.id} />
                      <Box sx={{ minWidth: 120 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {unit.officerName}
                        </Typography>
                        <Stack direction="row" spacing={0.5}>
                          <ZoneChip zone={unit.zone} />
                          <UnitStatusChip status={unit.status} />
                        </Stack>
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {rec.rationale}
                        </Typography>
                      </Box>
                      <ConfidenceChip value={rec.score} />
                      <Button
                        size="small"
                        variant="contained"
                        disabled={already || assignUnit.isPending}
                        onClick={() =>
                          assignUnit.mutate({
                            incidentId: inc.id,
                            unitId: unit.id,
                            actor: ACTOR,
                            rationale: rec.rationale,
                          })
                        }
                      >
                        {already ? 'Assigned' : 'Assign'}
                      </Button>
                    </Stack>
                  );
                })}
                {recommendedUnits.length === 0 && (
                  <Typography color="text.secondary" variant="body2">
                    No unit recommendations available.
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                CAD Write-back Preview
              </Typography>
              <Divider sx={{ my: 1.5 }} />
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1.5,
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: 12,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: 1,
                  overflow: 'auto',
                  maxHeight: 220,
                }}
              >
                {JSON.stringify(cadPayload, null, 2)}
              </Box>

              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  color="primary"
                  disabled={asrConfirmed || confirmAsr.isPending}
                  onClick={() =>
                    confirmAsr.mutate(
                      { incidentId: inc.id, actor: ACTOR, correlationId },
                      { onSuccess: () => setAsrConfirmed(true) }
                    )
                  }
                >
                  {asrConfirmed ? 'ASR Confirmed' : 'Confirm ASR'}
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  disabled={!asrConfirmed}
                  onClick={() => setCadOpen(true)}
                >
                  Submit to CAD
                </Button>
              </Stack>
              {!asrConfirmed && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Confirm ASR before submitting to CAD.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Box>

      <CadSubmitDialog
        open={cadOpen}
        onClose={() => setCadOpen(false)}
        incidentId={inc.id}
        eventNumber={inc.eventNumber}
        fields={sug?.fields ?? []}
        basePayload={cadPayload}
        correlationId={correlationId}
        actor={ACTOR}
      />
    </Stack>
  );
}
