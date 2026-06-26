'use client';

import { Card, CardContent, Typography, Box, Button, Chip, Divider } from '@mui/material';
import EastIcon from '@mui/icons-material/East';
import type { IncidentContext, Unit, UnitRecommendation } from '@/lib/mii/types';
import { UnitStatusChip, ZoneChip, ConfidenceChip } from './StatusChip';

// Pull a unit's status progression out of the incident timeline, e.g.
// EN ROUTE → ARRIVED. Keeps the assigned unit's "responding" story visible.
function statusHistoryFor(incident: IncidentContext, unit: Unit): string[] {
  const order = ['ASSIGNED', 'EN ROUTE', 'ARRIVED', 'AVAILABLE', 'OUT OF SERVICE'];
  const found = new Set<string>();
  for (const ev of incident.timeline) {
    if (!ev.label.includes(unit.displayName)) continue;
    const label = ev.label.toUpperCase();
    for (const s of order) {
      if (label.includes(s)) found.add(s);
    }
  }
  return order.filter((s) => found.has(s));
}

export default function UnitRecommendationCard({
  incident,
  recommendations,
  units,
  onAssign,
}: {
  incident: IncidentContext;
  recommendations: UnitRecommendation[];
  units: Unit[];
  onAssign: (unitId: string) => void;
}) {
  const assignedUnitIds = incident.assignedUnits;
  const assignedUnits = assignedUnitIds
    .map((id) => units.find((u) => u.id === id))
    .filter((u): u is Unit => Boolean(u));

  // Never show an already-assigned unit in the backup list.
  const backups = recommendations.filter((r) => !assignedUnitIds.includes(r.unitId));
  const backupLabel =
    assignedUnits.length > 0 ? 'Available backup recommendations' : 'Recommended units';

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Unit Recommendation
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Zone-first ranking over AVAILABLE units. Deterministic and explainable.
        </Typography>

        {/* Assigned / responding units */}
        <Typography variant="overline" color="text.secondary">
          Assigned / Responding
        </Typography>
        {assignedUnits.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            No unit assigned yet. Assign a recommended unit below.
          </Typography>
        ) : (
          <Box sx={{ mb: 1.5 }}>
            {assignedUnits.map((unit) => {
              const history = statusHistoryFor(incident, unit);
              return (
                <Box
                  key={unit.id}
                  sx={{
                    p: 1,
                    mt: 0.5,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'success.main',
                    backgroundColor: 'rgba(74,222,128,0.08)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Chip size="small" color="success" label="RESPONDING" sx={{ fontWeight: 700 }} />
                    <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                      {unit.displayName} — {unit.officerName}
                    </Typography>
                    <UnitStatusChip status={unit.status} />
                  </Box>
                  {history.length > 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        mt: 0.75,
                        flexWrap: 'wrap',
                      }}
                    >
                      {history.map((step, i) => (
                        <Box key={step} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {i > 0 && (
                            <EastIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                          )}
                          <Chip size="small" variant="outlined" label={step} />
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}

        <Divider sx={{ my: 1.5 }} />

        {/* Backup / available recommendations */}
        <Typography variant="overline" color="text.secondary">
          {backupLabel}
        </Typography>
        {backups.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No further available units to recommend.
          </Typography>
        )}
        {backups.map((r, idx) => {
          const unit = units.find((u) => u.id === r.unitId);
          if (!unit) return null;
          return (
            <Box key={r.id}>
              {idx > 0 && <Divider sx={{ my: 1 }} />}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip size="small" color="primary" label={`#${idx + 1}`} />
                <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                  {unit.displayName} — {unit.officerName}
                </Typography>
                <ConfidenceChip value={r.confidence} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <UnitStatusChip status={unit.status} />
                <ZoneChip zone={unit.zone} />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {r.rationale}
              </Typography>
              <Button
                size="small"
                variant="contained"
                onClick={() => onAssign(unit.id)}
                sx={{ mt: 1 }}
              >
                Assign Unit
              </Button>
            </Box>
          );
        })}
      </CardContent>
    </Card>
  );
}
