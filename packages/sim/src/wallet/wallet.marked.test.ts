// Marked money: wallet:top-ups-are-marked and lottery:tickets-bought-with-earned-naira. Naira bought with real money is
// credited by the authority's top-up and marked; earned naira is spent first and the marked share only once the
// earned runs out; a Friday ticket and the kiosk's slip are paid from earned naira alone.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { checkInvariants } from "../engine/invariants";
import { replay } from "../engine/replay";
import type { World } from "../engine/types";
import { lifeSaves } from "../goldens/lives.data";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { standInWorld } from "../world/standIn";
import { ledgerReport } from "./wallet.report";
import { EARNED_ONLY, earnedNaira } from "./wallet.logic";
import { rideFare } from "../place/place.logic";
import { LOTTO, BANKER } from "../testing/ids";

const lottery = content.tuning.lottery;
const luck = content.tuning.luck;
const FARE = rideFare(content, content.place["place.ojuelegba"]!.position, content.place["place.bode-thomas"]!.position, "keke");
/** ₦50,000 topped up. */
const TOP_UP = 5_000_000;

const ON_SALE: NonNullable<World["lottery"]> = { draw: 7, closesTick: 1000, onSale: true, fingerprint: "ab".repeat(32), beaconRound: 1007, salesSoFar: 0, jackpot: lottery.odds.jackpotStart, rolledOver: false, odds: lottery.odds, last: null };

/** The banker at home; with `online` the world runs the Friday draw, without it the kiosk sells its slip. */
function banker(online: boolean): Game {
  const base = standInWorld("world-1", 0, content);
  return start({
    scenario: BANKER,
    content,
    worldAt: (tick) => ({ tick, rates: base.rates, vars: base.vars, news: [], era: null, lottery: online ? ON_SALE : null, placeNames: {} }),
  });
}

function topUp(game: Game, amount = TOP_UP): void {
  game.accept({ type: "wallet/top-up", amount }, "authority");
}

/** Leaves exactly `earned` naira in all, in the `pocket` named: the rest is changed into dollars at the aboki. */
function nairaLeft(game: Game, earned: number, pocket: "bank" | "cash"): void {
  const { bank } = game.state.wallet.pockets.NGN;
  if (bank > 0) game.accept({ type: "wallet/move", currency: "NGN", amount: bank, to: "cash" });
  const cash = game.state.wallet.pockets.NGN.cash;
  game.accept({ type: "wallet/convert", from: "NGN", to: "USD", amount: cash - earned, via: "aboki" });
  if (pocket === "bank" && earned > 0) game.accept({ type: "wallet/move", currency: "NGN", amount: earned, to: "bank" });
  const naira = game.state.wallet.pockets.NGN;
  expect(naira.bank + naira.cash).toBe(earned);
}

function ride(game: Game) {
  return game.accept({ type: "place/ride", from: "place.ojuelegba", to: "place.bode-thomas", way: "keke" });
}

