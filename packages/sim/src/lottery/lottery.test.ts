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
const { odds } = tuning;
/** Tunde starts with ₦4.2m in the bank and ₦60,000 in cash. */
const TUNDE: Id<"scenario"> = "scenario.tunde";
const LOTTO: Id<"activity"> = "activity.play-lotto";

type Draw = NonNullable<World["lottery"]>;

function drawOf(draw: number, closesTick: number, last: LotteryResult | null = null, jackpot = odds.jackpotStart, rolledOver = false): Draw {
  return { draw, closesTick, onSale: true, fingerprint: "ab".repeat(32), beaconRound: 1000 + draw, salesSoFar: 140000, jackpot, rolledOver, odds, last };
}

/** A drawn draw whose jackpot stood at ₦250,000. */
const STOOD = 25_000_000;

function resultOf(draw: number, winners: LotteryResult["winners"]): LotteryResult {
  const hit = winners.some((tier) => tier.tier === "jackpot" && tier.tickets.length > 0);
  return {
    draw,
    revealed: "cd".repeat(32),
    beaconRound: 1000 + draw,
    beaconRandomness: "ef".repeat(32),
    listHash: "01".repeat(32),
    count: 300,
    odds,
    jackpot: STOOD,
    winners,
    nextJackpot: hit ? odds.jackpotStart : STOOD + 6000,
  };
}

const FULL: LotteryResult["winners"] = [
  { tier: "jackpot", tickets: [17], amount: STOOD },
  { tier: "mid", tickets: [1, 2], amount: odds.mid },
  { tier: "small", tickets: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33], amount: odds.small },
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

  test("[R-LOTTERY-006] given a draw on sale with a last result, when the view is read, then it shows the price, the cap, the tickets held, the close, the odds, the jackpot, the fingerprint and the last result", () => {
    const last = resultOf(6, FULL);
    const { game } = play(drawOf(7, 1000, last));
    game.accept({ type: "lottery/buy", tickets: 2 });
    expect(game.view().lottery).toEqual({
      ticket: tuning.ticket,
      maxTickets: tuning.maxTickets,
      draw: 7,
      closesTick: 1000,
      onSale: true,
      tickets: 2,
      numbers: null,
      jackpot: odds.jackpotStart,
      rolledOver: false,
      odds,
      fingerprint: "ab".repeat(32),
      last,
    });
  });

  test("[R-LOTTERY-023] given a draw whose jackpot rolled over, and one that starts again, when the view is read, then it shows the jackpot standing, whether it rolled over, and the odds; never a pot or a top-up", () => {
    const { game, live } = play(drawOf(7, 1000, null, STOOD + 6000, true));
    expect(game.view().lottery).toMatchObject({ jackpot: STOOD + 6000, rolledOver: true, odds });
    live.lottery = drawOf(8, 1000, null, odds.jackpotStart, false);
    expect(game.view().lottery).toMatchObject({ jackpot: odds.jackpotStart, rolledOver: false });
    expect(Object.keys(game.view().lottery ?? {}).filter((key) => /^pot|top/i.test(key))).toEqual([]);
  });
});

describe("what the rewrite kept", () => {
  test("[R-LOTTERY-024] given the content, when the draw's price and cap are read, then a ticket is ₦200 and five may be bought a draw, so the most staked in a week is ₦1,000", () => {
    expect(tuning.ticket).toBe(20000);
    expect(tuning.maxTickets).toBe(5);
    expect(tuning.ticket * tuning.maxTickets).toBe(100000);
  });
});

