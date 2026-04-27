import type { ActionType, AuditEntry } from '@/types/mii';
import { nextAuditId, nextCorrelationId, store } from './store';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export interface AuditFilter {
  actionType?: ActionType;
  incidentId?: string;
}

export const auditService = {
  async list(filter?: AuditFilter): Promise<AuditEntry[]> {
    let result = store.audit.slice();
    if (filter?.actionType) result = result.filter((a) => a.actionType === filter.actionType);
    if (filter?.incidentId) result = result.filter((a) => a.incidentId === filter.incidentId);
    return clone(result.sort((a, b) => b.ts.localeCompare(a.ts)));
  },
  async append(entry: Omit<AuditEntry, 'id' | 'ts' | 'correlationId'> & {
    correlationId?: string;
  }): Promise<AuditEntry> {
    const created: AuditEntry = {
      id: nextAuditId(),
      ts: new Date().toISOString(),
      correlationId: entry.correlationId ?? nextCorrelationId(),
      actor: entry.actor,
      actionType: entry.actionType,
      incidentId: entry.incidentId,
      before: entry.before,
      after: entry.after,
      payload: entry.payload,
    };
    store.audit.unshift(created);
    return clone(created);
  },
  newCorrelationId(): string {
    return nextCorrelationId();
  },
};