describe("the marked figure", () => {
  test.each(Object.keys(lifeSaves))("[wallet:top-ups-are-marked] given the golden %s played to its end, when its wallet is read, then nothing is marked: the key is absent and the view says 0", (name) => {
    const save = lifeSaves[name];
    if (save === undefined) throw new Error(`The goldens have no ${name}.`);
    const { state } = replay(save, content, (tick) => standInWorld(save.worldSeed, tick, content));
    expect("marked" in state.wallet).toBe(false);
    expect(state.wallet.totals.in["top-up"]).toBeUndefined();
  });

  test("[wallet:top-ups-are-marked] given a life at its start, when the view is read, then nothing is marked and the key is absent", () => {
    const game = banker(false);
    expect("marked" in game.state.wallet).toBe(false);
    expect(game.view().wallet).toEqual({ marked: 0 });
  });

  test("[wallet:top-ups-are-marked] [wallet:large-deposits-record-lots] [wallet:ledger-balances-each-currency] given the authority's top-up, when it lands, then the naira bank is credited under top-up, a lot is recorded for the visa officer, the marked figure rises by the amount and the ledger holds", () => {
    const game = banker(false);
    const before = game.state.wallet.pockets.NGN;
    const result = game.accept({ type: "wallet/top-up", amount: TOP_UP }, "authority");
    expect(result.events).toContainEqual({ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: TOP_UP, reason: "top-up" });
    expect(game.state.wallet.pockets.NGN).toEqual({ ...before, bank: before.bank + TOP_UP });
    expect(game.state.wallet.lots).toContainEqual({ currency: "NGN", amount: TOP_UP, month: game.state.turn.month, reason: "top-up" });
    expect(result.lines.map((line) => line.key)).toEqual(expect.arrayContaining(["line.wallet.top-up", "line.wallet.flagged"]));
    expect(game.state.wallet.marked).toBe(TOP_UP);
    expect(game.view().wallet.marked).toBe(TOP_UP);
    topUp(game, 1);
    expect(game.state.wallet.marked).toBe(TOP_UP + 1);
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[wallet:top-ups-are-marked] given a top-up of 0, below 0 or from a player, when it is sent, then it is refused and nothing moves", () => {
    const game = banker(false);
    game.expectRejected({ type: "wallet/top-up", amount: 0 }, "bad-amount", "authority");
    game.expectRejected({ type: "wallet/top-up", amount: -1 }, "bad-amount", "authority");
    // server:apologies-never-currency: the engine refuses every authority command from a player as not theirs, before the wallet sees it.
    game.expectRejected({ type: "wallet/top-up", amount: TOP_UP }, "not-yours", "player");
    game.expectRejected({ type: "wallet/top-up", amount: TOP_UP }, "not-yours", "stand-in");
    expect("marked" in game.state.wallet).toBe(false);
  });

  test("[wallet:top-ups-are-marked] given topped-up naira and earned naira enough for a fare, when the fare is paid, then it comes from the earned share and the marked figure stands", () => {
    const game = banker(false);
    topUp(game);
    const earned = earnedNaira(game.state.wallet);
    expect(earned).toBeGreaterThan(FARE);
    ride(game);
    expect(game.state.wallet.marked).toBe(TOP_UP);
    expect(earnedNaira(game.state.wallet)).toBe(earned - FARE);
  });

  test("[wallet:top-ups-are-marked] given earned naira short of a fare and topped-up naira beside it, when the fare is paid, then the earned share goes first and the marked figure falls by the difference", () => {
    const game = banker(false);
    const earned = FARE - 1;
    nairaLeft(game, earned, "cash");
    topUp(game);
    ride(game);
    expect(game.state.wallet.marked).toBe(TOP_UP - (FARE - earned));
    expect(earnedNaira(game.state.wallet)).toBe(0);
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[wallet:top-ups-are-marked] given only topped-up naira, when it is all spent, then the marked figure falls to zero and its key is gone", () => {
    const game = banker(false);
    nairaLeft(game, 0, "cash");
    topUp(game, FARE);
    expect(game.state.wallet.marked).toBe(FARE);
    game.accept({ type: "wallet/move", currency: "NGN", amount: FARE, to: "cash" });
    ride(game);
    expect("marked" in game.state.wallet).toBe(false);
    expect(game.view().wallet.marked).toBe(0);
  });

  test("[wallet:top-ups-are-marked] given topped-up naira, when it is moved between the bank and cash and back, then it is the same money: the marked figure stands", () => {
    const game = banker(false);
    nairaLeft(game, 0, "cash");
    topUp(game);
    game.accept({ type: "wallet/move", currency: "NGN", amount: TOP_UP, to: "cash" });
    game.accept({ type: "wallet/move", currency: "NGN", amount: TOP_UP, to: "bank" });
    expect(game.state.wallet.marked).toBe(TOP_UP);
  });

  test("[wallet:top-ups-are-marked] [lottery:prizes-never-leave-game] given topped-up naira, when the authority pays a prize, then the prize lands as earned naira and the marked figure stands", () => {
    const game = banker(true);
    topUp(game);
    const earned = earnedNaira(game.state.wallet);
    game.accept({ type: "lottery/pay", draw: ON_SALE.draw, prizes: [{ tier: "small", amount: lottery.odds.small }] }, "authority");
    expect(game.state.wallet.marked).toBe(TOP_UP);
    expect(earnedNaira(game.state.wallet)).toBe(earned + lottery.odds.small);
  });

  test("[wallet:top-ups-are-marked] given the content, when every entry is read, then none applies a top-up: only the authority's command does", () => {
    expect(JSON.stringify(content)).not.toContain('"wallet/top-up"');
  });
});

