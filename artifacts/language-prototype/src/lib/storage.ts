const STORE = 'kv';

function dbName(userId: string) {
  return 'english-lab:' + userId;
}

function open(userId: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB недоступна в этом браузере или режиме.'));
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(dbName(userId), 1);
    } catch (e) {
      reject(e instanceof Error ? e : new Error('IndexedDB недоступна.'));
      return;
    }
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Не удалось открыть IndexedDB.'));
    req.onblocked = () => reject(new Error('IndexedDB заблокирована другой вкладкой.'));
  });
}

export async function readAll(userId: string): Promise<Record<string, unknown>> {
  const db = await open(userId);
  return new Promise((resolve, reject) => {
    const out: Record<string, unknown> = {};
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) {
        out[String(c.key)] = c.value;
        c.continue();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(out);
    };
    const fail = () => {
      db.close();
      reject(tx.error ?? new Error('Ошибка чтения IndexedDB.'));
    };
    tx.onerror = fail;
    tx.onabort = fail;
  });
}

/** Single transaction: all puts and removes succeed together or not at all. */
export async function writeEntries(
  userId: string,
  puts: Record<string, unknown>,
  removes: string[] = [],
): Promise<void> {
  const db = await open(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    const fail = () => {
      db.close();
      const err = tx.error;
      reject(
        err && err.name === 'QuotaExceededError'
          ? new Error('Хранилище браузера заполнено.')
          : (err ?? new Error('Транзакция IndexedDB прервана.')),
      );
    };
    tx.onerror = fail;
    tx.onabort = fail;
    try {
      const store = tx.objectStore(STORE);
      for (const [k, v] of Object.entries(puts)) store.put(v, k);
      for (const k of removes) store.delete(k);
    } catch (e) {
      try {
        tx.abort();
      } catch {
        /* already finished */
      }
      db.close();
      reject(e instanceof Error ? e : new Error('Ошибка записи IndexedDB.'));
    }
  });
}

/** Atomically removes only sensitive workspace keys; saved settings are kept. */
export async function clearSensitive(userId: string): Promise<void> {
  await writeEntries(userId, {}, ['recording', 'state', 'consent']);
}

export function deleteDatabase(userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve();
      return;
    }
    const req = indexedDB.deleteDatabase(dbName(userId));
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('Не удалось удалить локальные данные.'));
    req.onblocked = () => resolve();
  });
}
