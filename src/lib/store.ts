/**
 * Prototype storage mechanism for CivicLens AI.
 *
 * A tiny namespaced key/value store over localStorage with a transparent
 * in-memory fallback (used in sandboxed previews and tests, where localStorage
 * is unavailable). All CivicLens collections — including the civic-score
 * contribution ledger — persist through this single mechanism.
 */

export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
  remove(key: string): void {
    this.map.delete(key);
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private ls: Storage) {}
  get(key: string): string | null {
    return this.ls.getItem(key);
  }
  set(key: string, value: string): void {
    this.ls.setItem(key, value);
  }
  remove(key: string): void {
    this.ls.removeItem(key);
  }
}

export type StorageMode = 'local' | 'memory';

function detectAdapter(): { adapter: StorageAdapter; mode: StorageMode } {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const probe = '__civiclens_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return { adapter: new LocalStorageAdapter(window.localStorage), mode: 'local' };
    }
  } catch {
    /* sandboxed iframe or blocked storage — fall through to memory */
  }
  return { adapter: new MemoryStorageAdapter(), mode: 'memory' };
}

export class DataStore {
  version = 0;
  mode: StorageMode;
  private listeners = new Set<() => void>();

  constructor(
    public adapter: StorageAdapter,
    public namespace = 'civiclens.v1',
  ) {
    this.mode = adapter instanceof LocalStorageAdapter ? 'local' : 'memory';
  }

  private full(key: string): string {
    return `${this.namespace}:${key}`;
  }

  read<T>(key: string, fallback: T): T {
    try {
      const raw = this.adapter.get(this.full(key));
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  write<T>(key: string, value: T): void {
    try {
      this.adapter.set(this.full(key), JSON.stringify(value));
    } catch {
      /* quota/blocked — memory keeps working for the session */
    }
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  remove(key: string): void {
    try {
      this.adapter.remove(this.full(key));
    } catch {
      /* ignore */
    }
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  has(key: string): boolean {
    try {
      return this.adapter.get(this.full(key)) != null;
    } catch {
      return false;
    }
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  getVersion = (): number => this.version;
}

let currentStore: DataStore = new DataStore(detectAdapter().adapter);

export function getDataStore(): DataStore {
  return currentStore;
}

export function setDataStore(store: DataStore): void {
  currentStore = store;
}

export function storageMode(): StorageMode {
  return currentStore.mode;
}
