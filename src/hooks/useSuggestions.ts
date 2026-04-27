'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { suggestionsService } from '@/services/suggestionsService';
import { auditService } from '@/services/auditService';
import { qk } from './queryKeys';

export const useSuggestionForIncident = (incidentId: string) =>
  useQuery({
    queryKey: qk.suggestion(incidentId),
    queryFn: async () => (await suggestionsService.getForIncident(incidentId)) ?? null,
    enabled: Boolean(incidentId),
  });

export const useSuggestions = () =>
  useQuery({ queryKey: qk.suggestions(), queryFn: () => suggestionsService.list() });

export const useApproveSuggestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      suggestionId,
      incidentId,
      actor,
      correlationId,
    }: {
      suggestionId: string;
      incidentId: string;
      actor: string;
      correlationId?: string;
    }) => {
      const before = await suggestionsService.getForIncident(incidentId);
      const updated = await suggestionsService.setState(suggestionId, 'APPROVED');
      await auditService.append({
        actor,
        actionType: 'APPROVE',
        incidentId,
        correlationId,
        before: { state: before?.state },
        after: { state: updated.state, fields: updated.fields },
      });
      return updated;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: qk.suggestion(s.incidentId) });
      qc.invalidateQueries({ queryKey: qk.suggestions() });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
};

export const useRejectSuggestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      suggestionId,
      incidentId,
      actor,
      correlationId,
    }: {
      suggestionId: string;
      incidentId: string;
      actor: string;
      correlationId?: string;
    }) => {
      const before = await suggestionsService.getForIncident(incidentId);
      const updated = await suggestionsService.setState(suggestionId, 'REJECTED');
      await auditService.append({
        actor,
        actionType: 'REJECT',
        incidentId,
        correlationId,
        before: { state: before?.state, fields: before?.fields },
        after: { state: updated.state },
      });
      return updated;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: qk.suggestion(s.incidentId) });
      qc.invalidateQueries({ queryKey: qk.suggestions() });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
};

export const useEditSuggestionField = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      suggestionId,
      incidentId,
      fieldKey,
      value,
      actor,
    }: {
      suggestionId: string;
      incidentId: string;
      fieldKey: string;
      value: string;
      actor: string;
    }) => {
      const { suggestion, before, after } = await suggestionsService.editField(
        suggestionId,
        fieldKey,
        value
      );
      await auditService.append({
        actor,
        actionType: 'EDIT',
        incidentId,
        before: { [before.key]: before.value },
        after: { [after.key]: after.value },
      });
      return suggestion;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: qk.suggestion(s.incidentId) });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
};

export const useConfirmAsr = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      incidentId,
      actor,
      correlationId,
    }: {
      incidentId: string;
      actor: string;
      correlationId?: string;
    }) => {
      return auditService.append({
        actor,
        actionType: 'CONFIRM_ASR',
        incidentId,
        correlationId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
};

export const useSubmitToCad = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      incidentId,
      actor,
      correlationId,
      payload,
    }: {
      incidentId: string;
      actor: string;
      correlationId?: string;
      payload: unknown;
    }) => {
      await new Promise((r) => setTimeout(r, 700));
      return auditService.append({
        actor,
        actionType: 'SUBMIT_TO_CAD',
        incidentId,
        correlationId,
        payload,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
};
