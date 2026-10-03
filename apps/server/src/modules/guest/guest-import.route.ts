import { GuestHistoryImportRequestSchema, GuestSessionRequestSchema } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";

import { requireBody, readCookie, setGuestSessionCookie } from "../auth/auth.http.js";
import type { AuthService } from "../auth/auth.service.js";
import { GUEST_SESSION_COOKIE } from "../auth/auth.service.js";
import { GuestImportService } from "./guest-import.service.js";

export async function registerGuestImportRoutes(app: FastifyInstance, auth: AuthService, service: GuestImportService, secure = false): Promise<void> {
  app.post("/guest/session", async (request, reply) => {
    const input = requireBody(request.body, GuestSessionRequestSchema);
    const existing = readCookie(request, GUEST_SESSION_COOKIE);
    if (existing) {
      try {
        const context = await auth.authenticateAny(undefined, existing);
        return reply.status(200).send({ principal: context.principal, displayName: context.user.displayName });
      } catch { /* issue a fresh bounded guest session below */ }
    }
    const session = auth.createGuestSession(input);
    setGuestSessionCookie(reply, session.token, secure);
    return reply.status(200).send({ principal: "GUEST", displayName: session.displayName });
  });

  app.post("/guest/history/import", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const input = requireBody(request.body, GuestHistoryImportRequestSchema);
    return reply.status(200).send(await service.import(context.user.id, input.records));
  });
}
