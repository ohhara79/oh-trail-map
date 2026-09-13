/**
 * IndexedDB persistence. The GPX text itself is bundled from data/gpx/ (see
 * trailFiles.ts), so all a trail record keeps is what you changed about it.
 */
import { DEFAULT_SETTINGS, type Settings } from './trails';

const DB_NAME = 'oh-trail-map';
const DB_VERSION = 1;
const TRAILS = 'trails';
const SETTINGS = 'settings';
const SETTINGS_KEY = 'app';

/** Keyed by the GPX file name. Records from the import era — timestamp ids
 *  carrying the GPX text as well — match no file and are deleted at boot. */
export type TrailRecord = {
  id: string;
  color: string;
  visible: boolean;
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

export function loadTrails(): Promise<TrailRecord[]> {
  return run<TrailRecord[]>(TRAILS, 'readonly', (s) => s.getAll());
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
  // Only the keys Settings still has: fields of removed features (uniform colour,
  // trail width) are dropped here, and so vanish from storage on the next save.
  return {
    basemapId: stored?.basemapId ?? DEFAULT_SETTINGS.basemapId,
    showPoints: stored?.showPoints ?? DEFAULT_SETTINGS.showPoints,
  };
}

export function saveSettings(settings: Settings): Promise<unknown> {
  return run(SETTINGS, 'readwrite', (s) => s.put(settings, SETTINGS_KEY));
}
