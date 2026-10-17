import { fc, test } from "@fast-check/vitest";
import { content as realContent, text } from "@japacity/content";
import { describe, expect } from "vitest";

import { bp, divCeil } from "../engine/int";
import { checkInvariants } from "../engine/invariants";
import { stepWith } from "../engine/step";
import type { Accepted, BaseEvent, Content, Ctx, Effect, Id, ObligationEntry, ObligationState, Terms } from "../engine/types";
import { registry } from "../kinds";
import { legalCommands } from "../testing/legal";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { draw, seedWhere } from "../route/route.journey";
import type { ObligationEvent } from "./obligation.events";

/** Decision 0035 lives the living by hand at home; these tests read the charge itself, so they charge it whole. */
const content: Content = { ...realContent, tuning: { ...realContent.tuning, home: { ...realContent.tuning.home, livingByHandBp: 0 } } };

const ADA: Id<"scenario"> = "scenario.ada";
const TUNDE: Id<"scenario"> = "scenario.tunde";
const UPKEEP: Id<"obligation"> = "obligation.upkeep";
const SUPPORT: Id<"obligation"> = "obligation.home-support";
const SALARY_LOAN: Id<"obligation"> = "obligation.salary-loan";
const QUICK_LOAN: Id<"obligation"> = "obligation.quick-loan";
const HELD: Id<"obligation"> = "obligation.held-funds";
const STANDING: Id<"quality"> = "quality.standing";
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const CREDIT: Id<"quality"> = "quality.credit-mark";

function entryOf(id: Id<"obligation">): ObligationEntry {
  const entry = content.obligation[id];
  if (entry === undefined) throw new Error(`No ${id} in content.`);
  return entry;
}

/** Ada's upkeep a month, from the scenario. */
const ADA_UPKEEP = content.scenario[ADA]!.obligations[0]!.amount;

/**
 * Carries out effects through the engine: a test registry swaps the route
 * kind's own `route/depart` for a handler that applies them.
 */
function apply(game: Game, effects: Effect[], terms: Terms = {}): Accepted {
  const kinds = registry().map((kind) =>
    kind.kind !== "route"
      ? kind
      : { ...kind, commands: { ...kind.commands, "route/depart": (ctx: Ctx): BaseEvent[] => ctx.apply(effects, { source: "test", param: null, terms }) } },
  );
  const result = stepWith(kinds, game.state, { type: "route/depart", route: "route.uk-masters", basedOn: game.state.v }, game.world(), game.content);
  if (!result.ok) throw new Error(result.detail);
  game.state = result.state;
  return result;
}

/** Leaves exactly `bank` naira kobo in the bank and `cash` in cash. */
function setNaira(game: Game, bank: number, cash = 0): void {
  const pocket = game.state.wallet.pockets.NGN;
  const effects: Effect[] = [];
  const change = (where: "bank" | "cash", now: number, want: number) => {
    if (now > want) effects.push({ type: "money/take", currency: "NGN", pocket: where, amount: now - want, reason: "mishap" });
    if (now < want) effects.push({ type: "money/add", currency: "NGN", pocket: where, amount: want - now, reason: "gift" });
  };
  change("bank", pocket.bank, bank);
  change("cash", pocket.cash, cash);
  if (effects.length > 0) apply(game, effects);
}

/** Opens an obligation by effect and returns its instance. */
function open(game: Game, obligation: Id<"obligation">, principal?: number, amount?: number): ObligationState {
  const before = new Set(Object.keys(game.state.obligation.items));
  const effect: Effect = { type: "obligation/open", obligation };
  if (principal !== undefined) effect.principal = principal;
  if (amount !== undefined) effect.amount = amount;
  apply(game, [effect]);
  const added = Object.values(game.state.obligation.items).filter((item) => !before.has(item.id));
  if (added.length !== 1) throw new Error(`Expected one new obligation, got ${String(added.length)}.`);
  return added[0]!;
}

function own(result: { events: BaseEvent[] }): ObligationEvent[] {
  return result.events.filter((event): event is ObligationEvent => event.type.startsWith("obligation/"));
}

function ofType<T extends ObligationEvent["type"]>(result: { events: BaseEvent[] }, type: T): Extract<ObligationEvent, { type: T }>[] {
  return own(result).filter((event): event is Extract<ObligationEvent, { type: T }> => event.type === type);
}

function debits(result: { events: BaseEvent[] }) {
  return result.events.filter((event) => event.type === "wallet/debited");
}

function qualityChanges(result: { events: BaseEvent[] }, source: string) {
  return result.events.filter(
    (event): event is BaseEvent & { quality: string; amount: number; source: string } =>
      event.type === "quality/changed" && (event as unknown as { source: string }).source === source,
  );
}

function item(game: Game, id: string): ObligationState | undefined {
  return game.state.obligation.items[id];
}

function upkeepOf(game: Game): ObligationState {
  const found = Object.values(game.state.obligation.items).find((owed) => owed.entry === UPKEEP);
  if (found === undefined) throw new Error("No upkeep.");
  return found;
}

