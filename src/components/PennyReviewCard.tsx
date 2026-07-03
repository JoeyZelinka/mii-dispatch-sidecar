'use client';

import * as React from 'react';
import { Card, CardContent, Typography, Box, Chip, Divider, Alert, Button, TextField } from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import type {
  PennyReviewState,
  PennyTranscriptPackage,
  PennyTranscriptionPlan,
  TranscriptQualityIssue,
} from '@/lib/mii/types';
import type { PennyQualityGateResult } from '@/lib/mii/penny';

const GATE_COLOR: Record<PennyQualityGateResult['status'], 'success' | 'warning' | 'error'> = {
  PASS: 'success',
  WARNING: 'warning',
  BLOCKED: 'error',
};

const SEVERITY_COLOR = { INFO: 'default', WARNING: 'warning', BLOCKING: 'error' } as const;

function issueStateLabel(
  issue: TranscriptQualityIssue,
  reviewState?: PennyReviewState
): 'acknowledged' | 'overridden' | 'unresolved' {
  if (reviewState?.overriddenIssueIds.includes(issue.id)) return 'overridden';
  if (reviewState?.acknowledgedIssueIds.includes(issue.id)) return 'acknowledged';
  return 'unresolved';
}

export default function PennyReviewCard({
  plan,
  pkg,
  reviewState,
  gate,
  onAcknowledgeIssue,
  onOverrideIssue,
  onAddNote,
  onEvaluateReadiness,
}: {
  plan: PennyTranscriptionPlan;
  pkg: PennyTranscriptPackage;
  reviewState?: PennyReviewState;
  gate: PennyQualityGateResult;
  onAcknowledgeIssue?: (issueId: string) => void;
  onOverrideIssue?: (issueId: string, note: string) => void;
  onAddNote?: (note: string) => void;
  onEvaluateReadiness?: () => void;
}) {
  const [overrideNotes, setOverrideNotes] = React.useState<Record<string, string>>({});
  const [note, setNote] = React.useState('');

  return (
    <Card variant="outlined" sx={{ borderColor: `${GATE_COLOR[gate.status]}.main` }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
          <FactCheckIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
            PENNY Human Review
          </Typography>
          <Chip size="small" color={GATE_COLOR[gate.status]} label={gate.status} />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {gate.summary}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
          <Chip size="small" variant="outlined" color="error" label={`${gate.blockingCount} blocking`} />
          <Chip size="small" variant="outlined" color="warning" label={`${gate.warningCount} warnings`} />
          <Chip size="small" variant="outlined" label={`${gate.infoCount} info`} />
          <Chip size="small" variant="outlined" label={`${gate.unresolvedWarningCount} unresolved warn`} />
          <Chip size="small" variant="outlined" label={`${gate.unresolvedBlockingCount} unresolved block`} />
        </Box>

        <Divider sx={{ my: 1 }} />
        <Typography variant="overline" color="text.secondary">
          Quality issues
        </Typography>
        {pkg.qualityIssues.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No quality issues.
          </Typography>
        )}
        {pkg.qualityIssues.map((iss) => {
          const st = issueStateLabel(iss, reviewState);
          return (
            <Box key={iss.id} sx={{ mb: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip size="small" color={SEVERITY_COLOR[iss.severity]} variant="outlined" label={iss.severity} />
                <Typography variant="caption" color="text.secondary">
                  {iss.kind.replace(/_/g, ' ')}
                  {iss.confidence != null ? ` · ${Math.round(iss.confidence * 100)}%` : ''}
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Chip
                  size="small"
                  color={st === 'unresolved' ? 'default' : 'success'}
                  variant={st === 'unresolved' ? 'outlined' : 'filled'}
                  label={st}
                />
              </Box>
              <Typography variant="caption" sx={{ display: 'block' }}>
                {iss.summary}
              </Typography>
              {st === 'unresolved' && iss.severity !== 'BLOCKING' && (
                <Button
                  size="small"
                  onClick={() => onAcknowledgeIssue?.(iss.id)}
                  sx={{ mt: 0.25 }}
                >
                  {iss.severity === 'WARNING' ? 'Acknowledge Warning' : 'Acknowledge'}
                </Button>
              )}
              {st === 'unresolved' && iss.severity === 'BLOCKING' && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
                  <TextField
                    size="small"
                    label="Override note (required)"
                    value={overrideNotes[iss.id] ?? ''}
                    onChange={(e) => setOverrideNotes((p) => ({ ...p, [iss.id]: e.target.value }))}
                    sx={{ minWidth: 240 }}
                  />
                  <Button
                    size="small"
                    color="warning"
                    variant="outlined"
                    disabled={!(overrideNotes[iss.id] ?? '').trim()}
                    onClick={() => onOverrideIssue?.(iss.id, overrideNotes[iss.id] ?? '')}
                  >
                    Override with Note
                  </Button>
                </Box>
              )}
            </Box>
          );
        })}

        {reviewState && reviewState.reviewNotes.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="overline" color="text.secondary">
              Review notes
            </Typography>
            {reviewState.reviewNotes.map((n, i) => (
              <Typography key={i} variant="caption" sx={{ display: 'block' }}>
                • {n}
              </Typography>
            ))}
          </>
        )}

        <Divider sx={{ my: 1 }} />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Review note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            sx={{ minWidth: 240, flexGrow: 1 }}
          />
          <Button
            size="small"
            variant="outlined"
            disabled={!note.trim()}
            onClick={() => {
              onAddNote?.(note.trim());
              setNote('');
            }}
          >
            Add Review Note
          </Button>
          <Button size="small" variant="contained" onClick={() => onEvaluateReadiness?.()}>
            Evaluate Review Readiness
          </Button>
        </Box>

        <Alert severity="info" icon={false} sx={{ mt: 1, py: 0.25 }}>
          Human review affects transcript attachment readiness only. It does not create incidents or
          write CAD.
        </Alert>
      </CardContent>
    </Card>
  );
}
