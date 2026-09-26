import { getJson, requestJson } from "../http/httpClient";

export type UserProfile = {
  id: string;
  fullName: string;
  displayName: string;
  username: string;
  theme: "light" | "dark" | "system";
  stats: { elo: number; rankedWins: number; rankedLosses: number; quickWins: number; quickLosses: number };
};

export type PublicProfile = { username: string; displayName: string; stats: UserProfile["stats"] };

export function register(input: { fullName: string; displayName: string; username: string; password: string }) {
  return requestJson<{ user: UserProfile; recoveryCode: string }>("/auth/register", { method: "POST", body: input });
}

export function login(input: { username: string; password: string; remember: boolean }) {
  return requestJson<{ user: UserProfile }>("/auth/login", { method: "POST", body: input });
}

export function logout() { return requestJson<void>("/auth/logout", { method: "POST" }); }
export function recover(input: { username: string; recoveryCode: string; newPassword: string }) { return requestJson<{ user: UserProfile }>("/auth/recover", { method: "POST", body: input }); }
export function changePassword(input: { currentPassword: string; newPassword: string }) { return requestJson<void>("/auth/password", { method: "POST", body: input }); }
export function getMe() { return getJson("/auth/me") as Promise<{ user: UserProfile }>; }
export function getPublicProfile(username: string) { return getJson(`/profiles/${encodeURIComponent(username)}`) as Promise<{ profile: PublicProfile }>; }
export function updateProfile(input: { fullName?: string; displayName?: string; theme?: "light" | "dark" | "system" }) { return requestJson<{ user: UserProfile }>("/profiles/me", { method: "PATCH", body: input }); }
