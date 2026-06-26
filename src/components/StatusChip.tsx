'use client';

import { Chip, type ChipProps } from '@mui/material';
import type { CueType, IncidentStatus, SemanticType, UnitStatus, Zone } from '@/lib/mii/types';

const incidentStatusColor: Record<IncidentStatus, ChipProps['color']> = {
  ACTIVE: 'error',
  PENDING_REVIEW: 'warning',
  CLOSED: 'default',
  CONFLICT: 'error',
};

export const IncidentStatusChip = ({
  status,
  size = 'small',
}: {
  status: IncidentStatus;
  size?: ChipProps['size'];
}) => (
  <Chip
    size={size}
    color={incidentStatusColor[status]}
    label={status.replace('_', ' ')}
    variant={status === 'CLOSED' ? 'outlined' : 'filled'}
    sx={{ letterSpacing: 0.5 }}
  />
);

const unitStatusColor: Record<UnitStatus, ChipProps['color']> = {
  AVAILABLE: 'success',
  BUSY: 'warning',
  EN_ROUTE: 'info',
  ARRIVED: 'secondary',
  OUT_OF_SERVICE: 'error',
  OFF_DUTY: 'default',
};

export const UnitStatusChip = ({
  status,
  size = 'small',
}: {
  status: UnitStatus;
  size?: ChipProps['size'];
}) => (
  <Chip
    size={size}
    color={unitStatusColor[status]}
    variant={status === 'OFF_DUTY' || status === 'OUT_OF_SERVICE' ? 'outlined' : 'filled'}
    label={status.replace(/_/g, ' ')}
  />
);

export const ZoneChip = ({ zone, size = 'small' }: { zone: Zone; size?: ChipProps['size'] }) => (
  <Chip
    size={size}
    label={zone}
    variant="outlined"
    color={zone === 'Unknown' ? 'default' : 'primary'}
    sx={{ borderColor: 'rgba(255,255,255,0.18)' }}
  />
);

const semanticColor: Record<SemanticType, ChipProps['color']> = {
  NEW_EVENT: 'error',
  UPDATE: 'info',
  CONFIRMATION: 'success',
  ADMIN_CHATTER: 'default',
};

export const SemanticBadge = ({
  type,
  size = 'small',
}: {
  type: SemanticType;
  size?: ChipProps['size'];
}) => (
  <Chip
    size={size}
    color={semanticColor[type]}
    label={type.replace(/_/g, ' ')}
    variant={type === 'ADMIN_CHATTER' ? 'outlined' : 'filled'}
  />
);

const cueColor: Record<CueType, ChipProps['color']> = {
  ROUTING: 'primary',
  OFFICER_OPENER: 'error',
  PROTOCOL_TOKEN: 'info',
  UNIT_STATUS: 'success',
};

export const CueChip = ({
  cueType,
  phrase,
  size = 'small',
}: {
  cueType: CueType;
  phrase: string;
  size?: ChipProps['size'];
}) => (
  <Chip size={size} color={cueColor[cueType]} variant="outlined" label={`${cueType}: ${phrase}`} />
);

export const ConfidenceChip = ({
  value,
  size = 'small',
}: {
  value: number;
  size?: ChipProps['size'];
}) => {
  const pct = Math.round(value * 100);
  const color: ChipProps['color'] = pct >= 85 ? 'success' : pct >= 70 ? 'warning' : 'error';
  return <Chip size={size} color={color} variant="outlined" label={`${pct}%`} />;
};
