import { useSyncExternalStore } from 'react';
import { getDataStore } from './store';

/** Re-renders the component whenever any service writes to the data store. */
export function useAppVersion(): number {
  const ds = getDataStore();
  return useSyncExternalStore(ds.subscribe, ds.getVersion, () => 0);
}