describe("the monthly charge", () => {
  test("[R-OBLIGATION-001] given Ada and her upkeep, when a month ends, then the upkeep amount is charged", () => {
    const game = start({ scenario: ADA, content });
    const upkeep = upkeepOf(game);
    expect(upkeep.amount).toBe(ADA_UPKEEP);
    const result = game.endTurn();
    expect(ofType(result, "obligation/charged")).toEqual([
      { type: "obligation/charged", id: upkeep.id, entry: UPKEEP, total: ADA_UPKEEP, interest: 0, principal: 0 },
    ]);
  });

  test("[R-OBLIGATION-001] given a twelve month loan, when it is charged, then interest on the opening principal and the principal over the term rounded up are added, and the last part stops at what is owed", () => {
    const game = start({ scenario: TUNDE, content });
    const entry = entryOf(SALARY_LOAN);
    const principal = 100000000;
    const loan = open(game, SALARY_LOAN, principal);
    const interest = bp(principal, entry.rateBp);
    const part = divCeil(principal, entry.term!);
    // Not a whole division, so the rounding up shows.
    expect(part * entry.term!).toBeGreaterThan(principal);
    expect(game.view().obligations.find((owed) => owed.id === loan.id)?.due).toBe(interest + part);

    let paid = 0;
    for (let month = 1; month < entry.term!; month += 1) {
      const result = game.endTurn();
      expect(ofType(result, "obligation/charged").filter((event) => event.id === loan.id)).toEqual([
        { type: "obligation/charged", id: loan.id, entry: SALARY_LOAN, total: interest + part, interest, principal: part },
      ]);
      paid += part;
      expect(item(game, loan.id)?.outstanding).toBe(principal - paid);
    }
    const left = principal - paid;
    expect(left).toBeLessThan(part);
    expect(game.view().obligations.find((owed) => owed.id === loan.id)?.due).toBe(interest + left);
    const last = game.endTurn();
    expect(ofType(last, "obligation/charged").filter((event) => event.id === loan.id)).toEqual([
      { type: "obligation/charged", id: loan.id, entry: SALARY_LOAN, total: interest + left, interest, principal: left },
    ]);
  });

  test("[R-OBLIGATION-001] given two obligations and money for only the older one, when the month ends, then the older is charged first and paid", () => {
    const game = start({ scenario: ADA, content });
    const upkeep = upkeepOf(game);
    const support = open(game, SUPPORT, undefined, 6000000);
    expect(support.amount).toBeLessThan(upkeep.amount);
    setNaira(game, upkeep.amount);
    const result = game.endTurn();
    const owned = own(result).filter((event) => event.type === "obligation/charged" || event.type === "obligation/missed");
    expect(owned.map((event) => [event.type, event.id])).toEqual([
      ["obligation/charged", upkeep.id],
      ["obligation/missed", support.id],
    ]);
  });
});

describe("paid in full or missed", () => {
  test("[R-OBLIGATION-002] given exactly the charge, when the month ends, then it is paid; one kobo less and what is held goes toward it, the shortfall the miss", () => {
    const exact = start({ scenario: ADA, content });
    setNaira(exact, ADA_UPKEEP);
    expect(ofType(exact.endTurn(), "obligation/charged")).toHaveLength(1);
    expect(exact.state.wallet.pockets.NGN.bank).toBe(0);

    // One kobo less: the upkeep takes what is held and the shortfall is the miss (decision 0015).
    const short = start({ scenario: ADA, content });
    setNaira(short, ADA_UPKEEP - 1);
    const result = short.endTurn();
    expect(ofType(result, "obligation/charged")).toEqual([]);
    expect(ofType(result, "obligation/missed")).toMatchObject([{ paid: ADA_UPKEEP - 1, total: ADA_UPKEEP }]);
    expect(debits(result)).toMatchObject([{ currency: "NGN", amount: ADA_UPKEEP - 1, reason: "upkeep" }]);
    expect(short.state.wallet.pockets.NGN.bank).toBe(0);
    expect(result.lines.find((line) => line.key === "line.obligation.missed-part")).toMatchObject({ tone: "bad", attention: true });
  });

  test("[R-OBLIGATION-002] [R-WALLET-018] given cash and bank, when a loan is charged, then naira is taken as the street pays by its size, each charge over the line for cash the bank first then cash, the principal part under its sink and interest under its interest sink", () => {
    const game = start({ scenario: ADA, content });
    const entry = entryOf(SALARY_LOAN);
    const principal = 100000000;
    const loan = open(game, SALARY_LOAN, principal);
    const part = divCeil(principal, entry.term!);
    const interest = bp(principal, entry.rateBp);
    // Enough in the bank for the upkeep and most of the loan's principal part; each charge is over the line for cash.
    for (const charge of [ADA_UPKEEP, part, interest]) expect(charge).toBeGreaterThan(content.tuning.wallet.cashUpTo);
    const bank = ADA_UPKEEP + part - 333334;
    setNaira(game, bank, 50000000);
    const result = game.endTurn();
    expect(debits(result)).toEqual([
      { type: "wallet/debited", currency: "NGN", pocket: "bank", amount: ADA_UPKEEP, reason: "upkeep" },
      { type: "wallet/debited", currency: "NGN", pocket: "bank", amount: part - 333334, reason: entry.sink },
      { type: "wallet/debited", currency: "NGN", pocket: "cash", amount: 333334, reason: entry.sink },
      { type: "wallet/debited", currency: "NGN", pocket: "cash", amount: interest, reason: entry.interestSink },
    ]);
    expect(entry.sink).toBe("loan-repay");
    expect(entry.interestSink).toBe("loan-interest");
    expect(item(game, loan.id)).toMatchObject({ outstanding: principal - part, monthsLeft: entry.term! - 1, missed: 0 });
  });

  test("[R-OBLIGATION-002] [R-OBLIGATION-009] given a loan whose last part is paid, when the month ends, then it closes and is removed", () => {
    const game = start({ scenario: TUNDE, content });
    const principal = 5000000;
    const loan = open(game, QUICK_LOAN, principal);
    const result = game.endTurn();
    expect(ofType(result, "obligation/charged").find((event) => event.id === loan.id)?.principal).toBe(principal);
    expect(ofType(result, "obligation/closed")).toEqual([{ type: "obligation/closed", id: loan.id, entry: QUICK_LOAN, why: "paid" }]);
    expect(item(game, loan.id)).toBeUndefined();
    expect(game.view().obligations.map((owed) => owed.id)).not.toContain(loan.id);
  });
});

