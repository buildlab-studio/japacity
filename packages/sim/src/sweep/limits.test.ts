// R-ENGINE-016: every limit the player can meet is a rule of the simulation.
// Each test sends the over-limit command straight through `step`, on the real
// content, and checks the code it is rejected with; the command just inside
// the limit is accepted, so the edge is where the rule puts it.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp, convertMinor, divFloor } from "../engine/int";
import type { ForeignCurrency, PlayerView } from "../engine/types";
import { NORTHGATE, offeredWith, readyContent, readyLife, seedWhere, slot, toApplied, UK } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";

const rest = slot("activity.rest");

function official(view: PlayerView): Record<ForeignCurrency, number> {
  return { GBP: view.rates.GBP.official, USD: view.rates.USD.official } as Record<ForeignCurrency, number>;
}

/** US cents a bank purchase of this much naira counts against the allowance: what is left after the charge. */
function centsOf(rates: Record<ForeignCurrency, number>, naira: number): number {
  return convertMinor(naira - bp(naira, content.tuning.wallet.bankChargeBp), "NGN", "USD", rates);
}

/**
 * Ada, rested until the quick loan opens: under ₦100,000 and nothing on her credit mark. Since decision 0035 nothing of
 * her living is charged as a month turns at home, so resting alone never brings her under the line: each month she eats
 * by hand as the month's time allows (R-HOME-012), the meals spending about what the month's living charge took.
 */
function withQuickLoan(): { game: Game; offer: PlayerView["offers"][number] } {
  // A meal bought: the family house's pot is free, so the meal bought is one of your own.
  const meal = { type: "activity/now", activity: "activity.cook-own", param: null } as const;
  const play = (seed: string): Game => {
    const game = start({ scenario: "scenario.ada", seed, content });
    for (let month = 0; month < 8 && !game.view().offers.some((offer) => offer.entry === "offer.quick-loan"); month += 1) {
      // A meal a morning until the month's free time is spent (R-TURN-010), or the money for one is gone.
      for (let fed = true; fed && game.view().halfDays.spent < game.view().halfDays.free; ) fed = game.send(meal).ok;
      game.endTurn();
    }
    return game;
  };
  const game = play(seedWhere((seed) => play(seed).view().offers.some((offer) => offer.entry === "offer.quick-loan")));
  const offer = game.view().offers.find((item) => item.entry === "offer.quick-loan");
  if (offer === undefined) throw new Error("No quick loan opened.");
  return { game, offer };
}

