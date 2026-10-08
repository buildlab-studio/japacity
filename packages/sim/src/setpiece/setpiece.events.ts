import type { Id } from "../engine/types";

export type SetpieceEvent =
  /** A set piece opened with these questions, in the order drawn (R-SETPIECE-001). */
  | { type: "setpiece/opened"; entry: Id<"setpiece">; route: Id<"route"> | null; questions: string[] }
  /** The first open question was answered (R-SETPIECE-003), with its score as judged at that moment (R-SETPIECE-004). */
  | { type: "setpiece/answered"; question: string; answer: string; score: number }
  /** R-SETPIECE-008: the answer just given names this follow-up, asked next, right after `after`. */
  | { type: "setpiece/followed-up"; question: string; after: string }
  /** The last question was answered and the set piece closed (R-SETPIECE-004). Its score goes to the route, never here. */
  | { type: "setpiece/closed"; entry: Id<"setpiece">; route: Id<"route"> | null }
  /** The open set piece was closed by the effect `setpiece/close`, unanswered: nothing scored, nothing counted. */
  | { type: "setpiece/dropped"; entry: Id<"setpiece">; route: Id<"route"> | null };
