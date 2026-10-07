import type { Id } from "../engine/types";

export type QualityEvent =
  /**
   * A quality moved (R-QUALITY-002). `amount` is what was really applied after
   * the soft cap and the range, so it is never zero. `source` is the cause's
   * source: an activity, an offer choice, an obligation, or `month`.
   */
  { type: "quality/changed"; quality: Id<"quality">; amount: number; source: string };
