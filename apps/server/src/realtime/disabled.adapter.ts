import type { SemanticEnvelope } from "@ottv2/contracts";

import { AppError } from "../shared/errors/app-error.js";
import type {
  RealtimeMessageHandler,
  RealtimePort,
  RealtimeScope,
  RealtimeSubsystemStatus,
  RealtimeUnsubscribe
} from "./realtime.port.js";

export class DisabledRealtimeAdapter implements RealtimePort {
  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  getStatus(): RealtimeSubsystemStatus {
    return { status: "degraded", reason: "not_configured" };
  }

  async publish(_scope: RealtimeScope, _message: SemanticEnvelope): Promise<void> {
    throw this.unavailable();
  }

  async subscribe(_scope: RealtimeScope, _handler: RealtimeMessageHandler): Promise<RealtimeUnsubscribe> {
    throw this.unavailable();
  }

  private unavailable(): AppError {
    return new AppError(
      "SERVICE_UNAVAILABLE",
      "Kênh thời gian thực chưa được cấu hình.",
      503,
      true,
      "RECOVERABLE"
    );
  }
}
