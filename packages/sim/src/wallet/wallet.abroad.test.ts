// Money abroad and home again: docs/rules/abroad-money.md R-ABROAD-001, 006 and
// 008, and wallet.md R-WALLET-011 for cash paid in over a month. Abroad is
// reached by replaying the ada-careful golden, which ends on her departure.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp, divFloor, mulDiv, valueInKobo } from "../engine/int";
import type { Accepted, BaseEvent, Content, ForeignCurrency, World } from "../engine/types";
import { lifeSaves } from "../goldens/lives.data";
import { applyEffects, draw } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import type { WalletEvent } from "./wallet.events";
import { remitQuote, walletKind } from "./wallet.logic";

const remit = content.tuning.remit;
const FOREIGN: readonly ForeignCurrency[] = ["GBP", "USD", "CAD", "AED", "EUR"];
/** $100, in cents. */
const HUNDRED_DOLLARS = 10000;

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

/** The debits under a reason: what left a pocket. */
function debitsOf(result: Accepted, reason: string): Money[] {
  return moneyOf(result, reason).filter((event) => event.type === "wallet/debited");
}

/** The credits under a reason: what arrived. A remit leaves and arrives under the one reason. */
function creditsOf(result: Accepted, reason: string): Money[] {
  return moneyOf(result, reason).filter((event) => event.type === "wallet/credited");
}

function remitted(result: Accepted): Extract<WalletEvent, { type: "wallet/remitted" }> | undefined {
  return result.events.find((event): event is BaseEvent & Extract<WalletEvent, { type: "wallet/remitted" }> => event.type === "wallet/remitted");
}

/** Ada at the end of the ada-careful golden: just arrived in the UK as a student, with her remote job's dollars in the bank. */
function adaAbroad(change: (used: Content) => Content = (used) => used): Game {
  const save = lifeSaves["ada-careful"];
  if (save === undefined) throw new Error("The goldens have no ada-careful.");
  const game = start({ content: change(content), scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed });
  for (const { command, tick, sender } of save.commands) {
    game.tick = tick;
    const result = game.send(command, sender);
    if (!result.ok) throw new Error(`The golden's ${command.type} was rejected with ${result.code}.`);
  }
  expect(game.state.place).toMatchObject({ where: "abroad", country: "country.uk" });
  return game;
}

function official(world: World): Record<ForeignCurrency, number> {
  return { GBP: world.rates.GBP.official, USD: world.rates.USD.official, CAD: world.rates.CAD.official, AED: world.rates.AED.official, EUR: world.rates.EUR.official };
}

describe("the new currencies", () => {
  test("[R-ABROAD-001] [R-ABROAD-008] given a life abroad, when the view is read, then it carries a pocket and a rate for every currency the wallet keeps", () => {
    const game = adaAbroad();
    const view = game.view();
    expect(Object.keys(view.pockets).sort()).toEqual(["AED", "CAD", "EUR", "GBP", "NGN", "USD"]);
    expect(Object.keys(view.rates).sort()).toEqual([...FOREIGN].sort());
    for (const currency of FOREIGN) expect(view.rates[currency].official).toBeGreaterThan(0);
  });

  test("[R-ABROAD-001] given Canadian dollars, dirhams and euros in cash, when they are moved and changed, then every wallet rule holds for them as for the pound", () => {
    const game = adaAbroad();
    const amounts: [ForeignCurrency, number][] = [
      ["CAD", 50000],
      ["AED", 120000],
      ["EUR", 30000],
    ];
    applyEffects(
      game,
      amounts.map(([currency, amount]) => ({ type: "money/add", currency, pocket: "cash", amount, reason: "gift" })),
    );
    for (const [currency, amount] of amounts) {
      game.accept({ type: "wallet/move", currency, amount, to: "bank" });
      expect(game.state.wallet.pockets[currency]).toEqual({ bank: amount, cash: 0, locked: 0 });
      const street = game.world().rates[currency].street;
      game.accept({ type: "wallet/move", currency, amount, to: "cash" });
      const changed = game.accept({ type: "wallet/convert", from: currency, to: "NGN", amount, via: "aboki" });
      // The aboki buys at the street rate less the spread (R-WALLET-007).
      expect(moneyOf(changed, "convert")).toEqual([
        { type: "wallet/debited", currency, pocket: "cash", amount, reason: "convert" },
        { type: "wallet/credited", currency: "NGN", pocket: "cash", amount: mulDiv(amount, street - bp(street, content.tuning.wallet.streetSpreadBp), 100), reason: "convert" },
      ]);
      game.expectRejected({ type: "wallet/move", currency, amount: 1, to: "bank" }, "cannot-afford");
    }
  });
});

