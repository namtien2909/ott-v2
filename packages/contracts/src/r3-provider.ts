import { z } from "zod";

const R3ProviderCheckSchema = z.object({
  pass: z.boolean()
}).passthrough();

const R3ProviderSchedulerResultSchema = z.object({
  id: z.number().int().nonnegative(),
  code: z.number().int().nullable(),
  elapsedMs: z.number().nonnegative(),
  validOutput: z.boolean()
});

export const R3ProviderEvidenceSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(["PROVEN", "NOT_PROVEN"]),
  runtimeGate: z.string().min(1),
  measuredAt: z.string().datetime({ offset: true }),
  playerCodeExecuted: z.literal(false),
  fixtureCodeExecuted: z.boolean(),
  provider: z.object({
    platform: z.string().min(1),
    arch: z.string().min(1),
    cpuCount: z.number().int().positive(),
    totalMemoryBytes: z.number().int().positive(),
    freeMemoryBytes: z.number().int().nonnegative()
  }),
  artifacts: z.object({
    wasmtimeVersion: z.string().min(1),
    wasmtimeBinarySha256: z.string().regex(/^[a-f0-9]{64}$/),
    cpythonVersion: z.string().min(1),
    cpythonWasmSha256: z.string().regex(/^[a-f0-9]{64}$/)
  }),
  checks: z.record(z.string(), R3ProviderCheckSchema),
  scheduler: z.object({
    pass: z.boolean(),
    requested: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    maxConcurrent: z.number().int().nonnegative(),
    results: z.array(R3ProviderSchedulerResultSchema)
  }),
  security: z.object({
    network: z.literal(false),
    filesystem: z.literal(false),
    secrets: z.literal(false),
    applicationMounts: z.literal(false)
  }),
  scope: z.string().min(1)
});

export type R3ProviderEvidence = z.infer<typeof R3ProviderEvidenceSchema>;

export const R3ProviderFailureSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.literal("NOT_PROVEN"),
  runtimeGate: z.literal("NOT_PROVEN"),
  measuredAt: z.string().datetime({ offset: true }),
  playerCodeExecuted: z.literal(false),
  fixtureCodeExecuted: z.literal(false),
  reason: z.literal("Provider probe failed closed; no player code was executed."),
  stage: z.string().regex(/^[a-z-]+$/),
  failedChecks: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/)),
  checks: z.record(z.string(), R3ProviderCheckSchema).optional(),
  scheduler: z.object({
    pass: z.boolean(),
    requested: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    maxConcurrent: z.number().int().nonnegative(),
    results: z.array(R3ProviderSchedulerResultSchema)
  }).optional(),
  startup: z.object({
    cause: z.enum(["HOST_STARTUP_TIMEOUT", "GLIBC_VERSION_UNAVAILABLE", "SHARED_LIBRARY_UNAVAILABLE", "EXECUTABLE_UNAVAILABLE", "EXECUTION_PERMISSION_DENIED", "HOST_THREAD_RESOURCE_FAILURE", "PYTHON_RUNTIME_LAYOUT_FAILURE", "GUEST_BUDGET_EXCEEDED", "HOST_PROCESS_ABORTED", "HOST_PROCESS_KILLED", "OK", "UNCLASSIFIED_STARTUP_FAILURE"]),
    code: z.number().int().nullable(),
    signal: z.string().nullable(),
    elapsedMs: z.number().nonnegative().optional(),
    hostTimedOut: z.boolean().optional()
  }).optional()
});

export const R3ProviderResponseSchema = z.union([R3ProviderEvidenceSchema, R3ProviderFailureSchema]);
