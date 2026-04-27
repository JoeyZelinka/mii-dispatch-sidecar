'use client';

import { useQuery } from '@tanstack/react-query';
import { auditService, type AuditFilter } from '@/services/auditService';
import { qk } from './queryKeys';

export const useAudit = (filter?: AuditFilter) =>
  useQuery({
    queryKey: qk.audit(filter),
    queryFn: () => auditService.list(filter),
  });