describe("misses", () => {
  test("[R-OBLIGATION-003] given no money, when upkeep is missed, then its onMiss effects apply and the misses count up; a paid month puts them back to zero", () => {
    const game = start({ scenario: ADA, content });
    const upkeep = upkeepOf(game);
    setNaira(game, 0);
    const first = game.endTurn();
    expect(ofType(first, "obligation/missed")).toEqual([{ type: "obligation/missed", id: upkeep.id, entry: UPKEEP, total: ADA_UPKEEP, missed: 1 }]);
    expect(qualityChanges(first, UPKEEP).map((event) => [event.quality, event.amount])).toEqual([
      [STANDING, -3],
      [WELLBEING, -5],
    ]);
    game.endTurn();
    expect(item(game, upkeep.id)?.missed).toBe(2);
    setNaira(game, ADA_UPKEEP);
    game.endTurn();
    expect(item(game, upkeep.id)?.missed).toBe(0);
  });

  test("[R-OBLIGATION-004] given upkeep and support missed month after month, when the months pass, then neither defaults and no arrears build up", () => {
    const game = start({ scenario: ADA, content });
    const upkeep = upkeepOf(game);
    const support = open(game, SUPPORT, undefined, 6000000);
    setNaira(game, 0);
    for (let month = 1; month <= 4; month += 1) {
      const result = game.endTurn();
      expect(ofType(result, "obligation/defaulted")).toEqual([]);
      expect(qualityChanges(result, SUPPORT).map((event) => event.amount)).toEqual([-6]);
      for (const owed of [upkeep, support]) {
        expect(item(game, owed.id)).toMatchObject({ state: "active", missed: month, amount: owed.amount, outstanding: 0 });
      }
    }
    const view = game.view().obligations;
    expect(view.find((owed) => owed.id === upkeep.id)?.due).toBe(ADA_UPKEEP);
    expect(view.find((owed) => owed.id === support.id)?.due).toBe(6000000);
    setNaira(game, ADA_UPKEEP + 6000000);
    const paid = game.endTurn();
    expect(ofType(paid, "obligation/charged").map((event) => event.total)).toEqual([ADA_UPKEEP, 6000000]);
  });
});

describe("default", () => {
  test("[R-OBLIGATION-005] given a loan with grace 1, when one charge is missed it is in grace; when the second is missed it defaults once, and onDefault applies once", () => {
    const game = start({ scenario: ADA, content });
    const entry = entryOf(SALARY_LOAN);
    expect(entry.grace).toBe(1);
    const loan = open(game, SALARY_LOAN, 10000000);
    setNaira(game, 0);
    const first = game.endTurn();
    expect(ofType(first, "obligation/defaulted")).toEqual([]);
    expect(item(game, loan.id)).toMatchObject({ state: "grace", missed: 1 });
    expect(qualityChanges(first, SALARY_LOAN).map((event) => [event.quality, event.amount])).toEqual([[STANDING, -4]]);

    const credit = game.state.quality[CREDIT]!;
    const second = game.endTurn();
    expect(ofType(second, "obligation/defaulted")).toEqual([{ type: "obligation/defaulted", id: loan.id, entry: SALARY_LOAN, outstanding: 10000000 }]);
    expect(item(game, loan.id)).toMatchObject({ state: "defaulted", missed: 2 });
    expect(qualityChanges(second, SALARY_LOAN).map((event) => [event.quality, event.amount])).toEqual([
      [STANDING, -4],
      [STANDING, -15],
      [CREDIT, 1],
    ]);
    expect(game.state.quality[CREDIT]).toBe(credit + 1);

    const third = game.endTurn();
    expect(ofType(third, "obligation/defaulted")).toEqual([]);
    expect(ofType(third, "obligation/missed").filter((event) => event.id === loan.id)).toEqual([]);
    expect(qualityChanges(third, SALARY_LOAN)).toEqual([]);
  });

  test("[R-OBLIGATION-005] [R-OBLIGATION-003] given a loan with grace 1, when a charge is missed, the next paid, and the next missed, then the paid month puts the count back to zero and the loan never defaults", () => {
    const game = start({ scenario: ADA, content });
    expect(entryOf(SALARY_LOAN).grace).toBe(1);
    const loan = open(game, SALARY_LOAN, 10000000);
    setNaira(game, 0);
    game.endTurn();
    expect(item(game, loan.id)).toMatchObject({ state: "grace", missed: 1 });

    setNaira(game, 50000000);
    const paid = game.endTurn();
    expect(ofType(paid, "obligation/charged").filter((event) => event.id === loan.id)).toHaveLength(1);
    expect(item(game, loan.id)).toMatchObject({ state: "active", missed: 0 });

    setNaira(game, 0);
    const missed = game.endTurn();
    expect(ofType(missed, "obligation/missed").filter((event) => event.id === loan.id)).toHaveLength(1);
    expect(ofType(missed, "obligation/defaulted")).toEqual([]);
    expect(item(game, loan.id)).toMatchObject({ state: "grace", missed: 1 });
  });

  test("[R-OBLIGATION-005] given a defaulted loan, when months pass, then the lender takes whatever is in the naira bank up to what is owed, never cash, until nothing is owed", () => {
    const game = start({ scenario: ADA, content });
    const principal = 10000000;
    const loan = open(game, SALARY_LOAN, principal);
    setNaira(game, 0);
    game.endTurn();
    game.endTurn();
    expect(item(game, loan.id)?.state).toBe("defaulted");
    expect(game.view().obligations.find((owed) => owed.id === loan.id)?.due).toBe(principal);

    // Too little for the upkeep: it is charged first (R-OBLIGATION-001) and takes every naira held (decision 0015), so
    // the lender finds nothing this month and what is owed stands.
    setNaira(game, 3000000, 5000000);
    const partly = game.endTurn();
    expect(ofType(partly, "obligation/missed")).toMatchObject([{ entry: UPKEEP, paid: 8000000 }]);
    expect(ofType(partly, "obligation/seized")).toEqual([]);
    expect(game.state.wallet.pockets.NGN).toMatchObject({ bank: 0, cash: 0 });
    expect(item(game, loan.id)?.outstanding).toBe(principal);

    setNaira(game, ADA_UPKEEP + 50000000, 0);
    const rest = game.endTurn();
    expect(ofType(rest, "obligation/seized")).toEqual([{ type: "obligation/seized", id: loan.id, entry: SALARY_LOAN, amount: principal }]);
    expect(ofType(rest, "obligation/closed")).toEqual([{ type: "obligation/closed", id: loan.id, entry: SALARY_LOAN, why: "paid" }]);
    expect(item(game, loan.id)).toBeUndefined();
    expect(game.state.wallet.pockets.NGN.bank).toBe(50000000 - principal);
  });
});

