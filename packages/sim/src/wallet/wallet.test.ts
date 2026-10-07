import { fc, test } from "@fast-check/vitest";
import { content, text } from "@japacity/content";
import { describe, expect } from "vitest";

import { check } from "../engine/check";
import { bp, convertMinor, mulDiv, mulDivCeil } from "../engine/int";
import { stepWith } from "../engine/step";
import type { BaseEvent, Content, Ctx, Currency, Effect, ForeignCurrency, Id, Reason, Rejection, Requirement, StepResult, World } from "../engine/types";
import { checkInvariants } from "../engine/invariants";
import { registry } from "../kinds";
import { legalCommands } from "../testing/legal";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { standInWorld } from "../world/standIn";
import type { WalletEvent } from "./wallet.events";
import { REASON_LINE } from "./wallet.logic";

const tuning = content.tuning.wallet;
const ALLOWANCE: Id<"var"> = "var.fx-bank-allowance";
const QUEUE: Id<"var"> = "var.fx-bank-queue";
/** Tunde starts with ₦4.2m in the bank and ₦60,000 in cash. */
const TUNDE: Id<"scenario"> = "scenario.tunde";

/** Round rates so the expected figures can be read off: ₦2,000 a pound and ₦1,000 a dollar at the bank. */
const ROUND_RATES: World["rates"] = {
  GBP: { official: 200000, street: 210000 },
  USD: { official: 100000, street: 105000 },
  // The three whole-life currencies: round figures the tests never read.
  CAD: { official: 70000, street: 73500 },
  AED: { official: 27000, street: 28350 },
  EUR: { official: 160000, street: 168000 },
};

/** The official rate of every foreign currency, as the int helpers want it. */
function officialOf(rates: World["rates"]): Record<ForeignCurrency, number> {
  return { GBP: rates.GBP.official, USD: rates.USD.official, CAD: rates.CAD.official, AED: rates.AED.official, EUR: rates.EUR.official };
}

interface Live {
  rates: World["rates"];
  vars: Partial<Record<Id<"var">, number>>;
}

/** A game on a world the test controls: change `live` and the next command sees it. */
function play(options: { scenario?: Id<"scenario">; content?: Content; vars?: Live["vars"]; seed?: string } = {}): { game: Game; live: Live } {
  const used = options.content ?? content;
  const base = standInWorld("world-1", 0, used);
  const live: Live = { rates: ROUND_RATES, vars: options.vars ?? {} };
  const game = start({
    scenario: options.scenario ?? TUNDE,
    content: used,
    ...(options.seed === undefined ? {} : { seed: options.seed }),
    worldAt: (tick) => ({ tick, rates: live.rates, vars: { ...base.vars, ...live.vars } as World["vars"], news: [], era: null }),
  });
  return { game, live };
}

/** Carries out effects through the engine, as an offer choice would. The offer stub has no command, so nothing real is replaced. */
function apply(game: Game, effects: Effect[]): Extract<StepResult, { ok: true }> {
  const kinds = registry().map((kind) =>
    kind.kind !== "offer"
      ? kind
      : {
          ...kind,
          commands: {
            "offer/choose": (ctx: Ctx): BaseEvent[] | Rejection => ctx.apply(effects, { source: "test", param: null, terms: {} }),
          },
        },
  );
  const result = stepWith(kinds, game.state, { type: "offer/choose", offer: "x", choice: "y", basedOn: game.state.v }, game.world(), game.content);
  if (!result.ok) throw new Error(result.detail);
  game.state = result.state;
  return result;
}

function walletEvents(result: { events: BaseEvent[] }): WalletEvent[] {
  return result.events.filter((event): event is WalletEvent => event.type.startsWith("wallet/"));
}

function judge(game: Game, requirement: Requirement) {
  return check({ state: game.state, world: game.world(), content: game.content }, requirement);
}

/** Bank plus cash plus locked for each currency, and the ledger's credits less debits. */
function ledger(game: Game, currency: Currency): { held: number; booked: number } {
  const pocket = game.state.wallet.pockets[currency];
  const sum = (side: typeof game.state.wallet.totals.in) =>
    Object.values(side).reduce((total, byCurrency) => total + (byCurrency?.[currency] ?? 0), 0);
  return { held: pocket.bank + pocket.cash + pocket.locked, booked: sum(game.state.wallet.totals.in) - sum(game.state.wallet.totals.out) };
}

/** US cents a naira purchase at the bank uses: what is left after the charge, at the official dollar rate. */
function centsFor(amount: number, rates: World["rates"]): number {
  return convertMinor(amount - bp(amount, tuning.bankChargeBp), "NGN", "USD", officialOf(rates));
}

/** The smallest naira amount whose bank purchase uses exactly this many cents. */
function nairaForCents(cents: number, rates: World["rates"]): number {
  let amount = mulDiv(cents, rates.USD.official, 100);
  while (centsFor(amount, rates) < cents) amount += 1;
  return amount;
}

