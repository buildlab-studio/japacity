// The month's lotto as the month's lines told it (docs/rules/luck.md R-LUCK-005, lottery.md): each ticket bought at
// the kiosk is a now-act with its count and the wallet's `social` line after it, each bought online is the wallet's
// ticket line. The Lotto app says what this month's tickets cost and the kiosk says when the month's ceiling is
// reached, both from these, so they never disagree.
import { content } from "@japacity/content";
import type { MoneyParam, PlayerView, ReportLine } from "@japacity/sim";

import { moneyParam } from "./text";

const PLAYED = "line.activity.played-now";
const LOTTO = "activity.play-lotto";
const SOCIAL = "line.wallet.social";
/** A ticket bought for the online draw (R-LOTTERY-006): the wallet's own line. */
const ONLINE = "line.wallet.ticket";

export interface LottoMonth {
  tickets: number;
  /** What the tickets cost this month, in naira; null when none was bought. */
  spent: MoneyParam | null;
}

/** The tickets bought this month and what they cost, from the month's lines in the order they were told. */
export function lottoMonth(lines: readonly ReportLine[]): LottoMonth {
  let tickets = 0;
  let spent = 0;
  lines.forEach((line, index) => {
    if (line.key === PLAYED && line.params.activity === LOTTO) {
      const count = Number(line.params.param ?? "1");
      tickets += Number.isSafeInteger(count) && count > 0 ? count : 1;
      // The kiosk's price is the wallet's `social` line told with the act (R-LUCK-005).
      const paid = lines.slice(index + 1, index + 3).find((next) => next.key === SOCIAL);
      spent += paid === undefined ? 0 : (moneyParam("amount", paid.params, SOCIAL)?.amount ?? 0);
      return;
    }
    if (line.key === ONLINE) {
      const amount = moneyParam("amount", line.params, ONLINE)?.amount ?? 0;
      spent += amount;
      tickets += Math.floor(amount / content.tuning.lottery.ticket);
    }
  });
  return { tickets, spent: tickets === 0 ? null : { currency: "NGN", amount: spent } };
}

/** True once this month's kiosk tickets reach the most one slip sells (R-LUCK-005, `tuning.luck.maxTickets`). */
export function kioskCapReached(lines: readonly ReportLine[]): boolean {
  return lottoMonth(lines).tickets >= content.tuning.luck.maxTickets;
}

/** R-WALLET-020: the naira earned in the game, the naira held less the marked, topped-up share a ticket is never paid from. */
export function earnedNaira(view: Pick<PlayerView, "pockets" | "wallet">): number {
  const { bank, cash } = view.pockets.NGN;
  return Math.max(0, bank + cash - view.wallet.marked);
}

/** R-WALLET-020, R-LOTTERY-018: the naira held would pay `cost`, but only with the marked share, so the kiosk is shut with its words. */
export function earnedShort(view: Pick<PlayerView, "pockets" | "wallet">, cost: number): boolean {
  const { bank, cash } = view.pockets.NGN;
  return bank + cash >= cost && earnedNaira(view) < cost;
}