describe("sending money home", () => {
  test("[R-ABROAD-006] given $100 sent home by app, when it is sent, then the dollars leave the bank as remit, the fee as remit-fee, and the official rate less the margin arrives at once in the naira bank under remit", () => {
    const game = adaAbroad();
    const rate = game.world().rates.USD.official;
    const before = game.state.wallet.pockets.NGN.bank;
    // Since decision 0013's re-recording Ada lands with a lot of her own (her held funds' naira, month 26); the remit adds none.
    const lots = game.state.wallet.lots;
    const result = game.accept({ type: "wallet/remit", currency: "USD", amount: HUNDRED_DOLLARS, channel: "app" });
    const fee = bp(HUNDRED_DOLLARS, remit.appFeeBp);
    const naira = mulDiv(HUNDRED_DOLLARS - fee, rate - bp(rate, remit.appMarginBp), 100);
    expect(debitsOf(result, "remit")).toEqual([{ type: "wallet/debited", currency: "USD", pocket: "bank", amount: HUNDRED_DOLLARS - fee, reason: "remit" }]);
    expect(moneyOf(result, "remit-fee").reduce((sum, event) => sum + event.amount, 0)).toBe(fee);
    expect(creditsOf(result, "remit")).toEqual([{ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: naira, reason: "remit" }]);
    expect(game.state.wallet.pockets.NGN.bank - before).toBe(naira);
    expect(result.lines).toContainEqual({
      key: "line.wallet.remit-app",
      params: { sent: { currency: "USD", amount: HUNDRED_DOLLARS }, naira: { currency: "NGN", amount: naira }, readyMonth: game.state.turn.month },
      tone: "plain",
      attention: false,
      counts: [],
    });
    // It is documented: never a lot.
    expect(game.state.wallet.lots).toEqual(lots);
  });

  test("[R-WALLET-017] given $100 sent home by app, when its lines are read, then the dollars leaving are told as money out and the naira landing as money in: a line's tone is its event's", () => {
    const game = adaAbroad();
    const result = game.accept({ type: "wallet/remit", currency: "USD", amount: HUNDRED_DOLLARS, channel: "app" });
    const remits = result.lines.filter((line) => line.key === "line.wallet.remit");
    const told = remits.map((line) => ({ currency: (line.params["amount"] as { currency: string }).currency, tone: line.tone }));
    expect(told).toEqual([
      { currency: "USD", tone: "bad" },
      { currency: "NGN", tone: "good" },
    ]);
  });

  test("[R-WALLET-017] given money credited under a reason that is mostly spent and debited under one that is mostly earned, when the lines are read, then the credit is told as money in and the debit as money out", () => {
    const state = adaAbroad().state;
    const tones = (event: WalletEvent) => (walletKind.lines?.(event, state, content) ?? []).map((line) => line.tone);
    expect(tones({ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: 1000, reason: "fee-visa" })).toEqual(["good"]);
    expect(tones({ type: "wallet/debited", currency: "NGN", pocket: "bank", amount: 1000, reason: "gift" })).toEqual(["bad"]);
    expect(tones({ type: "wallet/debited", currency: "GBP", pocket: "bank", amount: 1000, reason: "remit" })).toEqual(["bad"]);
    expect(tones({ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: 1000, reason: "remit" })).toEqual(["good"]);
  });

  test("[R-ABROAD-006] given $100 sent home through the bank, when it is sent and the month ends, then the fee is kept at once and the rest arrives in the naira bank next month at that month's official rate", () => {
    const game = adaAbroad();
    const fee = bp(HUNDRED_DOLLARS, remit.bankFeeBp);
    const sent = game.accept({ type: "wallet/remit", currency: "USD", amount: HUNDRED_DOLLARS, channel: "bank" });
    expect(debitsOf(sent, "remit")).toEqual([{ type: "wallet/debited", currency: "USD", pocket: "bank", amount: HUNDRED_DOLLARS - fee, reason: "remit" }]);
    expect(moneyOf(sent, "remit-fee")).toEqual([{ type: "wallet/debited", currency: "USD", pocket: "bank", amount: fee, reason: "remit-fee" }]);
    expect(creditsOf(sent, "remit")).toEqual([]);
    expect(remitted(sent)).toMatchObject({ channel: "bank", lost: false, readyMonth: game.state.turn.month + 1 });
    // The bank's own line tells it; the queue's line does not.
    expect(sent.lines.map((line) => line.key)).toContain("line.wallet.remit-bank");
    expect(sent.lines.map((line) => line.key)).not.toContain("line.wallet.queued");

    if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
    const rate = game.world().rates.USD.official;
    const month = game.endTurn();
    const naira = mulDiv(HUNDRED_DOLLARS - fee, rate, 100);
    expect(creditsOf(month, "remit")).toContainEqual({ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: naira, reason: "remit" });
    expect(game.state.wallet.queued).toEqual([]);
  });

  test("[R-ABROAD-006] given $100 handed to the informal channel and a draw on `street` over the loss chance, when it is sent, then no fee is kept and the street rate arrives as naira cash", () => {
    const game = adaAbroad((used) => ({ ...used, tuning: { ...used.tuning, remit: { ...used.tuning.remit, informalLossBp: 0 } } }));
    const street = game.world().rates.USD.street;
    const draws = game.state.draws.street ?? 0;
    const result = game.accept({ type: "wallet/remit", currency: "USD", amount: HUNDRED_DOLLARS, channel: "informal" });
    expect(game.state.draws.street).toBe(draws + 1);
    expect(debitsOf(result, "remit")).toEqual([{ type: "wallet/debited", currency: "USD", pocket: "bank", amount: HUNDRED_DOLLARS, reason: "remit" }]);
    expect(moneyOf(result, "remit-fee")).toEqual([]);
    expect(creditsOf(result, "remit")).toEqual([{ type: "wallet/credited", currency: "NGN", pocket: "cash", amount: mulDiv(HUNDRED_DOLLARS, street, 100), reason: "remit" }]);
  });

  test("[R-ABROAD-006] given the informal channel, when money is sent until both happen, then a draw on `street` under the loss chance loses it all, with a line that asks for attention, and one over it arrives", () => {
    const game = adaAbroad();
    const sent = 1000;
    let lost = 0;
    let arrived = 0;
    for (let tries = 0; tries < 400 && (lost === 0 || arrived === 0); tries += 1) {
      const n = game.state.draws.street ?? 0;
      const expectLost = draw(game.state.seed, "street", n, 10000) < remit.informalLossBp;
      const before = game.state.wallet.pockets.NGN;
      const result = game.accept({ type: "wallet/remit", currency: "USD", amount: sent, channel: "informal" });
      expect(debitsOf(result, "remit")[0]?.amount).toBe(sent);
      const lostLine = { key: "line.wallet.remit-lost", params: { sent: { currency: "USD", amount: sent } }, tone: "bad", attention: true, counts: [] };
      expect(creditsOf(result, "remit")).toHaveLength(expectLost ? 0 : 1);
      expect(game.state.wallet.pockets.NGN.bank).toBe(before.bank);
      expect(game.state.wallet.pockets.NGN.cash - before.cash).toBe(expectLost ? 0 : mulDiv(sent, game.world().rates.USD.street, 100));
      expect(remitted(result)?.lost).toBe(expectLost);
      expect(result.lines.filter((line) => line.key === "line.wallet.remit-lost")).toEqual(expectLost ? [lostLine] : []);
      lost += expectLost ? 1 : 0;
      arrived += expectLost ? 0 : 1;
    }
    expect(lost).toBeGreaterThan(0);
    expect(arrived).toBeGreaterThan(0);
  });

  test("[R-ABROAD-006] given the loss chance at its edges, when money goes the informal way, then at 0 it always arrives and at 10000 it never does", () => {
    for (const [lossBp, arrives] of [
      [0, true],
      [10000, false],
    ] as const) {
      const game = adaAbroad((used) => ({ ...used, tuning: { ...used.tuning, remit: { ...used.tuning.remit, informalLossBp: lossBp } } }));
      for (let tries = 0; tries < 20; tries += 1) {
        const result = game.accept({ type: "wallet/remit", currency: "USD", amount: 1000, channel: "informal" });
        expect(creditsOf(result, "remit").length === 1).toBe(arrives);
      }
    }
  });

  test("[R-ABROAD-006] given a remit asked for at home, in naira, for more than the bank pocket holds or for nothing, when it is sent, then it is rejected and nothing moves", () => {
    const home = start({ content, scenario: "scenario.zainab" });
    applyEffects(home, [{ type: "money/add", currency: "USD", pocket: "bank", amount: HUNDRED_DOLLARS, reason: "salary" }]);
    home.expectRejected({ type: "wallet/remit", currency: "USD", amount: HUNDRED_DOLLARS, channel: "app" }, "not-legal");

    const game = adaAbroad();
    const bank = game.state.wallet.pockets.USD.bank;
    game.expectRejected({ type: "wallet/remit", currency: "NGN" as ForeignCurrency, amount: HUNDRED_DOLLARS, channel: "app" }, "unknown-id");
    game.expectRejected({ type: "wallet/remit", currency: "USD", amount: 0, channel: "app" }, "bad-amount");
    game.expectRejected({ type: "wallet/remit", currency: "USD", amount: bank + 1, channel: "bank" }, "cannot-afford");
    // Cash does not count: a remit leaves from the bank pocket.
    applyEffects(game, [{ type: "money/add", currency: "GBP", pocket: "cash", amount: 50000, reason: "gift" }]);
    game.expectRejected({ type: "wallet/remit", currency: "GBP", amount: game.state.wallet.pockets.GBP.bank + 100, channel: "app" }, "cannot-afford");
    game.accept({ type: "wallet/remit", currency: "USD", amount: bank, channel: "app" });
    expect(game.state.wallet.pockets.USD.bank).toBe(0);
  });
});

