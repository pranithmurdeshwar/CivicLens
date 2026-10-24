/**
 * Shared test bootstrap: a fresh in-memory store with demo users and default
 * configuration for every test file.
 */
import { installTestStore } from '../db';
import { DEMO_USERS } from '../auth';
import { KEYS } from '../db';
import { getDataStore } from '../../lib/store';

export function resetTestState(): void {
  installTestStore();
  getDataStore().write(KEYS.users, DEMO_USERS.map((u) => ({ ...u })));
}

/** Compact future date helper for deterministic ageing. */
export function backdate(key: 'issues' | 'ledger', id: string, field: string, iso: string): void {
  const ds = getDataStore();
  const mapKey = key === 'issues' ? KEYS.issues : KEYS.ledger;
  const list = ds.read<Record<string, unknown>[]>(mapKey, []);
  ds.write(
    mapKey,
    list.map((item) => (item.id === id || (key === 'ledger' && item.eventId === id) ? { ...item, [field]: iso } : item)),
  );
}