describe("paying", () => {
  const PRIZES = [
    { tier: "jackpot", amount: 1320000 },
    { tier: "small", amount: 165000 },
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
    const result = game.accept({ type: "lottery/pay", draw: 7, prizes: [{ tier: "small", amount: 165000 }] }, "authority");
    expect(result.lines.find((line) => line.key === "line.lottery.letter")).toMatchObject({ big: false, attention: true });
    const mid = game.accept({ type: "lottery/pay", draw: 8, prizes: [{ tier: "mid", amount: 99000 }] }, "authority");
    expect(mid.lines.find((line) => line.key === "line.lottery.letter")?.big).toBe(true);
  });

  test("[R-SHARE-001] given a draw paid, when the view is read, then the card is the draw win's until a turn's news tells that draw; before any payment there is none", () => {
    const { game, live } = play(drawOf(7, 1000, resultOf(6, FULL)));
    endTurn(game);
    expect(game.view().card?.kind).not.toBe("draw-win");
    game.accept({ type: "lottery/pay", draw: 7, prizes: [{ tier: "small", amount: 165000 }] }, "authority");
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
    game.accept({ type: "lottery/pay", draw: 8, prizes: [{ tier: "small", amount: 1 }] }, "authority");
    expect(game.state.lottery.paid).toBe(8);
  });

  test("[R-LOTTERY-013] given the authority, when a payout names no prize or a prize that is not a whole number from 1 kobo, then it is rejected with bad-amount and nothing is paid", () => {
    const { game } = play();
    game.expectRejected({ type: "lottery/pay", draw: 7, prizes: [] }, "bad-amount", "authority");
    for (const amount of [0, -5, Number("2.5")]) {
      game.expectRejected({ type: "lottery/pay", draw: 7, prizes: [{ tier: "jackpot", amount }] }, "bad-amount", "authority");
    }
    expect(game.state.lottery.paid).toBeNull();
  });
});

function creditedReasons(events: readonly { type: string }[]): unknown[] {
  return events.flatMap((event) => (event.type === "wallet/credited" && "reason" in event ? [event.reason] : []));
}

describe("pot-top-up is refused", () => {
  test("[R-LOTTERY-013] given a payout that still carries a house part, when it is paid, then it is refused with not-legal and nothing is paid; a part of 0 credits only win", () => {
    const { game } = play();
    const bank = game.state.wallet.pockets.NGN.bank;
    for (const topUp of [1, 99000, -1, Number("0.5")]) {
      const prizes = [{ tier: "mid", amount: 99000, topUp }] as unknown as { tier: "mid"; amount: number }[];
      game.expectRejected({ type: "lottery/pay", draw: 7, prizes }, "not-legal", "authority");
    }
    expect(game.state.wallet.pockets.NGN.bank).toBe(bank);
    expect(game.state.lottery.paid).toBeNull();
    const zero = [{ tier: "mid", amount: 99000, topUp: 0 }] as unknown as { tier: "mid"; amount: number }[];
    expect(creditedReasons(game.accept({ type: "lottery/pay", draw: 7, prizes: zero }, "authority").events)).toEqual(["win"]);
  });

  test.prop([fc.array(fc.record({ tier: fc.constantFrom("jackpot" as const, "mid" as const, "small" as const), amount: fc.integer({ min: 1, max: 40_000_000 }) }), { minLength: 1, maxLength: 6 })])(
    "[R-LOTTERY-013] given any payout, when it is paid, then every prize is credited as win and nothing as pot-top-up",
    (prizes) => {
      const { game } = play();
      const result = game.accept({ type: "lottery/pay", draw: 7, prizes }, "authority");
      expect(creditedReasons(result.events)).toEqual(prizes.map(() => "win"));
      expect(game.state.wallet.totals.in["pot-top-up"]).toBeUndefined();
    },
  );
});

describe("telling", () => {
  test("[R-LOTTERY-016] given a last result the character has not been shown, when turns are played, then the front-page line comes once with the jackpot standing, whether it was hit and the winners, and seen moves on", () => {
    const { game, live } = play(drawOf(7, 1000, resultOf(6, FULL)));
    const first = linesOf(game, "line.lottery.drawn");
    expect(first).toEqual([
      { key: "line.lottery.drawn", params: { draw: 6, jackpot: { currency: "NGN", amount: STOOD }, winners: 17 }, tone: "plain", attention: false, counts: [] },
    ]);
    expect(game.state.lottery.seen).toBe(6);
    expect(linesOf(game, "line.lottery.drawn")).toEqual([]);
    live.lottery = drawOf(8, 1000, resultOf(7, [{ tier: "jackpot", tickets: [], amount: STOOD }, ...FULL.slice(1)]));
    if (game.state.turn.banked === 0) game.grant(1);
    const next = game.endTurn().lines.filter((line) => line.key.startsWith("line.lottery.drawn"));
    expect(next).toEqual([
      { key: "line.lottery.drawn-rolled", params: { draw: 7, jackpot: { currency: "NGN", amount: STOOD }, winners: 16 }, tone: "plain", attention: false, counts: [] },
    ]);
    expect(game.state.lottery.seen).toBe(7);
    expect(text["line.lottery.drawn-rolled"]).toBeDefined();
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
