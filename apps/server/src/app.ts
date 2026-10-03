import { performance } from "node:perf_hooks";
import Fastify, { type FastifyInstance } from "fastify";

import { loadEnv, type AppEnv } from "./config/env.js";
import { registerHealthRoute } from "./modules/health/health.route.js";
import { HealthService } from "./modules/health/health.service.js";
import { registerAuthRoutes } from "./modules/auth/auth.route.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { registerProfileRoutes } from "./modules/profile/profile.route.js";
import { registerRoomRoutes } from "./modules/room/room.route.js";
import { RoomManager } from "./modules/room/room.manager.js";
import { registerMatchRoutes } from "./modules/match/match.route.js";
import { MatchManager } from "./modules/match/match.manager.js";
import { registerMatchmakingRoutes } from "./modules/matchmaking/matchmaking.route.js";
import { MatchmakingManager } from "./modules/matchmaking/matchmaking.manager.js";
import { RatingService } from "./modules/rating/rating.service.js";
import { MatchHistoryService } from "./modules/history/history.service.js";
import { registerHistoryRoutes } from "./modules/history/history.route.js";
import { SocialService } from "./modules/social/social.service.js";
import { registerSocialRoutes } from "./modules/social/social.route.js";
import { GuestImportService } from "./modules/guest/guest-import.service.js";
import { registerGuestImportRoutes } from "./modules/guest/guest-import.route.js";
import { MetricsRegistry } from "./modules/diagnostics/metrics.js";
import { registerMetricsRoute } from "./modules/diagnostics/metrics.route.js";
import { registerCors } from "./plugins/cors.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerWebApp } from "./plugins/web-app.js";
import { PrismaDatabase, type DatabasePort } from "./plugins/prisma.js";
import { DisabledRealtimeAdapter } from "./realtime/disabled.adapter.js";
import { PlayHtmlAdapter } from "./realtime/playhtml.adapter.js";
import type { RealtimePort } from "./realtime/realtime.port.js";

export type BuildAppOptions = {
  env?: AppEnv;
  database?: DatabasePort;
  realtime?: RealtimePort;
  rooms?: RoomManager;
  matches?: MatchManager;
  matchmaking?: MatchmakingManager;
  history?: MatchHistoryService;
  social?: SocialService;
  guestImport?: GuestImportService;
  metrics?: MetricsRegistry;
};

function createRealtime(env: AppEnv, app: FastifyInstance): RealtimePort {
  if (env.REALTIME_ADAPTER === "disabled") return new DisabledRealtimeAdapter();
  return new PlayHtmlAdapter(
    {
      ...(env.PLAYHTML_ENDPOINT ? { endpoint: env.PLAYHTML_ENDPOINT } : {}),
      ...(env.PLAYHTML_PROJECT_ID ? { projectId: env.PLAYHTML_PROJECT_ID } : {})
    },
    app.log
  );
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = options.env ?? loadEnv();
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : { level: env.LOG_LEVEL }
  });
  const database = options.database ?? new PrismaDatabase();
  const realtime = options.realtime ?? createRealtime(env, app);
  const auth = new AuthService(database instanceof PrismaDatabase ? database.client : undefined);
  const rooms = options.rooms ?? new RoomManager();
  const matches = options.matches ?? new MatchManager();
  const matchmaking = options.matchmaking ?? new MatchmakingManager(rooms, matches);
  const rating = new RatingService(database instanceof PrismaDatabase ? database.client : undefined);
  const history = options.history ?? new MatchHistoryService(database instanceof PrismaDatabase ? database.client : undefined);
  const social = options.social ?? new SocialService(database instanceof PrismaDatabase ? database.client : undefined, rooms);
  const guestImport = options.guestImport ?? new GuestImportService(database instanceof PrismaDatabase ? database.client : undefined);
  const metrics = options.metrics ?? new MetricsRegistry();

  await registerCors(app, env.corsOrigins);
  await registerWebApp(app);
  registerErrorHandler(app);
  await registerAuthRoutes(app, auth, env);
  await registerProfileRoutes(app, auth, social);
  await registerRoomRoutes(app, auth, rooms);
  await registerMatchRoutes(app, auth, rooms, matches, rating, history, metrics);
  await registerMatchmakingRoutes(app, auth, matchmaking);
  await registerHistoryRoutes(app, auth, history);
  await registerSocialRoutes(app, auth, social);
  await registerGuestImportRoutes(app, auth, guestImport, env.NODE_ENV === "production");
  await registerMetricsRoute(app, metrics);
  await registerHealthRoute(app, new HealthService(database, realtime));
  app.addHook("onReady", async () => realtime.start());
  const requestStarts = new Map<string, number>();
  app.addHook("onRequest", async (request) => { requestStarts.set(request.id, performance.now()); });
  app.addHook("onResponse", async (request, reply) => {
    const startedAt = requestStarts.get(request.id);
    requestStarts.delete(request.id);
    const path = request.routeOptions.url ?? request.url.split("?", 1)[0] ?? "/";
    metrics.observeHttp(request.method, path, reply.statusCode, startedAt === undefined ? 0 : performance.now() - startedAt);
  });
  app.addHook("onClose", async () => {
    matches.stop();
    matchmaking.stop();
    history.stop();
    social.presence.stop();
    await realtime.stop();
    await database.close();
  });
  return app;
}