describe("opening", () => {
  test("[R-OBLIGATION-006] given the effect, when a loan opens, then its principal is credited to the naira bank as a flagged loan", () => {
    const game = start({ scenario: ADA, content });
    game.endTurn();
    const bank = game.state.wallet.pockets.NGN.bank;
    const result = apply(game, [{ type: "obligation/open", obligation: SALARY_LOAN, principal: { term: "amount" } }], { amount: 25000000 });
    const loan = ofType(result, "obligation/opened")[0]!.item;
    expect(loan).toEqual({
      id: loan.id,
      entry: SALARY_LOAN,
      state: "active",
      openedMonth: 1,
      amount: entryOf(SALARY_LOAN).amount,
      principal: 25000000,
      outstanding: 25000000,
      monthsLeft: entryOf(SALARY_LOAN).term,
      missed: 0,
      bond: null,
      charged: 0,
    });
    expect(game.state.wallet.pockets.NGN.bank).toBe(bank + 25000000);
    expect(result.events).toContainEqual({ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: 25000000, reason: "loan" });
    expect(game.state.wallet.lots).toContainEqual({ currency: "NGN", amount: 25000000, month: 1, reason: "loan" });
  });

  test("[R-OBLIGATION-006] given the effect, when held funds open, then the principal is credited to the locked pocket as flagged held funds", () => {
    const game = start({ scenario: ADA, content });
    const { bank, cash } = game.state.wallet.pockets.NGN;
    const held = open(game, HELD, 200000000);
    expect(held).toMatchObject({ principal: 200000000, outstanding: 200000000, monthsLeft: null, state: "active" });
    expect(game.state.wallet.pockets.NGN).toEqual({ bank, cash, locked: 200000000 });
    expect(game.state.wallet.lots).toContainEqual({ currency: "NGN", amount: 200000000, month: 0, reason: "held-funds" });
  });

  test("[R-OBLIGATION-006] given an amount on the effect, when support opens, then it overrides the entry's fixed charge", () => {
    const game = start({ scenario: ADA, content });
    expect(entryOf(SUPPORT).amount).toBe(0);
    expect(open(game, SUPPORT, undefined, 4500000)).toMatchObject({ amount: 4500000, principal: 0, outstanding: 0 });
  });
});

describe("held funds", () => {
  test("[R-OBLIGATION-007] given held funds, when the interest is paid, then it is taken under its interest sink and the principal stays locked", () => {
    const game = start({ scenario: ADA, content });
    const principal = 200000000;
    const held = open(game, HELD, principal);
    const interest = bp(principal, entryOf(HELD).rateBp);
    expect(game.view().obligations.find((owed) => owed.id === held.id)?.due).toBe(interest);
    setNaira(game, ADA_UPKEEP + interest);
    const result = game.endTurn();
    expect(debits(result)).toContainEqual({ type: "wallet/debited", currency: "NGN", pocket: "bank", amount: interest, reason: "held-funds-interest" });
    expect(game.state.wallet.pockets.NGN.locked).toBe(principal);
    expect(item(game, held.id)).toMatchObject({ outstanding: principal, missed: 0 });
  });

  test("[R-OBLIGATION-007] given held funds, when a month's interest is missed, then the lender takes the locked principal back at once, it closes and onMiss applies", () => {
    const game = start({ scenario: ADA, content });
    const principal = 200000000;
    const held = open(game, HELD, principal);
    setNaira(game, 1000000);
    const result = game.endTurn();
    expect(ofType(result, "obligation/taken-back")).toEqual([{ type: "obligation/taken-back", id: held.id, entry: HELD, amount: principal }]);
    expect(debits(result)).toContainEqual({ type: "wallet/debited", currency: "NGN", pocket: "locked", amount: principal, reason: "held-funds-return" });
    expect(qualityChanges(result, HELD).map((event) => [event.quality, event.amount])).toEqual([[STANDING, -5]]);
    // The upkeep, short, took the bank's naira first (decision 0015).
    expect(game.state.wallet.pockets.NGN).toMatchObject({ locked: 0, bank: 0 });
    expect(item(game, held.id)).toBeUndefined();
    const line = result.lines.find((entry) => entry.key === "line.obligation.taken-back");
    expect(line).toMatchObject({ tone: "bad", attention: true });
  });
});

describe("paying early", () => {
  test("[R-OBLIGATION-008] [R-WALLET-018] given a loan, when any whole amount up to what is owed is paid, then it is taken under loan-repay as the street pays by its size, a sum over the line for cash the bank first then cash, and the outstanding falls", () => {
    const game = start({ scenario: ADA, content });
    const loan = open(game, SALARY_LOAN, 10000000);
    setNaira(game, 1000000, 20000000);
    expect(1500000).toBeGreaterThan(content.tuning.wallet.cashUpTo);
    const result = game.accept({ type: "obligation/pay", obligation: loan.id, amount: 1500000 });
    expect(debits(result)).toEqual([
      { type: "wallet/debited", currency: "NGN", pocket: "bank", amount: 1000000, reason: "loan-repay" },
      { type: "wallet/debited", currency: "NGN", pocket: "cash", amount: 500000, reason: "loan-repay" },
    ]);
    expect(item(game, loan.id)?.outstanding).toBe(8500000);
  });

  test("[R-OBLIGATION-008] [R-OBLIGATION-009] given a loan, when exactly what is owed is paid, then it closes and is removed; one kobo more is a bad amount", () => {
    const game = start({ scenario: ADA, content });
    const loan = open(game, SALARY_LOAN, 10000000);
    game.expectRejected({ type: "obligation/pay", obligation: loan.id, amount: 10000001 }, "bad-amount");
    const result = game.accept({ type: "obligation/pay", obligation: loan.id, amount: 10000000 });
    expect(ofType(result, "obligation/closed")).toEqual([{ type: "obligation/closed", id: loan.id, entry: SALARY_LOAN, why: "paid" }]);
    expect(item(game, loan.id)).toBeUndefined();
    expect(result.lines.find((line) => line.key === "line.obligation.closed")).toMatchObject({ tone: "good" });
  });

  test("[R-OBLIGATION-008] given a loan, when the amount is zero, a fraction or more than can be paid, then it is rejected", () => {
    const game = start({ scenario: ADA, content });
    const loan = open(game, SALARY_LOAN, 10000000);
    expect(game.expectRejected({ type: "obligation/pay", obligation: loan.id, amount: 0 }, "bad-amount").code).toBe("bad-amount");
    expect(game.expectRejected({ type: "obligation/pay", obligation: loan.id, amount: Number("2.5") }, "bad-amount").code).toBe("bad-amount");
    setNaira(game, 999999, 0);
    game.expectRejected({ type: "obligation/pay", obligation: loan.id, amount: 1000000 }, "cannot-afford");
    game.accept({ type: "obligation/pay", obligation: loan.id, amount: 999999 });
  });

  test("[R-OBLIGATION-008] given held funds, when the whole principal is paid, then the locked money goes back and it closes; part of it is a bad amount", () => {
    const game = start({ scenario: ADA, content });
    const held = open(game, HELD, 200000000);
    const { bank, cash } = game.state.wallet.pockets.NGN;
    game.expectRejected({ type: "obligation/pay", obligation: held.id, amount: 199999999 }, "bad-amount");
    const result = game.accept({ type: "obligation/pay", obligation: held.id, amount: 200000000 });
    expect(debits(result)).toEqual([{ type: "wallet/debited", currency: "NGN", pocket: "locked", amount: 200000000, reason: "held-funds-return" }]);
    expect(game.state.wallet.pockets.NGN).toEqual({ bank, cash, locked: 0 });
    expect(ofType(result, "obligation/closed")).toEqual([{ type: "obligation/closed", id: held.id, entry: HELD, why: "returned" }]);
    expect(item(game, held.id)).toBeUndefined();
  });

  test("[R-OBLIGATION-008] given upkeep or an unknown id, when paid, then it is rejected with not-legal or unknown-id", () => {
    const game = start({ scenario: ADA, content });
    expect(game.expectRejected({ type: "obligation/pay", obligation: upkeepOf(game).id, amount: 100 }, "not-legal").code).toBe("not-legal");
    expect(game.expectRejected({ type: "obligation/pay", obligation: "obligation-999", amount: 100 }, "unknown-id").code).toBe("unknown-id");
  });
});

