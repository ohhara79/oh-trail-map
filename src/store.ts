/**
 * IndexedDB persistence. The GPX text itself is bundled from data/gpx/ (see
 * trailFiles.ts), so all a trail record keeps is what you changed about it.
 * Colours come from trails.ts PALETTE and are never stored.
 */
import { DEFAULT_SETTINGS, type Settings } from './trails';

const DB_NAME = 'oh-trail-map';
const DB_VERSION = 1;
const TRAILS = 'trails';
const SETTINGS = 'settings';
const SETTINGS_KEY = 'app';

/** Keyed by the GPX file name. Records from the import era — timestamp ids
 *  carrying the GPX text as well — match no file and are deleted at boot.
 *  Records from when colours could be picked still carry a `color`; it is
 *  ignored, and dropped the next time the record is written. */
export type TrailRecord = {
  id: string;
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
  // trail width, and now showPoints — the single National Point Number toggle the
  // per-point list replaced) are dropped here, and so vanish from storage on the
  // next save. A browser that had showPoints off therefore gets its pins back
  // once: turning `false` into 281 codes needs the point list, which this module
  // deliberately cannot see, and one click on the new master checkbox is the very
  // affordance that replaced it.
  return {
    basemapId: stored?.basemapId ?? DEFAULT_SETTINGS.basemapId,
    // Array.isArray rather than ??: the key is new, and a record written by a
    // tampered or future build must not reach `new Set(...)` as something that
    // is not one.
    hiddenPoints: Array.isArray(stored?.hiddenPoints)
      ? stored.hiddenPoints.filter((code): code is string => typeof code === 'string')
      : DEFAULT_SETTINGS.hiddenPoints,
  };
}

export function saveSettings(settings: Settings): Promise<unknown> {
  return run(SETTINGS, 'readwrite', (s) => s.put(settings, SETTINGS_KEY));
}
