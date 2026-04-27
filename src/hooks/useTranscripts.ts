'use client';

import { useQuery } from '@tanstack/react-query';
import { transcriptsService, type TranscriptFilter } from '@/services/transcriptsService';
import { qk } from './queryKeys';

export const useTranscripts = (filter?: TranscriptFilter) =>
  useQuery({
    queryKey: qk.transcripts(filter),
    queryFn: () => transcriptsService.list(filter),
  });
