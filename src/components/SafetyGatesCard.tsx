'use client';

import { Card, CardContent, Typography, Box, Chip, Divider } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ShieldIcon from '@mui/icons-material/Shield';
import type { IncidentContext, MockCadPayload, Unit } from '@/lib/mii/types';
import {
  evaluateGates,
  requiresUnit,
  sensitiveFields,
  hasUnconfirmedSensitive,
  canSubmitMockCad,
  type GateStatus,
} from '@/lib/mii/safetyGates';

const statusVisual: Record<
  GateStatus,
  { color: 'success' | 'warning' | 'error'; icon: React.ReactNode; label: string }
> = {
  pass: { color: 'success', icon: <CheckCircleIcon fontSize="small" />, label: 'PASS' },
  warning: { color: 'warning', icon: <WarningAmberIcon fontSize="small" />, label: 'WARNING' },
  fail: { color: 'error', icon: <BlockIcon fontSize="small" />, label: 'BLOCKED' },
};

type ChecklistState = 'Done' | 'Required' | 'Warning' | 'Optional' | 'Blocked';

const checklistVisual: Record<
  ChecklistState,
  { color: 'success' | 'warning' | 'error' | 'default'; icon: React.ReactNode }
> = {
  Done: { color: 'success', icon: <CheckCircleIcon fontSize="small" color="success" /> },
  Warning: { color: 'warning', icon: <WarningAmberIcon fontSize="small" color="warning" /> },
  Required: { color: 'default', icon: <RadioButtonUncheckedIcon fontSize="small" color="disabled" /> },
  Optional: { color: 'default', icon: <RadioButtonUncheckedIcon fontSize="small" color="disabled" /> },
  Blocked: { color: 'error', icon: <BlockIcon fontSize="small" color="error" /> },
};

function buildChecklist(
  incident: IncidentContext,
  payload?: MockCadPayload
): { label: string; state: ChecklistState; detail: string }[] {
  const nonSensitive = incident.suggestedFields.filter((f) => !f.sensitive);
  const fieldsApplied = nonSensitive.length > 0 && nonSensitive.every((f) => f.confirmed);
  const needsUnit = requiresUnit(incident);
  const hasUnit = incident.assignedUnits.length > 0;
  const sensitive = sensitiveFields(incident);
  const submitOk = canSubmitMockCad(incident);

  return [
    {
      label: 'Confirm ASR',
      state: incident.asrConfirmed ? 'Done' : 'Required',
      detail: incident.asrConfirmed
        ? 'ASR confirmed by reviewer.'
        : 'Required before mock CAD submission.',
    },
    {
      label: 'Apply Suggested Fields',
      state: nonSensitive.length === 0 ? 'Optional' : fieldsApplied ? 'Done' : 'Required',
      detail:
        nonSensitive.length === 0
          ? 'No non-sensitive fields to apply.'
          : fieldsApplied
            ? 'All non-sensitive suggested fields applied.'
            : 'Apply extracted fields into the incident record.',
    },
    {
      label: 'Assign Unit',
      state: hasUnit ? 'Done' : needsUnit ? 'Required' : 'Optional',
      detail: hasUnit
        ? `${incident.assignedUnits.length} responding unit(s) assigned.`
        : needsUnit
          ? 'A responding unit is required for this incident type.'
          : 'No responding unit required.',
    },
    {
      label: 'Review Sensitive Fields',
      state:
        sensitive.length === 0
          ? 'Optional'
          : hasUnconfirmedSensitive(incident)
            ? 'Warning'
            : 'Done',
      detail:
        sensitive.length === 0
          ? 'No sensitive fields detected.'
          : hasUnconfirmedSensitive(incident)
            ? 'Unconfirmed sensitive fields will be excluded from the payload.'
            : 'All sensitive fields explicitly confirmed.',
    },
    {
      label: 'Submit Mock CAD',
      state: payload ? 'Done' : submitOk ? 'Required' : 'Blocked',
      detail: payload
        ? 'Mock CAD payload built (NOT SENT).'
        : submitOk
          ? 'All blocking gates pass — ready to submit.'
          : 'Blocked by one or more safety gates above.',
    },
  ];
}

export default function SafetyGatesCard({
  incident,
  payload,
}: {
  incident: IncidentContext;
  units?: Unit[];
  payload?: MockCadPayload;
}) {
  const gates = evaluateGates(incident);
  const checklist = buildChecklist(incident, payload);

  return (
    <Card sx={{ borderColor: 'primary.main', borderWidth: 1, borderStyle: 'solid' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <ShieldIcon color="primary" fontSize="small" />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Safety Gates
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Human-in-the-loop controls before mock CAD submission
        </Typography>

        {gates.map((g, idx) => {
          const v = statusVisual[g.status];
          return (
            <Box key={g.id}>
              {idx > 0 && <Divider sx={{ my: 1 }} />}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip size="small" color={v.color} icon={v.icon as React.ReactElement} label={v.label} />
                <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                  Gate {g.id} — {g.title}
                </Typography>
                {g.blocking ? (
                  <Chip size="small" variant="outlined" label="Blocking" />
                ) : (
                  <Chip size="small" variant="outlined" color="info" label="Advisory" />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                {g.message}
              </Typography>
            </Box>
          );
        })}

        <Divider sx={{ my: 1.5 }} />
        <Typography variant="overline" color="text.secondary">
          Review checklist
        </Typography>
        <Box sx={{ mt: 0.5 }}>
          {checklist.map((item) => {
            const cv = checklistVisual[item.state];
            return (
              <Box
                key={item.label}
                sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.5 }}
              >
                <Box sx={{ mt: '2px' }}>{cv.icon}</Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>
                      {item.label}
                    </Typography>
                    <Chip size="small" variant="outlined" color={cv.color} label={item.state} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {item.detail}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}
