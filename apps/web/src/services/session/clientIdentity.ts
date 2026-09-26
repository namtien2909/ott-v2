function readOrCreate(storage: Storage, key: string): string {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const value = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  storage.setItem(key, value);
  return value;
}

export function getClientId(): string {
  try { return readOrCreate(localStorage, "ottv2:client-id"); } catch { return "ephemeral-client"; }
}

export function getTabId(): string {
  try { return readOrCreate(sessionStorage, "ottv2:tab-id"); } catch { return getClientId(); }
}