describe("pockets and debits", () => {
  test("[R-WALLET-001] given a pocket, when an effect takes more than it holds, then nothing is taken; taking exactly all of it leaves zero", () => {
    const { game } = play();
    const cash = game.state.wallet.pockets.NGN.cash;
    const over = apply(game, [{ type: "money/take", currency: "NGN", pocket: "cash", amount: cash + 1, reason: "social" }]);
    expect(walletEvents(over)).toEqual([]);
    expect(game.state.wallet.pockets.NGN.cash).toBe(cash);
    expect(judge(game, { type: "money/can-pay", currency: "NGN", amount: cash + 1 }).met).toBe(true);
    const exact = apply(game, [{ type: "money/take", currency: "NGN", pocket: "cash", amount: cash, reason: "social" }]);
    expect(walletEvents(exact)).toEqual([{ type: "wallet/debited", currency: "NGN", pocket: "cash", amount: cash, reason: "social" }]);
    expect(game.state.wallet.pockets.NGN.cash).toBe(0);
  });

  test("[R-WALLET-001] given cash and bank, when an effect takes from any pocket, then cash goes first, then bank, and too much takes nothing", () => {
    const { game } = play();
    const { bank, cash } = game.state.wallet.pockets.NGN;
    const tooMuch = apply(game, [{ type: "money/take", currency: "NGN", pocket: "any", amount: bank + cash + 1, reason: "family" }]);
    expect(walletEvents(tooMuch)).toEqual([]);
    expect(judge(game, { type: "money/can-pay", currency: "NGN", amount: bank + cash + 1 }).met).toBe(false);
    expect(judge(game, { type: "money/can-pay", currency: "NGN", amount: bank + cash }).met).toBe(true);
    const taken = apply(game, [{ type: "money/take", currency: "NGN", pocket: "any", amount: cash + 500, reason: "family" }]);
    expect(walletEvents(taken)).toEqual([
      { type: "wallet/debited", currency: "NGN", pocket: "cash", amount: cash, reason: "family" },
      { type: "wallet/debited", currency: "NGN", pocket: "bank", amount: 500, reason: "family" },
    ]);
    expect(game.state.wallet.pockets.NGN).toEqual({ bank: bank - 500, cash: 0, locked: 0 });
  });

  test("[R-WALLET-001] given a debit from the bank, when it cannot be met in full, then no pocket goes below zero and the invariants hold", () => {
    const { game } = play();
    const { bank } = game.state.wallet.pockets.NGN;
    apply(game, [{ type: "money/take", currency: "NGN", pocket: "bank", amount: bank + 1, reason: "mishap" }]);
    apply(game, [{ type: "money/take", currency: "USD", pocket: "bank", amount: 1, reason: "mishap" }]);
    expect(game.state.wallet.pockets.NGN.bank).toBe(bank);
    expect(game.state.wallet.pockets.USD).toEqual({ bank: 0, cash: 0, locked: 0 });
    expect(checkInvariants(game.state, content)).toEqual([]);
  });
});

describe("the ledger", () => {
  test("[R-WALLET-002] given credits and debits, when they happen, then each is an event with currency, pocket, amount and reason, and the totals follow", () => {
    const { game } = play();
    const result = apply(game, [
      { type: "money/add", currency: "NGN", pocket: "bank", amount: 700000, reason: "salary" },
      { type: "money/add", currency: "USD", pocket: "cash", amount: 2500, reason: "gig" },
      { type: "money/take", currency: "NGN", pocket: "bank", amount: 300000, reason: "upkeep" },
    ]);
    expect(walletEvents(result)).toEqual([
      { type: "wallet/credited", currency: "NGN", pocket: "bank", amount: 700000, reason: "salary" },
      { type: "wallet/credited", currency: "USD", pocket: "cash", amount: 2500, reason: "gig" },
      { type: "wallet/debited", currency: "NGN", pocket: "bank", amount: 300000, reason: "upkeep" },
    ]);
    expect(game.state.wallet.totals.in.salary).toEqual({ NGN: 700000 });
    expect(game.state.wallet.totals.in.gig).toEqual({ USD: 2500 });
    expect(game.state.wallet.totals.out.upkeep).toEqual({ NGN: 300000 });
    for (const currency of ["NGN", "GBP", "USD"] as const) {
      const { held, booked } = ledger(game, currency);
      expect(held).toBe(booked);
    }
  });

  test("[R-WALLET-002] given a queued purchase, when it leaves and later arrives, then each currency still balances: debited on leaving, credited on arrival", () => {
    const { game, live } = play({ vars: { [QUEUE]: 1 } });
    game.accept({ type: "wallet/convert", from: "NGN", to: "USD", amount: 1000000, via: "bank" });
    expect(game.state.wallet.queued).toHaveLength(1);
    for (const currency of ["NGN", "USD"] as const) expect(ledger(game, currency).held).toBe(ledger(game, currency).booked);
    live.vars = {};
    game.endTurn();
    expect(game.state.wallet.queued).toEqual([]);
    expect(game.state.wallet.pockets.USD.bank).toBeGreaterThan(0);
    for (const currency of ["NGN", "USD"] as const) expect(ledger(game, currency).held).toBe(ledger(game, currency).booked);
  });

  test.prop([fc.constantFrom<Id<"scenario">>("scenario.ada", "scenario.tunde", "scenario.zainab"), fc.string({ minLength: 1, maxLength: 6 }), fc.array(fc.nat(), { minLength: 40, maxLength: 40 })], {
    numRuns: 20,
  })("[R-WALLET-002] [R-WALLET-001] given random legal commands, when played, then for each currency bank plus cash plus locked equals credits less debits", (scenario, seed, picks) => {
    const game = start({ scenario, seed, content });
    for (const pick of picks) {
      const legal = legalCommands(game.view());
      if (legal.length === 0) {
        game.grant(1);
        continue;
      }
      const command = legal[pick % legal.length]!;
      const result = game.send(command);
      if (!result.ok) throw new Error(`${command.type} from the legal list was rejected with ${result.code}: ${result.detail}`);
      expect(checkInvariants(game.state, content)).toEqual([]);
      for (const currency of ["NGN", "GBP", "USD"] as const) {
        const { held, booked } = ledger(game, currency);
        expect(held).toBe(booked);
      }
    }
  });

  test("[R-WALLET-002] given every reason, when its line is looked up, then the words exist", () => {
    const keys = [...new Set(Object.values(REASON_LINE).filter((key): key is string => key !== null))];
    expect(keys.length).toBeGreaterThan(20);
    const all = [...keys, "line.wallet.converted", "line.wallet.moved", "line.wallet.queued", "line.wallet.flagged"];
    expect(all.filter((key) => (text[key] ?? "").trim() === "")).toEqual([]);
  });
});

