function readOrCreate(storage: Storage, key: string): string {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const value = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  storage.setItem(key, value);
  return value;
}

const GUEST_ADJECTIVES = ["Lam", "Đỏ", "Xanh", "Bạc", "Mây", "Sao", "Gió", "Lửa"] as const;

/** Stable, human-readable label derived from the opaque browser profile id. */
export function guestDisplayName(clientId = getClientId()): string {
  let hash = 0;
  for (const character of clientId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `Khách ${GUEST_ADJECTIVES[hash % GUEST_ADJECTIVES.length]} ${(hash % 1000).toString().padStart(3, "0")}`;
}

export function getClientId(): string {
  try { return readOrCreate(localStorage, "ottv2:client-id"); } catch { return "ephemeral-client"; }
}

export function getTabId(): string {
  try { return readOrCreate(sessionStorage, "ottv2:tab-id"); } catch { return getClientId(); }
}
