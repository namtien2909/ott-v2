import type { PrismaClient, Session, User, UserProfile, UserStats } from "@prisma/client";
import type {
  ChangePasswordRequest,
  AvatarPreset,
  LoginRequest,
  ProfilePatchRequest,
  RecoverRequest,
  RegisterRequest,
  PresenceVisibility,
} from "@ottv2/contracts";

import { AppError } from "../../shared/errors/app-error.js";
import { createOpaqueToken, createRecoveryCode, hashSecret, hashToken, verifySecret } from "./auth.crypto.js";
import { AuthThrottle } from "./auth.throttle.js";

const SESSION_COOKIE = "ottv2_session";
const SHORT_SESSION_MS = 24 * 60 * 60 * 1000;
const LONG_SESSION_MS = 30 * SHORT_SESSION_MS;

type UserWithData = User & { profile: UserProfile | null; stats: UserStats | null };

export type SelfProfile = {
  id: string;
  fullName: string;
  displayName: string;
  username: string;
  theme: "light" | "dark" | "system";
  avatarPreset: AvatarPreset;
  privacy: { presenceVisibility: PresenceVisibility; friendListVisibility: "PRIVATE"; fullNameVisibility: "PRIVATE" };
  stats: { elo: number; rankedWins: number; rankedLosses: number; quickWins: number; quickLosses: number };
};

export type PublicProfile = {
  userId: string;
  username: string;
  displayName: string;
  avatarPreset: AvatarPreset;
  stats: { elo: number; rankedWins: number; rankedLosses: number; quickWins: number; quickLosses: number };
  friendCount: number;
  recentForm: Array<"WIN" | "LOSS">;
};

export type AuthContext = { session: Session; user: UserWithData };

const includeData = { profile: true, stats: true } as const;

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function themeOf(profile: UserProfile | null): "light" | "dark" | "system" {
  return profile?.theme === "light" || profile?.theme === "dark" ? profile.theme : "system";
}

function avatarOf(profile: UserProfile | null): AvatarPreset {
  return profile?.avatarPreset === "wolf" || profile?.avatarPreset === "fox" || profile?.avatarPreset === "panda" || profile?.avatarPreset === "arena" ? profile.avatarPreset : "robot";
}

function privacyOf(profile: UserProfile | null): SelfProfile["privacy"] {
  return {
    presenceVisibility: profile?.presenceVisibility === "NOBODY" ? "NOBODY" : "FRIENDS",
    friendListVisibility: "PRIVATE",
    fullNameVisibility: "PRIVATE",
  };
}

function statsOf(stats: UserStats | null) {
  return {
    elo: stats?.elo ?? 1000,
    rankedWins: stats?.rankedWins ?? 0,
    rankedLosses: stats?.rankedLosses ?? 0,
    quickWins: stats?.quickWins ?? 0,
    quickLosses: stats?.quickLosses ?? 0,
  };
}

function toSelf(user: UserWithData): SelfProfile {
  return { id: user.id, fullName: user.fullName, displayName: user.displayName, username: user.username, theme: themeOf(user.profile), avatarPreset: avatarOf(user.profile), privacy: privacyOf(user.profile), stats: statsOf(user.stats) };
}

function unavailable(): never {
  throw new AppError("SERVICE_UNAVAILABLE", "Dịch vụ tài khoản hiện chưa sẵn sàng.", 503, true, "RECOVERABLE");
}

export class AuthService {
  readonly throttle = new AuthThrottle();

  constructor(private readonly db?: PrismaClient) {}

  private requireDb(): PrismaClient {
    if (!this.db) unavailable();
    return this.db;
  }

  async register(input: RegisterRequest, remember = true): Promise<{ user: SelfProfile; recoveryCode: string; token: string }> {
    const db = this.requireDb();
    const usernameNormalized = normalizeUsername(input.username);
    const duplicate = await db.user.findUnique({ where: { usernameNormalized } });
    if (duplicate) throw new AppError("CONFLICT", "Username đã được sử dụng.", 409, false, "INVALID");

    const recoveryCode = createRecoveryCode();
    const token = createOpaqueToken();
    const now = new Date();
    const user = await db.user.create({
      data: {
        fullName: input.fullName.trim(),
        displayName: input.displayName.trim(),
        username: input.username.trim(),
        usernameNormalized,
        passwordHash: await hashSecret(input.password),
        recoveryCodeHash: await hashSecret(recoveryCode),
        profile: { create: {} },
        stats: { create: {} },
        sessions: { create: { tokenHash: hashToken(token), remember, expiresAt: new Date(now.getTime() + (remember ? LONG_SESSION_MS : SHORT_SESSION_MS)) } },
      },
      include: includeData,
    });
    return { user: toSelf(user), recoveryCode, token };
  }

  async login(input: LoginRequest, ip: string): Promise<{ user: SelfProfile; token: string; remember: boolean }> {
    const db = this.requireDb();
    const key = `${normalizeUsername(input.username)}|${ip}`;
    this.throttle.guard(key);
    const user = await db.user.findUnique({ where: { usernameNormalized: normalizeUsername(input.username) }, include: includeData });
    if (!user || !(await verifySecret(input.password, user.passwordHash))) {
      this.throttle.failure(key);
      throw new AppError("UNAUTHORIZED", "Tên đăng nhập hoặc mật khẩu không đúng.", 401, false, "INVALID");
    }
    this.throttle.success(key);
    const token = createOpaqueToken();
    await db.session.create({ data: { userId: user.id, tokenHash: hashToken(token), remember: input.remember, expiresAt: new Date(Date.now() + (input.remember ? LONG_SESSION_MS : SHORT_SESSION_MS)) } });
    return { user: toSelf(user), token, remember: input.remember };
  }

