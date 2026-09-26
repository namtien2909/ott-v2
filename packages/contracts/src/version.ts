import { z } from "zod";

export const PROTOCOL_VERSION = "0.1" as const;
export const APPLICATION_VERSION = "0.1.0" as const;

export const ProtocolVersionSchema = z.literal(PROTOCOL_VERSION);
export type ProtocolVersion = z.infer<typeof ProtocolVersionSchema>;
