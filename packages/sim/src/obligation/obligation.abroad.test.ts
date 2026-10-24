import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../engine/check";
import { bp, convertMinor, divCeil, divFloor, mulDiv } from "../engine/int";
import { checkInvariants } from "../engine/invariants";
import type { BaseEvent, Id, ObligationEntry, ObligationState, ReportLine } from "../engine/types";
import { playMonths } from "../testing/place.journey";
import { applyEffects } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { eventsOf, readOf } from "../testing/read";
import { carPaid, carTerms, carView } from "./obligation.logic";
import { abroad, closeTypes, isOpen, markBy, markOf, nextMonth, openOwed, owedOf, settledAbroad } from "../testing/obligation.journey";
import { setPockets } from "../testing/wallet";
import { AGENT_DEBT, CAR, OVERSTAYER, RENT_FLAT, RENT_ROOM, SHORTFALL, STANDING, STUDENT, TUITION, UK_PHONE, UK_ROUTE, UK_UPKEEP, WELLBEING } from "../testing/ids";
import { officialRates } from "../wallet/wallet.rates";

const CREDIT = content.tuning.credit;

function entryOf(id: Id<"obligation">): ObligationEntry {
  const entry = content.obligation[id];
  if (entry === undefined) throw new Error(`No ${id} in content.`);
  return entry;
}

function keysOf(lines: ReportLine[], prefix: string): string[] {
  return lines.map((line) => line.key).filter((key) => key.startsWith(prefix));
}

function hasCar(game: Game): boolean {
  return check(readOf(game), { type: "obligation/has", obligationType: "car" }).met;
}

// ---------------------------------------------------------------------------
// Rent and the phone: abroad-money:arrival-opens-upkeep-and-room, abroad-money:phone-contract-builds-credit
// ---------------------------------------------------------------------------

