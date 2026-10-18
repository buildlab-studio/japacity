// The lottery's public draw page (lottery:fingerprint-commits-secret, lottery:ticket-list-frozen-anonymously, lottery:result-published-in-tick-row).
import type { LotteryOdds, LotteryResult } from "@japacity/sim";

/**
 * `GET /api/draw/:n`, no session: a draw's public data, the same for everyone. Before the close: the fingerprint, the
 * beacon round, the odds and the jackpot it opened with. From the freeze: the stored list of tokens, its count and
 * hash. From the result: the result, which holds the secret.
 */
export interface DrawReply {
  draw: number;
  closesTick: number;
  closesAt: number;
  fingerprint: string;
  beaconRound: number;
  /** lottery:odds-fixed-at-draw-open, lottery:jackpot-rolls-over: the odds and the jackpot fixed when the draw opened. */
  odds: LotteryOdds;
  jackpot: number;
  list: string[] | null;
  count: number | null;
  listHash: string | null;
  result: LotteryResult | null;
}
