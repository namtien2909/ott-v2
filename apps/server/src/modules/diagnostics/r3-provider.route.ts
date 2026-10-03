import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { R3ProviderResponseSchema } from "@ottv2/contracts";

const generatedEvidenceUrl = new URL("../../r3-provider-evidence.json", import.meta.url);
const checkedInEvidenceUrl = new URL("../../../../../docs/r3-provider-render-evidence.json", import.meta.url);

async function readEvidence(): Promise<unknown | null> {
  for (const url of [generatedEvidenceUrl, checkedInEvidenceUrl]) {
    try {
      return JSON.parse(await readFile(fileURLToPath(url), "utf8"));
    } catch {
      // A missing or malformed report is handled as NOT_PROVEN below. Do not
      // expose filesystem paths or parser details through a public endpoint.
    }
  }
  return null;
}

export async function registerR3ProviderRoute(app: FastifyInstance): Promise<void> {
  app.get("/diagnostics/r3/provider", async (_request, reply) => {
    const candidate = await readEvidence();
    const parsed = candidate === null ? null : R3ProviderResponseSchema.safeParse(candidate);
    if (!parsed?.success) {
      return reply.status(503).send({
        schemaVersion: 1,
        status: "NOT_PROVEN",
        runtimeGate: "NOT_PROVEN",
        reason: "Provider runtime evidence is not available."
      });
    }
    return reply.status(parsed.data.status === "PROVEN" ? 200 : 503).send(parsed.data);
  });
}
