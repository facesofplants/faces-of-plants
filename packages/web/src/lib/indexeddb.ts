/**
 * IndexedDB storage for GBIF occurrence data.
 * Enables offline-first access and client-side spatial analysis.
 */

const DB_NAME = 'faces-of-plants';
const DB_VERSION = 1;
const STORE_OCCURRENCES = 'occurrences';
const STORE_SEARCHES = 'searches';

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Occurrences store — indexed by species + country for fast lookups
      if (!db.objectStoreNames.contains(STORE_OCCURRENCES)) {
        const store = db.createObjectStore(STORE_OCCURRENCES, { keyPath: 'key' });
        store.createIndex('species', 'species', { unique: false });
        store.createIndex('speciesCountry', ['species', 'country'], { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Search cache — stores search params → occurrence keys mapping
      if (!db.objectStoreNames.contains(STORE_SEARCHES)) {
        const store = db.createObjectStore(STORE_SEARCHES, { keyPath: 'hash' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

function hashSearchParams(params: Record<string, unknown>): string {
  const str = JSON.stringify(params, Object.keys(params).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `search_${Math.abs(hash).toString(36)}`;
}

export interface StoredOccurrence {
  key: string;
  species: string;
  country: string;
  lat: number;
  lng: number;
  data: unknown;
  timestamp: number;
}

export interface SearchCacheEntry {
  hash: string;
  params: Record<string, unknown>;
  occurrenceKeys: string[];
  count: number;
  timestamp: number;
}

/**
 * Store GBIF occurrences in IndexedDB.
 */
export async function storeOccurrences(
  species: string,
  country: string,
  occurrences: unknown[]
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_OCCURRENCES, 'readwrite');
  const store = tx.objectStore(STORE_OCCURRENCES);
  const now = Date.now();

  for (const occ of occurrences) {
    const o = occ as Record<string, unknown>;
    const key = `${species}_${(o as { key?: string }).key || Math.random().toString(36).slice(2)}`;
    const item: StoredOccurrence = {
      key,
      species,
      country: country || 'global',
      lat: (o as { decimalLatitude?: number }).decimalLatitude || 0,
      lng: (o as { decimalLongitude?: number }).decimalLongitude || 0,
      data: occ,
      timestamp: now,
    };
    store.put(item);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieve stored occurrences for a species.
 */
export async function getOccurrences(
  species: string,
  country?: string
): Promise<unknown[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_OCCURRENCES, 'readonly');
  const store = tx.objectStore(STORE_OCCURRENCES);

  return new Promise((resolve, reject) => {
    let request: IDBRequest;
    if (country) {
      const index = store.index('speciesCountry');
      request = index.getAll([species, country]);
    } else {
      const index = store.index('species');
      request = index.getAll(species);
    }

    request.onsuccess = () => {
      const results = request.result as StoredOccurrence[];
      resolve(results.map((r) => r.data));
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Cache a search result for quick re-display.
 */
export async function cacheSearch(
  params: Record<string, unknown>,
  occurrenceKeys: string[],
  count: number
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_SEARCHES, 'readwrite');
  const store = tx.objectStore(STORE_SEARCHES);
  const hash = hashSearchParams(params);

  store.put({
    hash,
    params,
    occurrenceKeys,
    count,
    timestamp: Date.now(),
  });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get cached search results.
 */
export async function getCachedSearch(
  params: Record<string, unknown>
): Promise<SearchCacheEntry | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_SEARCHES, 'readonly');
  const store = tx.objectStore(STORE_SEARCHES);
  const hash = hashSearchParams(params);

  return new Promise((resolve, reject) => {
    const request = store.get(hash);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all stored occurrences (for clustering analysis).
 */
export async function getAllOccurrences(): Promise<StoredOccurrence[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_OCCURRENCES, 'readonly');
  const store = tx.objectStore(STORE_OCCURRENCES);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get count of stored occurrences.
 */
export async function getStoredCount(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_OCCURRENCES, 'readonly');
  const store = tx.objectStore(STORE_OCCURRENCES);

  return new Promise((resolve, reject) => {
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear old entries (older than maxAge ms).
 */
export async function clearOldEntries(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_OCCURRENCES, 'readwrite');
  const store = tx.objectStore(STORE_OCCURRENCES);
  const index = store.index('timestamp');
  const cutoff = Date.now() - maxAgeMs;
  let deleted = 0;

  return new Promise((resolve, reject) => {
    const request = index.openCursor(IDBKeyRange.upperBound(cutoff));
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
      if (cursor) {
        cursor.delete();
        deleted++;
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve(deleted);
    tx.onerror = () => reject(tx.error);
  });
}