describe("transfers", () => {
  test("[R-WALLET-003] given a move from bank to cash, when it is made, then it is a debit and a credit of the same amount under move", () => {
    const { game } = play();
    const { bank, cash } = game.state.wallet.pockets.NGN;
    const result = game.accept({ type: "wallet/move", currency: "NGN", amount: 250000, to: "cash" });
    expect(walletEvents(result)).toEqual([
      { type: "wallet/debited", currency: "NGN", pocket: "bank", amount: 250000, reason: "move" },
      { type: "wallet/credited", currency: "NGN", pocket: "cash", amount: 250000, reason: "move" },
    ]);
    expect(game.state.wallet.pockets.NGN).toEqual({ bank: bank - 250000, cash: cash + 250000, locked: 0 });
    expect(result.lines.map((line) => line.key)).toEqual(["line.wallet.moved"]);
  });

  test("[R-WALLET-003] given a conversion, when it is made, then it is a debit and a credit under convert", () => {
    const { game } = play();
    const result = game.accept({ type: "wallet/convert", from: "NGN", to: "USD", amount: 2100000, via: "aboki" });
    const pair = walletEvents(result).filter((event) => event.type !== "wallet/debited" || event.reason === "convert");
    expect(pair).toEqual([
      { type: "wallet/debited", currency: "NGN", pocket: "cash", amount: 2100000, reason: "convert" },
      { type: "wallet/credited", currency: "USD", pocket: "cash", amount: 2000, reason: "convert" },
    ]);
  });
});

