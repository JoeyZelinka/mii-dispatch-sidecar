'use client';

import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Stack } from '@/components/Stack';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useAudit } from '@/hooks/useAudit';
import { formatDateTime } from '@/lib/format';
import type { ActionType } from '@/types/mii';

const ACTIONS: ActionType[] = [
  'APPROVE',
  'REJECT',
  'EDIT',
  'CONFIRM_ASR',
  'SUBMIT_TO_CAD',
];

const actionColor = (a: ActionType) =>
  a === 'APPROVE'
    ? 'success'
    : a === 'REJECT'
      ? 'error'
      : a === 'SUBMIT_TO_CAD'
        ? 'primary'
        : a === 'CONFIRM_ASR'
          ? 'info'
          : 'default';

const JsonBlock = ({
  title,
  value,
  tone,
}: {
  title: string;
  value: unknown;
  tone: 'before' | 'after' | 'payload';
}) => {
  if (value === undefined || value === null) return null;
  const bg =
    tone === 'before'
      ? 'rgba(255,107,107,0.06)'
      : tone === 'after'
        ? 'rgba(74,222,128,0.06)'
        : 'rgba(78,161,255,0.06)';
  return (
    <Box sx={{ flex: 1, minWidth: 240 }}>
      <Typography variant="overline" color="text.secondary">
        {title}
      </Typography>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1,
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: 12,
          backgroundColor: bg,
          borderRadius: 1,
          maxHeight: 220,
          overflow: 'auto',
        }}
      >
        {JSON.stringify(value, null, 2)}
      </Box>
    </Box>
  );
};

export default function AuditClient() {
  const [actionType, setActionType] = React.useState<ActionType | 'ALL'>('ALL');
  const [incidentId, setIncidentId] = React.useState('');
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  const { data } = useAudit({
    actionType: actionType === 'ALL' ? undefined : actionType,
    incidentId: incidentId.trim() || undefined,
  });

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Audit Log
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Every dispatcher action with before/after diffs and correlation IDs.
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Action</InputLabel>
          <Select
            label="Action"
            value={actionType}
            onChange={(e) => setActionType(e.target.value as ActionType | 'ALL')}
          >
            <MenuItem value="ALL">All actions</MenuItem>
            {ACTIONS.map((a) => (
              <MenuItem key={a} value={a}>
                {a.replace(/_/g, ' ')}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Incident ID"
          value={incidentId}
          onChange={(e) => setIncidentId(e.target.value)}
          placeholder="INC-2025"
        />
      </Stack>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }} />
                <TableCell sx={{ width: 170 }}>Time</TableCell>
                <TableCell sx={{ width: 130 }}>Action</TableCell>
                <TableCell sx={{ width: 140 }}>Actor</TableCell>
                <TableCell sx={{ width: 130 }}>Incident</TableCell>
                <TableCell>Correlation</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data ?? []).map((a) => {
                const isOpen = Boolean(open[a.id]);
                const hasDetails =
                  a.before !== undefined || a.after !== undefined || a.payload !== undefined;
                return (
                  <React.Fragment key={a.id}>
                    <TableRow hover>
                      <TableCell>
                        {hasDetails && (
                          <IconButton
                            size="small"
                            onClick={() =>
                              setOpen((prev) => ({ ...prev, [a.id]: !isOpen }))
                            }
                          >
                            {isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                          </IconButton>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{formatDateTime(a.ts)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={actionColor(a.actionType)}
                          label={a.actionType.replace(/_/g, ' ')}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{a.actor}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" label={a.incidentId} />
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="caption"
                          sx={{ fontFamily: 'ui-monospace, Menlo, monospace' }}
                        >
                          {a.correlationId}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 0, borderBottom: 'none' }}>
                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2 }}>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                              <JsonBlock title="Before" value={a.before} tone="before" />
                              <JsonBlock title="After" value={a.after} tone="after" />
                              <JsonBlock title="Payload" value={a.payload} tone="payload" />
                            </Stack>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary" sx={{ p: 2 }}>
                      No audit entries match.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  );
}
