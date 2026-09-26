import type { SemanticEnvelope } from "@ottv2/contracts";

export type RealtimeScope =
  | { kind: "room"; roomId: string }
  | { kind: "match"; matchId: string }
  | { kind: "connection"; connectionId: string };

export type RealtimeSubsystemStatus = {
  status: "ok" | "degraded";
  reason?: "not_configured" | "not_started" | "not_implemented" | "connection_failed";
};

export type RealtimeMessageHandler = (message: SemanticEnvelope) => void | Promise<void>;
export type RealtimeUnsubscribe = () => void | Promise<void>;

export interface RealtimePort {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): RealtimeSubsystemStatus;
  publish(scope: RealtimeScope, message: SemanticEnvelope): Promise<void>;
  subscribe(scope: RealtimeScope, handler: RealtimeMessageHandler): Promise<RealtimeUnsubscribe>;
}
