'use client';

import { useQuery } from '@tanstack/react-query';
import { codesService, type CodeFilter } from '@/services/codesService';
import { qk } from './queryKeys';

export const useCodes = (filter?: CodeFilter) =>
  useQuery({
    queryKey: qk.codes(filter),
    queryFn: () => codesService.list(filter),
  });