  async authenticate(token: string | undefined): Promise<AuthContext> {
    if (!token) throw new AppError("UNAUTHORIZED", "Bạn cần đăng nhập để tiếp tục.", 401, false, "FATAL_SESSION");
    const db = this.requireDb();
    const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new AppError("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn.", 401, false, "FATAL_SESSION");
    }
    const user = await db.user.findUnique({ where: { id: session.userId }, include: includeData });
    if (!user) throw new AppError("UNAUTHORIZED", "Tài khoản không còn tồn tại.", 401, false, "FATAL_SESSION");
    await db.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
    return { session, user };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token || !this.db) return;
    await this.db.session.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async recover(input: RecoverRequest, ip: string): Promise<{ user: SelfProfile }> {
    const db = this.requireDb();
    const key = `${normalizeUsername(input.username)}|${ip}`;
    this.throttle.guard(key);
    const user = await db.user.findUnique({ where: { usernameNormalized: normalizeUsername(input.username) }, include: includeData });
    const valid = Boolean(user && !user.recoveryUsedAt && await verifySecret(input.recoveryCode, user.recoveryCodeHash));
    if (!user || !valid) {
      this.throttle.failure(key);
      throw new AppError("UNAUTHORIZED", "Username hoặc Recovery Code không đúng.", 401, false, "INVALID");
    }
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash: await hashSecret(input.newPassword), recoveryUsedAt: new Date() } }),
      db.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    this.throttle.success(key);
    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: includeData });
    return { user: toSelf(refreshed) };
  }

  async changePassword(context: AuthContext, input: ChangePasswordRequest): Promise<void> {
    const db = this.requireDb();
    if (!(await verifySecret(input.currentPassword, context.user.passwordHash))) {
      throw new AppError("UNAUTHORIZED", "Mật khẩu hiện tại không đúng.", 401, false, "INVALID");
    }
    await db.$transaction([
      db.user.update({ where: { id: context.user.id }, data: { passwordHash: await hashSecret(input.newPassword) } }),
      db.session.updateMany({ where: { userId: context.user.id, id: { not: context.session.id }, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  async self(context: AuthContext): Promise<SelfProfile> { return toSelf(context.user); }
  async publicProfile(username: string): Promise<PublicProfile> {
    const db = this.requireDb();
    const user = await db.user.findUnique({ where: { usernameNormalized: normalizeUsername(username) }, include: includeData });
    if (!user) throw new AppError("NOT_FOUND", "Không tìm thấy người chơi.", 404, false, "INVALID");
    const [friendCount, recentPlayers] = await Promise.all([
      db.friendship.count({ where: { OR: [{ userAId: user.id }, { userBId: user.id }] } }),
      db.matchPlayer.findMany({ where: { userId: user.id, isWinner: { not: null } }, orderBy: { match: { endedAt: "desc" } }, take: 5, select: { isWinner: true } }),
    ]);
    return { userId: user.id, username: user.username, displayName: user.displayName, avatarPreset: avatarOf(user.profile), stats: statsOf(user.stats), friendCount, recentForm: recentPlayers.map((player) => player.isWinner ? "WIN" : "LOSS") };
  }

  async updateProfile(context: AuthContext, input: ProfilePatchRequest): Promise<SelfProfile> {
    const db = this.requireDb();
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: context.user.id }, data: { ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}), ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}) } });
      if (input.theme !== undefined || input.avatarPreset !== undefined || input.presenceVisibility !== undefined || input.friendListVisibility !== undefined || input.fullNameVisibility !== undefined) await tx.userProfile.upsert({ where: { userId: context.user.id }, create: { userId: context.user.id, ...(input.theme !== undefined ? { theme: input.theme } : {}), ...(input.avatarPreset !== undefined ? { avatarPreset: input.avatarPreset } : {}), ...(input.presenceVisibility !== undefined ? { presenceVisibility: input.presenceVisibility } : {}), ...(input.friendListVisibility !== undefined ? { friendListVisibility: input.friendListVisibility } : {}), ...(input.fullNameVisibility !== undefined ? { fullNameVisibility: input.fullNameVisibility } : {}) }, update: { ...(input.theme !== undefined ? { theme: input.theme } : {}), ...(input.avatarPreset !== undefined ? { avatarPreset: input.avatarPreset } : {}), ...(input.presenceVisibility !== undefined ? { presenceVisibility: input.presenceVisibility } : {}), ...(input.friendListVisibility !== undefined ? { friendListVisibility: input.friendListVisibility } : {}), ...(input.fullNameVisibility !== undefined ? { fullNameVisibility: input.fullNameVisibility } : {}) } });
    });
    const user = await db.user.findUniqueOrThrow({ where: { id: context.user.id }, include: includeData });
    return toSelf(user);
  }
}

export { SESSION_COOKIE };