describe("[R-ENGINE-016] limits the player can meet", () => {
  test("[R-ENGINE-016] [R-TURN-006] given three free slots, when a fourth slot is filled, then the turn is rejected with not-legal, and three are accepted", () => {
    const game = start({ scenario: "scenario.ada", content });
    expect(game.view().freeSlots).toBe(content.tuning.turn.freeSlotsNoJob);
    game.expectRejected({ type: "turn/end", slots: [rest, rest, rest, rest] }, "not-legal");
    game.endTurn([rest, rest, rest]);
  });

  test("[R-ENGINE-016] [R-TURN-006] given a job and two free slots, when a third slot is filled, then the turn is rejected with not-legal", () => {
    const game = start({ scenario: "scenario.tunde", content });
    expect(game.view().freeSlots).toBe(content.tuning.turn.freeSlots);
    game.expectRejected({ type: "turn/end", slots: [rest, rest, rest] }, "not-legal");
    game.endTurn([rest, rest]);
  });

  test("[R-ENGINE-016] [R-WALLET-005] given the month's bank allowance, when a purchase is one US cent over what is left, then it is rejected with bad-amount, and a purchase of exactly what is left is accepted", () => {
    const game = start({ scenario: "scenario.tunde", content });
    // At home the view shows the allowance (R-WALLET-005); a null here fails the test below.
    const left = game.view().bankAllowanceLeft ?? -1;
    expect(left).toBeGreaterThan(0);
    const rates = official(game.view());
    // The largest naira amount that buys no more than what is left, found by halving; one kobo more buys one cent more.
    let low = 0;
    let high = game.state.wallet.pockets.NGN.bank;
    while (low < high) {
      const middle = high - divFloor(high - low, 2);
      if (centsOf(rates, middle) <= left) low = middle;
      else high = middle - 1;
    }
    const naira = low;
    const over = naira + 1;
    expect(centsOf(rates, naira)).toBe(left);
    expect(centsOf(rates, over)).toBe(left + 1);
    expect(over).toBeLessThanOrEqual(game.state.wallet.pockets.NGN.bank);

    game.expectRejected({ type: "wallet/convert", from: "NGN", to: "USD", amount: over, via: "bank" }, "bad-amount");
    game.accept({ type: "wallet/convert", from: "NGN", to: "USD", amount: naira, via: "bank" });
    expect(game.view().bankAllowanceLeft).toBe(0);
  });

  test("[R-ENGINE-016] [R-OFFER-003] given an offer that asks for an amount, when the amount is one kobo over its max or one under its min, then the choice is rejected with bad-amount, and the min itself is accepted", () => {
    const { game, offer } = withQuickLoan();
    const range = offer.choices.find((choice) => choice.id === "take")?.pick;
    expect(range).not.toBeNull();
    const { min, max } = range!;
    game.expectRejected({ type: "offer/choose", offer: offer.id, choice: "take", amount: max + 1 }, "bad-amount");
    game.expectRejected({ type: "offer/choose", offer: offer.id, choice: "take", amount: min - 1 }, "bad-amount");
    game.expectRejected({ type: "offer/choose", offer: offer.id, choice: "take", amount: Number("0.5") + min }, "bad-amount");
    game.accept({ type: "offer/choose", offer: offer.id, choice: "take", amount: min });
  });

  test("[R-ENGINE-016] [R-OBLIGATION-008] given a loan, when a payment is one kobo over what is owed, then it is rejected with bad-amount, and paying exactly what is owed closes it", () => {
    const { game, offer } = withQuickLoan();
    const min = offer.choices.find((choice) => choice.id === "take")!.pick!.min;
    game.accept({ type: "offer/choose", offer: offer.id, choice: "take", amount: min });
    const loan = game.view().obligations.find((item) => item.entry === "obligation.quick-loan");
    expect(loan?.outstanding).toBe(min);
    game.expectRejected({ type: "obligation/pay", obligation: loan!.id, amount: loan!.outstanding + 1 }, "bad-amount");
    game.expectRejected({ type: "obligation/pay", obligation: loan!.id, amount: 0 }, "bad-amount");
    game.accept({ type: "obligation/pay", obligation: loan!.id, amount: loan!.outstanding });
    expect(game.view().obligations.some((item) => item.id === loan!.id)).toBe(false);
  });

  test("[R-ENGINE-016] [R-OBLIGATION-008] given upkeep, when it is paid ahead, then it is rejected with not-legal", () => {
    const game = start({ scenario: "scenario.ada", content });
    const upkeep = game.view().obligations.find((item) => item.entry === "obligation.upkeep");
    expect(upkeep).toBeDefined();
    game.expectRejected({ type: "obligation/pay", obligation: upkeep!.id, amount: 100 }, "not-legal");
  });

  test("[R-ENGINE-016] [R-ROUTE-008] given no offer from the school, when the deposit is paid, then it is rejected with not-legal", () => {
    const game = readyLife(content);
    expect(game.state.wallet.pockets.GBP.bank).toBeGreaterThan(content.school[NORTHGATE]!.deposit);
    game.expectRejected({ type: "route/pay-deposit", route: UK, school: NORTHGATE }, "not-legal");
  });

  test("[R-ENGINE-016] [R-ROUTE-020] given no grant, when the character departs, then it is rejected with not-legal", () => {
    const game = start({ scenario: "scenario.tunde", content });
    expect(game.state.wallet.pockets.NGN.bank).toBeGreaterThan(160000000);
    game.expectRejected({ type: "route/depart", route: UK }, "not-legal");
  });

  test("[R-ENGINE-016] [R-SETPIECE-003] given the interview open, when a later question is answered first, then it is rejected with not-legal, and with no set piece open any answer is", () => {
    const quiet = start({ scenario: "scenario.ada", content });
    quiet.expectRejected({ type: "setpiece/answer", question: "why-uk", answer: "course" }, "not-legal");

    const used = readyContent(content);
    const game = readyLife(content, { seed: seedWhere((seed) => offeredWith(seed, used, NORTHGATE, 4)) });
    toApplied(game);
    const open = game.state.setpiece.open;
    expect(open).not.toBeNull();
    const [first, second] = open!.questions;
    expect(second).toBeDefined();
    const answerTo = (question: string): string => {
      const entry = content.setpiece[open!.entry]!.questions.find((item) => item.id === question);
      return entry!.answers[0]!.id;
    };
    game.expectRejected({ type: "setpiece/answer", question: second!, answer: answerTo(second!) }, "not-legal");
    game.expectRejected({ type: "setpiece/answer", question: first!, answer: "no-such-answer" }, "not-legal");
    game.accept({ type: "setpiece/answer", question: first!, answer: answerTo(first!) });
  });

  test("[R-ENGINE-016] [R-TURN-005] given a player, when it sends turns/grant, then it is rejected with not-yours", () => {
    const game = start({ scenario: "scenario.zainab", content });
    game.expectRejected({ type: "turns/grant", count: 1 }, "not-yours", "player");
    const banked = game.state.turn.banked;
    game.grant(1);
    expect(game.state.turn.banked).toBe(Math.min(content.tuning.turn.cap, banked + 1));
  });
});