describe("the remit quote", () => {
  test("[R-ABROAD-008] given round rates, when $100 is quoted, then the app gives ₦98,000, the bank ₦92,000 and the informal channel ₦105,000", () => {
    const rates: World["rates"] = {
      GBP: { official: 200000, street: 210000 },
      USD: { official: 100000, street: 105000 },
      CAD: { official: 70000, street: 73500 },
      AED: { official: 27000, street: 28350 },
      EUR: { official: 160000, street: 168000 },
    };
    expect(remit).toMatchObject({ appFeeBp: 0, appMarginBp: 200, bankFeeBp: 800 });
    expect(remitQuote(rates, remit, "USD", HUNDRED_DOLLARS)).toEqual({
      app: { fee: 0, naira: 9800000 },
      bank: { fee: 800, naira: 9200000 },
      informal: { fee: 0, naira: 10500000 },
    });
  });

  test("[R-ABROAD-008] given the view's rates abroad, when each channel is quoted and then used, then the app and informal quotes are what arrives, and the bank's is what today's rate would give", () => {
    for (const channel of ["app", "bank", "informal"] as const) {
      const game = adaAbroad((used) => ({ ...used, tuning: { ...used.tuning, remit: { ...used.tuning.remit, informalLossBp: 0 } } }));
      const quote = remitQuote(game.view().rates, remit, "USD", HUNDRED_DOLLARS)[channel];
      const result = game.accept({ type: "wallet/remit", currency: "USD", amount: HUNDRED_DOLLARS, channel });
      expect(remitted(result)).toMatchObject({ channel, fee: quote.fee, naira: quote.naira });
      expect(creditsOf(result, "remit").map((event) => event.amount)).toEqual(channel === "bank" ? [] : [quote.naira]);
    }
  });
});

