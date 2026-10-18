/** What the lottery kind records: docs/rules/lottery.md. */
export type LotteryEvent =
  /** Tickets bought for the open draw, their cost taken from the naira bank (lottery:ticket-buying-capped, lottery:tickets-kept-per-draw). */
  | { type: "lottery/bought"; draw: number; tickets: number; cost: number }
  /** The authority paid this character's prizes for a draw (lottery:winners-paid-by-authority). */
  | { type: "lottery/paid"; draw: number; prizes: { tier: "jackpot" | "mid" | "small"; amount: number }[] }
  /**
   * The draw's result was shown to the character once (lottery:draw-result-on-front-page): the
   * jackpot the draw stood at, whether a ticket hit it, and how many tickets
   * won, for the front-page line.
   */
  | { type: "lottery/shown"; draw: number; jackpot: number; hit: boolean; winners: number };
