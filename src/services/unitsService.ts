import type { Unit, UnitStatus } from '@/types/mii';
import { store } from './store';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export const unitsService = {
  async list(): Promise<Unit[]> {
    return clone(store.units.slice().sort((a, b) => a.id.localeCompare(b.id)));
  },
  async get(id: string): Promise<Unit | undefined> {
    const u = store.units.find((u) => u.id === id);
    return u ? clone(u) : undefined;
  },
  async search(q: string): Promise<Unit[]> {
    const needle = q.trim().toLowerCase();
    if (!needle) return this.list();
    return clone(
      store.units.filter(
        (u) =>
          u.id.toLowerCase().includes(needle) ||
          (u.officerName ?? '').toLowerCase().includes(needle)
      )
    );
  },
  async updateStatus(id: string, status: UnitStatus): Promise<Unit> {
    const idx = store.units.findIndex((u) => u.id === id);
    if (idx < 0) throw new Error(`Unit ${id} not found`);
    store.units[idx] = {
      ...store.units[idx],
      status,
      lastUpdateTs: new Date().toISOString(),
    };
    return clone(store.units[idx]);
  },
  async assignToIncident(unitId: string, incidentId: string): Promise<Unit> {
    const idx = store.units.findIndex((u) => u.id === unitId);
    if (idx < 0) throw new Error(`Unit ${unitId} not found`);
    store.units[idx] = {
      ...store.units[idx],
      currentIncidentId: incidentId,
      status: 'EN_ROUTE',
      lastUpdateTs: new Date().toISOString(),
    };
    return clone(store.units[idx]);
  },
};