describe("the bank", () => {
  test("[R-WALLET-004] given naira in the bank, when dollars are bought at the bank, then 1.5% is charged on what is paid in and the rest converts at the official rate", () => {
    const { game } = play();
    const { bank, cash } = game.state.wallet.pockets.NGN;
    const amount = 10000000;
    const charge = bp(amount, tuning.bankChargeBp);
    expect(charge).toBe(150000);
    const result = game.accept({ type: "wallet/convert", from: "NGN", to: "USD", amount, via: "bank" });
    expect(walletEvents(result).filter((event) => event.type === "wallet/debited" || event.type === "wallet/credited")).toEqual([
      { type: "wallet/debited", currency: "NGN", pocket: "bank", amount: charge, reason: "bank-charge" },
      { type: "wallet/debited", currency: "NGN", pocket: "bank", amount: amount - charge, reason: "convert" },
      { type: "wallet/credited", currency: "USD", pocket: "bank", amount: mulDiv(amount - charge, 100, ROUND_RATES.USD.official), reason: "convert" },
    ]);
    expect(game.state.wallet.pockets.NGN).toEqual({ bank: bank - amount, cash, locked: 0 });
    expect(game.state.wallet.pockets.USD).toEqual({ bank: 9850, cash: 0, locked: 0 });
  });

  test("[R-WALLET-004] given dollars in the bank, when they are sold, then the charge is in dollars and the rest converts at the official rate", () => {
    const { game } = play();
    apply(game, [{ type: "money/add", currency: "USD", pocket: "bank", amount: 20000, reason: "salary" }]);
    const nairaBefore = game.state.wallet.pockets.NGN.bank;
    game.accept({ type: "wallet/convert", from: "USD", to: "NGN", amount: 20000, via: "bank" });
    expect(game.state.wallet.totals.out["bank-charge"]).toEqual({ USD: 300 });
    expect(game.state.wallet.pockets.NGN.bank - nairaBefore).toBe(mulDiv(19700, ROUND_RATES.USD.official, 100));
  });

  test("[R-WALLET-004] given pounds in the bank, when they are converted to dollars, then it goes through naira at the official rates with one charge", () => {
    const { game } = play();
    apply(game, [{ type: "money/add", currency: "GBP", pocket: "bank", amount: 10000, reason: "gift" }]);
    const result = game.accept({ type: "wallet/convert", from: "GBP", to: "USD", amount: 10000, via: "bank" });
    const charges = walletEvents(result).filter((event) => event.type === "wallet/debited" && event.reason === "bank-charge");
    expect(charges).toEqual([{ type: "wallet/debited", currency: "GBP", pocket: "bank", amount: 150, reason: "bank-charge" }]);
    expect(game.state.wallet.pockets.USD.bank).toBe(mulDiv(9850, ROUND_RATES.GBP.official, ROUND_RATES.USD.official));
    expect(game.state.wallet.pockets.USD.bank).toBe(19700);
  });

  test("[R-WALLET-004] given naira only in cash, when a bank conversion is asked for, then it is rejected: the bank uses bank pockets only", () => {
    const { game } = play();
    const { bank } = game.state.wallet.pockets.NGN;
    apply(game, [{ type: "money/take", currency: "NGN", pocket: "bank", amount: bank, reason: "mishap" }]);
    expect(game.state.wallet.pockets.NGN.cash).toBeGreaterThan(100000);
    expect(game.expectRejected({ type: "wallet/convert", from: "NGN", to: "USD", amount: 100000, via: "bank" }, "cannot-afford").code).toBe("cannot-afford");
  });

  test("[R-WALLET-005] given the month's allowance, when a purchase uses exactly all of it, then it is accepted; one cent more is bad-amount", () => {
    const allowance = content.var[ALLOWANCE]!.start;
    const exact = nairaForCents(allowance, ROUND_RATES);
    const over = nairaForCents(allowance + 1, ROUND_RATES);
    expect(centsFor(exact, ROUND_RATES)).toBe(allowance);
    expect(centsFor(over, ROUND_RATES)).toBe(allowance + 1);

    const first = play().game;
    expect(first.view().bankAllowanceLeft).toBe(allowance);
    first.expectRejected({ type: "wallet/convert", from: "NGN", to: "USD", amount: over, via: "bank" }, "bad-amount");
    first.accept({ type: "wallet/convert", from: "NGN", to: "USD", amount: exact, via: "bank" });
    expect(first.view().bankAllowanceLeft).toBe(0);
    first.expectRejected({ type: "wallet/convert", from: "NGN", to: "USD", amount: nairaForCents(1, ROUND_RATES), via: "bank" }, "bad-amount");
  });

  test("[R-WALLET-005] given purchases in one month, when they add up past the allowance, then the one that passes it is refused, and a new month starts it again", () => {
    const allowance = content.var[ALLOWANCE]!.start;
    const { game } = play();
    const half = nairaForCents(allowance - 20000, ROUND_RATES);
    game.accept({ type: "wallet/convert", from: "NGN", to: "USD", amount: half, via: "bank" });
    expect(game.view().bankAllowanceLeft).toBe(20000);
    game.expectRejected({ type: "wallet/convert", from: "NGN", to: "USD", amount: nairaForCents(20001, ROUND_RATES), via: "bank" }, "bad-amount");
    game.accept({ type: "wallet/convert", from: "NGN", to: "USD", amount: nairaForCents(20000, ROUND_RATES), via: "bank" });
    expect(game.view().bankAllowanceLeft).toBe(0);
    game.endTurn();
    expect(game.view().bankAllowanceLeft).toBe(allowance);
    expect(game.state.wallet.bought).toEqual({ month: 1, cents: 0 });
  });

  test("[R-WALLET-005] given pounds bought at the bank, when the allowance is read, then the purchase is valued in US cents at the official rates", () => {
    const allowance = content.var[ALLOWANCE]!.start;
    const { game } = play();
    game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount: 10000000, via: "bank" });
    expect(game.view().bankAllowanceLeft).toBe(allowance - centsFor(10000000, ROUND_RATES));
    expect(game.view().bankAllowanceLeft).toBe(allowance - 9850);
  });

  test("[R-WALLET-005] given an allowance of zero, when foreign currency is sold at the bank for more than any allowance, then there is no limit", () => {
    const { game } = play({ vars: { [ALLOWANCE]: 0 } });
    apply(game, [{ type: "money/add", currency: "USD", pocket: "bank", amount: 5000000, reason: "salary" }]);
    expect(game.view().bankAllowanceLeft).toBe(0);
    game.accept({ type: "wallet/convert", from: "USD", to: "NGN", amount: 5000000, via: "bank" });
    expect(game.state.wallet.pockets.USD.bank).toBe(0);
    game.expectRejected({ type: "wallet/convert", from: "NGN", to: "USD", amount: 1000000, via: "bank" }, "bad-amount");
  });

  test("[R-WALLET-006] given a bank queue of 0, when dollars are bought at the bank, then they arrive at once", () => {
    const { game } = play({ vars: { [QUEUE]: 0 } });
    game.accept({ type: "wallet/convert", from: "NGN", to: "USD", amount: 1000000, via: "bank" });
    expect(game.state.wallet.queued).toEqual([]);
    expect(game.state.wallet.pockets.USD.bank).toBe(985);
  });

  test("[R-WALLET-006] given a bank queue of 1, when dollars are bought, then the naira leaves now and the dollars arrive next month at that day's official rate", () => {
    const { game, live } = play({ vars: { [QUEUE]: 1 } });
    const nairaBefore = game.state.wallet.pockets.NGN.bank;
    const result = game.accept({ type: "wallet/convert", from: "NGN", to: "USD", amount: 1000000, via: "bank" });
    expect(game.state.wallet.pockets.NGN.bank).toBe(nairaBefore - 1000000);
    expect(game.state.wallet.pockets.USD.bank).toBe(0);
    expect(game.state.wallet.queued).toEqual([{ id: expect.any(String) as string, from: "NGN", to: "USD", paid: 985000, readyMonth: 1 }]);
    expect(result.lines.map((line) => line.key)).toContain("line.wallet.queued");
    expect(game.view().queued).toEqual(game.state.wallet.queued);

    // The naira falls before the dollars arrive: they come at the rate of the day they arrive.
    live.rates = { ...ROUND_RATES, USD: { official: 125000, street: 130000 } };
    live.vars = { [QUEUE]: 0 };
    game.endTurn();
    expect(game.state.wallet.queued).toEqual([]);
    expect(game.state.wallet.pockets.USD.bank).toBe(mulDiv(985000, 100, 125000));
    expect(game.state.wallet.pockets.USD.bank).toBe(788);
  });

  test("[R-WALLET-006] given a bank queue of 2, when one month passes, then the purchase is still waiting; it arrives in the second", () => {
    const { game } = play({ vars: { [QUEUE]: 2 } });
    game.accept({ type: "wallet/convert", from: "NGN", to: "USD", amount: 1000000, via: "bank" });
    expect(game.state.wallet.queued[0]?.readyMonth).toBe(2);
    game.endTurn();
    expect(game.state.wallet.queued).toHaveLength(1);
    expect(game.state.wallet.pockets.USD.bank).toBe(0);
    game.endTurn();
    expect(game.state.wallet.queued).toEqual([]);
    expect(game.state.wallet.pockets.USD.bank).toBe(985);
  });

  test("[R-WALLET-006] given a bank queue, when dollars are sold at the bank, then the naira arrives at once: only purchases wait", () => {
    const { game } = play({ vars: { [QUEUE]: 2 } });
    apply(game, [{ type: "money/add", currency: "USD", pocket: "bank", amount: 10000, reason: "salary" }]);
    const nairaBefore = game.state.wallet.pockets.NGN.bank;
    game.accept({ type: "wallet/convert", from: "USD", to: "NGN", amount: 10000, via: "bank" });
    expect(game.state.wallet.queued).toEqual([]);
    expect(game.state.wallet.pockets.NGN.bank).toBe(nairaBefore + mulDiv(9850, ROUND_RATES.USD.official, 100));
  });
});

