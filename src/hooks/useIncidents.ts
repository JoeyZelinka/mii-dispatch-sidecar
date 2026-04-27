'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { incidentsService } from '@/services/incidentsService';
import { auditService } from '@/services/auditService';
import type { IncidentStatus } from '@/types/mii';
import { qk } from './queryKeys';

export const useIncidents = (status?: IncidentStatus) =>
  useQuery({
    queryKey: qk.incidents(status),
    queryFn: () => incidentsService.list({ status }),
  });

export const useIncident = (id: string) =>
  useQuery({
    queryKey: qk.incident(id),
    queryFn: async () => (await incidentsService.get(id)) ?? null,
    enabled: Boolean(id),
  });

export const useUpdateIncidentStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: IncidentStatus }) =>
      incidentsService.updateStatus(id, status),
    onSuccess: (inc) => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
      qc.invalidateQueries({ queryKey: qk.incident(inc.id) });
    },
  });
};

export const useAssignUnit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      incidentId,
      unitId,
      actor,
      rationale,
    }: {
      incidentId: string;
      unitId: string;
      actor: string;
      rationale?: string;
    }) => {
      const before = await incidentsService.get(incidentId);
      const after = await incidentsService.assignUnit(incidentId, unitId);
      await auditService.append({
        actor,
        actionType: 'EDIT',
        incidentId,
        before: { assignedUnits: before?.assignedUnits },
        after: { assignedUnits: after.assignedUnits, assigned: unitId, rationale },
      });
      return after;
    },
    onSuccess: (inc) => {
      qc.invalidateQueries({ queryKey: qk.incident(inc.id) });
      qc.invalidateQueries({ queryKey: ['incidents'] });
      qc.invalidateQueries({ queryKey: qk.units() });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
};