describe("closing", () => {
  test("[R-OBLIGATION-009] given obligations that close, when they close, then none is left in the state or the view and the invariants hold", () => {
    const game = start({ scenario: TUNDE, content });
    const loan = open(game, QUICK_LOAN, 5000000);
    const held = open(game, HELD, 200000000);
    game.accept({ type: "obligation/pay", obligation: held.id, amount: 200000000 });
    game.endTurn();
    expect(Object.keys(game.state.obligation.items)).toEqual([upkeepOf(game).id]);
    expect(game.view().obligations.map((owed) => owed.id)).toEqual([upkeepOf(game).id]);
    expect(loan.id in game.state.obligation.items).toBe(false);
    expect(checkInvariants(game.state, content)).toEqual([]);
  });
});

describe("lines and the view", () => {
  test("[R-OBLIGATION-003] [R-OBLIGATION-005] given each kind of line, when it is shown, then it has words, and misses and defaults call for attention", () => {
    const keys = ["charged", "missed", "defaulted", "seized", "closed", "taken-back"].map((what) => `line.obligation.${what}`);
    expect(keys.filter((key) => (text[key] ?? "").trim() === "")).toEqual([]);
    const game = start({ scenario: ADA, content });
    open(game, SALARY_LOAN, 10000000);
    setNaira(game, 0);
    game.endTurn();
    const result = game.endTurn();
    expect(result.lines.find((line) => line.key === "line.obligation.missed")).toMatchObject({ tone: "bad", attention: true });
    expect(result.lines.find((line) => line.key === "line.obligation.defaulted")).toMatchObject({ tone: "bad", attention: true });
    setNaira(game, ADA_UPKEEP);
    const quiet = game.endTurn();
    expect(quiet.lines.find((line) => line.key === "line.obligation.charged")).toMatchObject({ tone: "plain", attention: false });
  });

  test("[R-OBLIGATION-001] given open obligations, when the view is read, then each shows its fields and what this month's charge would be", () => {
    const game = start({ scenario: ADA, content });
    const loan = open(game, SALARY_LOAN, 12000000);
    const view = game.view().obligations;
    expect(view).toEqual([
      { ...upkeepOf(game), due: ADA_UPKEEP, car: null },
      { ...loan, car: null, due: bp(12000000, entryOf(SALARY_LOAN).rateBp) + 1000000 },
    ]);
  });
});

describe("random play", () => {
  test.prop([fc.constantFrom<Id<"scenario">>("scenario.ada", "scenario.tunde", "scenario.zainab"), fc.string({ minLength: 1, maxLength: 6 }), fc.array(fc.nat(), { minLength: 40, maxLength: 40 })], {
    numRuns: 20,
  })("[R-OBLIGATION-008] given random legal commands with a loan and held funds open, when played, then every one is accepted and the invariants hold", (scenario, seed, picks) => {
    const game = start({ scenario, seed, content });
    open(game, SALARY_LOAN, 30000000);
    open(game, HELD, 200000000);
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
    }
  });

  test("[R-OBLIGATION-008] given a loan and held funds, when the legal list is read, then it offers to pay each and every offer is accepted", () => {
    const game = start({ scenario: TUNDE, content });
    open(game, SALARY_LOAN, 30000000);
    open(game, HELD, 200000000);
    const pays = legalCommands(game.view()).filter((command) => command.type === "obligation/pay");
    expect(pays.length).toBeGreaterThanOrEqual(3);
    for (const command of pays) {
      const copy = start({ scenario: TUNDE, content });
      copy.state = game.state;
      copy.accept(command);
    }
  });
});

// ---------------------------------------------------------------------------
// The group loan: R-OBLIGATION-010 to 013. The savings circle: R-LUCK-009.
// ---------------------------------------------------------------------------

const GROUP_LOAN: Id<"obligation"> = "obligation.group-loan";
const GUARANTEE: Id<"obligation"> = "obligation.guarantee";
const AJO: Id<"obligation"> = "obligation.ajo";
const NETWORK: Id<"quality"> = "quality.network";
const TECH: Id<"quality"> = "quality.tech";
const PORTFOLIO: Id<"quality"> = "quality.portfolio";
const GROUP = content.tuning.groupLoan;
/** ₦100,000, the page's example: ₦25,000 in fees and savings. */
const HUNDRED_THOUSAND = 10000000;

