import { GuestHistoryImportRequestSchema } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";

import { requireBody, readCookie } from "../auth/auth.http.js";
import type { AuthService } from "../auth/auth.service.js";
import { GuestImportService } from "./guest-import.service.js";

export async function registerGuestImportRoutes(app: FastifyInstance, auth: AuthService, service: GuestImportService): Promise<void> {
  app.post("/guest/history/import", async (request, reply) => {
    const context = await auth.authenticate(readCookie(request));
    const input = requireBody(request.body, GuestHistoryImportRequestSchema);
    return reply.status(200).send(await service.import(context.user.id, input.records));
  });
}
