import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => value === "" ? undefined : value;

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGINS: z.string().min(1).default("http://localhost:3000"),
  RENDER_EXTERNAL_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  REALTIME_ADAPTER: z.enum(["disabled", "playhtml"]).default("disabled"),
  PLAYHTML_ENDPOINT: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  PLAYHTML_PROJECT_ID: z.preprocess(emptyStringToUndefined, z.string().min(1).optional())
});

export type AppEnv = z.infer<typeof envSchema> & { corsOrigins: string[] };

function canonicalOrigin(origin: string): string {
  try {
    const parsed = new URL(origin);
    return parsed.pathname === "/" && parsed.search === "" && parsed.hash === ""
      ? parsed.origin
      : origin;
  } catch {
    return origin;
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".") || "environment").join(", ");
    throw new Error(`Invalid environment configuration: ${names}`);
  }

  const configuredOrigins = parsed.data.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(canonicalOrigin);
  const renderOrigin = parsed.data.RENDER_EXTERNAL_URL ? canonicalOrigin(parsed.data.RENDER_EXTERNAL_URL) : undefined;
  const corsOrigins = [...new Set(renderOrigin ? [...configuredOrigins, renderOrigin] : configuredOrigins)];
  if (parsed.data.NODE_ENV === "production") {
    if (corsOrigins.includes("*") || corsOrigins.some((origin) => {
      try {
        const hostname = new URL(origin).hostname.toLowerCase();
        return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
      } catch {
        return true;
      }
    })) {
      throw new Error("Invalid environment configuration: CORS_ORIGINS");
    }
    if (parsed.data.REALTIME_ADAPTER === "playhtml" && (!parsed.data.PLAYHTML_ENDPOINT || !parsed.data.PLAYHTML_PROJECT_ID)) {
      throw new Error("Invalid environment configuration: PLAYHTML_ENDPOINT, PLAYHTML_PROJECT_ID");
    }
  }

  return { ...parsed.data, corsOrigins };
}