/** Opens an offer through its own `when`, as the offer kind would, and returns its instance id, or null when it does not open. */
function offerOf(game: Game, offer: Id<"offer">): string | null {
  apply(game, [{ type: "offer/open", offer }]);
  return Object.values(game.state.offer.items).find((open) => open.entry === offer)?.id ?? null;
}

function choose(game: Game, offer: Id<"offer">, choice: string, amount?: number): Accepted {
  const id = offerOf(game, offer);
  if (id === null) throw new Error(`${offer} did not open.`);
  return game.accept(amount === undefined ? { type: "offer/choose", offer: id, choice } : { type: "offer/choose", offer: id, choice, amount });
}

/** Ends a month, granting turns when the bank is empty. */
function month(game: Game): Accepted {
  if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
  return game.endTurn();
}

function groupLoanOf(game: Game): ObligationState {
  const found = Object.values(game.state.obligation.items).find((owed) => owed.entry === GROUP_LOAN);
  if (found === undefined) throw new Error("No group loan is open.");
  return found;
}

function credits(result: { events: BaseEvent[] }) {
  return result.events.filter((event) => event.type === "wallet/credited");
}

describe("the group loan", () => {
  test("[R-OBLIGATION-010] given ₦100,000 taken through the offer, when it opens, then ₦90,000 is credited as a flagged loan, the 15% fee is paid and 10% is held as savings", () => {
    const game = start({ scenario: TUNDE, content });
    const result = choose(game, "offer.group-loan", "take", HUNDRED_THOUSAND);
    const fee = bp(HUNDRED_THOUSAND, GROUP.feeBp);
    const savings = bp(HUNDRED_THOUSAND, GROUP.savingsBp);
    expect([fee, savings]).toEqual([1500000, 1000000]);
    expect(credits(result)).toEqual([{ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: HUNDRED_THOUSAND - savings, reason: "loan" }]);
    // Flagged: a visa officer would ask where it came from.
    expect(game.state.wallet.lots).toContainEqual({ currency: "NGN", amount: HUNDRED_THOUSAND - savings, month: 0, reason: "loan" });
    expect(debits(result)).toEqual([{ type: "wallet/debited", currency: "NGN", pocket: "bank", amount: fee, reason: "fee-agent" }]);
    expect(groupLoanOf(game)).toMatchObject({ principal: HUNDRED_THOUSAND, outstanding: HUNDRED_THOUSAND, amount: savings, monthsLeft: 9, state: "active" });
  });

  test("[R-OBLIGATION-010] given the offer's range, when an amount is picked, then ₦50,000 and ₦300,000 are taken and a kobo outside either is a bad amount", () => {
    for (const amount of [5000000, 30000000]) {
      const game = start({ scenario: TUNDE, content });
      choose(game, "offer.group-loan", "take", amount);
      expect(groupLoanOf(game).principal).toBe(amount);
    }
    for (const amount of [4999999, 30000001]) {
      const game = start({ scenario: TUNDE, content });
      const id = offerOf(game, "offer.group-loan")!;
      expect(game.expectRejected({ type: "offer/choose", offer: id, choice: "take", amount }, "bad-amount").code).toBe("bad-amount");
    }
  });

  test("[R-OBLIGATION-010] given a group loan repaid month by month, when the ninth charge is paid, then it closes and the savings held back come back to the bank", () => {
    const game = start({ scenario: TUNDE, content });
    const loan = open(game, GROUP_LOAN, HUNDRED_THOUSAND);
    const entry = entryOf(GROUP_LOAN);
    const part = divCeil(HUNDRED_THOUSAND, entry.term!);
    const interest = bp(HUNDRED_THOUSAND, entry.rateBp);
    expect([part, interest]).toEqual([1111112, 170000]);
    for (let paid = 1; paid < entry.term!; paid += 1) {
      setNaira(game, 100000000);
      const result = month(game);
      expect(ofType(result, "obligation/charged").filter((event) => event.id === loan.id)).toEqual([
        { type: "obligation/charged", id: loan.id, entry: GROUP_LOAN, total: part + interest, interest, principal: part },
      ]);
    }
    setNaira(game, 100000000);
    const last = month(game);
    expect(item(game, loan.id)).toBeUndefined();
    expect(ofType(last, "obligation/closed")).toEqual([{ type: "obligation/closed", id: loan.id, entry: GROUP_LOAN, why: "paid" }]);
    expect(credits(last)).toContainEqual({ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: bp(HUNDRED_THOUSAND, GROUP.savingsBp), reason: "deposit-return" });
  });

  test("[R-OBLIGATION-011] given a group loan missed three months in a row, when each month ends, then the group covers the first, visits on the second, and on the third it defaults and the laptop is seized", () => {
    const game = start({ scenario: ADA, content });
    apply(game, [{ type: "quality/add", quality: PORTFOLIO, amount: 2 }]);
    const loan = open(game, GROUP_LOAN, HUNDRED_THOUSAND);
    const part = divCeil(HUNDRED_THOUSAND, 9);
    const total = part + bp(HUNDRED_THOUSAND, 170);
    setNaira(game, 0);

    const first = month(game);
    expect(ofType(first, "obligation/covered")).toEqual([{ type: "obligation/covered", id: loan.id, entry: GROUP_LOAN, total, principal: part, missed: 1 }]);
    expect(item(game, loan.id)).toMatchObject({ state: "grace", missed: 1, outstanding: HUNDRED_THOUSAND - part + total, monthsLeft: 8 });
    expect(qualityChanges(first, GROUP_LOAN).map((event) => [event.quality, event.amount])).toEqual([[STANDING, -5]]);
    expect(first.lines.find((line) => line.key === "line.obligation.group-covered")).toMatchObject({ params: { obligation: GROUP_LOAN, amount: { currency: "NGN", amount: total } }, tone: "bad" });

    const second = month(game);
    expect(item(game, loan.id)).toMatchObject({ state: "grace", missed: 2 });
    expect(qualityChanges(second, GROUP_LOAN).map((event) => [event.quality, event.amount])).toEqual([
      [STANDING, -12],
      [WELLBEING, -5],
    ]);
    expect(second.lines.find((line) => line.key === "line.obligation.group-visit")).toMatchObject({ tone: "bad", attention: true });

    const credit = game.state.quality[CREDIT]!;
    const third = month(game);
    expect(item(game, loan.id)).toMatchObject({ state: "defaulted", missed: 3 });
    expect(qualityChanges(third, GROUP_LOAN).map((event) => [event.quality, event.amount])).toEqual([
      [STANDING, -15],
      [CREDIT, 1],
      [TECH, -10],
      [PORTFOLIO, -1],
    ]);
    expect(game.state.quality[CREDIT]).toBe(credit + 1);
    expect(third.lines.find((line) => line.key === "line.obligation.group-default")).toMatchObject({ tone: "bad", attention: true });

    // From then on the lender takes from the bank, as any defaulted loan (the upkeep, charged first, is paid in full here).
    setNaira(game, ADA_UPKEEP + 5000000);
    const taken = month(game);
    expect(ofType(taken, "obligation/seized")).toEqual([{ type: "obligation/seized", id: loan.id, entry: GROUP_LOAN, amount: 5000000 }]);
    // The credit mark now keeps every group loan closed.
    expect(offerOf(game, "offer.group-loan")).toBeNull();
    expect(checkInvariants(game.state, content)).toEqual([]);
  });
});