describe("cash paid in over a month", () => {
  const line = content.tuning.wallet.flagDepositAbove;

  test("[R-WALLET-011] given naira cash paid into the bank in three moves in one month, when they add up to exactly ₦500,000 and then one kobo more, then only the move that takes the month past the line records a lot; next month the count starts again", () => {
    const game = start({ content, scenario: "scenario.tunde" });
    expect(line).toBe(50000000);
    applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "cash", amount: 2 * line, reason: "gift" }]);
    game.accept({ type: "wallet/move", currency: "NGN", amount: 30000000, to: "bank" });
    expect(game.state.wallet.cashIn).toEqual({ month: 0, kobo: 30000000 });
    game.accept({ type: "wallet/move", currency: "NGN", amount: 20000000, to: "bank" });
    expect(game.state.wallet.cashIn).toEqual({ month: 0, kobo: line });
    expect(game.state.wallet.lots).toEqual([]);
    game.accept({ type: "wallet/move", currency: "NGN", amount: 1, to: "bank" });
    expect(game.state.wallet.lots).toEqual([{ currency: "NGN", amount: 1, month: 0, reason: "move" }]);

    game.endTurn();
    game.accept({ type: "wallet/move", currency: "NGN", amount: 40000000, to: "bank" });
    expect(game.state.wallet.cashIn).toEqual({ month: 1, kobo: 40000000 });
    expect(game.state.wallet.lots).toHaveLength(1);
  });

  test("[R-WALLET-011] given naira and then pound cash paid in the same month, when the pounds are valued at the official rate, then the two add up against the line", () => {
    /** Pays ₦400,000 of cash in, then `pence` of pound cash, and gives the lots recorded. */
    function paidIn(pence: number): Game["state"]["wallet"] {
      const game = start({ content, scenario: "scenario.tunde" });
      applyEffects(game, [
        { type: "money/add", currency: "NGN", pocket: "cash", amount: 40000000, reason: "gift" },
        { type: "money/add", currency: "GBP", pocket: "cash", amount: pence, reason: "gift" },
      ]);
      game.accept({ type: "wallet/move", currency: "NGN", amount: 40000000, to: "bank" });
      game.accept({ type: "wallet/move", currency: "GBP", amount: pence, to: "bank" });
      return game.state.wallet;
    }
    const world = start({ content, scenario: "scenario.tunde" }).world();
    const rates = official(world);
    // The most pence worth ₦100,000 or less at the official rate.
    const under = divFloor(10000000 * 100, world.rates.GBP.official);
    expect(valueInKobo(under, "GBP", rates)).toBeLessThanOrEqual(10000000);
    expect(valueInKobo(under + 1, "GBP", rates)).toBeGreaterThan(10000000);
    const within = paidIn(under);
    expect(within.cashIn).toEqual({ month: 0, kobo: 40000000 + valueInKobo(under, "GBP", rates) });
    expect(within.lots).toEqual([]);
    expect(paidIn(under + 1).lots).toEqual([{ currency: "GBP", amount: under + 1, month: 0, reason: "move" }]);
  });
});

