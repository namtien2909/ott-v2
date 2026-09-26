import { z } from "zod";

import { ProtocolVersionSchema } from "./version.js";

export const SemanticEnvelopeSchema = z.object({
  protocolVersion: ProtocolVersionSchema,
  messageId: z.uuid(),
  type: z.string().min(1),
  timestamp: z.number().nonnegative(),
  roomId: z.string().min(1).optional(),
  matchId: z.uuid().optional(),
  actorId: z.string().min(1).optional(),
  sequence: z.number().int().nonnegative().optional(),
  stateVersion: z.number().int().nonnegative().optional(),
  payload: z.unknown()
});

export type SemanticEnvelope = z.infer<typeof SemanticEnvelopeSchema>;