describe("how the group loan reaches you", () => {
  test("[R-OBLIGATION-012] given network one short of 20, and then at 20, when the group loan offer is opened, then it opens only from 20; standing 39 and a credit mark keep it shut", () => {
    const ada = start({ scenario: ADA, content });
    const network = ada.state.quality[NETWORK]!;
    expect(network).toBeLessThan(20);
    apply(ada, [{ type: "quality/add", quality: NETWORK, amount: 19 - network }]);
    expect(ada.state.quality[NETWORK]).toBe(19);
    expect(offerOf(ada, "offer.group-loan")).toBeNull();
    apply(ada, [{ type: "quality/add", quality: NETWORK, amount: 1 }]);
    expect(offerOf(ada, "offer.group-loan")).not.toBeNull();

    const low = start({ scenario: TUNDE, content });
    apply(low, [{ type: "quality/add", quality: STANDING, amount: 39 - low.state.quality[STANDING]! }]);
    expect(low.state.quality[STANDING]).toBe(39);
    expect(offerOf(low, "offer.group-loan")).toBeNull();
    apply(low, [{ type: "quality/add", quality: STANDING, amount: 1 }]);
    expect(offerOf(low, "offer.group-loan")).not.toBeNull();

    const marked = start({ scenario: TUNDE, content });
    apply(marked, [{ type: "quality/add", quality: CREDIT, amount: 1 }]);
    expect(offerOf(marked, "offer.group-loan")).toBeNull();
  });

  test("[R-OBLIGATION-012] given the group at the door over a parent's shop loan, when it is paid, ₦120,000 goes as family money; refused or left, standing falls 15", () => {
    const paid = start({ scenario: TUNDE, content });
    const result = choose(paid, "offer.parents-group-debt", "pay");
    const taken = debits(result) as (BaseEvent & { amount: number; reason: string })[];
    expect(taken.every((event) => event.reason === "family")).toBe(true);
    expect(taken.reduce((sum, event) => sum + event.amount, 0)).toBe(12000000);

    const refused = start({ scenario: TUNDE, content });
    const no = choose(refused, "offer.parents-group-debt", "no");
    expect(no.events.filter((event) => event.type === "quality/changed").map((event) => (event as unknown as { amount: number }).amount)).toEqual([-15]);
    expect(entryOf(GROUP_LOAN).type).toBe("group-loan");
    expect(content.offer["offer.parents-group-debt"]?.onExpire).toBe("no");
  });

  test("[R-OBLIGATION-012] given a relative's guarantee accepted, when three months pass and the relative is gone, then the group loan opens on you for the balance, with nothing lent and no savings held", () => {
    const always = { ...content, tuning: { ...content.tuning, groupLoan: { ...GROUP, vanishBp: 10000 } } };
    const game = start({ scenario: TUNDE, content: always });
    const accepted = choose(game, "offer.stand-guarantor", "accept");
    expect(accepted.events.filter((event) => event.type === "quality/changed").map((event) => (event as unknown as { amount: number }).amount)).toEqual([4]);
    const guarantee = Object.values(game.state.obligation.items).find((owed) => owed.entry === GUARANTEE)!;
    const balance = guarantee.principal;
    expect(balance).toBeGreaterThanOrEqual(10000000);
    month(game);
    month(game);
    expect(Object.values(game.state.obligation.items).some((owed) => owed.entry === GROUP_LOAN)).toBe(false);
    const called = month(game);
    expect(groupLoanOf(game)).toMatchObject({ principal: balance, outstanding: balance, amount: 0 });
    expect(item(game, guarantee.id)).toBeUndefined();
    expect(credits(called).filter((event) => (event as unknown as { reason: string }).reason === "loan")).toEqual([]);
    expect(called.lines.find((line) => line.key === "line.obligation.guarantee-called")).toMatchObject({ params: { obligation: GUARANTEE, amount: { currency: "NGN", amount: balance } } });
  });

  test("[R-OBLIGATION-012] given a guarantee accepted and the relative still there, when three months pass, then the guarantee ends and nothing is owed; refusing costs standing 4", () => {
    const never = { ...content, tuning: { ...content.tuning, groupLoan: { ...GROUP, vanishBp: 0 } } };
    const game = start({ scenario: TUNDE, content: never });
    choose(game, "offer.stand-guarantor", "accept");
    month(game);
    month(game);
    const ended = month(game);
    expect(Object.values(game.state.obligation.items).some((owed) => owed.entry === GUARANTEE || owed.entry === GROUP_LOAN)).toBe(false);
    expect(ended.lines.find((line) => line.key === "line.obligation.ended")).toBeDefined();
    const refused = start({ scenario: TUNDE, content });
    const no = choose(refused, "offer.stand-guarantor", "refuse");
    expect(no.events.filter((event) => event.type === "quality/changed").map((event) => (event as unknown as { amount: number }).amount)).toEqual([-4]);
  });
});

