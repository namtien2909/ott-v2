export type ComponentStatus = "ok" | "degraded";

export type ServiceComponent = {
  status: ComponentStatus;
  latencyMs?: number;
  reason?: string;
};
