import type { Id } from "../engine/types";

/** What the lottery kind records: docs/rules/lottery.md. */
export type LotteryEvent =
  /** Tickets bought for the open draw, their cost taken from the naira bank (R-LOTTERY-003, R-LOTTERY-004). */
  | { type: "lottery/bought"; draw: number; tickets: number; cost: number }
  /** The authority paid this character's prizes for a draw (R-LOTTERY-013); `topUp` is each prize's part from the house (R-LOTTERY-022). */
  | { type: "lottery/paid"; draw: number; prizes: { tier: "jackpot" | "mid" | "small"; amount: number; topUp: number }[] }
  /**
   * The draw's result was shown to the character once (R-LOTTERY-016): what one
   * jackpot ticket was paid and how many tickets won, for the front-page line.
   */
  | { type: "lottery/shown"; draw: number; jackpot: number; winners: number };

/** Kept so the id type is used while the kind has no entries of its own. */
export type LotteryId = Id<"news">;
