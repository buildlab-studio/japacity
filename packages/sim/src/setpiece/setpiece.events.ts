import type { Id } from "../engine/types";

/** Placeholder: the setpiece work defines the real events. */
export type SetpieceEvent = { type: "setpiece/opened"; entry: Id<"setpiece">; route: Id<"route">; questions: string[] };
