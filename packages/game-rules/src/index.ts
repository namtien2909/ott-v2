/**
 * W1 pure authoritative game rules. This package owns no transport, timer,
 * persistence or UI behavior.
 */
export const GAME_RULES_PACKAGE_VERSION = "0.1.0" as const;

export * from "./types.js";
export * from "./coordinates.js";
export * from "./setup.js";
export * from "./engine.js";
