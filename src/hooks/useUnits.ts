'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unitsService } from '@/services/unitsService';
import { auditService } from '@/services/auditService';
import type { UnitStatus } from '@/types/mii';
import { qk } from './queryKeys';

export const useUnits = () =>
  useQuery({ queryKey: qk.units(), queryFn: () => unitsService.list() });

export const useUnitsSearch = (q: string) =>
  useQuery({
    queryKey: qk.unitsSearch(q),
    queryFn: () => unitsService.search(q),
  });

export const useUpdateUnitStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      actor,
    }: {
      id: string;
      status: UnitStatus;
      actor: string;
    }) => {
      const before = await unitsService.get(id);
      const after = await unitsService.updateStatus(id, status);
      await auditService.append({
        actor,
        actionType: 'EDIT',
        incidentId: before?.currentIncidentId ?? '-',
        before: { unit: id, status: before?.status },
        after: { unit: id, status: after.status },
      });
      return after;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.units() });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
};
