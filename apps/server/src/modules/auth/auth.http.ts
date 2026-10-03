import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../shared/errors/app-error.js";
import { GUEST_SESSION_COOKIE, SESSION_COOKIE } from "./auth.service.js";

export function readCookie(request: FastifyRequest, name = SESSION_COOKIE): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function setSessionCookie(reply: FastifyReply, token: string, remember: boolean, secure: boolean): void {
  const maxAge = remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
  reply.header("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`);
}

export function setGuestSessionCookie(reply: FastifyReply, token: string, secure: boolean): void {
  reply.header("Set-Cookie", `${GUEST_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${secure ? "; Secure" : ""}`);
}

export function clearSessionCookie(reply: FastifyReply, secure: boolean): void {
  reply.header("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? "; Secure" : ""}`);
}

export function requireBody<T>(body: unknown, parser: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: unknown[] } } }): T {
  const parsed = parser.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Dữ liệu yêu cầu không hợp lệ.", 400, false, "INVALID", { issues: parsed.error.issues });
  return parsed.data;
}
