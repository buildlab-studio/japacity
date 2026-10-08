import type { Id } from "../engine/types";

export type SetpieceEvent =
  /** A set piece opened with these questions, in the order drawn (R-SETPIECE-001). */
  | { type: "setpiece/opened"; entry: Id<"setpiece">; route: Id<"route"> | null; questions: string[] }
  /** The first open question was answered (R-SETPIECE-003), with its score as judged at that moment (R-SETPIECE-004). */
  | { type: "setpiece/answered"; question: string; answer: string; score: number }
  /** The last question was answered and the set piece closed (R-SETPIECE-004). Its score goes to the route, never here. */
  | { type: "setpiece/closed"; entry: Id<"setpiece">; route: Id<"route"> | null };
