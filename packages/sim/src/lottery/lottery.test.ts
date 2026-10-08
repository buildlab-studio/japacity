import { fc, test } from "@fast-check/vitest";
import { content, text } from "@japacity/content";
import { describe, expect } from "vitest";

import { checkInvariants } from "../engine/invariants";
import type { Id, LotteryResult, World } from "../engine/types";
import { legalCommands } from "../testing/legal";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { standInWorld } from "../world/standIn";

const tuning = content.tuning.lottery;
/** Tunde starts with ₦4.2m in the bank and ₦60,000 in cash. */
const TUNDE: Id<"scenario"> = "scenario.tunde";
const LOTTO: Id<"activity"> = "activity.play-lotto";

type Draw = NonNullable<World["lottery"]>;

function drawOf(draw: number, closesTick: number, last: LotteryResult | null = null, topUpTickets = 0): Draw {
  return { draw, closesTick, fingerprint: "ab".repeat(32), beaconRound: 1000 + draw, potSoFar: 140000, topUpTickets, last };
}

function resultOf(draw: number, winners: LotteryResult["winners"]): LotteryResult {
  return { draw, revealed: "cd".repeat(32), beaconRound: 1000 + draw, beaconRandomness: "ef".repeat(32), listHash: "01".repeat(32), count: 300, pot: 6000000, topUp: 0, fund: 3300000, winners };
}

const FULL: LotteryResult["winners"] = [
  { tier: "jackpot", tickets: [17], amount: 1320000 },
  { tier: "mid", tickets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], amount: 99000 },
  { tier: "small", tickets: [20, 21, 22, 23, 24, 25], amount: 165000 },
];

interface Live {
  lottery: World["lottery"];
}

/** A game whose world carries the draw the test sets in `live`; change it and the next command sees it. */
function play(lottery: World["lottery"] = drawOf(7, 1000)): { game: Game; live: Live } {
  const base = standInWorld("world-1", 0, content);
  const live: Live = { lottery };
  const game = start({
    scenario: TUNDE,
    content,
    worldAt: (tick) => ({ tick, rates: base.rates, vars: base.vars, news: [], era: null, lottery: live.lottery, placeNames: {} }),
  });
  return { game, live };
}

/** Leaves exactly `amount` in the naira bank, the rest moved to cash. */
function bankAt(game: Game, amount: number): void {
  const over = game.state.wallet.pockets.NGN.bank - amount;
  if (over > 0) game.accept({ type: "wallet/move", currency: "NGN", amount: over, to: "cash" });
  expect(game.state.wallet.pockets.NGN.bank).toBe(amount);
}

function endTurn(game: Game): void {
  if (game.state.turn.banked === 0) game.grant(1);
  game.endTurn();
}

function linesOf(game: Game, key: string) {
  if (game.state.turn.banked === 0) game.grant(1);
  return game.endTurn().lines.filter((line) => line.key === key);
}

