import type { TurnReport } from "../engine/types";

export type TurnEvent =
  /** The authority granted turns. `count` is what was actually added after the cap. */
  | { type: "turn/granted"; count: number; banked: number }
  /** One banked turn was spent and the month went up by one. */
  | { type: "turn/spent"; month: number; banked: number }
  /** The bank was filled to the cap. */
  | { type: "turn/refilled"; banked: number }
  /** The life at home is over. */
  | { type: "turn/finished" }
  /** The month's report was stored. */
  | { type: "turn/ended"; report: TurnReport }
  /** Free slots were locked until `untilMonth` (R-TURN-009). */
  | { type: "turn/locked"; slots: number; untilMonth: number; why: string }
  /** Locks whose month has passed were dropped. */
  | { type: "turn/unlocked"; why: string[] };
