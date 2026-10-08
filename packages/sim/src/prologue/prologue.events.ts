import type { Id, PrologueSlice } from "../engine/types";

export type PrologueEvent =
  /** R-PROLOGUE-002: step 0's draw, made once on stream `prologue`. */
  | { type: "prologue/drawn"; draw: NonNullable<PrologueSlice["draw"]> }
  /**
   * R-PROLOGUE-003: an answer given. `outcome` is the words key of its draw's
   * result, or null when it drew nothing; `next` is the step it leads to, null
   * when the prologue closes.
   */
  | { type: "prologue/chosen"; step: string; answer: string; outcome: string | null; next: string | null; flags: string[]; gradeBase: number }
  /** The graduation's grade draw: the grade the degree ends with. */
  | { type: "prologue/graded"; grade: number }
  /** R-PROLOGUE-005: a headline passes, as flavour only. */
  | { type: "prologue/headline"; story: Id<"news"> }
  /** R-PROLOGUE-006. */
  | { type: "prologue/closed" };