describe("tickets", () => {
  test("[R-LOTTERY-001] given no draw in the world, when the kiosk is looked at, then it is open and lottery/buy is rejected", () => {
    const { game } = play(null);
    expect(game.view().activities.find((option) => option.id === LOTTO)?.allowed).toBe(true);
    expect(game.view().lottery).toBeNull();
    game.expectRejected({ type: "lottery/buy", tickets: 1 }, "not-legal");
    endTurn(game);
  });

  test("[R-LOTTERY-001] given the world runs a draw, when the kiosk is looked at or played, then it is closed", () => {
    const { game } = play();
    expect(game.view().activities.find((option) => option.id === LOTTO)?.allowed).toBe(false);
    if (game.state.turn.banked === 0) game.grant(1);
    game.expectRejected({ type: "turn/end", slots: [{ activity: LOTTO, param: null }] }, "not-legal");
  });

  test("[R-LOTTERY-002] given a draw closing at the next tick, when tickets are bought before and at the close, then the first is accepted and the second is rejected", () => {
    const { game } = play(drawOf(7, 1));
    expect(game.tick).toBe(0);
    game.accept({ type: "lottery/buy", tickets: 1 });
    endTurn(game);
    expect(game.tick).toBe(1);
    game.expectRejected({ type: "lottery/buy", tickets: 1 }, "not-legal");
  });

  test("[R-LOTTERY-003] given a draw on sale, when tickets are bought, then their price is taken from the naira bank as ticket, cash is untouched and no turn is spent", () => {
    const { game } = play();
    const before = game.state.wallet.pockets.NGN;
    const banked = game.state.turn.banked;
    const tick = game.tick;
    const result = game.accept({ type: "lottery/buy", tickets: 3 });
    const cost = 3 * tuning.ticket;
    expect(game.state.wallet.pockets.NGN.bank).toBe(before.bank - cost);
    expect(game.state.wallet.pockets.NGN.cash).toBe(before.cash);
    expect(result.events).toContainEqual({ type: "wallet/debited", currency: "NGN", pocket: "bank", amount: cost, reason: "ticket" });
    expect(result.events).toContainEqual({ type: "lottery/bought", draw: 7, tickets: 3, cost });
    expect(game.state.turn.banked).toBe(banked);
    expect(game.tick).toBe(tick);
  });

  test("[R-LOTTERY-003] given a draw on sale, when tickets that are not a whole number from 1 are asked for, then each is rejected with bad-amount", () => {
    const { game } = play();
    for (const tickets of [0, -1, Number("1.5"), Number.NaN]) {
      expect(game.expectRejected({ type: "lottery/buy", tickets }, "bad-amount").code).toBe("bad-amount");
    }
    expect(game.state.lottery.tickets).toBe(0);
  });

  test("[R-LOTTERY-003] given the cap, when tickets up to it and one past it are bought, then the cap is accepted and the one past is rejected", () => {
    const { game } = play();
    game.expectRejected({ type: "lottery/buy", tickets: tuning.maxTickets + 1 }, "bad-amount");
    game.accept({ type: "lottery/buy", tickets: tuning.maxTickets - 1 });
    game.expectRejected({ type: "lottery/buy", tickets: 2 }, "bad-amount");
    game.accept({ type: "lottery/buy", tickets: 1 });
    expect(game.state.lottery.tickets).toBe(tuning.maxTickets);
    game.expectRejected({ type: "lottery/buy", tickets: 1 }, "bad-amount");
  });

  test("[R-LOTTERY-003] given one kobo short in the bank and plenty in cash, when a ticket is bought, then it is rejected with cannot-afford, and at the exact price it is accepted", () => {
    const { game } = play();
    bankAt(game, tuning.ticket - 1);
    expect(game.state.wallet.pockets.NGN.cash).toBeGreaterThan(tuning.ticket);
    game.expectRejected({ type: "lottery/buy", tickets: 1 }, "cannot-afford");
    game.accept({ type: "wallet/move", currency: "NGN", amount: 1, to: "bank" });
    game.accept({ type: "lottery/buy", tickets: 1 });
    expect(game.state.wallet.pockets.NGN.bank).toBe(0);
  });

  test.prop([fc.array(fc.integer({ min: -1, max: 7 }), { maxLength: 12 })])(
    "[R-LOTTERY-003] given any run of purchases, when they are sent, then the tickets held never pass the cap and the bank pays exactly the tickets accepted",
    (asks) => {
      const { game } = play();
      const bank = game.state.wallet.pockets.NGN.bank;
      for (const tickets of asks) game.send({ type: "lottery/buy", tickets });
      expect(game.state.lottery.tickets).toBeLessThanOrEqual(tuning.maxTickets);
      expect(game.state.wallet.pockets.NGN.bank).toBe(bank - game.state.lottery.tickets * tuning.ticket);
      expect(checkInvariants(game.state, content)).toEqual([]);
    },
  );

  test("[R-LOTTERY-003] given a draw on sale, when the legal sample is read, then it offers a ticket that is accepted, and none once the cap is reached", () => {
    const { game } = play();
    const offered = legalCommands(game.view()).filter((command) => command.type === "lottery/buy");
    expect(offered).toEqual([{ type: "lottery/buy", tickets: 1 }]);
    for (const command of offered) game.accept(command);
    game.accept({ type: "lottery/buy", tickets: tuning.maxTickets - 1 });
    expect(legalCommands(game.view()).filter((command) => command.type === "lottery/buy")).toEqual([]);
  });

  test("[R-LOTTERY-004] given tickets held in one draw, when the next draw opens and tickets are bought, then the count starts again from 0", () => {
    const { game, live } = play(drawOf(7, 1000));
    game.accept({ type: "lottery/buy", tickets: tuning.maxTickets });
    live.lottery = drawOf(8, 1000);
    expect(game.view().lottery?.tickets).toBe(0);
    game.accept({ type: "lottery/buy", tickets: 2 });
    expect(game.state.lottery).toMatchObject({ draw: 8, tickets: 2 });
    game.accept({ type: "lottery/buy", tickets: tuning.maxTickets - 2 });
    game.expectRejected({ type: "lottery/buy", tickets: 1 }, "bad-amount");
  });

  test("[R-LOTTERY-006] given a draw on sale with a last result, when the view is read, then it shows the price, the cap, the tickets held, the close, the pot, the fingerprint and the last result", () => {
    const last = resultOf(6, FULL);
    const { game } = play(drawOf(7, 1000, last));
    game.accept({ type: "lottery/buy", tickets: 2 });
    expect(game.view().lottery).toEqual({
      ticket: tuning.ticket,
      maxTickets: tuning.maxTickets,
      draw: 7,
      closesTick: 1000,
      tickets: 2,
      numbers: null,
      potSoFar: 140000,
      topUpTickets: 0,
      topUpSoFar: 0,
      fingerprint: "ab".repeat(32),
      last,
    });
  });

  test("[R-LOTTERY-023] given a declared top-up, when the view is read with sales under, at and over it, then the top-up so far makes the pot up to it and is 0 from there", () => {
    const sold = (tickets: number): Draw => ({ ...drawOf(7, 1000, null, tuning.topUpTickets), potSoFar: tickets * tuning.ticket });
    const { game, live } = play(sold(0));
    expect(game.view().lottery).toMatchObject({ topUpTickets: tuning.topUpTickets, topUpSoFar: tuning.topUpTickets * tuning.ticket, potSoFar: 0 });
    live.lottery = sold(tuning.topUpTickets - 1);
    expect(game.view().lottery?.topUpSoFar).toBe(tuning.ticket);
    live.lottery = sold(tuning.topUpTickets);
    expect(game.view().lottery?.topUpSoFar).toBe(0);
    live.lottery = sold(tuning.topUpTickets + 1);
    expect(game.view().lottery?.topUpSoFar).toBe(0);
  });

  test("[R-LOTTERY-023] given a draw declared with no top-up, when the view is read, then it shows 0 tickets and 0 so far", () => {
    const { game } = play(drawOf(7, 1000, null, 0));
    expect(game.view().lottery).toMatchObject({ topUpTickets: 0, topUpSoFar: 0 });
  });
});