describe("the aboki", () => {
  const sure = { ...content, tuning: { ...content.tuning, wallet: { ...tuning, streetShortBp: 0 } } };

  test("[R-WALLET-007] given naira cash, when dollars are bought at the aboki, then it is instant, cash only, at the street rate", () => {
    const { game } = play({ content: sure });
    const before = game.state.wallet.pockets.NGN;
    game.accept({ type: "wallet/convert", from: "NGN", to: "USD", amount: 5250000, via: "aboki" });
    expect(game.state.wallet.pockets.USD).toEqual({ bank: 0, cash: mulDiv(5250000, 100, ROUND_RATES.USD.street), locked: 0 });
    expect(game.state.wallet.pockets.USD.cash).toBe(5000);
    expect(game.state.wallet.pockets.NGN).toEqual({ bank: before.bank, cash: before.cash - 5250000, locked: 0 });
  });

  test("[R-WALLET-007] given dollar cash, when it is sold at the aboki, then it earns the street rate less 2%", () => {
    const { game } = play({ content: sure });
    apply(game, [{ type: "money/add", currency: "USD", pocket: "cash", amount: 10000, reason: "gift" }]);
    const cashBefore = game.state.wallet.pockets.NGN.cash;
    game.accept({ type: "wallet/convert", from: "USD", to: "NGN", amount: 10000, via: "aboki" });
    const rate = ROUND_RATES.USD.street - bp(ROUND_RATES.USD.street, tuning.streetSpreadBp);
    expect(rate).toBe(102900);
    expect(game.state.wallet.pockets.NGN.cash - cashBefore).toBe(mulDiv(10000, rate, 100));
  });

  test("[R-WALLET-007] given no allowance and a bank queue, when far more than any allowance is bought at the aboki, then there is no limit", () => {
    const { game } = play({ content: sure, vars: { [ALLOWANCE]: 0, [QUEUE]: 2 } });
    apply(game, [{ type: "money/add", currency: "NGN", pocket: "cash", amount: 300000000, reason: "sale" }]);
    game.accept({ type: "wallet/convert", from: "NGN", to: "USD", amount: 300000000, via: "aboki" });
    expect(game.state.wallet.queued).toEqual([]);
    expect(game.state.wallet.pockets.USD.cash).toBeGreaterThan(content.var[ALLOWANCE]!.start);
  });

  test("[R-WALLET-007] given naira in the bank but too little cash, when the aboki is asked, then it is cannot-afford: the aboki takes cash only", () => {
    const { game } = play({ content: sure });
    const { cash } = game.state.wallet.pockets.NGN;
    expect(game.state.wallet.pockets.NGN.bank).toBeGreaterThan(cash + 1);
    expect(game.expectRejected({ type: "wallet/convert", from: "NGN", to: "USD", amount: cash + 1, via: "aboki" }, "cannot-afford").code).toBe("cannot-afford");
  });

  test("[R-WALLET-007] given pound cash, when it is changed for dollars at the aboki, then it is sold for naira less the spread and the naira buys dollars at street", () => {
    const { game } = play({ content: sure });
    apply(game, [{ type: "money/add", currency: "GBP", pocket: "cash", amount: 1000, reason: "gift" }]);
    game.accept({ type: "wallet/convert", from: "GBP", to: "USD", amount: 1000, via: "aboki" });
    const naira = mulDiv(1000, ROUND_RATES.GBP.street - bp(ROUND_RATES.GBP.street, tuning.streetSpreadBp), 100);
    expect(game.state.wallet.pockets.USD.cash).toBe(mulDiv(naira, 100, ROUND_RATES.USD.street));
    expect(game.state.wallet.pockets.USD.cash).toBe(1960);
  });

  test("[R-WALLET-008] given a short count is certain, when dollars are bought, then between 3% and 8% of them is taken back as a short-count debit", () => {
    const always = { ...content, tuning: { ...content.tuning, wallet: { ...tuning, streetShortBp: 10000 } } };
    const [min, max] = tuning.streetShortLossBp;
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const { game } = play({ content: always, seed });
      const result = game.accept({ type: "wallet/convert", from: "NGN", to: "USD", amount: 5250000, via: "aboki" });
      const short = walletEvents(result).find((event) => event.type === "wallet/debited" && event.reason === "short-count");
      expect(short).toMatchObject({ currency: "USD", pocket: "cash" });
      const lost = short?.type === "wallet/debited" ? short.amount : 0;
      expect(lost).toBeGreaterThanOrEqual(bp(5000, min));
      expect(lost).toBeLessThanOrEqual(bp(5000, max));
      expect(game.state.wallet.pockets.USD.cash).toBe(5000 - lost);
      expect(result.lines.map((line) => line.key)).toContain("line.wallet.short-count");
    }
  });

  test("[R-WALLET-008] given the loss is fixed at 3%, when a short count happens, then exactly 3% is lost", () => {
    const fixed = { ...content, tuning: { ...content.tuning, wallet: { ...tuning, streetShortBp: 10000, streetShortLossBp: [300, 300] as [number, number] } } };
    const { game } = play({ content: fixed });
    game.accept({ type: "wallet/convert", from: "NGN", to: "USD", amount: 5250000, via: "aboki" });
    expect(game.state.wallet.pockets.USD.cash).toBe(5000 - 150);
    expect(game.state.wallet.totals.out["short-count"]).toEqual({ USD: 150 });
  });

  test("[R-WALLET-008] given the real 1.5% chance, when the aboki is used 2000 times, then a short count happens about 1.5% of the time and is drawn on the street stream", () => {
    const { game } = play();
    apply(game, [{ type: "money/add", currency: "NGN", pocket: "cash", amount: 250000000, reason: "sale" }]);
    let shorts = 0;
    for (let i = 0; i < 2000; i += 1) {
      const draws = game.state.draws.street ?? 0;
      // A hundred cents each, so even a 3% short count loses at least one.
      const result = game.accept({ type: "wallet/convert", from: "NGN", to: "USD", amount: 105000, via: "aboki" });
      if (walletEvents(result).some((event) => event.type === "wallet/debited" && event.reason === "short-count")) shorts += 1;
      expect(game.state.draws.street).toBeGreaterThan(draws);
    }
    expect(tuning.streetShortBp).toBe(150);
    expect(shorts).toBeGreaterThan(10);
    expect(shorts).toBeLessThan(60);
  });
});