describe("the way out", () => {
  test("[R-OBLIGATION-013] given a group loan the group has covered, when it is paid ahead whole, then it closes and the savings come back", () => {
    const game = start({ scenario: ADA, content });
    const loan = open(game, GROUP_LOAN, HUNDRED_THOUSAND);
    setNaira(game, 0);
    month(game);
    const owed = item(game, loan.id)!.outstanding;
    setNaira(game, owed);
    const paid = game.accept({ type: "obligation/pay", obligation: loan.id, amount: owed });
    expect(item(game, loan.id)).toBeUndefined();
    expect(credits(paid)).toContainEqual({ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: bp(HUNDRED_THOUSAND, GROUP.savingsBp), reason: "deposit-return" });
  });

  test("[R-OBLIGATION-013] given a group loan in default, when what is owed is paid ahead, then it closes; the savings are lost with the default", () => {
    const game = start({ scenario: ADA, content });
    const loan = open(game, GROUP_LOAN, HUNDRED_THOUSAND);
    setNaira(game, 0);
    month(game);
    month(game);
    month(game);
    expect(item(game, loan.id)?.state).toBe("defaulted");
    const owed = item(game, loan.id)!.outstanding;
    setNaira(game, 0, owed);
    const paid = game.accept({ type: "obligation/pay", obligation: loan.id, amount: owed });
    expect(item(game, loan.id)).toBeUndefined();
    expect(credits(paid)).toEqual([]);
  });

  test("[R-OBLIGATION-013] given a group loan, when the legal list is read, then paying it ahead is offered and accepted", () => {
    const game = start({ scenario: TUNDE, content });
    const loan = open(game, GROUP_LOAN, HUNDRED_THOUSAND);
    const pays = legalCommands(game.view()).filter((command) => command.type === "obligation/pay" && command.obligation === loan.id);
    expect(pays.length).toBeGreaterThanOrEqual(1);
    for (const command of pays) {
      const copy = start({ scenario: TUNDE, content });
      copy.state = game.state;
      copy.accept(command);
    }
    const words = ["group-covered", "group-visit", "group-default", "guarantee-called"].map((what) => text[`line.obligation.${what}`] ?? "");
    expect(words.filter((said) => said.trim() === "")).toEqual([]);
  });
});

describe("the savings circle", () => {
  const POT = 20000000;

  function joined(seed: string): { game: Game; circle: ObligationState } {
    const game = start({ scenario: TUNDE, content, seed });
    choose(game, "offer.join-ajo", "join");
    const circle = Object.values(game.state.obligation.items).find((owed) => owed.entry === AJO);
    if (circle === undefined) throw new Error("The circle did not open.");
    return { game, circle };
  }

  test("[R-LUCK-009] given the offer at home with standing 40 and network 20, when it is taken, then the circle opens: ₦20,000 a month for 10 months with a pot of ₦200,000", () => {
    const { circle } = joined("seed-1");
    expect(circle).toMatchObject({ amount: 2000000, monthsLeft: 10, principal: POT, outstanding: POT });
    expect(entryOf(AJO)).toMatchObject({ rateBp: 0, term: 10, grace: 0 });
    const ada = start({ scenario: ADA, content });
    expect(offerOf(ada, "offer.join-ajo")).toBeNull();
  });

  test("[R-LUCK-009] given a seed whose first lotto draw in ten is 0, when the first month is paid, then the pot comes as a gift; a seed whose first is not waits", () => {
    const lucky = seedWhere((seed) => draw(seed, "lotto", 0, 10) === 0);
    const { game, circle } = joined(lucky);
    setNaira(game, 100000000);
    const first = month(game);
    expect(ofType(first, "obligation/pot-paid")).toEqual([{ type: "obligation/pot-paid", id: circle.id, entry: AJO, amount: POT }]);
    expect(credits(first)).toContainEqual({ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: POT, reason: "gift" });
    expect(first.lines.find((line) => line.key === "line.obligation.pot")).toMatchObject({ tone: "good", attention: true });

    const unlucky = seedWhere((seed) => draw(seed, "lotto", 0, 10) !== 0 && draw(seed, "lotto", 1, 9) === 0);
    const later = joined(unlucky);
    setNaira(later.game, 100000000);
    expect(ofType(month(later.game), "obligation/pot-paid")).toEqual([]);
    expect(ofType(month(later.game), "obligation/pot-paid")).toHaveLength(1);
  });

  test.prop([fc.string({ minLength: 1, maxLength: 8 })], { numRuns: 12 })(
    "[R-LUCK-009] given any seed, when all ten months are paid, then the pot comes exactly once, it equals what was paid in, and the circle ends",
    (seed) => {
      const { game, circle } = joined(seed);
      let pots = 0;
      let paidIn = 0;
      for (let count = 0; count < 10; count += 1) {
        setNaira(game, 100000000);
        const result = month(game);
        pots += ofType(result, "obligation/pot-paid").reduce((sum, event) => sum + event.amount, 0);
        paidIn += ofType(result, "obligation/charged").filter((event) => event.id === circle.id).reduce((sum, event) => sum + event.total, 0);
      }
      expect(pots).toBe(POT);
      expect(paidIn).toBe(POT);
      expect(item(game, circle.id)).toBeUndefined();
      expect(game.state.draws.lotto ?? 0).toBeLessThanOrEqual(10);
    },
  );

  test("[R-LUCK-009] given a circle, when a month's share is missed, then it closes with standing -6 and no pot", () => {
    const unlucky = seedWhere((seed) => draw(seed, "lotto", 0, 10) !== 0);
    // Ada has no pay coming in, so a month with nothing is a missed share.
    const game = start({ scenario: ADA, content, seed: unlucky });
    const circle = open(game, AJO);
    setNaira(game, 100000000);
    month(game);
    setNaira(game, 0);
    const missed = month(game);
    expect(item(game, circle.id)).toBeUndefined();
    expect(ofType(missed, "obligation/closed")).toEqual([{ type: "obligation/closed", id: circle.id, entry: AJO, why: "dropped" }]);
    expect(qualityChanges(missed, AJO).map((event) => [event.quality, event.amount])).toEqual([[STANDING, -6]]);
    expect(ofType(missed, "obligation/pot-paid")).toEqual([]);
    expect(missed.lines.find((line) => line.key === "line.obligation.dropped")).toMatchObject({ tone: "bad", attention: true });
  });
});
