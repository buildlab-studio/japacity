// The lottery's public draw page (lottery.md R-LOTTERY-007, 008, 015).
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
  /** R-LOTTERY-021, R-LOTTERY-012: the odds and the jackpot fixed when the draw opened. */
  odds: LotteryOdds;
  jackpot: number;
  list: string[] | null;
  count: number | null;
  listHash: string | null;
  result: LotteryResult | null;
}
