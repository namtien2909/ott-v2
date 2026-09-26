import { ChangePasswordRequestSchema, LoginRequestSchema, RecoverRequestSchema, RegisterRequestSchema } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";

import type { AppEnv } from "../../config/env.js";
import { requireBody, clearSessionCookie, readCookie, setSessionCookie } from "./auth.http.js";
import { AuthService } from "./auth.service.js";

export async function registerAuthRoutes(app: FastifyInstance, service: AuthService, env: AppEnv): Promise<void> {
  const secure = env.NODE_ENV === "production";

  app.post("/auth/register", async (request, reply) => {
    const input = requireBody(request.body, RegisterRequestSchema);
    const result = await service.register(input);
    setSessionCookie(reply, result.token, true, secure);
    return reply.status(201).send({ user: result.user, recoveryCode: result.recoveryCode });
  });

  app.post("/auth/login", async (request, reply) => {
    const input = requireBody(request.body, LoginRequestSchema);
    const result = await service.login(input, request.ip);
    setSessionCookie(reply, result.token, result.remember, secure);
    return reply.status(200).send({ user: result.user });
  });

  app.post("/auth/logout", async (request, reply) => {
    await service.logout(readCookie(request));
    clearSessionCookie(reply, secure);
    return reply.status(204).send();
  });

  app.post("/auth/recover", async (request, reply) => {
    const input = requireBody(request.body, RecoverRequestSchema);
    const result = await service.recover(input, request.ip);
    clearSessionCookie(reply, secure);
    return reply.status(200).send(result);
  });

  app.post("/auth/password", async (request, reply) => {
    const context = await service.authenticate(readCookie(request));
    const input = requireBody(request.body, ChangePasswordRequestSchema);
    await service.changePassword(context, input);
    return reply.status(204).send();
  });

  app.get("/auth/me", async (request, reply) => {
    const context = await service.authenticate(readCookie(request));
    return reply.status(200).send({ user: await service.self(context) });
  });
}
