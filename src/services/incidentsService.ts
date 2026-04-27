import type { Incident, IncidentStatus } from '@/types/mii';
import { store } from './store';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export const incidentsService = {
  async list(filter?: { status?: IncidentStatus }): Promise<Incident[]> {
    let result = store.incidents.slice();
    if (filter?.status) result = result.filter((i) => i.status === filter.status);
    return clone(result.sort((a, b) => b.updatedTs.localeCompare(a.updatedTs)));
  },
  async get(id: string): Promise<Incident | undefined> {
    const found = store.incidents.find((i) => i.id === id);
    return found ? clone(found) : undefined;
  },
  async updateStatus(id: string, status: IncidentStatus): Promise<Incident> {
    const idx = store.incidents.findIndex((i) => i.id === id);
    if (idx < 0) throw new Error(`Incident ${id} not found`);
    store.incidents[idx] = {
      ...store.incidents[idx],
      status,
      updatedTs: new Date().toISOString(),
    };
    return clone(store.incidents[idx]);
  },
  async assignUnit(incidentId: string, unitId: string): Promise<Incident> {
    const idx = store.incidents.findIndex((i) => i.id === incidentId);
    if (idx < 0) throw new Error(`Incident ${incidentId} not found`);
    const inc = store.incidents[idx];
    if (!inc.assignedUnits.includes(unitId)) {
      inc.assignedUnits = [...inc.assignedUnits, unitId];
    }
    inc.updatedTs = new Date().toISOString();
    store.incidents[idx] = inc;
    return clone(inc);
  },
};