describe("foreign fees", () => {
  const fee = 55800;

  test("[R-WALLET-009] given pounds in the bank and in cash, when a pound fee is paid, then the bank pays first and cash the rest", () => {
    const { game } = play();
    apply(game, [
      { type: "money/add", currency: "GBP", pocket: "bank", amount: 50000, reason: "gift" },
      { type: "money/add", currency: "GBP", pocket: "cash", amount: 10000, reason: "gift" },
    ]);
    const result = apply(game, [{ type: "money/pay-fee", currency: "GBP", amount: fee, reason: "fee-visa" }]);
    expect(walletEvents(result)).toEqual([
      { type: "wallet/debited", currency: "GBP", pocket: "bank", amount: 50000, reason: "fee-visa" },
      { type: "wallet/debited", currency: "GBP", pocket: "cash", amount: 5800, reason: "fee-visa" },
    ]);
    expect(game.state.wallet.pockets.GBP).toEqual({ bank: 0, cash: 4200, locked: 0 });
  });

  test("[R-WALLET-009] given too few pounds, when the fee is paid, then the rest comes from the naira bank at the official rate plus the 1.5% charge", () => {
    const { game } = play();
    apply(game, [{ type: "money/add", currency: "GBP", pocket: "cash", amount: 800, reason: "gift" }]);
    const nairaBefore = game.state.wallet.pockets.NGN.bank;
    expect(judge(game, { type: "money/can-pay", currency: "GBP", amount: fee }).met).toBe(true);
    apply(game, [{ type: "money/pay-fee", currency: "GBP", amount: fee, reason: "fee-visa" }]);
    const naira = mulDivCeil(fee - 800, ROUND_RATES.GBP.official, 100);
    expect(naira).toBe(110000000);
    expect(nairaBefore - game.state.wallet.pockets.NGN.bank).toBe(naira + bp(naira, tuning.bankChargeBp));
    expect(game.state.wallet.pockets.GBP).toEqual({ bank: 0, cash: 0, locked: 0 });
    expect(game.state.wallet.totals.out["fee-visa"]).toEqual({ GBP: fee });
    expect(game.state.wallet.totals.out["bank-charge"]).toEqual({ NGN: bp(naira, tuning.bankChargeBp) });
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[R-WALLET-009] given a bank queue above zero, when the pounds are short, then the naira leg is refused and nothing at all is paid", () => {
    const { game, live } = play({ vars: { [QUEUE]: 1 } });
    apply(game, [{ type: "money/add", currency: "GBP", pocket: "bank", amount: 800, reason: "gift" }]);
    const before = game.state.wallet;
    expect(judge(game, { type: "money/can-pay", currency: "GBP", amount: fee }).met).toBe(false);
    const result = apply(game, [{ type: "money/pay-fee", currency: "GBP", amount: fee, reason: "fee-visa" }]);
    expect(walletEvents(result)).toEqual([]);
    expect(game.state.wallet).toEqual(before);
    // With enough pounds of its own, the fee is paid whatever the queue.
    expect(judge(game, { type: "money/can-pay", currency: "GBP", amount: 800 }).met).toBe(true);
    live.vars = { [QUEUE]: 0 };
    expect(judge(game, { type: "money/can-pay", currency: "GBP", amount: fee }).met).toBe(true);
  });

  test("[R-WALLET-009] given not enough money anywhere, when the fee is paid, then nothing is paid", () => {
    const { game } = play({ scenario: "scenario.ada" });
    const { bank } = game.state.wallet.pockets.NGN;
    const tooBig = mulDiv(bank, 100, ROUND_RATES.GBP.official) + 1;
    expect(judge(game, { type: "money/can-pay", currency: "GBP", amount: tooBig }).met).toBe(false);
    const result = apply(game, [{ type: "money/pay-fee", currency: "GBP", amount: tooBig, reason: "fee-school" }]);
    expect(walletEvents(result)).toEqual([]);
    expect(game.state.wallet.pockets.NGN.bank).toBe(bank);
  });

  test("[R-WALLET-009] given the naira bank holds exactly the fee and its charge, when it is paid, then it is accepted; a kobo less and it is not", () => {
    const { game } = play({ scenario: "scenario.ada" });
    const naira = mulDivCeil(10000, ROUND_RATES.GBP.official, 100);
    const needed = naira + bp(naira, tuning.bankChargeBp);
    apply(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: needed, reason: "gift" }]);
    const { bank } = game.state.wallet.pockets.NGN;
    apply(game, [{ type: "money/take", currency: "NGN", pocket: "bank", amount: bank - needed + 1, reason: "mishap" }]);
    expect(judge(game, { type: "money/can-pay", currency: "GBP", amount: 10000 }).met).toBe(false);
    apply(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 1, reason: "gift" }]);
    expect(judge(game, { type: "money/can-pay", currency: "GBP", amount: 10000 }).met).toBe(true);
    apply(game, [{ type: "money/pay-fee", currency: "GBP", amount: 10000, reason: "fee-school" }]);
    expect(game.state.wallet.pockets.NGN.bank).toBe(0);
  });
});

