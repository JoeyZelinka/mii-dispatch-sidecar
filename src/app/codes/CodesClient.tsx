'use client';

import {
  Box,
  Card,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
} from '@mui/material';
import { CODE_DICTIONARY } from '@/lib/mii/dictionary';
import PageHeader from '@/components/PageHeader';

const typeColor = {
  Signal: 'error',
  'Q-Code': 'info',
  'Plain-Talk': 'success',
} as const;

export default function CodesClient() {
  return (
    <Box>
      <PageHeader
        title="Code Dictionary"
        subtitle="Local code / Q-code → plain-talk translation table used by the deterministic classifier"
      />
      <Card>
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code / Token</TableCell>
                <TableCell>Plain Meaning</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {CODE_DICTIONARY.map((entry) => (
                <TableRow key={entry.code} hover>
                  <TableCell sx={{ fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>
                    {entry.code}
                  </TableCell>
                  <TableCell>{entry.meaning}</TableCell>
                  <TableCell>
                    <Chip size="small" color={typeColor[entry.type]} label={entry.type} />
                  </TableCell>
                  <TableCell>
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                      {entry.notes}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}