describe("paying", () => {
  const PRIZES = [
    { tier: "jackpot", amount: 1320000, topUp: 0 },
    { tier: "small", amount: 165000, topUp: 0 },
  ] as const;

  test("[R-LOTTERY-013] given a player, when lottery/pay is sent, then it is rejected with not-yours", () => {
    const { game } = play();
    expect(game.expectRejected({ type: "lottery/pay", draw: 7, prizes: [...PRIZES] }, "not-yours").code).toBe("not-yours");
    expect(game.state.lottery.paid).toBeNull();
  });

  test("[R-LOTTERY-013] given the authority, when a draw is paid, then each prize goes to the naira bank as win, unflagged, with a big letter", () => {
    const { game } = play();
    const before = game.state.wallet.pockets.NGN;
    const result = game.accept({ type: "lottery/pay", draw: 7, prizes: [...PRIZES] }, "authority");
    expect(game.state.wallet.pockets.NGN.bank).toBe(before.bank + 1320000 + 165000);
    expect(game.state.wallet.pockets.NGN.cash).toBe(before.cash);
    expect(result.events).toContainEqual({ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: 1320000, reason: "win" });
    expect(result.events).toContainEqual({ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: 165000, reason: "win" });
    expect(result.events.some((event) => event.type === "wallet/lot-recorded")).toBe(false);
    expect(game.state.lottery.paid).toBe(7);
    const letters = result.lines.filter((line) => line.key === "line.lottery.letter");
    expect(letters).toEqual([
      { key: "line.lottery.letter", params: { draw: 7, won: { currency: "NGN", amount: 1485000 } }, tone: "good", big: true, attention: true, counts: [] },
    ]);
    expect(text["line.lottery.letter"]).toBeDefined();
  });

  test("[R-LOTTERY-013] given only small prizes, when they are paid, then the letter is not staged", () => {
    const { game } = play();
    const result = game.accept({ type: "lottery/pay", draw: 7, prizes: [{ tier: "small", amount: 165000, topUp: 0 }] }, "authority");
    expect(result.lines.find((line) => line.key === "line.lottery.letter")).toMatchObject({ big: false, attention: true });
    const mid = game.accept({ type: "lottery/pay", draw: 8, prizes: [{ tier: "mid", amount: 99000, topUp: 0 }] }, "authority");
    expect(mid.lines.find((line) => line.key === "line.lottery.letter")?.big).toBe(true);
  });

  test("[R-SHARE-001] given a draw paid, when the view is read, then the card is the draw win's until a turn's news tells that draw; before any payment there is none", () => {
    const { game, live } = play(drawOf(7, 1000, resultOf(6, FULL)));
    endTurn(game);
    expect(game.view().card?.kind).not.toBe("draw-win");
    game.accept({ type: "lottery/pay", draw: 7, prizes: [{ tier: "small", amount: 165000, topUp: 0 }] }, "authority");
    expect(game.view().card).toMatchObject({ kind: "draw-win", months: game.state.turn.month, name: null });
    // The result is published in the tick after the payments (R-LOTTERY-015).
    live.lottery = drawOf(8, 1000, resultOf(7, FULL));
    endTurn(game);
    expect(game.state.lottery.seen).toBe(7);
    expect(game.view().card?.kind).not.toBe("draw-win");
  });

  test("[R-LOTTERY-013] given a draw already paid, when it is paid again or an earlier draw is paid, then each is rejected with not-legal and the next draw is accepted", () => {
    const { game } = play();
    game.accept({ type: "lottery/pay", draw: 7, prizes: [...PRIZES] }, "authority");
    game.expectRejected({ type: "lottery/pay", draw: 7, prizes: [...PRIZES] }, "not-legal", "authority");
    game.expectRejected({ type: "lottery/pay", draw: 6, prizes: [...PRIZES] }, "not-legal", "authority");
    game.accept({ type: "lottery/pay", draw: 8, prizes: [{ tier: "small", amount: 1, topUp: 0 }] }, "authority");
    expect(game.state.lottery.paid).toBe(8);
  });

  test("[R-LOTTERY-013] given the authority, when a payout names no prize or a prize that is not a whole number from 1 kobo, then it is rejected with bad-amount and nothing is paid", () => {
    const { game } = play();
    game.expectRejected({ type: "lottery/pay", draw: 7, prizes: [] }, "bad-amount", "authority");
    for (const amount of [0, -5, Number("2.5")]) {
      game.expectRejected({ type: "lottery/pay", draw: 7, prizes: [{ tier: "jackpot", amount, topUp: 0 }] }, "bad-amount", "authority");
    }
    expect(game.state.lottery.paid).toBeNull();
  });
});

