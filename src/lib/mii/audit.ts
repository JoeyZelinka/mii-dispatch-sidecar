import type { AuditAction, AuditEvent } from './types';
import { makeId, nowIso } from './util';

export interface AuditInput {
  correlationId: string;
  action: AuditAction;
  actor: string;
  summary: string;
  incidentId?: string;
  before?: unknown;
  after?: unknown;
}

// Construct a single, defensible audit event. Append-only by convention.
export function makeAuditEvent(input: AuditInput): AuditEvent {
  return {
    id: makeId('audit'),
    correlationId: input.correlationId,
    incidentId: input.incidentId,
    action: input.action,
    actor: input.actor,
    timestamp: nowIso(),
    summary: input.summary,
    before: input.before,
    after: input.after,
  };
}

export function newCorrelationId(): string {
  return makeId('corr');
}