describe("rent", () => {
  test("[abroad-money:arrival-opens-upkeep-and-room] given a life arriving in the UK, when it lands, then the country's upkeep and a shared room open in pounds, and the room needs no credit", () => {
    const game = abroad(content);
    expect(owedOf(game, UK_UPKEEP)).toMatchObject({ amount: entryOf(UK_UPKEEP).amount, state: "active" });
    expect(owedOf(game, RENT_ROOM)).toMatchObject({ amount: entryOf(RENT_ROOM).amount, state: "active" });
    expect(entryOf(RENT_ROOM)).toMatchObject({ currency: "GBP", reportsToCredit: true });
    expect(entryOf(RENT_ROOM).creditMin).toBeUndefined();
    expect(markOf(game)).toBe(0);
  });

  test("[abroad-money:arrival-opens-upkeep-and-room] given a flat in your own name, when rent is missed twice, then each miss costs standing and wellbeing; the third evicts back to a room with the default figure on the file", () => {
    const game = settledAbroad(content);
    closeTypes(game, "rent", "upkeep");
    markBy(game, 60);
    const flat = openOwed(game, RENT_FLAT);
    setPockets(game, { GBP: 0 });
    const misses = entryOf(RENT_FLAT).onMiss;
    expect(misses).toEqual([
      { type: "quality/add", quality: STANDING, amount: -3 },
      { type: "quality/add", quality: WELLBEING, amount: -5 },
    ]);
    for (const missed of [1, 2]) {
      const result = nextMonth(game);
      expect(owedOf(game, RENT_FLAT)).toMatchObject({ id: flat.id, missed, state: "grace" });
      const fromRent = eventsOf(result, "quality/changed").filter((event) => event.source === RENT_FLAT);
      expect(fromRent.map((event) => [event.quality, event.amount])).toEqual([
        [STANDING, -3],
        [WELLBEING, -5],
      ]);
      expect(keysOf(result.lines, "line.obligation.")).toEqual(["line.obligation.missed"]);
    }
    expect(markOf(game)).toBe(60 - 2 * CREDIT.onMiss);
    const third = nextMonth(game);
    expect(isOpen(game, RENT_FLAT)).toBe(false);
    expect(owedOf(game, RENT_ROOM)).toMatchObject({ state: "active", missed: 0, amount: entryOf(RENT_ROOM).amount });
    expect(markOf(game)).toBe(60 - 2 * CREDIT.onMiss - CREDIT.onDefault);
    expect(third.lines.find((line) => line.key === "line.obligation.evicted")).toMatchObject({ tone: "bad", attention: true });
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[abroad-money:arrival-opens-upkeep-and-room] [goal:goals-need-the-real-deed] given a flat in your own name, when obligation/has names an entry, then only that entry counts, and the flat is not offered again while it is held", () => {
    const game = settledAbroad(content);
    markBy(game, 60);
    const flatOffered = (): boolean => game.view().activities.some((option) => option.id === "activity.rent-flat-uk" && option.allowed);
    expect(flatOffered()).toBe(true);
    const hasEntry = (obligation: Id<"obligation">): boolean => check(readOf(game), { type: "obligation/has", obligationType: "rent", obligation }).met;
    expect(hasEntry(RENT_ROOM)).toBe(true);
    expect(hasEntry(RENT_FLAT)).toBe(false);
    closeTypes(game, "rent");
    openOwed(game, RENT_FLAT);
    expect(hasEntry(RENT_FLAT)).toBe(true);
    expect(hasEntry(RENT_ROOM)).toBe(false);
    expect(check(readOf(game), { type: "obligation/has", obligationType: "phone", obligation: RENT_FLAT }).met).toBe(false);
    expect(flatOffered()).toBe(false);
  });

  test("[abroad-money:arrival-opens-upkeep-and-room] given a shared room, when rent is missed three times in a row, then it has nowhere cheaper to go: it stays open, starts over, and the file takes the default figure", () => {
    const game = settledAbroad(content);
    closeTypes(game, "upkeep");
    markBy(game, 60);
    setPockets(game, { GBP: 0 });
    playMonths(game, 2);
    expect(owedOf(game, RENT_ROOM)).toMatchObject({ missed: 2, state: "grace" });
    const third = nextMonth(game);
    expect(owedOf(game, RENT_ROOM)).toMatchObject({ missed: 0, state: "active" });
    expect(markOf(game)).toBe(60 - 2 * CREDIT.onMiss - CREDIT.onDefault);
    expect(keysOf(third.lines, "line.obligation.")).toEqual(["line.obligation.missed", "line.obligation.rent-default"]);
  });

  test("[abroad-money:arrival-opens-upkeep-and-room] given rent missed twice, when the next month is paid, then the misses start over and no eviction follows", () => {
    const game = settledAbroad(content);
    closeTypes(game, "upkeep");
    setPockets(game, { GBP: 0 });
    playMonths(game, 2);
    setPockets(game, { GBP: entryOf(RENT_ROOM).amount });
    playMonths(game, 1);
    expect(owedOf(game, RENT_ROOM)).toMatchObject({ missed: 0, state: "active" });
    setPockets(game, { GBP: 0 });
    playMonths(game, 2);
    expect(owedOf(game, RENT_ROOM)).toMatchObject({ missed: 2, state: "grace" });
  });

  const FLAT_UK = "activity.rent-flat-uk" as Id<"activity">;
  const depositOf = (result: { events: BaseEvent[] }) =>
    eventsOf(result, "wallet/credited").filter((event) => event.reason === "deposit-return").map((event) => [event.currency, event.pocket, event.amount]);

  test("[abroad-money:arrival-opens-upkeep-and-room] given a flat taken with one month's rent as its deposit, when the character goes home, then the deposit comes back to the pound bank as deposit-return", () => {
    const game = settledAbroad(content);
    markBy(game, 60);
    setPockets(game, { GBP: 1000000 });
    game.endTurn([{ activity: FLAT_UK, param: null }]);
    expect(isOpen(game, RENT_FLAT)).toBe(true);
    const home = game.accept({ type: "return/home" });
    expect(isOpen(game, RENT_FLAT)).toBe(false);
    expect(depositOf(home)).toEqual([["GBP", "bank", entryOf(RENT_FLAT).amount]]);
  });

  test("[abroad-money:arrival-opens-upkeep-and-room] given a shared room with no deposit, when the character goes home, then nothing comes back", () => {
    const game = settledAbroad(content);
    expect(isOpen(game, RENT_ROOM)).toBe(true);
    expect(depositOf(game.accept({ type: "return/home" }))).toEqual([]);
  });

  test("[abroad-money:arrival-opens-upkeep-and-room] given a flat taken with its deposit, when it is lost to the third missed rent, then the eviction returns no deposit", () => {
    const game = settledAbroad(content);
    markBy(game, 60);
    setPockets(game, { GBP: 1000000 });
    game.endTurn([{ activity: FLAT_UK, param: null }]);
    closeTypes(game, "upkeep");
    setPockets(game, { GBP: 0 });
    const months = [nextMonth(game), nextMonth(game), nextMonth(game)];
    expect(isOpen(game, RENT_FLAT)).toBe(false);
    expect(isOpen(game, RENT_ROOM)).toBe(true);
    expect(months.flatMap(depositOf)).toEqual([]);
  });
});

describe("the phone", () => {
  test("[abroad-money:phone-contract-builds-credit] given a phone contract, when it is paid on time, then it adds to the file each month and keeps running after its 24 months", () => {
    const game = settledAbroad(content);
    closeTypes(game, "rent", "upkeep");
    const phone = openOwed(game, UK_PHONE);
    expect(entryOf(UK_PHONE)).toMatchObject({ creditMin: 10, reportsToCredit: true, amount: 2500 });
    playMonths(game, 25);
    expect(markOf(game)).toBeGreaterThanOrEqual(25 * CREDIT.onTime);
    expect(owedOf(game, UK_PHONE).id).toBe(phone.id);
    expect(game.view().credit?.onTime).toBe(25);
  });

  test("[abroad-money:phone-contract-builds-credit] given a phone contract open, when the free slots are read, then a second contract is not offered and a month that asks for one is rejected; once it ends, it is offered again", () => {
    const game = settledAbroad(content);
    markBy(game, 60);
    const contract = "activity.phone-contract-uk" as Id<"activity">;
    const offered = () => game.view().activities.find((option) => option.id === contract);
    expect(offered()?.allowed).toBe(true);
    game.endTurn([{ activity: contract, param: null }]);
    expect(Object.values(game.state.obligation.items).filter((item) => item.entry === UK_PHONE)).toHaveLength(1);
    expect(offered()?.allowed).toBe(false);
    game.expectRejected({ type: "turn/end", slots: [{ activity: contract, param: null }] }, "not-legal");
    closeTypes(game, "phone");
    expect(offered()?.allowed).toBe(true);
  });

  test("[abroad-money:phone-contract-builds-credit] given a phone contract, when three months are missed in a row, then the contract ends and the file takes the default figure", () => {
    const game = settledAbroad(content);
    closeTypes(game, "rent", "upkeep");
    markBy(game, 60);
    openOwed(game, UK_PHONE);
    setPockets(game, { GBP: 0 });
    playMonths(game, 2);
    expect(owedOf(game, UK_PHONE).missed).toBe(2);
    const third = nextMonth(game);
    expect(isOpen(game, UK_PHONE)).toBe(false);
    expect(markOf(game)).toBe(60 - 2 * CREDIT.onMiss - CREDIT.onDefault);
    expect(keysOf(third.lines, "line.obligation.")).toEqual(["line.obligation.missed", "line.obligation.cut-off"]);
  });
});