function creditedReasons(events: readonly { type: string }[]): unknown[] {
  return events.flatMap((event) => (event.type === "wallet/credited" && "reason" in event ? [event.reason] : []));
}

describe("the house's part of a prize", () => {
  test("[R-LOTTERY-022] given a prize with a top-up part, when it is paid, then the part is credited as pot-top-up, the rest as win, and the letter tells the whole prize", () => {
    const { game } = play();
    const before = game.state.wallet.pockets.NGN.bank;
    const result = game.accept({ type: "lottery/pay", draw: 7, prizes: [{ tier: "jackpot", amount: 1320000, topUp: 1000000 }] }, "authority");
    expect(game.state.wallet.pockets.NGN.bank).toBe(before + 1320000);
    expect(result.events).toContainEqual({ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: 320000, reason: "win" });
    expect(result.events).toContainEqual({ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: 1000000, reason: "pot-top-up" });
    expect(result.events.some((event) => event.type === "wallet/lot-recorded")).toBe(false);
    expect(result.lines.find((line) => line.key === "line.lottery.letter")?.params).toEqual({ draw: 7, won: { currency: "NGN", amount: 1320000 } });
  });

  test("[R-LOTTERY-022] given prizes all from sales or all from the top-up, when they are paid, then only the one reason is credited", () => {
    const { game } = play();
    const sales = game.accept({ type: "lottery/pay", draw: 7, prizes: [{ tier: "mid", amount: 99000, topUp: 0 }] }, "authority");
    expect(creditedReasons(sales.events)).toEqual(["win"]);
    const house = game.accept({ type: "lottery/pay", draw: 8, prizes: [{ tier: "mid", amount: 99000, topUp: 99000 }] }, "authority");
    expect(creditedReasons(house.events)).toEqual(["pot-top-up"]);
  });

  test("[R-LOTTERY-022] given a top-up part under 0, over its prize or not whole, when the prize is paid, then it is rejected with bad-amount and nothing is paid", () => {
    const { game } = play();
    const bank = game.state.wallet.pockets.NGN.bank;
    for (const topUp of [-1, 99001, Number("0.5"), Number.NaN]) {
      game.expectRejected({ type: "lottery/pay", draw: 7, prizes: [{ tier: "mid", amount: 99000, topUp }] }, "bad-amount", "authority");
    }
    expect(game.state.wallet.pockets.NGN.bank).toBe(bank);
    expect(game.state.lottery.paid).toBeNull();
  });
});

