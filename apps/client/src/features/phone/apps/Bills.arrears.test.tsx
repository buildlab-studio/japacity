// The way back at every stage of a missed tuition payment (abroad-money:missed-tuition-runs-in-stages, obligation:paying-down-obligations,
// status:course-passed-or-withdrawn): Bills offers to pay every charge missed and not yet paid, the exact sum the fees office takes, so the
// stages stop and a withdrawn student may be reinstated.
import { content } from "@japacity/content";
import type { Game } from "@japacity/sim/testing";
import { ALWAYS_GRANTED, answerFirst, offeredSeed, readyLife, setPockets, toApplied } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import { Bills, payNow } from "./Bills";

const UK = "route.uk-masters";

/** A student flown to Northgate who misses `months` of tuition with no pounds to pay it. */
function missed(months: number): Game {
  const game = readyLife(content, { seed: offeredSeed(content), quiet: true, tuning: ALWAYS_GRANTED });
  toApplied(game);
  answerFirst(game);
  game.endTurn();
  expect(game.accept({ type: "route/depart", route: UK }).ok).toBe(true);
  for (let month = 0; month < months; month += 1) {
    setPockets(game, { GBP: 0 });
    game.endTurn();
  }
  return game;
}

const tuitionOf = (game: Game) => game.view().obligations.find((owed) => owed.entry === "obligation.tuition");

describe("paying tuition arrears", () => {
  test.each([1, 2])("[obligation:paying-down-obligations] [abroad-money:missed-tuition-runs-in-stages] given %i months of tuition missed, when Bills offers to pay, then the sum is every charge missed and not yet paid, which the fees office takes whole", (months) => {
    const game = missed(months);
    const owed = tuitionOf(game);
    if (owed === undefined) throw new Error("No tuition open.");
    expect(owed.missed).toBeGreaterThan(0);
    const pay = payNow(owed, game.view().month);
    if (pay === null) throw new Error("Bills offers no way to pay the arrears.");
    setPockets(game, { GBP: pay.amount });
    expect(game.accept({ type: "obligation/pay", obligation: owed.id, amount: pay.amount }).ok).toBe(true);
    expect(tuitionOf(game)?.missed ?? 0).toBe(0);
  });

  test("[abroad-money:missed-tuition-runs-in-stages] given a charge missed, when Bills opens, then the tuition carries a button to pay the arrears with the sum on it", async () => {
    const game = missed(1);
    const owed = tuitionOf(game)!;
    const pay = payNow(owed, game.view().month)!;
    await renderWithView(<Bills />, game.view());
    const button = document.querySelector(`[data-pay="${owed.id}"]`);
    expect(button?.textContent).toBe(`${say("phone.bills.pay")}: ${formatMoney(pay.amount, "GBP")}`);
    expect(pay.button).toBe(say("phone.bills.tuition.button"));
  });

  test("[abroad-money:tuition-paid-in-instalments] given tuition paid on time, when Bills is read, then there is nothing to pay ahead from the slip", () => {
    const game = missed(0);
    const owed = tuitionOf(game);
    if (owed === undefined) throw new Error("No tuition open.");
    expect(payNow(owed, game.view().month)).toBeNull();
  });
});
