import type { GuestHistoryImportResponse, GuestMatchRecord, GuestSessionResponse } from "@ottv2/contracts";
import { requestJson } from "../http/httpClient";
import { getGuestProfile } from "../local/localGameStorage";
import { getClientId } from "../session/clientIdentity";

export function importGuestHistory(records: GuestMatchRecord[]) {
  return requestJson<GuestHistoryImportResponse>("/guest/history/import", { method: "POST", body: { records } });
}

let sessionPromise: Promise<GuestSessionResponse> | null = null;
let sessionExpiresAt = 0;
let sessionExpiryTimer: number | undefined;
const SESSION_LOCK_DB = "ottv2-guest-session-lock";
const SESSION_LOCK_STORE = "leases";
const SESSION_LOCK_NAME = "bootstrap";
const SESSION_LOCK_WAIT_MS = 30_000;

type LeaseRecord = { name: string; owner: string };
let lockDbPromise: Promise<IDBDatabase> | null = null;

class GuestSessionBootstrapError extends Error {
  constructor(message = "Không thể đồng bộ phiên khách trên trình duyệt này.") {
    super(message);
    this.name = "GuestSessionBootstrapError";
  }
}

function openLockDb(): Promise<IDBDatabase> {
  if (lockDbPromise) return lockDbPromise;
  if (typeof indexedDB === "undefined") return Promise.reject(new GuestSessionBootstrapError());
  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(SESSION_LOCK_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(SESSION_LOCK_STORE, { keyPath: "name" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new GuestSessionBootstrapError());
    request.onblocked = () => reject(new GuestSessionBootstrapError());
  }).catch((error) => {
    lockDbPromise = null;
    throw error;
  });
  lockDbPromise = promise;
  return promise;
}

async function tryAcquireLease(db: IDBDatabase, owner: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_LOCK_STORE, "readwrite");
    const store = tx.objectStore(SESSION_LOCK_STORE);
    let acquired = false;
    const request = store.get(SESSION_LOCK_NAME) as IDBRequest<LeaseRecord | undefined>;
    request.onsuccess = () => {
      const current = request.result;
      if (!current) {
        store.put({ name: SESSION_LOCK_NAME, owner } satisfies LeaseRecord);
        acquired = true;
      }
    };
    request.onerror = () => reject(request.error ?? new GuestSessionBootstrapError());
    tx.oncomplete = () => resolve(acquired);
    tx.onerror = () => reject(tx.error ?? new GuestSessionBootstrapError());
    tx.onabort = () => reject(tx.error ?? new GuestSessionBootstrapError());
  });
}

async function releaseLease(db: IDBDatabase, owner: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SESSION_LOCK_STORE, "readwrite");
    const store = tx.objectStore(SESSION_LOCK_STORE);
    const request = store.get(SESSION_LOCK_NAME) as IDBRequest<LeaseRecord | undefined>;
    request.onsuccess = () => { if (request.result?.owner === owner) store.delete(SESSION_LOCK_NAME); };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new GuestSessionBootstrapError());
  });
}

export async function withGuestBootstrapLock<T>(work: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks) return locks.request("ottv2-guest-session", { mode: "exclusive" }, work);

  // IndexedDB read/write transactions are serialized across browser tabs. A
  // localStorage read→write lease is intentionally not used: it is not CAS and
  // can let two tabs bootstrap two principals under stale reads. If IndexedDB
  // is unavailable, fail closed instead of risking duplicate Guest identity.
  const db = await openLockDb();
  const owner = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const waitStartedAt = Date.now();
  for (;;) {
    const acquired = await tryAcquireLease(db, owner);
    if (acquired) {
      try { return await work(); }
      finally {
        await releaseLease(db, owner).catch(() => undefined);
      }
    }
    // Never steal an owned record: the owner may be frozen while its POST is
    // still in flight. Waiting is bounded so a crashed tab fails closed rather
    // than allowing a second principal to be created.
    if (Date.now() - waitStartedAt >= SESSION_LOCK_WAIT_MS) throw new GuestSessionBootstrapError();
    await new Promise((resolve) => window.setTimeout(resolve, 40));
  }
}

/** Establishes an opaque HttpOnly Guest principal for ordinary Online actions. */
export function ensureGuestSession(): Promise<GuestSessionResponse> {
  if (sessionPromise && sessionExpiresAt > Date.now()) return sessionPromise;
  if (sessionExpiryTimer !== undefined) window.clearTimeout(sessionExpiryTimer);
  sessionPromise = null;
  if (!sessionPromise) {
    sessionPromise = withGuestBootstrapLock(async () => {
      const profile = await getGuestProfile();
      return requestJson<GuestSessionResponse>("/guest/session", {
        method: "POST",
        body: { clientId: getClientId(), displayName: profile?.displayName ?? "Khách" },
      });
    }).then((result) => {
      sessionExpiresAt = Date.now() + 15 * 60 * 1000;
      sessionExpiryTimer = window.setTimeout(() => { sessionPromise = null; sessionExpiresAt = 0; }, 15 * 60 * 1000);
      return result;
    }).catch((error) => { sessionPromise = null; sessionExpiresAt = 0; throw error; });
  }
  return sessionPromise;
}

export function resetGuestSession(): void {
  sessionPromise = null;
  sessionExpiresAt = 0;
  if (sessionExpiryTimer !== undefined) window.clearTimeout(sessionExpiryTimer);
  sessionExpiryTimer = undefined;
}
