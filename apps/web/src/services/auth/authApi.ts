import { getJson, requestJson } from "../http/httpClient";

export type AvatarPreset = "robot" | "wolf" | "fox" | "panda" | "arena";
export type UserProfile = {
  id: string;
  fullName: string;
  displayName: string;
  username: string;
  theme: "light" | "dark" | "system";
  avatarPreset: AvatarPreset;
  privacy: { presenceVisibility: "FRIENDS" | "NOBODY"; friendListVisibility: "PRIVATE"; fullNameVisibility: "PRIVATE" };
  stats: { elo: number; rankedWins: number; rankedLosses: number; quickWins: number; quickLosses: number };
};

export type PublicProfile = { userId: string; username: string; displayName: string; avatarPreset: AvatarPreset; stats: UserProfile["stats"]; friendCount: number; recentForm: Array<"WIN" | "LOSS">; isSelf?: boolean; isFriend: boolean; requestStatus: "PENDING" | null; presence?: "OFFLINE" | "ONLINE" | "IN_GAME" };

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
export function updateProfile(input: { fullName?: string; displayName?: string; theme?: "light" | "dark" | "system"; avatarPreset?: AvatarPreset; presenceVisibility?: "FRIENDS" | "NOBODY"; friendListVisibility?: "PRIVATE"; fullNameVisibility?: "PRIVATE" }) { return requestJson<{ user: UserProfile }>("/profiles/me", { method: "PATCH", body: input }); }
