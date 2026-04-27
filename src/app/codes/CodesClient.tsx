'use client';

import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Stack } from '@/components/Stack';
import StarIcon from '@mui/icons-material/Star';
import { useCodes } from '@/hooks/useCodes';

type Cat = '10-codes' | 'Q-codes' | 'ALL';

export default function CodesClient() {
  const [q, setQ] = React.useState('');
  const [cat, setCat] = React.useState<Cat>('ALL');
  const [localOnly, setLocalOnly] = React.useState(false);

  const { data } = useCodes({
    q,
    category: cat === 'ALL' ? undefined : cat,
    localOnly,
  });

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Code Dictionary
          </Typography>
          <Typography variant="body2" color="text.secondary">
            10-codes and Q-codes with plain-talk translations and local overrides.
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <TextField
          size="small"
          placeholder="Search codes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ width: 280 }}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={cat}
          onChange={(_, v) => v && setCat(v)}
        >
          <ToggleButton value="ALL">All</ToggleButton>
          <ToggleButton value="10-codes">10-codes</ToggleButton>
          <ToggleButton value="Q-codes">Q-codes</ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel
          control={
            <Switch
              checked={localOnly}
              onChange={(e) => setLocalOnly(e.target.checked)}
            />
          }
          label="Local only"
        />
      </Stack>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 110 }}>Code</TableCell>
                <TableCell sx={{ width: 110 }}>Category</TableCell>
                <TableCell>Meaning</TableCell>
                <TableCell>Plain Talk</TableCell>
                <TableCell sx={{ width: 110 }}>Local</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data ?? []).map((c) => (
                <TableRow
                  key={`${c.category}-${c.code}`}
                  sx={{
                    backgroundColor: c.localOverride ? 'rgba(122,215,192,0.06)' : 'transparent',
                  }}
                >
                  <TableCell>
                    <Chip size="small" color="primary" label={c.code} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={c.category}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{c.meaning}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {c.plainTalk}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {c.localOverride && (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <StarIcon fontSize="inherit" sx={{ color: 'secondary.main' }} />
                        <Typography variant="caption" color="secondary.light">
                          Local
                        </Typography>
                      </Stack>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary" sx={{ p: 2 }}>
                      No codes match.
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
