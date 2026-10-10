// The lotto kiosk and the bet slip: docs/rules/luck.md R-LUCK-005, 006 and 008.
// a now-act (an application, a paper, a visit) is refused in a slot, so each probe that
// sent one in a turn/end is sent as activity/now, and an application checked as applying is read in the month it is sent.
import { content } from "@japacity/content";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { bp, mulDiv } from "../engine/int";
import type { Accepted, BaseEvent, Id, MoneyParam, ReportLine } from "../engine/types";
import { applyEffects, draw, slot } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import type { ActivityEvent, Prize } from "./activity.events";
import { activityKind, PER_MILLION, prizeOdds, ticketParams } from "./activity.logic";

const LOTTO: Id<"activity"> = "activity.play-lotto";
const BET: Id<"activity"> = "activity.bet-slip";
const luck = content.tuning.luck;

interface Money {
  type: string;
  currency: string;
  pocket: string;
  amount: number;
  reason: string;
}

function moneyOf(result: Accepted, reason: string): Money[] {
  return result.events.filter((event): event is BaseEvent & Money => (event.type === "wallet/credited" || event.type === "wallet/debited") && (event as unknown as Money).reason === reason);
}

/** The prize a draw out of a million wins, worked out here from the odds as the page states them. */
function expectedPrize(value: number): { prize: Prize; amount: number } | null {
  let below = 0;
  for (const odds of prizeOdds(luck)) {
    below += odds.perMillion;
    if (value < below) return { prize: odds.prize, amount: odds.amount };
  }
  return null;
}

function ada(): Game {
  return start({ content, scenario: "scenario.ada" });
}

describe("the lotto kiosk", () => {
  test("[R-LUCK-005] [R-ENGINE-016] given the kiosk, when tickets are picked, then 1 to the cap are sold and 0, one over the cap or none are rejected with not-legal", () => {
    expect(ticketParams(luck)).toEqual(["1", "2", "3", "4", "5"]);
    expect(luck.maxTickets).toBe(5);
    const game = ada();
    expect(game.view().activities.find((option) => option.id === LOTTO)).toMatchObject({ allowed: true, params: ["1", "2", "3", "4", "5"], cost: [{ currency: "NGN", amount: luck.ticket }] });
    for (const bad of ["0", "6", "two", null]) game.expectRejected({ type: "activity/now", activity: LOTTO, param: bad }, "not-legal");
    game.endTurn([slot(LOTTO, String(luck.maxTickets))]);
  });

  test("[R-LUCK-005] given tickets bought, when they are drawn, then each costs the ticket price from cash under social, each is one draw on `lotto`, and winnings go to the bank as a win that is never a lot", () => {
    const game = ada();
    let won = 0;
    for (let month = 0; month < 20 && won === 0; month += 1) {
      // Upkeep is taken cash first, so the stake is put back in hand each month.
      applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "cash", amount: luck.ticket * 3, reason: "gift" }]);
      const n = game.state.draws.lotto ?? 0;
      const prizes = [0, 1, 2].map((ticket) => expectedPrize(draw(game.state.seed, "lotto", n + ticket, PER_MILLION)));
      const result = game.endTurn([slot(LOTTO, "3")]);
      expect(game.state.draws.lotto).toBe(n + 3);
      expect(moneyOf(result, "social")).toEqual([{ type: "wallet/debited", currency: "NGN", pocket: "cash", amount: luck.ticket * 3, reason: "social" }]);
      const total = prizes.reduce((sum, hit) => sum + (hit?.amount ?? 0), 0);
      const played = result.events.find((event): event is Extract<ActivityEvent, { type: "activity/lotto-played" }> => event.type === "activity/lotto-played");
      expect(played?.prizes).toEqual(prizes.flatMap((hit) => (hit === null ? [] : [hit.prize])));
      expect(moneyOf(result, "win")).toEqual(total === 0 ? [] : [{ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: total, reason: "win" }]);
      won += total;
    }
    expect(won).toBeGreaterThan(0);
    expect(game.state.wallet.lots).toEqual([]);
  });

  test("[R-LUCK-005] given naira only in the bank, when tickets are played, then the kiosk is paid from the bank: cash first, the bank for the rest (decision 0012)", () => {
    const game = ada();
    game.accept({ type: "wallet/move", currency: "NGN", amount: game.state.wallet.pockets.NGN.cash, to: "bank" });
    const result = game.endTurn([slot(LOTTO, "1")]);
    expect(result.events.some((event) => event.type === "activity/slot-failed")).toBe(false);
    expect(moneyOf(result, "social")).toMatchObject([{ pocket: "bank", amount: luck.ticket }]);
  });

  test("[R-LUCK-005] given the kiosk's odds, when the expected return on a ticket is worked out from the numbers, then it is under half the stake", () => {
    // Out of a million draws: the prizes paid, against the stake paid.
    const paid = prizeOdds(luck).reduce((sum, odds) => sum + odds.perMillion * odds.amount, 0);
    expect(paid * 2).toBeLessThan(luck.ticket * PER_MILLION);
    // ₦50 small, ₦25 mid and ₦20 jackpot on each ₦200 ticket: ₦95, as the page computes it.
    expect(mulDiv(paid, 1, PER_MILLION)).toBe(9500);
  });

  test("[R-LUCK-005] [R-ENGINE-017] given the tuning's jackpot figure, when its odds are read, then it is 1 in 100,000 draws, and an overlay's figure is the one drawn", () => {
    const jackpot = prizeOdds(luck).find((odds) => odds.prize === "jackpot")!;
    expect(jackpot.perMillion).toBe(luck.jackpotPerMillion);
    expect(jackpot.perMillion * 100000).toBe(PER_MILLION);
    const overlaid = prizeOdds({ ...luck, jackpotPerMillion: 2 * luck.jackpotPerMillion }).find((odds) => odds.prize === "jackpot")!;
    expect(overlaid.perMillion).toBe(2 * luck.jackpotPerMillion);
  });

  test.prop([fc.integer({ min: 0, max: PER_MILLION - 1 })])("[R-LUCK-005] given any draw out of a million, when its prize is read, then it is the band it falls in, and the bands do not overlap", (value) => {
    const bands = prizeOdds(luck);
    const total = bands.reduce((sum, odds) => sum + odds.perMillion, 0);
    expect(total).toBeLessThan(PER_MILLION);
    const hit = expectedPrize(value);
    expect(hit === null).toBe(value >= total);
  });

  test("[R-LUCK-008] given a month at the kiosk, when its line is read, then a jackpot or a mid prize is staged and a small win or nothing is not", () => {
    const state = ada().state;
    const naira = (amount: number): MoneyParam => ({ currency: "NGN", amount });
    const lineOf = (prizes: Prize[], won: number): ReportLine[] =>
      activityKind.lines?.({ type: "activity/lotto-played", tickets: 2, stake: naira(luck.ticket * 2), prizes, won: naira(won) }, state, content) ?? [];
    expect(lineOf(["jackpot"], luck.prizeJackpot)[0]).toMatchObject({ key: "line.activity.lotto-won", big: true, attention: true });
    expect(lineOf(["mid", "small"], luck.prizeMid + luck.prizeSmall)[0]).toMatchObject({ big: true });
    expect(lineOf(["small"], luck.prizeSmall)[0]?.big).toBeUndefined();
    expect(lineOf([], 0)[0]).toMatchObject({ key: "line.activity.lotto-lost" });
  });

  test("[R-LUCK-005] [R-PLACE-003] given a life abroad, when the kiosk is asked for, then it is not legal there", () => {
    const game = ada();
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    expect(game.expectRejected({ type: "activity/now", activity: LOTTO, param: "1" }, "not-legal").code).toBe("not-legal");
    expect(game.expectRejected({ type: "activity/now", activity: BET, param: null }, "not-legal").code).toBe("not-legal");
  });
});