describe("locked money", () => {
  test("[R-WALLET-010] given a locked credit, when it lands, then it is in the locked pocket and cannot be moved, converted or spent from any pocket", () => {
    const { game } = play({ scenario: "scenario.ada" });
    const { bank } = game.state.wallet.pockets.NGN;
    apply(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 500000000, reason: "held-funds", locked: true }]);
    expect(game.state.wallet.pockets.NGN).toMatchObject({ bank, locked: 500000000 });
    game.expectRejected({ type: "wallet/move", currency: "NGN", amount: bank + 1, to: "cash" }, "cannot-afford");
    game.expectRejected({ type: "wallet/convert", from: "NGN", to: "USD", amount: bank + 1, via: "bank" }, "cannot-afford");
    const any = apply(game, [{ type: "money/take", currency: "NGN", pocket: "any", amount: bank + game.state.wallet.pockets.NGN.cash + 1, reason: "family" }]);
    expect(walletEvents(any)).toEqual([]);
    expect(judge(game, { type: "money/min", currency: "NGN", amount: bank + game.state.wallet.pockets.NGN.cash + 1 }).met).toBe(false);
    expect(game.state.wallet.pockets.NGN.locked).toBe(500000000);
  });

  test("[R-WALLET-010] given locked money, when a debit names the locked pocket, then it is removed", () => {
    const { game } = play({ scenario: "scenario.ada" });
    apply(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 500000000, reason: "held-funds", locked: true }]);
    const result = apply(game, [{ type: "money/take", currency: "NGN", pocket: "locked", amount: 500000000, reason: "held-funds-return" }]);
    expect(walletEvents(result)).toEqual([{ type: "wallet/debited", currency: "NGN", pocket: "locked", amount: 500000000, reason: "held-funds-return" }]);
    expect(game.state.wallet.pockets.NGN.locked).toBe(0);
  });
});

describe("flagged deposits", () => {
  test("[R-WALLET-011] given a flagged credit to the bank, when it lands, then a lot is recorded with the currency, amount, month and reason", () => {
    const { game } = play();
    game.endTurn();
    const result = apply(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 80000000, reason: "sale", flagged: true }]);
    expect(game.state.wallet.lots).toEqual([{ currency: "NGN", amount: 80000000, month: 1, reason: "sale" }]);
    expect(result.lines.map((line) => line.key)).toContain("line.wallet.flagged");
    apply(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 80000000, reason: "gift" }]);
    expect(game.state.wallet.lots).toHaveLength(1);
  });

  test("[R-WALLET-011] given naira cash, when exactly ₦500,000 is moved into the bank, then no lot; one kobo more records one", () => {
    const { game } = play();
    expect(tuning.flagDepositAbove).toBe(50000000);
    apply(game, [{ type: "money/add", currency: "NGN", pocket: "cash", amount: 200000000, reason: "sale" }]);
    game.accept({ type: "wallet/move", currency: "NGN", amount: tuning.flagDepositAbove, to: "bank" });
    expect(game.state.wallet.lots).toEqual([]);
    game.accept({ type: "wallet/move", currency: "NGN", amount: tuning.flagDepositAbove + 1, to: "bank" });
    expect(game.state.wallet.lots).toEqual([{ currency: "NGN", amount: tuning.flagDepositAbove + 1, month: 0, reason: "move" }]);
  });

  test("[R-WALLET-011] given pound cash, when it is moved into the bank, then it is valued at the official rate against the line", () => {
    const { game } = play();
    apply(game, [{ type: "money/add", currency: "GBP", pocket: "cash", amount: 60000, reason: "gift" }]);
    // £250 at ₦2,000 is exactly ₦500,000.
    game.accept({ type: "wallet/move", currency: "GBP", amount: 25000, to: "bank" });
    expect(game.state.wallet.lots).toEqual([]);
    game.accept({ type: "wallet/move", currency: "GBP", amount: 25001, to: "bank" });
    expect(game.state.wallet.lots).toEqual([{ currency: "GBP", amount: 25001, month: 0, reason: "move" }]);
  });

  test("[R-WALLET-011] given a lot, when months pass in the settle phase, then it is kept for 3 months and dropped after", () => {
    const { game } = play();
    apply(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 80000000, reason: "gift", flagged: true }]);
    for (let month = 1; month <= tuning.lotMonths; month += 1) {
      game.endTurn();
      expect(game.state.wallet.lots).toHaveLength(1);
    }
    game.endTurn();
    expect(game.state.turn.month).toBe(tuning.lotMonths + 1);
    expect(game.state.wallet.lots).toEqual([]);
  });
});

