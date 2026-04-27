import type { CodeEntry } from '@/types/mii';
import { store } from './store';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export interface CodeFilter {
  q?: string;
  category?: '10-codes' | 'Q-codes';
  localOnly?: boolean;
}

export const codesService = {
  async list(filter?: CodeFilter): Promise<CodeEntry[]> {
    let result = store.codes.slice();
    if (filter?.category) result = result.filter((c) => c.category === filter.category);
    if (filter?.localOnly) result = result.filter((c) => Boolean(c.localOverride));
    if (filter?.q) {
      const q = filter.q.trim().toLowerCase();
      if (q) {
        result = result.filter(
          (c) =>
            c.code.toLowerCase().includes(q) ||
            c.meaning.toLowerCase().includes(q) ||
            c.plainTalk.toLowerCase().includes(q)
        );
      }
    }
    return clone(result.sort((a, b) => a.code.localeCompare(b.code)));
  },
};
