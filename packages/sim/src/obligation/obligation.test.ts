import { fc, test } from "@fast-check/vitest";
import { content, text } from "@japacity/content";
import { describe, expect } from "vitest";

import { bp, divCeil } from "../engine/int";
import { checkInvariants } from "../engine/invariants";
import { stepWith } from "../engine/step";
import type { Accepted, BaseEvent, Ctx, Effect, Id, ObligationEntry, ObligationState, Terms } from "../engine/types";
import { registry } from "../kinds";
import { legalCommands } from "../testing/legal";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import type { ObligationEvent } from "./obligation.events";

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
 * Carries out effects through the engine. The route kind does not handle
 * `route/depart` yet, so a test registry gives it a handler that applies them.
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
  test("[R-OBLIGATION-002] given exactly the charge, when the month ends, then it is paid; one kobo less and nothing is taken", () => {
    const exact = start({ scenario: ADA, content });
    setNaira(exact, ADA_UPKEEP);
    expect(ofType(exact.endTurn(), "obligation/charged")).toHaveLength(1);
    expect(exact.state.wallet.pockets.NGN.bank).toBe(0);

    const short = start({ scenario: ADA, content });
    setNaira(short, ADA_UPKEEP - 1);
    const result = short.endTurn();
    expect(ofType(result, "obligation/charged")).toEqual([]);
    expect(ofType(result, "obligation/missed")).toHaveLength(1);
    expect(debits(result)).toEqual([]);
    expect(short.state.wallet.pockets.NGN.bank).toBe(ADA_UPKEEP - 1);
  });

  test("[R-OBLIGATION-002] given cash and bank, when a loan is charged, then naira is taken cash first then bank, the principal part under its sink and interest under its interest sink", () => {
    const game = start({ scenario: ADA, content });
    const entry = entryOf(SALARY_LOAN);
    const principal = 100000000;
    const loan = open(game, SALARY_LOAN, principal);
    const part = divCeil(principal, entry.term!);
    const interest = bp(principal, entry.rateBp);
    // Enough cash for the upkeep and most of the loan's principal part.
    const cash = ADA_UPKEEP + part - 333334;
    setNaira(game, 50000000, cash);
    const result = game.endTurn();
    expect(debits(result)).toEqual([
      { type: "wallet/debited", currency: "NGN", pocket: "cash", amount: ADA_UPKEEP, reason: "upkeep" },
      { type: "wallet/debited", currency: "NGN", pocket: "cash", amount: part - 333334, reason: entry.sink },
      { type: "wallet/debited", currency: "NGN", pocket: "bank", amount: 333334, reason: entry.sink },
      { type: "wallet/debited", currency: "NGN", pocket: "bank", amount: interest, reason: entry.interestSink },
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

    // Too little for the upkeep, so it is missed and the whole bank goes to the lender.
    setNaira(game, 3000000, 5000000);
    const partly = game.endTurn();
    expect(ofType(partly, "obligation/seized")).toEqual([{ type: "obligation/seized", id: loan.id, entry: SALARY_LOAN, amount: 3000000 }]);
    expect(debits(partly)).toEqual([{ type: "wallet/debited", currency: "NGN", pocket: "bank", amount: 3000000, reason: "loan-repay" }]);
    expect(game.state.wallet.pockets.NGN).toMatchObject({ bank: 0, cash: 5000000 });
    expect(item(game, loan.id)?.outstanding).toBe(principal - 3000000);

    setNaira(game, ADA_UPKEEP + 50000000, 0);
    const rest = game.endTurn();
    expect(ofType(rest, "obligation/seized")).toEqual([{ type: "obligation/seized", id: loan.id, entry: SALARY_LOAN, amount: principal - 3000000 }]);
    expect(ofType(rest, "obligation/closed")).toEqual([{ type: "obligation/closed", id: loan.id, entry: SALARY_LOAN, why: "paid" }]);
    expect(item(game, loan.id)).toBeUndefined();
    expect(game.state.wallet.pockets.NGN.bank).toBe(50000000 - (principal - 3000000));
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
    expect(game.state.wallet.pockets.NGN).toMatchObject({ locked: 0, bank: 1000000 });
    expect(item(game, held.id)).toBeUndefined();
    const line = result.lines.find((entry) => entry.key === "line.obligation.taken-back");
    expect(line).toMatchObject({ tone: "bad", attention: true });
  });
});

describe("paying early", () => {
  test("[R-OBLIGATION-008] given a loan, when any whole amount up to what is owed is paid, then it is taken cash first under loan-repay and the outstanding falls", () => {
    const game = start({ scenario: ADA, content });
    const loan = open(game, SALARY_LOAN, 10000000);
    setNaira(game, 20000000, 1000000);
    const result = game.accept({ type: "obligation/pay", obligation: loan.id, amount: 1500000 });
    expect(debits(result)).toEqual([
      { type: "wallet/debited", currency: "NGN", pocket: "cash", amount: 1000000, reason: "loan-repay" },
      { type: "wallet/debited", currency: "NGN", pocket: "bank", amount: 500000, reason: "loan-repay" },
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
      { ...upkeepOf(game), due: ADA_UPKEEP },
      { ...loan, due: bp(12000000, entryOf(SALARY_LOAN).rateBp) + 1000000 },
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