describe("a ticket is bought with earned naira", () => {
  test("[wallet:top-ups-are-marked] [lottery:tickets-bought-with-earned-naira] given topped-up naira and earned naira enough for a ticket, when a Friday ticket is bought, then it is paid from the earned share and the marked figure is unchanged", () => {
    const game = banker(true);
    topUp(game);
    const bank = game.state.wallet.pockets.NGN.bank;
    const earned = earnedNaira(game.state.wallet);
    game.accept({ type: "lottery/buy", tickets: 1 });
    expect(game.state.wallet.marked).toBe(TOP_UP);
    expect(game.state.wallet.pockets.NGN.bank).toBe(bank - lottery.ticket);
    expect(earnedNaira(game.state.wallet)).toBe(earned - lottery.ticket);
  });

  test("[wallet:top-ups-are-marked] [lottery:tickets-bought-with-earned-naira] given earned naira one kobo short of a ticket and topped-up naira that would cover it, when a Friday ticket is bought, then it is refused with cannot-afford and the detail says tickets come from money earned; at the price it sells", () => {
    const game = banker(true);
    nairaLeft(game, lottery.ticket - 1, "bank");
    topUp(game);
    const naira = game.state.wallet.pockets.NGN;
    expect(naira.bank).toBeGreaterThanOrEqual(lottery.ticket);
    const refused = game.expectRejected({ type: "lottery/buy", tickets: 1 }, "cannot-afford");
    expect(refused.detail).toBe(EARNED_ONLY);
    expect(refused.detail).toContain("Tickets come from money you earned");
    expect(game.state.wallet.marked).toBe(TOP_UP);
    // One earned kobo more, a prize's worth, and the ticket sells from it.
    game.accept({ type: "lottery/pay", draw: ON_SALE.draw, prizes: [{ tier: "small", amount: 1 }] }, "authority");
    game.accept({ type: "lottery/buy", tickets: 1 });
    expect(game.state.wallet.marked).toBe(TOP_UP);
    expect(earnedNaira(game.state.wallet)).toBe(0);
  });

  test("[wallet:top-ups-are-marked] [lottery:tickets-bought-with-earned-naira] given the whole balance marked, when a Friday ticket is bought, then it is refused with the earned-only detail and none is offered", () => {
    const game = banker(true);
    nairaLeft(game, 0, "bank");
    topUp(game);
    expect(earnedNaira(game.state.wallet)).toBe(0);
    expect(game.expectRejected({ type: "lottery/buy", tickets: 1 }, "cannot-afford").detail).toBe(EARNED_ONLY);
    expect(game.state.lottery.tickets).toBe(0);
  });

  test("[wallet:top-ups-are-marked] [lottery:tickets-bought-with-earned-naira] [luck:kiosk-sells-lotto-tickets] given the whole balance marked, when the kiosk's slip is bought, then it is refused with the earned-only detail, the view shows it unaffordable and nothing is paid", () => {
    const game = banker(false);
    nairaLeft(game, 0, "cash");
    topUp(game);
    expect(game.view().activities.find((option) => option.id === LOTTO)).toMatchObject({ affordable: false });
    const before = game.state.wallet;
    expect(game.expectRejected({ type: "activity/now", activity: LOTTO, param: "1" }, "cannot-afford").detail).toBe(EARNED_ONLY);
    expect(game.state.wallet).toBe(before);
  });

  test("[wallet:top-ups-are-marked] [lottery:tickets-bought-with-earned-naira] [luck:kiosk-sells-lotto-tickets] given topped-up naira and earned naira enough for a slip, when the kiosk's slip is bought, then it is paid from the earned share and the marked figure is unchanged", () => {
    const game = banker(false);
    topUp(game);
    const earned = earnedNaira(game.state.wallet);
    expect(game.view().activities.find((option) => option.id === LOTTO)).toMatchObject({ affordable: true });
    game.accept({ type: "activity/now", activity: LOTTO, param: "1" });
    expect(game.state.wallet.marked).toBe(TOP_UP);
    expect(earnedNaira(game.state.wallet)).toBe(earned - luck.ticket);
  });
});

describe("the ledger report and the top-up", () => {
  test("[wallet:top-ups-are-marked] [wallet:ledger-report-raises-alarms] given a top-up, when the report is made with no receipts, then the top-up names the account; with receipts that match it, nothing does; one kobo under them names it again", () => {
    const game = banker(false);
    expect(ledgerReport(game.state, content).suspect).toBe(false);
    topUp(game);
    const alone = ledgerReport(game.state, content);
    expect(alone.alarms).toEqual([{ reason: "top-up", currency: "NGN", total: TOP_UP, ceiling: 0 }]);
    expect(alone.suspect).toBe(true);
    expect(ledgerReport(game.state, content, TOP_UP)).toMatchObject({ alarms: [], suspect: false });
    expect(ledgerReport(game.state, content, TOP_UP - 1).alarms).toEqual([{ reason: "top-up", currency: "NGN", total: TOP_UP, ceiling: TOP_UP - 1 }]);
  });
});