describe("the bet slip", () => {
  test("[R-LUCK-006] given a bet slip, when it is played, then the stake leaves cash, the draw on `lotto` decides, a win pays the odds on the stake to cash as a win with wellbeing +2, and a loss costs wellbeing 2", () => {
    const game = ada();
    const outcomes = new Set<boolean>();
    for (let month = 0; month < 20 && outcomes.size < 2; month += 1) {
      if (game.state.wallet.pockets.NGN.cash < luck.stake) applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "cash", amount: luck.stake, reason: "gift" }]);
      const n = game.state.draws.lotto ?? 0;
      const wins = draw(game.state.seed, "lotto", n, 10000) < luck.betWinBp;
      const result = game.endTurn([slot(BET)]);
      expect(moneyOf(result, "social")).toEqual([{ type: "wallet/debited", currency: "NGN", pocket: "cash", amount: luck.stake, reason: "social" }]);
      expect(moneyOf(result, "win")).toEqual(wins ? [{ type: "wallet/credited", currency: "NGN", pocket: "cash", amount: bp(luck.stake, luck.betOddsBp), reason: "win" }] : []);
      expect(result.events).toContainEqual({ type: "quality/changed", quality: "quality.wellbeing", amount: wins ? 2 : -2, source: BET });
      outcomes.add(wins);
    }
    expect(outcomes.size).toBe(2);
  });

  test("[R-LUCK-006] given the bet slip's odds, when the expected return is worked out from the numbers, then it is under the stake", () => {
    expect(bp(bp(luck.stake, luck.betOddsBp), luck.betWinBp)).toBeLessThan(luck.stake);
    expect(bp(luck.stake, luck.betOddsBp)).toBe(380000);
  });
});
