/**
 * IndexedDB persistence. localStorage is not an option here — its ~5 MB quota
 * is easily blown by a handful of GPX files, which we keep verbatim so a trail
 * can be re-parsed (and re-exported) exactly as imported.
 */
import { DEFAULT_SETTINGS, type Settings } from './trails';

const DB_NAME = 'oh-trail-map';
const DB_VERSION = 1;
const TRAILS = 'trails';
const SETTINGS = 'settings';
const SETTINGS_KEY = 'app';

export type TrailRecord = {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  gpxText: string;
  addedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TRAILS)) {
        db.createObjectStore(TRAILS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SETTINGS)) {
        db.createObjectStore(SETTINGS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function loadTrails(): Promise<TrailRecord[]> {
  const all = await run<TrailRecord[]>(TRAILS, 'readonly', (s) => s.getAll());
  return all.sort((a, b) => a.addedAt - b.addedAt);
}

export function putTrail(record: TrailRecord): Promise<unknown> {
  return run(TRAILS, 'readwrite', (s) => s.put(record));
}

export function deleteTrail(id: string): Promise<unknown> {
  return run(TRAILS, 'readwrite', (s) => s.delete(id));
}

export async function loadSettings(): Promise<Settings> {
  const stored = await run<Settings | undefined>(SETTINGS, 'readonly', (s) =>
    s.get(SETTINGS_KEY),
  );
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export function saveSettings(settings: Settings): Promise<unknown> {
  return run(SETTINGS, 'readwrite', (s) => s.put(settings, SETTINGS_KEY));
}