// ---------------------------------------------------------------------------
// Tuition: abroad-money:tuition-paid-in-instalments
// ---------------------------------------------------------------------------

describe("tuition", () => {
  // An odd figure, so the last instalment's rounding shows.
  const PRINCIPAL = 1200001;
  const PLAN_FEE = content.tuning.status.planFee;
  const PLAN: Id<"offer"> = "offer.fee-payment-plan";

  function student(): { game: Game; tuition: ObligationState } {
    const game = abroad(content);
    // The study gate opened the real tuition on departure (abroad-money:tuition-paid-in-instalments); these tests pin a round figure instead.
    closeTypes(game, "rent", "upkeep", "tuition");
    expect(game.state.route[UK_ROUTE]!.support).toBeNull();
    return { game, tuition: openOwed(game, TUITION, PRINCIPAL) };
  }

  function charges(result: { events: BaseEvent[] }, id: string): number[] {
    return eventsOf(result, "obligation/charged")
      .filter((event) => event.id === id)
      .map((event) => event.total as number);
  }

  function stageKeys(result: { lines: ReportLine[] }): string[] {
    return keysOf(result.lines, "line.obligation.tuition-");
  }

  /** The months in arrears without a plan, with nothing in pounds: each month's results. */
  function missedMonths(game: Game, count: number): { lines: ReportLine[]; events: BaseEvent[] }[] {
    setPockets(game, { GBP: 0 });
    const results = [];
    for (let month = 0; month < count; month += 1) results.push(nextMonth(game));
    return results;
  }

  function planOpen(game: Game): string | null {
    return Object.values(game.state.offer.items).find((item) => item.entry === PLAN)?.id ?? null;
  }

  test("[abroad-money:tuition-paid-in-instalments] given the tuition's entry, when it is read, then it carries a schedule by course month, half then four eighths, and no grace count that could default it", () => {
    const entry = entryOf(TUITION);
    expect(entry.schedule).toEqual([5000, 0, 1250, 1250, 1250, 1250]);
    expect(entry.schedule!.reduce((sum, share) => sum + share, 0)).toBe(10000);
    expect(entry.everyMonths).toBeUndefined();
    expect(entry.term).toBeNull();
    expect(entry.sink).toBe("fee-school");
  });

  test("[abroad-money:tuition-paid-in-instalments] given tuition with the money to pay it, when the course runs, then half is charged in course month 1, nothing in month 2, an eighth in each of months 3 to 6 with the last rounded so the whole is paid, nothing after, and it closes paid", () => {
    const { game, tuition } = student();
    const fees = game.state.wallet.totals.out["fee-school"]?.GBP ?? 0;
    const charged: number[][] = [];
    for (let month = 1; month <= 8; month += 1) charged.push(charges(nextMonth(game), tuition.id));
    const eighth = mulDiv(PRINCIPAL, 1250, 10000);
    const half = mulDiv(PRINCIPAL, 5000, 10000);
    expect(charged).toEqual([[half], [], [eighth], [eighth], [eighth], [PRINCIPAL - half - 3 * eighth], [], []]);
    expect(isOpen(game, TUITION)).toBe(false);
    expect((game.state.wallet.totals.out["fee-school"]?.GBP ?? 0) - fees).toBe(PRINCIPAL);
  });

  test("[abroad-money:missed-tuition-runs-in-stages] given a charge missed with no plan, when the months pass in arrears, then the first month is a reminder alone, the second cuts access and opens the plan, the third is the final warning, and the fourth withdraws the student with two months left on the permission", () => {
    const { game } = student();
    const expires = game.state.status.current!.expiresMonth!;
    const [first, second, third, fourth] = missedMonths(game, 4);
    expect(stageKeys(first!)).toEqual(["line.obligation.tuition-reminder"]);
    expect(first!.lines.find((line) => line.key === "line.obligation.tuition-reminder")).toMatchObject({ tone: "bad", attention: true });
    expect(owedOf(game, TUITION).missed).toBe(4);
    expect(stageKeys(second!)).toEqual(["line.obligation.tuition-cut"]);
    expect(entryOf(TUITION).onCut).toEqual([
      { type: "quality/add", quality: WELLBEING, amount: -3 },
      { type: "offer/open", offer: PLAN },
    ]);
    expect(stageKeys(third!)).toEqual(["line.obligation.tuition-warning"]);
    expect(keysOf(fourth!.lines, "line.obligation.")).toContain("line.obligation.withdrawn");
    expect(owedOf(game, TUITION).state).toBe("defaulted");
    // status:course-passed-or-withdrawn: the sponsor reports it and the permission is cut to two months on; the status has not lapsed.
    expect(game.state.status.current).toMatchObject({ entry: STUDENT, expiresMonth: game.state.turn.month + content.tuning.status.curtailMonths, withdrawn: { expiresMonth: expires } });
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[abroad-money:missed-tuition-runs-in-stages] given access cut, when the plan's offer is read, then it spreads the arrears and the rest evenly to course month 12 for £50, and lapses after a month", () => {
    const { game } = student();
    missedMonths(game, 2);
    const id = planOpen(game);
    expect(id).not.toBeNull();
    const months = 12 - 2;
    expect(game.state.offer.items[id!]!.terms).toMatchObject({ instalment: divFloor(PRINCIPAL, months), fee: PLAN_FEE });
    expect(content.offer[PLAN]).toMatchObject({ chanceBp: 0, expiresAfter: 1, onExpire: null });
    expect(PLAN_FEE).toBe(5000);
  });

  test("[abroad-money:missed-tuition-runs-in-stages] given the plan agreed, when it runs, then £50 is paid to the school, the tuition owed is spread over the months left to month 12 with the last rounded, and the cut of access ends", () => {
    const { game, tuition } = student();
    missedMonths(game, 2);
    setPockets(game, { GBP: 2000000 });
    const fees = game.state.wallet.totals.out["fee-school"]?.GBP ?? 0;
    game.accept({ type: "offer/choose", offer: planOpen(game)!, choice: "agree" });
    expect((game.state.wallet.totals.out["fee-school"]?.GBP ?? 0) - fees).toBe(PLAN_FEE);
    expect(owedOf(game, TUITION)).toMatchObject({ missed: 0, plan: { month: 2, total: PRINCIPAL, months: 10 } });
    const charged: number[] = [];
    for (let month = 3; month <= 13; month += 1) charged.push(...charges(nextMonth(game), tuition.id));
    const part = divFloor(PRINCIPAL, 10);
    expect(charged).toEqual([...Array<number>(9).fill(part), PRINCIPAL - 9 * part]);
    expect(isOpen(game, TUITION)).toBe(false);
  });

  test("[abroad-money:missed-tuition-runs-in-stages] given the plan agreed, when one plan payment is missed it is the final warning, and a second in a row withdraws the student", () => {
    const { game } = student();
    missedMonths(game, 2);
    setPockets(game, { GBP: 2000000 });
    game.accept({ type: "offer/choose", offer: planOpen(game)!, choice: "agree" });
    const [warned, withdrawn] = missedMonths(game, 2);
    expect(stageKeys(warned!)).toEqual(["line.obligation.tuition-warning"]);
    expect(keysOf(withdrawn!.lines, "line.obligation.")).toContain("line.obligation.withdrawn");
    expect(owedOf(game, TUITION).state).toBe("defaulted");
    expect(game.state.status.current?.withdrawn).toBeDefined();
  });

  test("[abroad-money:missed-tuition-runs-in-stages] given a missed charge, when the next month's charge with the arrears is paid in full, then the stage ends and nothing more is told", () => {
    const { game, tuition } = student();
    missedMonths(game, 1);
    setPockets(game, { GBP: 2000000 });
    const paid = nextMonth(game);
    expect(charges(paid, tuition.id)).toEqual([mulDiv(PRINCIPAL, 5000, 10000)]);
    expect(stageKeys(paid)).toEqual([]);
    expect(owedOf(game, TUITION).missed).toBe(0);
  });

  test("[obligation:paying-down-obligations] [abroad-money:missed-tuition-runs-in-stages] given tuition in arrears, when obligation/pay is sent, then only every charge missed and not yet paid is taken, under fee-school, and it clears the stage; with nothing missed it is not legal", () => {
    const { game, tuition } = student();
    missedMonths(game, 2);
    const arrears = mulDiv(PRINCIPAL, 5000, 10000);
    game.expectRejected({ type: "obligation/pay", obligation: tuition.id, amount: arrears }, "cannot-afford");
    setPockets(game, { GBP: 2000000 });
    game.expectRejected({ type: "obligation/pay", obligation: tuition.id, amount: arrears - 1 }, "bad-amount");
    game.expectRejected({ type: "obligation/pay", obligation: tuition.id, amount: arrears + 1 }, "bad-amount");
    const fees = game.state.wallet.totals.out["fee-school"]?.GBP ?? 0;
    game.accept({ type: "obligation/pay", obligation: tuition.id, amount: arrears });
    expect((game.state.wallet.totals.out["fee-school"]?.GBP ?? 0) - fees).toBe(arrears);
    expect(owedOf(game, TUITION)).toMatchObject({ missed: 0, outstanding: PRINCIPAL - arrears, state: "active" });
    game.expectRejected({ type: "obligation/pay", obligation: tuition.id, amount: 1 }, "not-legal");
  });

  test("[obligation:paying-down-obligations] [status:course-passed-or-withdrawn] given a withdrawn student inside the two months, when everything owed is paid, then the student is reinstated with the status's own end restored and the tuition goes on", () => {
    const { game, tuition } = student();
    const expires = game.state.status.current!.expiresMonth!;
    missedMonths(game, 4);
    setPockets(game, { GBP: 2000000 });
    // Nothing was paid, so everything owed is the shares of course months 1 to 4: three quarters.
    expect(owedOf(game, TUITION).outstanding).toBe(PRINCIPAL);
    const owed = mulDiv(PRINCIPAL, 7500, 10000);
    game.accept({ type: "obligation/pay", obligation: tuition.id, amount: owed });
    expect(owedOf(game, TUITION).state).toBe("active");
    expect(game.state.status.current).toMatchObject({ entry: STUDENT, expiresMonth: expires });
    expect(game.state.status.current?.withdrawn).toBeUndefined();
    expect(charges(nextMonth(game), tuition.id)).toEqual([mulDiv(PRINCIPAL, 8750, 10000) - mulDiv(PRINCIPAL, 7500, 10000)]);
  });

  test("[status:course-passed-or-withdrawn] given a withdrawn student who pays nothing, when the two months pass, then the status lapses as any status does, its grace after, and the tuition stays on record", () => {
    const { game } = student();
    missedMonths(game, 4);
    playMonths(game, content.tuning.status.curtailMonths - 1);
    expect(game.state.status.current?.entry).toBe(STUDENT);
    playMonths(game, 1);
    expect(game.state.status.current?.entry).toBe(OVERSTAYER);
    expect(owedOf(game, TUITION).state).toBe("defaulted");
  });

  test("[route:family-pledge-pays-tuition] given the family's pledge standing and no pounds, when a tuition charge falls, then the pledge pays the school: the shortfall in naira at the day's rate comes off the pledge, lands in the pound bank under gift unflagged, and the charge is paid whole", () => {
    const { game, tuition } = student();
    const pledge = 50000000000;
    applyEffects(game, [{ type: "route/support", route: UK_ROUTE, currency: "NGN", amount: pledge }]);
    setPockets(game, { GBP: 100000 });
    const lots = game.state.wallet.lots.length;
    const half = mulDiv(PRINCIPAL, 5000, 10000);
    // The day's rate is the month's own, before the tick moves on.
    const rates = officialRates(game.world());
    const result = nextMonth(game);
    expect(charges(result, tuition.id)).toEqual([half]);
    const short = half - 100000;
    const naira = convertMinor(short, "GBP", "NGN", rates);
    expect(game.state.route[UK_ROUTE]!.support).toEqual({ currency: "NGN", amount: pledge - naira });
    expect(game.state.wallet.totals.in.gift?.GBP).toBe(short);
    expect(game.state.wallet.lots.length).toBe(lots);
    expect(result.lines.find((line) => line.key === "line.route.pledge-paid")).toMatchObject({ params: { amount: { currency: "GBP", amount: short } } });
    expect(text["line.route.pledge-paid"]).toBe("Your father paid the school {amount}.");
    expect(owedOf(game, TUITION).missed).toBe(0);
  });

  test("[route:family-pledge-pays-tuition] given a pledge too small for the shortfall, when the charge falls, then what is left of it is paid in, the pledge is spent to nothing and the charge is still missed; a pledge at nothing pays nothing more", () => {
    const { game } = student();
    applyEffects(game, [{ type: "route/support", route: UK_ROUTE, currency: "NGN", amount: 100000000 }]);
    setPockets(game, { GBP: 0 });
    const first = nextMonth(game);
    expect(game.state.route[UK_ROUTE]!.support?.amount).toBe(0);
    expect(first.lines.some((line) => line.key === "line.route.pledge-paid")).toBe(true);
    expect(owedOf(game, TUITION).missed).toBe(1);
    const second = nextMonth(game);
    expect(second.lines.some((line) => line.key === "line.route.pledge-paid")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The car: car:car-bought-on-finance, car:open-finance-gives-the-car, car:missed-payments-take-the-car, car:car-handed-back-after-half, car:final-payment-owns-the-car, car:view-shows-car-terms
// ---------------------------------------------------------------------------

const CAR_ENTRY = entryOf(CAR);
const TERMS = carTerms(CAR_ENTRY);
/** What the activity opens: the price less the 10% deposit (car:car-bought-on-finance). */
const CAR_PRINCIPAL = TERMS.price - bp(TERMS.price, CAR_ENTRY.car!.depositBp);
/** The part of the price paid each month, the final payment left aside. */
const MONTHLY = divCeil(CAR_PRINCIPAL - TERMS.final, CAR_ENTRY.term!);

/** A settled life with only the car to pay, bought at the given mark, and `payments` monthly payments made. */
function carAfter(payments: number, mark = 30): { game: Game; car: ObligationState } {
  const game = settledAbroad(content);
  closeTypes(game, "rent", "upkeep");
  markBy(game, mark);
  setPockets(game, { GBP: 5000000 });
  openOwed(game, CAR, CAR_PRINCIPAL);
  playMonths(game, payments);
  return { game, car: owedOf(game, CAR) };
}

describe("the car", () => {
  test("[car:car-bought-on-finance] [credit:rate-follows-credit-ladder] given marks of 30, 50 and 70, when the car is opened, then the price less the deposit is owed over 36 months with the ladder's rate fixed as its monthly interest", () => {
    expect(CAR_PRINCIPAL).toBe(855000);
    for (const [mark, rate] of [
      [30, 120],
      [49, 120],
      [50, 90],
      [70, 50],
    ] as const) {
      const { car, game } = carAfter(0, mark);
      expect(car).toMatchObject({ principal: CAR_PRINCIPAL, outstanding: CAR_PRINCIPAL, monthsLeft: 36, amount: bp(CAR_PRINCIPAL, rate) });
      expect(game.view().obligations.find((owed) => owed.id === car.id)?.due).toBe(MONTHLY + bp(CAR_PRINCIPAL, rate));
      expect(carView(readOf(game), car)).toMatchObject({ final: 285000, price: 950000, paid: 95000, interest: bp(CAR_PRINCIPAL, rate) });
    }
  });

  test("[car:open-finance-gives-the-car] given a car on finance, when it is open, then obligation/has car holds; it goes when the car is taken", () => {
    const { game } = carAfter(2);
    expect(hasCar(game)).toBe(true);
    setPockets(game, { GBP: 0 });
    playMonths(game, 3);
    expect(isOpen(game, CAR)).toBe(false);
    expect(hasCar(game)).toBe(false);
  });

  test("[car:missed-payments-take-the-car] given 13 payments made, under a third of the price, when the third miss in a row comes, then the car is taken at once and the shortfall is owed with a judgment", () => {
    const { game, car } = carAfter(13);
    expect(carPaid(CAR_ENTRY, car)).toBeLessThan(TERMS.third);
    const outstanding = car.outstanding;
    setPockets(game, { GBP: 0 });
    const first = nextMonth(game);
    expect(keysOf(first.lines, "line.obligation.")).toEqual(["line.obligation.missed"]);
    const second = nextMonth(game);
    expect(keysOf(second.lines, "line.obligation.")).toEqual(["line.obligation.car-notice"]);
    expect(carView(readOf(game), owedOf(game, CAR))).toMatchObject({ notice: true, courtMonth: null });
    const month = game.state.turn.month + 1;
    const third = nextMonth(game);
    expect(isOpen(game, CAR)).toBe(false);
    const shortfall = outstanding - TERMS.resale;
    expect(owedOf(game, SHORTFALL)).toMatchObject({ principal: shortfall, outstanding: shortfall, monthsLeft: 12 });
    expect(game.state.wallet.pockets.GBP.bank).toBe(0);
    expect(game.view().credit?.judgmentUntil).toBe(month + CREDIT.judgmentMonths);
    expect(keysOf(third.lines, "line.obligation.")).toEqual(["line.obligation.missed", "line.obligation.repossessed-owing"]);
    expect(markOf(game)).toBe(Math.max(0, 30 + 13 * CREDIT.onTime - 2 * CREDIT.onMiss - CREDIT.onDefault));
  });

  test("[car:missed-payments-take-the-car] given 14 payments made, a third of the price, when the third miss in a row comes, then the lender goes to court and the car is taken three months later", () => {
    const { game, car } = carAfter(14);
    expect(carPaid(CAR_ENTRY, car)).toBeGreaterThanOrEqual(TERMS.third);
    setPockets(game, { GBP: 0 });
    playMonths(game, 2);
    const month = game.state.turn.month + 1;
    const third = nextMonth(game);
    expect(isOpen(game, CAR)).toBe(true);
    expect(third.lines.find((line) => line.key === "line.obligation.car-court")?.params).toEqual({ obligation: CAR, month: month + TERMS.courtMonths });
    expect(carView(readOf(game), owedOf(game, CAR))?.courtMonth).toBe(month + TERMS.courtMonths);
    playMonths(game, TERMS.courtMonths - 1);
    expect(isOpen(game, CAR)).toBe(true);
    const taken = nextMonth(game);
    expect(game.state.turn.month).toBe(month + TERMS.courtMonths);
    expect(isOpen(game, CAR)).toBe(false);
    expect(eventsOf(taken, "obligation/repossessed")).toHaveLength(1);
  });

  test("[car:missed-payments-take-the-car] given a car in court, when the arrears are paid whole with obligation/pay, then the car stays and payments run again; any other amount is a bad amount", () => {
    const { game } = carAfter(14);
    setPockets(game, { GBP: 0 });
    playMonths(game, 3);
    const car = owedOf(game, CAR);
    const arrears = game.view().obligations.find((owed) => owed.id === car.id)?.due ?? 0;
    expect(arrears).toBe(3 * (MONTHLY + car.amount));
    setPockets(game, { GBP: arrears + 5000000 });
    game.expectRejected({ type: "obligation/pay", obligation: car.id, amount: arrears - 1 }, "bad-amount");
    game.expectRejected({ type: "obligation/pay", obligation: car.id, amount: arrears + 1 }, "bad-amount");
    game.accept({ type: "obligation/pay", obligation: car.id, amount: arrears });
    expect(owedOf(game, CAR)).toMatchObject({ missed: 0, state: "active", outstanding: car.outstanding - 3 * MONTHLY, monthsLeft: car.monthsLeft! - 3 });
    playMonths(game, 3);
    expect(owedOf(game, CAR).missed).toBe(0);
    expect(hasCar(game)).toBe(true);
  });

  test("[car:missed-payments-take-the-car] given a car with nothing missed, when its arrears are paid, then it is not legal; with too little money it cannot be afforded", () => {
    const { game, car } = carAfter(1);
    expect(game.expectRejected({ type: "obligation/pay", obligation: car.id, amount: MONTHLY }, "not-legal").code).toBe("not-legal");
    setPockets(game, { GBP: 0 });
    playMonths(game, 1);
    const arrears = game.view().obligations.find((owed) => owed.id === car.id)?.due ?? 0;
    expect(arrears).toBe(MONTHLY + car.amount);
    expect(game.expectRejected({ type: "obligation/pay", obligation: car.id, amount: arrears }, "cannot-afford").code).toBe("cannot-afford");
  });

  test("[car:car-handed-back-after-half] given 23 payments and then 24, when the car is handed back with 0, then under half it is not legal; at half it goes back with nothing owed and no judgment", () => {
    const under = carAfter(23);
    expect(carPaid(CAR_ENTRY, under.car)).toBeLessThan(TERMS.half);
    under.game.expectRejected({ type: "obligation/pay", obligation: under.car.id, amount: 0 }, "not-legal");
    const { game, car } = carAfter(24);
    expect(carPaid(CAR_ENTRY, car)).toBeGreaterThanOrEqual(TERMS.half);
    const result = game.accept({ type: "obligation/pay", obligation: car.id, amount: 0 });
    expect(isOpen(game, CAR)).toBe(false);
    expect(isOpen(game, SHORTFALL)).toBe(false);
    expect(hasCar(game)).toBe(false);
    expect(game.view().credit?.judgmentUntil).toBeNull();
    expect(result.lines.find((line) => line.key === "line.obligation.handed-back")).toBeDefined();
  });

  test("[car:final-payment-owns-the-car] given every monthly payment made, when the term ends, then the final payment is charged; paid, the car is owned with nothing owed and hasCar stays", () => {
    const { game, car } = carAfter(36);
    expect(car).toMatchObject({ monthsLeft: 0 });
    // The monthly part stops at the final payment, so what is left is exactly the final payment.
    expect(36 * MONTHLY).toBeGreaterThan(CAR_PRINCIPAL - TERMS.final);
    expect(car.outstanding).toBe(TERMS.final);
    const last = nextMonth(game);
    expect(eventsOf(last, "obligation/charged").find((event) => event.id === car.id)).toMatchObject({ total: car.outstanding, interest: 0 });
    expect(owedOf(game, CAR)).toMatchObject({ outstanding: 0, monthsLeft: 0 });
    expect(last.lines.find((line) => line.key === "line.obligation.owned")).toMatchObject({ tone: "good" });
    expect(hasCar(game)).toBe(true);
    const after = nextMonth(game);
    expect(eventsOf(after, "obligation/charged").filter((event) => event.id === car.id)).toEqual([]);
    game.expectRejected({ type: "obligation/pay", obligation: car.id, amount: 0 }, "not-legal");
  });

  test("[car:final-payment-owns-the-car] [obligation:due-phase-charges-oldest-first] given the car paid off and owned, when the view lists what is owed, then the car is not there: it is kept with no obligation, and the car's work still counts it", () => {
    const { game, car } = carAfter(36);
    expect(game.view().obligations.some((owed) => owed.id === car.id)).toBe(true);
    nextMonth(game);
    expect(owedOf(game, CAR)).toMatchObject({ outstanding: 0, monthsLeft: 0 });
    expect(game.view().obligations.some((owed) => owed.id === car.id)).toBe(false);
    expect(hasCar(game)).toBe(true);
  });

  test("[car:final-payment-owns-the-car] given every monthly payment made, when the final payment is missed, then the car goes back with nothing owed", () => {
    const { game } = carAfter(36);
    setPockets(game, { GBP: 0 });
    const missed = nextMonth(game);
    expect(isOpen(game, CAR)).toBe(false);
    expect(isOpen(game, SHORTFALL)).toBe(false);
    expect(hasCar(game)).toBe(false);
    expect(game.view().credit?.judgmentUntil).toBeNull();
    expect(keysOf(missed.lines, "line.obligation.")).toEqual(["line.obligation.missed", "line.obligation.handed-back"]);
  });

  test("[car:view-shows-car-terms] given a car partway paid, when the screen asks, then it has the price, the paid so far, the third and half marks, the final payment, the rate, months left and misses", () => {
    const { game, car } = carAfter(5);
    const owed = game.view().obligations.find((item) => item.id === car.id);
    expect(owed).toMatchObject({ monthsLeft: 31, missed: 0 });
    expect(owed?.car).toEqual(carView(readOf(game), car));
    expect(carView(readOf(game), car)).toEqual({
      price: 950000,
      final: 285000,
      third: 316635,
      half: 475000,
      resale: 522500,
      courtMonths: 3,
      paid: 95000 + 5 * MONTHLY,
      interest: bp(CAR_PRINCIPAL, 120),
      rateBp: 120,
      notice: false,
      courtMonth: null,
    });
    expect(carView(readOf(game), { ...car, entry: UK_PHONE })).toBeNull();
  });

  test("[car:missed-payments-take-the-car] [car:final-payment-owns-the-car] given each car line, when it is looked up, then it has words, and money in it is typed", () => {
    const keys = ["car-notice", "car-court", "caught-up", "repossessed", "repossessed-owing", "handed-back", "handed-back-owing", "owned"].map((what) => `line.obligation.${what}`);
    expect(keys.filter((key) => (text[key] ?? "").trim() === "")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The agent's debt: road:chain-steps-monthly, road:exit-is-assisted-return
// ---------------------------------------------------------------------------

describe("the car on the way home", () => {
  const HOME_SHORTFALL: Id<"obligation"> = "obligation.car-shortfall-home";
  const official = (game: Game) => ({ GBP: game.world().rates.GBP.official, USD: game.world().rates.USD.official, CAD: game.world().rates.CAD.official, AED: game.world().rates.AED.official, EUR: game.world().rates.EUR.official });

  test("[return:return-reopens-home-charges] [car:car-handed-back-after-half] given a car under half paid, when the character comes home, then it is handed back and the shortfall opens at home in naira at the day's official rate, with nothing left in pounds", () => {
    const { game, car } = carAfter(2);
    expect(carPaid(CAR_ENTRY, car)).toBeLessThan(TERMS.half);
    const shortfall = car.outstanding - TERMS.resale;
    expect(shortfall).toBeGreaterThan(0);
    const naira = convertMinor(shortfall, "GBP", "NGN", official(game));
    game.accept({ type: "return/home" });
    expect(game.state.place.where).toBe("home");
    expect(isOpen(game, CAR)).toBe(false);
    expect(hasCar(game)).toBe(false);
    expect(isOpen(game, SHORTFALL)).toBe(false);
    expect(entryOf(HOME_SHORTFALL)).toMatchObject({ currency: "NGN", type: "loan" });
    expect(owedOf(game, HOME_SHORTFALL)).toMatchObject({ principal: naira, outstanding: naira });
  });

  test("[return:return-reopens-home-charges] [car:car-handed-back-after-half] given a car half paid, when the character comes home, then it is handed back with nothing owed anywhere", () => {
    const { game, car } = carAfter(24);
    expect(carPaid(CAR_ENTRY, car)).toBeGreaterThanOrEqual(TERMS.half);
    game.accept({ type: "return/home" });
    expect(isOpen(game, CAR)).toBe(false);
    expect(isOpen(game, SHORTFALL)).toBe(false);
    expect(isOpen(game, HOME_SHORTFALL)).toBe(false);
  });
});

describe("the agent's debt", () => {
  const RANSOM: Id<"offer"> = "offer.road-ransom-call";

  /** The ransom call opened on the road and answered `cannot`. Returns the sum. */
  function cannotPay(game: Game): number {
    applyEffects(game, [{ type: "offer/open", offer: RANSOM }]);
    const offer = Object.values(game.state.offer.items).find((item) => item.entry === RANSOM);
    if (offer === undefined) throw new Error("The ransom call did not open.");
    game.accept({ type: "offer/choose", offer: offer.id, choice: "cannot" });
    return offer.terms.sum as number;
  }

  test("[road:chain-steps-monthly] given the compound's ransom call on the road, when nobody can pay, then the sum opens as the agent's debt in naira; a second call adds to the same debt", () => {
    const game = abroad(content);
    game.accept({ type: "return/home" });
    applyEffects(game, [{ type: "place/move", to: "road", country: null }]);
    const first = cannotPay(game);
    expect(owedOf(game, AGENT_DEBT)).toMatchObject({ principal: first, outstanding: first });
    expect(entryOf(AGENT_DEBT).currency).toBe("NGN");
    const second = cannotPay(game);
    expect(owedOf(game, AGENT_DEBT)).toMatchObject({ principal: first + second, outstanding: first + second });
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[road:exit-is-assisted-return] given the agent's debt, when the character is brought home, then the debt stays open in naira, charges nothing and cannot be paid ahead", () => {
    const game = abroad(content);
    game.accept({ type: "return/home" });
    applyEffects(game, [{ type: "place/move", to: "road", country: null }]);
    const sum = cannotPay(game);
    applyEffects(game, [{ type: "place/move", to: "home", country: null }]);
    expect(game.state.place.where).toBe("home");
    const debt = owedOf(game, AGENT_DEBT);
    expect(debt.outstanding).toBe(sum);
    const month = nextMonth(game);
    expect(eventsOf(month, "wallet/debited").filter((event) => event.reason === "agent-debt")).toEqual([]);
    expect(owedOf(game, AGENT_DEBT).outstanding).toBe(sum);
    game.expectRejected({ type: "obligation/pay", obligation: debt.id, amount: sum }, "not-legal");
  });

  test("[road:exit-is-assisted-return] given the agent's debt carried abroad, when the character returns home by any road, then the debt follows and the abroad obligations close", () => {
    const game = abroad(content);
    openOwed(game, AGENT_DEBT, 50000000);
    game.accept({ type: "return/home" });
    expect(owedOf(game, AGENT_DEBT).outstanding).toBe(50000000);
    expect(isOpen(game, RENT_ROOM)).toBe(false);
    expect(isOpen(game, UK_UPKEEP)).toBe(false);
    expect(game.view().obligations.map((owed) => owed.entry)).toContain(AGENT_DEBT);
  });
});
