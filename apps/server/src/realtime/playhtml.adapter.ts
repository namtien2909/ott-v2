import type { FastifyBaseLogger } from "fastify";

import { AppError } from "../shared/errors/app-error.js";
import type {
  RealtimeMessageHandler,
  RealtimePort,
  RealtimeScope,
  RealtimeSubsystemStatus,
  RealtimeUnsubscribe
} from "./realtime.port.js";
import type { SemanticEnvelope } from "@ottv2/contracts";

export type PlayHtmlAdapterConfig = {
  endpoint?: string;
  projectId?: string;
};

export class PlayHtmlAdapter implements RealtimePort {
  private started = false;

  constructor(
    private readonly config: PlayHtmlAdapterConfig,
    private readonly logger: FastifyBaseLogger
  ) {}

  async start(): Promise<void> {
    this.started = true;
    this.logger.info({ configured: this.isConfigured() }, "realtime adapter skeleton started");
  }

  async stop(): Promise<void> {
    this.started = false;
  }

  getStatus(): RealtimeSubsystemStatus {
    if (!this.isConfigured()) return { status: "degraded", reason: "not_configured" };
    if (!this.started) return { status: "degraded", reason: "not_started" };
    return { status: "degraded", reason: "not_implemented" };
  }

  async publish(_scope: RealtimeScope, _message: SemanticEnvelope): Promise<void> {
    throw this.unavailable();
  }

  async subscribe(_scope: RealtimeScope, _handler: RealtimeMessageHandler): Promise<RealtimeUnsubscribe> {
    throw this.unavailable();
  }

  private isConfigured(): boolean {
    return Boolean(this.config.endpoint && this.config.projectId);
  }

  private unavailable(): AppError {
    return new AppError(
      "SERVICE_UNAVAILABLE",
      "Kênh thời gian thực chưa sẵn sàng.",
      503,
      true,
      "RECOVERABLE"
    );
  }
}
