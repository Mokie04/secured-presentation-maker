const DB_NAME = 'sayuna-generation-cache';
const STORE_NAME = 'generation-cache';
const DB_VERSION = 1;
const MAX_CACHE_ITEMS = 40;

type CacheRecord<T> = {
  key: string;
  value: T;
  createdAt: number;
  lastAccessedAt: number;
};

const isIndexedDbAvailable = (): boolean => (
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
);

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> => (
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  })
);

const transactionDone = (transaction: IDBTransaction): Promise<void> => (
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  })
);

const openDb = (): Promise<IDBDatabase> => (
  new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('lastAccessedAt', 'lastAccessedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  })
);

const normalizeCachePart = (part: unknown): unknown => {
  if (typeof part === 'string') {
    return part.replace(/\s+/g, ' ').trim();
  }

  if (Array.isArray(part)) {
    return part.map(normalizeCachePart);
  }

  if (part && typeof part === 'object') {
    return Object.keys(part as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeCachePart((part as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return part;
};

const hashValue = async (value: string): Promise<string> => {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return `fallback-${(hash >>> 0).toString(16)}`;
};

export const buildGenerationCacheKey = async (
  namespace: string,
  parts: unknown[],
): Promise<string> => {
  const normalized = JSON.stringify(parts.map(normalizeCachePart));
  return `${namespace}:${await hashValue(normalized)}`;
};

const trimCache = async (db: IDBDatabase): Promise<void> => {
  const readTransaction = db.transaction(STORE_NAME, 'readonly');
  const readStore = readTransaction.objectStore(STORE_NAME);
  const records = await requestToPromise<CacheRecord<unknown>[]>(readStore.getAll());
  await transactionDone(readTransaction);

  const staleRecords = records
    .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)
    .slice(0, Math.max(0, records.length - MAX_CACHE_ITEMS));

  if (staleRecords.length === 0) return;

  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  staleRecords.forEach((record) => {
    store.delete(record.key);
  });

  await transactionDone(transaction);
};

export const getCachedGeneration = async <T>(key: string): Promise<T | null> => {
  let db: IDBDatabase | null = null;

  try {
    db = await openDb();
    const readTransaction = db.transaction(STORE_NAME, 'readonly');
    const readStore = readTransaction.objectStore(STORE_NAME);
    const record = await requestToPromise<CacheRecord<T> | undefined>(readStore.get(key));
    await transactionDone(readTransaction);

    if (!record) {
      return null;
    }

    const writeTransaction = db.transaction(STORE_NAME, 'readwrite');
    const writeStore = writeTransaction.objectStore(STORE_NAME);
    writeStore.put({ ...record, lastAccessedAt: Date.now() });
    await transactionDone(writeTransaction);
    return record.value;
  } catch {
    console.warn('Failed to read saved generation data.');
    return null;
  } finally {
    db?.close();
  }
};

export const setCachedGeneration = async <T>(key: string, value: T): Promise<void> => {
  let db: IDBDatabase | null = null;

  try {
    db = await openDb();
    const now = Date.now();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({ key, value, createdAt: now, lastAccessedAt: now });
    await transactionDone(transaction);
    await trimCache(db);
  } catch {
    console.warn('Failed to save generation data.');
  } finally {
    db?.close();
  }
};
