export const qk = {
  incidents: (status?: string) => ['incidents', status ?? 'all'] as const,
  incident: (id: string) => ['incident', id] as const,
  units: () => ['units'] as const,
  unitsSearch: (q: string) => ['units', 'search', q] as const,
  suggestion: (incidentId: string) => ['suggestion', incidentId] as const,
  suggestions: () => ['suggestions'] as const,
  transcripts: (filter?: unknown) => ['transcripts', filter ?? 'all'] as const,
  codes: (filter?: unknown) => ['codes', filter ?? 'all'] as const,
  audit: (filter?: unknown) => ['audit', filter ?? 'all'] as const,
};