describe("the bank abroad", () => {
  /** Enough dollars for the first month's bills, and more than a month of the Lagos allowance. */
  const DOLLARS = 800000;

  test("[R-WALLET-005] [R-ABROAD-005] given the recorded Ada just landed with dollars and no pounds, when she changes them to pounds at the bank and ends the month, then the Lagos allowance does not apply and her rent, tuition and living are paid", () => {
    const game = adaAbroad();
    const { GBP, USD } = game.state.wallet.pockets;
    // Whatever the recording carried over, she lands here with the dollars and no pounds.
    applyEffects(game, [
      ...(GBP.bank > 0 ? [{ type: "money/take", currency: "GBP", pocket: "bank", amount: GBP.bank, reason: "social" } as const] : []),
      ...(GBP.cash > 0 ? [{ type: "money/take", currency: "GBP", pocket: "cash", amount: GBP.cash, reason: "social" } as const] : []),
      ...(USD.bank < DOLLARS ? [{ type: "money/add", currency: "USD", pocket: "bank", amount: DOLLARS - USD.bank, reason: "gift" } as const] : []),
    ]);
    expect(game.state.wallet.pockets.GBP).toMatchObject({ bank: 0, cash: 0 });
    expect(game.state.wallet.pockets.USD.bank).toBeGreaterThanOrEqual(DOLLARS);
    // R-WALLET-006: abroad the view shows no allowance at all.
    expect(game.view().bankAllowanceLeft).toBeNull();
    game.accept({ type: "wallet/convert", from: "USD", to: "GBP", amount: DOLLARS, via: "bank" });
    expect(game.state.wallet.pockets.GBP.bank).toBeGreaterThan(0);
    const month = game.endTurn();
    for (const reason of ["rent", "upkeep", "fee-school"]) {
      expect(debitsOf(month, reason).filter((event) => event.currency === "GBP").map((event) => event.reason)).toContain(reason);
    }
    expect(Object.values(game.state.obligation.items).map((owed) => owed.missed)).toEqual([0, 0, 0]);
  });

  test("[R-WALLET-006] given a bank queue in the world, when Ada changes dollars to pounds at the bank abroad, then the pounds arrive at once: the queue is the Lagos bank's", () => {
    const game = adaAbroad();
    // Since decision 0013's re-recording Ada lands with fewer dollars than this; the change needs them held, as above.
    const { USD } = game.state.wallet.pockets;
    if (USD.bank < DOLLARS) applyEffects(game, [{ type: "money/add", currency: "USD", pocket: "bank", amount: DOLLARS - USD.bank, reason: "gift" }]);
    const landed = game.world();
    game.world = () => ({ ...landed, vars: { ...landed.vars, "var.fx-bank-queue": 2 } });
    const before = game.state.wallet.pockets.GBP.bank;
    game.accept({ type: "wallet/convert", from: "USD", to: "GBP", amount: DOLLARS, via: "bank" });
    expect(game.state.wallet.pockets.GBP.bank).toBeGreaterThan(before);
    expect(game.state.wallet.queued).toEqual([]);
  });
});
