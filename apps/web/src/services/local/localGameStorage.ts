export type LocalMode = "GUEST" | "AI" | "OFFLINE";
export type LocalResult = "WIN" | "LOSS" | "DRAW";

export type LocalHistoryRecord = {
  localId: string;
  mode: LocalMode;
  result: LocalResult;
  playerName: string;
  opponentName: string;
  timerSeconds: number;
  durationSeconds: number;
  endedAt: string;
  scoreDelta: number;
};

export type GuestProfile = { displayName: string };
type ImportDecision = "IMPORTED" | "DECLINED";

const DB_NAME = "ottv2-local";
const DB_VERSION = 1;
const HISTORY_STORE = "history";
const META_STORE = "meta";
const PROFILE_KEY = "guest-profile";
const IMPORT_KEY = "guest-import-decision";
const FALLBACK_HISTORY = "ottv2.local.history";
const FALLBACK_PROFILE = "ottv2.local.profile";
const FALLBACK_IMPORT = "ottv2.local.import";

function fallbackGet<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}

function fallbackSet<T>(key: string, value: T): void {
  try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); } catch { /* storage can be unavailable in private mode */ }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("INDEXED_DB_UNAVAILABLE")); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE)) db.createObjectStore(HISTORY_STORE, { keyPath: "localId" });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("INDEXED_DB_OPEN_FAILED"));
  });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("INDEXED_DB_REQUEST_FAILED"));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("INDEXED_DB_TRANSACTION_FAILED"));
  });
}

export async function getGuestProfile(): Promise<GuestProfile | null> {
  try { return (await withStore<GuestProfile | undefined>(META_STORE, "readonly", (store) => store.get(PROFILE_KEY))) ?? null; }
  catch { return fallbackGet<GuestProfile | null>(FALLBACK_PROFILE, null); }
}

export async function setGuestProfile(profile: GuestProfile): Promise<void> {
  try { await withStore(META_STORE, "readwrite", (store) => store.put(profile, PROFILE_KEY)); }
  catch { fallbackSet(FALLBACK_PROFILE, profile); }
}

export async function getLocalHistory(): Promise<LocalHistoryRecord[]> {
  try { return await withStore<LocalHistoryRecord[]>(HISTORY_STORE, "readonly", (store) => store.getAll()); }
  catch { return fallbackGet<LocalHistoryRecord[]>(FALLBACK_HISTORY, []); }
}

export async function addLocalHistory(record: LocalHistoryRecord): Promise<void> {
  try { await withStore(HISTORY_STORE, "readwrite", (store) => store.put(record)); }
  catch {
    const records = fallbackGet<LocalHistoryRecord[]>(FALLBACK_HISTORY, []).filter((item) => item.localId !== record.localId);
    fallbackSet(FALLBACK_HISTORY, [record, ...records]);
  }
}

export async function getImportDecision(): Promise<ImportDecision | null> {
  try { return (await withStore<ImportDecision | undefined>(META_STORE, "readonly", (store) => store.get(IMPORT_KEY))) ?? null; }
  catch { return fallbackGet<ImportDecision | null>(FALLBACK_IMPORT, null); }
}

export async function setImportDecision(decision: ImportDecision): Promise<void> {
  try { await withStore(META_STORE, "readwrite", (store) => store.put(decision, IMPORT_KEY)); }
  catch { fallbackSet(FALLBACK_IMPORT, decision); }
}

export async function clearGuestHistory(): Promise<void> {
  const records = await getLocalHistory();
  const keep = records.filter((record) => record.mode !== "GUEST");
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(HISTORY_STORE, "readwrite");
      const store = transaction.objectStore(HISTORY_STORE);
      const request = store.clear();
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    });
    await Promise.all(keep.map((record) => withStore(HISTORY_STORE, "readwrite", (store) => store.put(record))));
  } catch { fallbackSet(FALLBACK_HISTORY, keep); }
}