describe("telling", () => {
  test("[R-LOTTERY-016] given a last result the character has not been shown, when turns are played, then the front-page line comes once with the jackpot and the winners, and seen moves on", () => {
    const { game, live } = play(drawOf(7, 1000, resultOf(6, FULL)));
    const first = linesOf(game, "line.lottery.drawn");
    expect(first).toEqual([
      { key: "line.lottery.drawn", params: { draw: 6, jackpot: { currency: "NGN", amount: 1320000 }, winners: 17 }, tone: "plain", attention: false, counts: [] },
    ]);
    expect(game.state.lottery.seen).toBe(6);
    expect(linesOf(game, "line.lottery.drawn")).toEqual([]);
    live.lottery = drawOf(8, 1000, resultOf(7, [{ tier: "jackpot", tickets: [], amount: 1320000 }, ...FULL.slice(1)]));
    const next = linesOf(game, "line.lottery.drawn");
    expect(next).toHaveLength(1);
    expect(next[0]?.params).toEqual({ draw: 7, jackpot: { currency: "NGN", amount: 0 }, winners: 16 });
    expect(game.state.lottery.seen).toBe(7);
  });

  test("[R-LOTTERY-016] given no draw or no result yet, when a turn is played, then no draw line is given", () => {
    for (const lottery of [null, drawOf(0, 14)]) {
      const { game } = play(lottery);
      expect(linesOf(game, "line.lottery.drawn")).toEqual([]);
      expect(game.state.lottery.seen).toBeNull();
    }
    expect(text["line.lottery.drawn"]).toBeDefined();
  });
});