describe("command amounts", () => {
  test.each([0, -100, Number("1.5"), Number.NaN])("[R-WALLET-012] given the amount %s, when a move or conversion is asked for, then it is bad-amount", (amount) => {
    const { game } = play();
    const codes = [
      game.expectRejected({ type: "wallet/move", currency: "NGN", amount, to: "cash" }, "bad-amount"),
      game.expectRejected({ type: "wallet/convert", from: "NGN", to: "USD", amount, via: "aboki" }, "bad-amount"),
      game.expectRejected({ type: "wallet/convert", from: "NGN", to: "USD", amount, via: "bank" }, "bad-amount"),
    ].map((rejection) => rejection.code);
    expect(codes).toEqual(["bad-amount", "bad-amount", "bad-amount"]);
  });

  test("[R-WALLET-012] given an amount too small to give back a single cent, when it is changed, then it is bad-amount and nothing moves", () => {
    const { game } = play();
    expect(mulDiv(1000, 100, ROUND_RATES.USD.street)).toBe(0);
    expect(game.expectRejected({ type: "wallet/convert", from: "NGN", to: "USD", amount: 1000, via: "aboki" }, "bad-amount").code).toBe("bad-amount");
    expect(game.expectRejected({ type: "wallet/convert", from: "NGN", to: "USD", amount: 1000, via: "bank" }, "bad-amount").code).toBe("bad-amount");
  });

  test("[R-WALLET-012] given a pocket, when exactly all of it is moved, then it is accepted; one more is cannot-afford", () => {
    const { game } = play();
    const { cash } = game.state.wallet.pockets.NGN;
    game.expectRejected({ type: "wallet/move", currency: "NGN", amount: cash + 1, to: "bank" }, "cannot-afford");
    game.accept({ type: "wallet/move", currency: "NGN", amount: cash, to: "bank" });
    expect(game.state.wallet.pockets.NGN.cash).toBe(0);
  });
});

describe("requirements and view", () => {
  test("[R-WALLET-010] given bank, cash and locked money, when money/min is judged, then bank and cash count, a named pocket counts alone, locked never", () => {
    const { game } = play({ scenario: "scenario.ada" });
    apply(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 900000000, reason: "held-funds", locked: true }]);
    const { bank, cash } = game.state.wallet.pockets.NGN;
    expect(judge(game, { type: "money/min", currency: "NGN", amount: bank + cash })).toEqual({ met: true, have: bank + cash, need: bank + cash });
    expect(judge(game, { type: "money/min", currency: "NGN", amount: bank + cash + 1 }).met).toBe(false);
    expect(judge(game, { type: "money/min", currency: "NGN", amount: cash, pocket: "cash" })).toEqual({ met: true, have: cash, need: cash });
    expect(judge(game, { type: "money/min", currency: "NGN", amount: cash + 1, pocket: "cash" }).met).toBe(false);
    expect(judge(game, { type: "money/min", currency: "NGN", amount: { var: ALLOWANCE } }).need).toBe(content.var[ALLOWANCE]!.start);
  });

  test("[R-WALLET-005] given the world, when the view is read, then it shows the pockets, the queue, the world's rates and the allowance left", () => {
    const { game } = play();
    const view = game.view();
    expect(view.pockets).toEqual(game.state.wallet.pockets);
    expect(view.queued).toEqual([]);
    expect(view.rates).toEqual(ROUND_RATES);
    expect(view.bankAllowanceLeft).toBe(content.var[ALLOWANCE]!.start);
  });
});

describe("lines", () => {
  test("[R-WALLET-002] given a salary and a fee, when they happen, then the lines are keyed by reason with the amount and currency", () => {
    const { game } = play();
    const result = apply(game, [
      { type: "money/add", currency: "NGN", pocket: "bank", amount: 700000, reason: "salary" },
      { type: "money/take", currency: "NGN", pocket: "bank", amount: 300000, reason: "fee-document" },
    ]);
    expect(result.lines).toEqual([
      { key: "line.wallet.salary", params: { currency: "NGN", amount: 700000 }, tone: "good", attention: false, counts: [] },
      { key: "line.wallet.fee-document", params: { currency: "NGN", amount: 300000 }, tone: "bad", attention: false, counts: [] },
    ]);
    const reasons: Reason[] = ["salary", "fee-document"];
    for (const reason of reasons) expect(REASON_LINE[reason]).toBe(`line.wallet.${reason}`);
  });
});
