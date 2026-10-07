import type { Id } from "../engine/types";

/** Placeholder: the status work defines the real events. */
export type StatusEvent = { type: "status/granted"; status: Id<"status">; month: number };
