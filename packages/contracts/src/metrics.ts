import { z } from "zod";

export const MetricRouteSchema = z.object({
  method: z.string().min(1),
  path: z.string().min(1),
  count: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  averageMs: z.number().nonnegative(),
  p95Ms: z.number().nonnegative(),
});

export const MetricsSnapshotSchema = z.object({
  uptimeSeconds: z.number().nonnegative(),
  requestCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  activeStreams: z.number().int().nonnegative(),
  fanoutEvents: z.number().int().nonnegative(),
  routes: z.array(MetricRouteSchema),
});

export type MetricRoute = z.infer<typeof MetricRouteSchema>;
export type MetricsSnapshot = z.infer<typeof MetricsSnapshotSchema>;
