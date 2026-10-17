// Working life abroad: docs/rules/ladders.md, abroad-money.md R-ABROAD-002, car.md,
// health.md R-HEALTH-004. Lives reach abroad through the real route kind (`flown`).
// R-ACTIVITY-015: a now-act (an application, a paper, a visit) is refused in a slot, so each probe sends one as
// activity/now, and an application checked as applying is read in the month it is sent.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../engine/check";
import { bp, divFloor, mulDiv } from "../engine/int";
import type { Registry } from "../engine/kind";
import type { Accepted, BaseEvent, Content, Id, ReadCtx, Requirement } from "../engine/types";
import { registry } from "../kinds";
import { ALWAYS_GRANTED, flown, offeredSeed, playMonths } from "../place/place.journey";
import type { LifeOptions } from "../route/route.journey";
import { applyEffects, draw, readyLife, slot, toDecision } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { activityKind, cashWorkedThisMonth, localTenure, paramsFor, passChanceBp } from "./activity.logic";
import { drivingAttempts, hasCar, jobTerms, monthlyPay, monthlyTax } from "./activity.pay";

const CARE: Id<"activity"> = "activity.job-uk-care";
const WAREHOUSE: Id<"activity"> = "activity.job-uk-warehouse";
const RETAIL: Id<"activity"> = "activity.job-uk-retail-part";
const KITCHEN: Id<"activity"> = "activity.job-uk-kitchen-cash";
const COURIER: Id<"activity"> = "activity.job-uk-courier-cash";
const NURSE: Id<"activity"> = "activity.job-uk-nurse";
const GUARD: Id<"activity"> = "activity.job-gulf-guard";
const HUNT: Id<"activity"> = "activity.job-hunt";
const STUDENT: Id<"status"> = "status.uk-student";
const GRADUATE: Id<"status"> = "status.uk-graduate";
const SPONSORED: Id<"status"> = "status.uk-sponsored";
const SETTLED: Id<"status"> = "status.uk-settled";
const OVERSTAYER: Id<"status"> = "status.uk-overstayer";
const HOME_LICENCE: Id<"document"> = "document.home-licence";
const UK_LICENCE: Id<"document"> = "document.uk-licence";
/** £27,000 a year, inside the care home's band. */
const CARE_SALARY = 2700000;
const tuning = content.tuning;

function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

function entry(id: Id<"activity">) {
  const found = content.activity[id];
  if (found === undefined) throw new Error(`The content has no ${id}.`);
  return found;
}

function yearly(id: Id<"activity">): number {
  const amount = entry(id).pay?.amount;
  if (typeof amount !== "number") throw new Error(`${id} pays no fixed figure.`);
  return amount;
}

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

function keys(result: Accepted): string[] {
  return result.lines.map((line) => line.key);
}

/** The route the character left on, with the sponsor's salary recorded, as the sponsor gate leaves it (R-SPONSOR-007). */
function leftOnSponsor(game: Game, salary: number): void {
  const route = game.state.route["route.uk-care"];
  if (route === undefined) throw new Error("The content has no care route.");
  // The sponsor gate's record is written directly, so the test reaches the job without playing the gate.
  game.state = { ...game.state, route: { ...game.state.route, "route.uk-care": { ...route, state: "departed", gate: { gate: "sponsor", sponsor: { employer: "A care home", salary } } } } };
}

/** Ada flown on the study route, then a sponsored care worker for a care home paying `salary` a year. */
function careWorker(options: LifeOptions = {}, salary = CARE_SALARY): Game {
  const game = flown(content, options);
  leftOnSponsor(game, salary);
  applyEffects(game, [{ type: "status/grant", status: SPONSORED, job: CARE }]);
  return game;
}

/** Ada flown, then holding a status and, when given, a job it allows. */
function holding(status: Id<"status">, job: Id<"activity"> | null = null, options: LifeOptions = {}): Game {
  const game = flown(content, options);
  applyEffects(game, [{ type: "status/grant", status }]);
  if (job !== null) applyEffects(game, [{ type: "activity/start-job", job }]);
  return game;
}

function hunts(game: Game): string[] | null {
  return paramsFor(readOf(game), entry(HUNT));
}

describe("what may be done abroad", () => {
  test("[R-LADDER-001] [R-PLACE-003] given a student in the UK, when the view is read, then the free slots are only those of anywhere, of abroad and of the UK; a home one or another country's in a slot is rejected, as a UK one is at home", () => {
    const game = flown(content);
    const listed = game.view().activities.map((option) => option.id);
    const wrong = listed.filter((id) => {
      const found = entry(id);
      const where = found.where ?? "home";
      return where === "home" || (where === "abroad" && found.country !== null && found.country !== undefined && found.country !== "country.uk");
    });
    expect(wrong).toEqual([]);
    expect(listed).toEqual(expect.arrayContaining(["activity.rest", HUNT, "activity.call-home", "activity.community-uk", "activity.send-money"]));
    expect(listed).not.toContain("activity.family-time");
    expect(listed).not.toContain("activity.community-ca");
    game.expectRejected({ type: "turn/end", slots: [slot("activity.family-time")] }, "not-legal");
    game.expectRejected({ type: "activity/now", activity: "activity.community-ca", param: null }, "not-legal");
    game.endTurn([slot("activity.call-home")]);

    const home = start({ content, scenario: "scenario.ada" });
    home.expectRejected({ type: "activity/now", activity: "activity.call-home", param: null }, "not-legal");
    expect(home.view().activities.find((option) => option.id === "activity.call-home")?.allowed).toBe(false);
  });

  test("[R-LADDER-001] [R-LADDER-006] [R-STATUS-002] given a student, an overstayer and a graduate, when the jobs to hunt are listed, then the student has the one part-time job, the overstayer the cash jobs, the graduate every UK job it qualifies for; none a job with no hiring chance", () => {
    expect(hunts(flown(content))).toEqual([RETAIL]);
    expect(hunts(holding(OVERSTAYER))).toEqual([KITCHEN, COURIER]);
    const graduate = hunts(holding(GRADUATE)) ?? [];
    expect(graduate).toEqual(expect.arrayContaining([WAREHOUSE, RETAIL, KITCHEN, COURIER]));
    // The sponsor's and the agent's jobs are started by departure, never hunted.
    expect(graduate).not.toContain(CARE);
    expect(graduate).not.toContain("activity.job-uk-skilled");
    expect(graduate.every((id) => entry(id as Id<"activity">).country === "country.uk")).toBe(true);
  });

  test("[R-LADDER-001] [R-LADDER-005] given a sponsored care worker, when the jobs to hunt are listed, then only jobs that carry their own sponsorship are, and the nurse's once the pin is held", () => {
    const game = careWorker();
    expect(hunts(game)).toEqual([]);
    expect(game.view().activities.find((option) => option.id === HUNT)?.allowed).toBe(false);
    applyEffects(game, [{ type: "document/grant", document: "document.nmc-pin" }]);
    expect(hunts(game)).toEqual([NURSE]);
  });

  test("[R-LADDER-006] [R-PLACE-003] given Zainab's developer job at home, when she arrives as a student, then the job ends with the flight, no pay comes from it and no clock starts", () => {
    const game = readyLife(content, { from: "scenario.zainab", seed: offeredSeed(content), tuning: ALWAYS_GRANTED });
    toDecision(game);
    expect(game.state.activity.job).toBe("activity.job-junior-dev");
    const served = game.state.activity.tenure["activity.job-junior-dev"];
    const flight = game.accept({ type: "route/depart", route: "route.uk-masters" });
    expect(game.state.activity.job).toBeNull();
    expect(flight.events).toContainEqual({ type: "activity/job-ended", job: "activity.job-junior-dev", why: "moved" });
    const result = game.endTurn();
    expect(moneyOf(result, "salary")).toEqual([]);
    expect(game.state.status.current).toMatchObject({ entry: STUDENT, clock: null });
    // The time served is kept.
    expect(game.state.activity.tenure["activity.job-junior-dev"]).toBe(served);
  });
});

describe("local tenure", () => {
  test("[R-LADDER-002] given months in a UK job and months in a job at home, when local tenure is judged abroad, then only the UK months count, and at home only the home ones", () => {
    const game = holding(GRADUATE, WAREHOUSE, { from: "scenario.zainab" });
    const atHome = game.state.activity.tenure["activity.job-junior-dev"] ?? 0;
    expect(atHome).toBeGreaterThan(0);
    playMonths(game, 3);
    expect(game.state.activity.tenure[WAREHOUSE]).toBe(3);
    expect(localTenure(readOf(game))).toBe(3);
    expect(check(readOf(game), { type: "activity/local-tenure", months: 3 })).toEqual({ met: true, have: 3, need: 3 });
    expect(check(readOf(game), { type: "activity/local-tenure", months: 4 })).toEqual({ met: false, have: 3, need: 4 });
    const home: ReadCtx = { ...readOf(game), state: { ...game.state, place: { ...game.state.place, where: "home", country: null } } };
    expect(localTenure(home)).toBe(atHome);
    // A job abroad's months still count toward any job's tenure.
    expect(check(readOf(game), { type: "activity/tenure", activities: [], months: atHome + 3 }).met).toBe(true);
  });
});

describe("pay and tax abroad", () => {
  test("[R-ABROAD-002] [R-LADDER-005] given a sponsored care worker on £27,000, when a month is played, then the sponsor's job is the job held, the salary over twelve goes to the pound bank and the tax on the part above the line is taken in the same phase", () => {
    const game = careWorker();
    const result = game.endTurn();
    expect(game.state.activity.job).toBe(CARE);
    const month = divFloor(CARE_SALARY, 12);
    const tax = divFloor(bp(CARE_SALARY - content.country["country.uk"]!.taxFreeLine, content.country["country.uk"]!.taxBp), 12);
    expect(month).toBe(225000);
    expect(tax).toBe(33670);
    expect(moneyOf(result, "salary")).toEqual([{ type: "wallet/credited", currency: "GBP", pocket: "bank", amount: month, reason: "salary" }]);
    expect(moneyOf(result, "tax")).toEqual([{ type: "wallet/debited", currency: "GBP", pocket: "bank", amount: tax, reason: "tax" }]);
    // Rent and upkeep are charged too, by the obligation kind, after the job.
    const types = result.events.map((event) => event.type);
    const paid = result.events.findIndex((event) => (event as unknown as Money).reason === "tax");
    expect(paid).toBeLessThan(types.indexOf("activity/slots-recorded"));
    expect(moneyOf(result, "rent").length + moneyOf(result, "upkeep").length).toBeGreaterThan(0);
  });

  test("[R-WALLET-016] given a sponsored care worker on the route's salary, when the view is read before the month, then the month's pay is the salary the wallet credits less the tax it takes", () => {
    const game = careWorker();
    // The sponsor's job is taken up in the first month's work (R-SPONSOR-007); from then the view reads it.
    game.endTurn();
    const pay = game.view().job.pay;
    const result = game.endTurn();
    const credited = moneyOf(result, "salary").reduce((sum, money) => sum + money.amount, 0);
    const taxed = moneyOf(result, "tax").reduce((sum, money) => sum + money.amount, 0);
    expect(taxed).toBeGreaterThan(0);
    expect(pay).toEqual({ currency: "GBP", amount: credited - taxed });
  });

  test("[R-WALLET-016] given a job abroad under the tax line and one above it, when the view is read, then each month's pay is the wallet's credit less its tax", () => {
    for (const [status, job] of [[STUDENT, RETAIL], [GRADUATE, WAREHOUSE]] as const) {
      const game = holding(status, job);
      const pay = game.view().job.pay;
      const result = game.endTurn();
      const net = moneyOf(result, "salary").reduce((sum, money) => sum + money.amount, 0) - moneyOf(result, "tax").reduce((sum, money) => sum + money.amount, 0);
      expect(pay).toEqual({ currency: "GBP", amount: net });
    }
  });

  test("[R-ABROAD-002] given a job under the line, one above it and a job in the UAE, when a month is played, then the first pays no tax, the second the share above the line, the UAE none", () => {
    const retail = holding(STUDENT, RETAIL);
    expect(yearly(RETAIL)).toBeLessThan(content.country["country.uk"]!.taxFreeLine);
    const under = retail.endTurn();
    expect(moneyOf(under, "salary")).toEqual([{ type: "wallet/credited", currency: "GBP", pocket: "bank", amount: divFloor(yearly(RETAIL), 12), reason: "salary" }]);
    expect(moneyOf(under, "tax")).toEqual([]);

    const warehouse = holding(GRADUATE, WAREHOUSE);
    const above = warehouse.endTurn();
    expect(moneyOf(above, "tax")).toEqual([{ type: "wallet/debited", currency: "GBP", pocket: "bank", amount: 24336, reason: "tax" }]);

    const gulf = flown(content);
    const contract = gulf.state.route["route.gulf-contract"]!;
    gulf.state = { ...gulf.state, route: { ...gulf.state.route, "route.gulf-contract": { ...contract, state: "departed", gate: { gate: "contract", agent: { employer: "A guard company", salary: 180000, role: "guard" } } } } };
    applyEffects(gulf, [
      { type: "place/move", to: "abroad", country: "country.uae" },
      { type: "status/grant", status: "status.gulf-worker", job: GUARD },
    ]);
    const month = gulf.endTurn();
    // The agent's salary is a month: twelve of them over twelve.
    expect(moneyOf(month, "salary")).toEqual([{ type: "wallet/credited", currency: "AED", pocket: "bank", amount: 180000, reason: "salary" }]);
    expect(moneyOf(month, "tax")).toEqual([]);
  });

  test("[R-ABROAD-002] given a yearly salary at the line, a penny over it, and twelve pence over, when the month's tax is worked out, then it is nothing, nothing, and one penny less what rounds away", () => {
    const game = careWorker();
    const line = content.country["country.uk"]!.taxFreeLine;
    const taxAt = (salary: number) => monthlyTax(readOf(game), entry(CARE), { salary });
    expect(taxAt(line)).toBe(0);
    expect(taxAt(line + 1)).toBe(0);
    expect(taxAt(line + 43)).toBe(divFloor(bp(43, 2800), 12));
    expect(taxAt(line - 100000)).toBe(0);
  });

  test("[R-LUCK-008] given the first pay abroad, when the month is reported, then it is a staged line showing the pay in naira at the official rate, and the next month's is a plain salary line", () => {
    const game = careWorker();
    const rate = game.world().rates.GBP.official;
    const first = game.endTurn();
    const staged = first.lines.find((line) => line.key === "line.activity.salary-first-abroad");
    expect(staged).toEqual({
      key: "line.activity.salary-first-abroad",
      params: { job: CARE, amount: { currency: "GBP", amount: 225000 }, naira: { currency: "NGN", amount: mulDiv(225000, rate, 100) } },
      tone: "good",
      attention: false,
      counts: [],
      big: true,
    });
    const second = game.endTurn();
    expect(keys(second)).toContain("line.activity.salary");
    expect(keys(second)).not.toContain("line.activity.salary-first-abroad");
    expect(second.lines.some((line) => line.big === true && line.key.startsWith("line.activity."))).toBe(false);
  });

  test("[R-SHARE-001] given the first pay abroad, when the view is read through the month after it, then the card is the first pay abroad's, with the month and no name; the next month's pay brings none", () => {
    const game = careWorker();
    expect(game.view().card?.kind).not.toBe("first-pay-abroad");
    game.endTurn();
    expect(game.view().card).toMatchObject({ kind: "first-pay-abroad", months: game.state.turn.month, name: null, chapter: game.state.chapter.current });
    game.endTurn();
    expect(game.view().card?.kind).not.toBe("first-pay-abroad");
  });

  test("[R-ACTIVITY-001] [R-ABROAD-002] given a sponsor's job with no salary recorded, when its month is played, then nothing is paid and the job is still worked", () => {
    const game = flown(content);
    applyEffects(game, [{ type: "status/grant", status: SPONSORED, job: CARE }]);
    expect(jobTerms(readOf(game))).toEqual({});
    expect(monthlyPay(readOf(game), entry(CARE))).toBeNull();
    const result = game.endTurn();
    expect(moneyOf(result, "salary")).toEqual([]);
    expect(game.state.activity.tenure[CARE]).toBe(1);
  });
});

describe("cash work", () => {
  /** An overstayer in the kitchen, with detection taken out so the months can be watched. */
  function kitchen(job: Id<"activity"> = KITCHEN): Game {
    const change = (used: Content): Content => ({
      ...used,
      status: { ...used.status, [OVERSTAYER]: { ...used.status[OVERSTAYER]!, detectBp: 0 } },
      tuning: { ...used.tuning, ladder: { ...used.tuning.ladder, cashDetectBp: 0 } },
    });
    return holding(OVERSTAYER, job, { change });
  }

  test("[R-LADDER-003] given an overstayer in a cash job, when months are played, then the pay goes to the pound cash pocket as cash work with no tax, and a month the draw on `status` falls under `withheldBp` pays nothing", () => {
    const game = kitchen();
    const pay = divFloor(yearly(KITCHEN), 12);
    let withheld = 0;
    let paid = 0;
    for (let month = 0; month < 40 && (withheld === 0 || paid === 0); month += 1) {
      const n = game.state.draws.status ?? 0;
      const expectWithheld = draw(game.state.seed, "status", n, 10000) < entry(KITCHEN).withheldBp!;
      const result = game.endTurn();
      expect(moneyOf(result, "tax")).toEqual([]);
      const withheldLine = { key: "line.activity.pay-withheld", params: { job: KITCHEN, amount: { currency: "GBP", amount: pay } }, tone: "bad", attention: true, counts: [] };
      const credited = { type: "wallet/credited", currency: "GBP", pocket: "cash", amount: pay, reason: "cash-work" };
      expect(moneyOf(result, "cash-work")).toEqual(expectWithheld ? [] : [credited]);
      expect(result.lines.filter((line) => line.key === "line.activity.pay-withheld")).toEqual(expectWithheld ? [withheldLine] : []);
      const worked = result.events.find((event) => event.type === "activity/month-worked") as unknown as { pay: unknown } | undefined;
      expect(worked?.pay).toEqual(expectWithheld ? null : { currency: "GBP", amount: pay });
      withheld += expectWithheld ? 1 : 0;
      paid += expectWithheld ? 0 : 1;
    }
    expect(withheld).toBeGreaterThan(0);
    expect(paid).toBeGreaterThan(0);
  });

  test("[R-LADDER-003] given the courier's rented account, when a month is paid, then £60 a week comes off the pay before it reaches cash", () => {
    const game = kitchen(COURIER);
    const rent = mulDiv(tuning.ladder.accountRent, 52, 12);
    expect(monthlyPay(readOf(game), entry(COURIER))).toEqual({ currency: "GBP", amount: divFloor(yearly(COURIER), 12) - rent });
    expect(rent).toBe(26000);
  });

  test("[R-LADDER-003] given a cash job held and not, when the status kind asks, then cash work this month is read from the job held", () => {
    const game = kitchen();
    expect(cashWorkedThisMonth(readOf(game))).toBe(true);
    game.accept({ type: "activity/quit" });
    expect(cashWorkedThisMonth(readOf(game))).toBe(false);
    expect(cashWorkedThisMonth(readOf(holding(GRADUATE, WAREHOUSE)))).toBe(false);
  });

  test("[R-LADDER-003] [R-STATUS-005] given an overstayer with the base detection taken out, when a month is played in a cash job, with no job, and with the cash raise at 0, then only cash work found at a raise of 10000 removes the status", () => {
    const removed = (job: Id<"activity"> | null, cashDetectBp: number): boolean => {
      const change = (used: Content): Content => ({
        ...used,
        status: { ...used.status, [OVERSTAYER]: { ...used.status[OVERSTAYER]!, detectBp: 0 } },
        activity: { ...used.activity, [KITCHEN]: { ...used.activity[KITCHEN]!, withheldBp: 0 } },
        tuning: { ...used.tuning, ladder: { ...used.tuning.ladder, cashDetectBp } },
      });
      const game = holding(OVERSTAYER, job, { change });
      return game.endTurn().events.some((event) => event.type === "status/removed");
    };
    expect(tuning.ladder.cashDetectBp).toBe(200);
    expect(removed(KITCHEN, 10000)).toBe(true);
    expect(removed(null, 10000)).toBe(false);
    expect(removed(KITCHEN, 0)).toBe(false);
  });

  test("[R-STATUS-002] [R-LADDER-003] given a graduate in the warehouse whose status lapses to the overstayer's, when the next month is played, then the job ends before it is paid", () => {
    const game = holding(GRADUATE, WAREHOUSE);
    applyEffects(game, [{ type: "status/grant", status: OVERSTAYER }]);
    const result = game.endTurn();
    expect(result.events).toContainEqual({ type: "activity/job-ended", job: WAREHOUSE, why: "status" });
    expect(moneyOf(result, "salary")).toEqual([]);
  });
});

describe("the car as a work tool", () => {
  function withCar(game: Game): void {
    applyEffects(game, [{ type: "obligation/open", obligation: "obligation.car", principal: 855000 }]);
  }

  test("[R-LADDER-004] [R-CAR-002] given the care worker's visiting round, when months are played with the car, with it in default and without it, then the bonus is paid only while the car is held and not in default", () => {
    const without = careWorker();
    expect(moneyOf(without.endTurn(), "salary")[0]?.amount).toBe(225000);

    const driving = careWorker();
    withCar(driving);
    expect(hasCar(driving.state, content)).toBe(true);
    const bonus = entry(CARE).carBonus!;
    const month = driving.endTurn();
    expect(moneyOf(month, "salary")[0]?.amount).toBe(divFloor(CARE_SALARY + bonus, 12));
    // The bonus is taxed with the salary.
    expect(moneyOf(month, "tax")[0]?.amount).toBe(divFloor(bp(CARE_SALARY + bonus - content.country["country.uk"]!.taxFreeLine, 2800), 12));

    const [car] = Object.values(driving.state.obligation.items).filter((item) => item.entry === "obligation.car");
    driving.state = { ...driving.state, obligation: { items: { ...driving.state.obligation.items, [car!.id]: { ...car!, state: "defaulted" } } } };
    expect(hasCar(driving.state, content)).toBe(false);
    expect(moneyOf(driving.endTurn(), "salary")[0]?.amount).toBe(225000);
  });

  test("[R-LADDER-004] [R-CAR-006] given an activity that needs the car, when it is judged with no car, with a car and no licence, and with both, then only the last allows it", () => {
    const needing: Content = { ...content, activity: { ...content.activity, "activity.call-home": { ...entry("activity.call-home"), needsCar: true } } };
    const game = flown(content, { from: "scenario.tunde", change: (used) => ({ ...used, activity: { ...used.activity, "activity.call-home": needing.activity["activity.call-home"]! } }) });
    const allowed = () => game.view().activities.find((option) => option.id === "activity.call-home")?.allowed;
    expect(allowed()).toBe(false);
    game.expectRejected({ type: "activity/now", activity: "activity.call-home", param: null }, "not-legal");
    withCar(game);
    // Tunde drives, but the home licence comes with the first month abroad.
    expect(allowed()).toBe(false);
    game.endTurn();
    expect(allowed()).toBe(true);
    game.endTurn([slot("activity.call-home")]);
  });
});

describe("the sponsor's job", () => {
  test("[R-LADDER-005] [R-STATUS-003] given a sponsored care worker, when the job is quit, then the status clock starts, and the job is not taken up again while it runs", () => {
    const game = careWorker();
    game.endTurn();
    game.accept({ type: "activity/quit" });
    expect(game.state.status.current).toMatchObject({ entry: SPONSORED, clock: content.status[SPONSORED]!.clockMonths });
    game.endTurn();
    expect(game.state.activity.job).toBeNull();
  });

  test("[R-LADDER-005] [R-STATUS-003] given a Gulf worker, when the job ends by an effect, then the status lapses at once", () => {
    const game = flown(content);
    applyEffects(game, [
      { type: "place/move", to: "abroad", country: "country.uae" },
      { type: "status/grant", status: "status.gulf-worker", job: GUARD },
    ]);
    game.endTurn();
    expect(game.state.activity.job).toBe(GUARD);
    applyEffects(game, [{ type: "activity/end-job", why: "contract" }]);
    expect(game.state.status.current?.entry).toBe("status.uae-irregular");
  });

  test("[R-LADDER-005] given a graduate and a settled resident, when a job that carries its own sponsorship is started, then the graduate is granted the sponsored status for that job and the settled resident keeps theirs", () => {
    const graduate = holding(GRADUATE);
    applyEffects(graduate, [{ type: "activity/start-job", job: NURSE }]);
    expect(graduate.state.status.current).toMatchObject({ entry: SPONSORED, job: NURSE });
    const settled = holding(SETTLED);
    applyEffects(settled, [{ type: "activity/start-job", job: NURSE }]);
    expect(settled.state.status.current?.entry).toBe(SETTLED);
    expect(settled.state.activity.job).toBe(NURSE);
  });

  test("[R-STATUS-002] given a student, when a job the status does not allow is offered and accepted, then it does not start", () => {
    const game = flown(content);
    applyEffects(game, [{ type: "activity/start-job", job: WAREHOUSE }]);
    expect(game.state.activity.job).toBeNull();
  });
});

describe("overtime", () => {
  test("[R-LADDER-001] [R-LADDER-006] given a warehouse job and a cash job, when overtime fills a slot, then a quarter of the month's pay more comes in, to the bank as salary or to cash as cash work; a student's part-time job may not", () => {
    const game = holding(GRADUATE, WAREHOUSE);
    game.endTurn();
    const month = divFloor(yearly(WAREHOUSE), 12);
    const result = game.endTurn([slot("activity.overtime")]);
    expect(moneyOf(result, "salary")).toEqual([
      { type: "wallet/credited", currency: "GBP", pocket: "bank", amount: month, reason: "salary" },
      { type: "wallet/credited", currency: "GBP", pocket: "bank", amount: bp(month, tuning.ladder.overtimeBp), reason: "salary" },
    ]);
    expect(keys(result)).toContain("line.activity.overtime");

    const cash = holding(OVERSTAYER, KITCHEN);
    const extra = cash.endTurn([slot("activity.overtime")]);
    expect(moneyOf(extra, "cash-work").at(-1)).toEqual({ type: "wallet/credited", currency: "GBP", pocket: "cash", amount: bp(divFloor(yearly(KITCHEN), 12), 2500), reason: "cash-work" });

    holding(STUDENT, RETAIL).expectRejected({ type: "turn/end", slots: [slot("activity.overtime")] }, "not-legal");
  });
});

describe("sick pay", () => {
  function lockedFor(game: Game, months: number): void {
    applyEffects(game, [{ type: "turn/lock", slots: 1, months, why: "illness" }]);
  }

  test("[R-HEALTH-004] given a slot locked for illness, when the month is played, then a job with no sick leave pays half and one with sick leave pays in full", () => {
    const teacher = start({ content, scenario: "scenario.ada" });
    applyEffects(teacher, [{ type: "activity/start-job", job: "activity.job-teacher" }]);
    lockedFor(teacher, 1);
    const pay = yearly("activity.job-teacher");
    const sick = teacher.endTurn();
    expect(moneyOf(sick, "salary")).toEqual([{ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: bp(pay, tuning.health.sickPayBp), reason: "salary" }]);
    expect(keys(sick)).toContain("line.activity.sick-pay");
    expect(moneyOf(teacher.endTurn(), "salary")[0]?.amount).toBe(pay);

    const banker = start({ content, scenario: "scenario.tunde" });
    expect(entry("activity.job-bank-officer").sickLeave).toBe(true);
    lockedFor(banker, 1);
    expect(moneyOf(banker.endTurn(), "salary")[0]?.amount).toBe(yearly("activity.job-bank-officer"));
  });

  test("[R-HEALTH-004] given an illness lock for two months and another reason's lock, when months are played, then both sick months pay half and the other lock pays in full", () => {
    const teacher = start({ content, scenario: "scenario.ada" });
    applyEffects(teacher, [{ type: "activity/start-job", job: "activity.job-teacher" }]);
    const pay = yearly("activity.job-teacher");
    lockedFor(teacher, 2);
    expect(moneyOf(teacher.endTurn(), "salary")[0]?.amount).toBe(bp(pay, 5000));
    expect(moneyOf(teacher.endTurn(), "salary")[0]?.amount).toBe(bp(pay, 5000));
    expect(moneyOf(teacher.endTurn(), "salary")[0]?.amount).toBe(pay);
    applyEffects(teacher, [{ type: "turn/lock", slots: 1, months: 1, why: "burial" }]);
    expect(moneyOf(teacher.endTurn(), "salary")[0]?.amount).toBe(pay);
  });
});

describe("buying the car and the driving test", () => {
  /** The real registry with the credit file taken as 30 or more, so the test needs no credit history. */
  function creditMet(): Registry {
    return registry().map((kind) => (kind.kind !== "credit" ? kind : { ...kind, requirements: { ...kind.requirements, "credit/min": () => ({ met: true }) } }));
  }

  test("[R-CAR-001] [R-CAR-006] given a driver a month into the UK with the credit the lender asks, when the car is bought, then the deposit is paid as car-deposit and the car opens for the price less the deposit; without a licence it may not be", () => {
    const tunde = flown(content, { from: "scenario.tunde", kinds: creditMet() });
    tunde.endTurn();
    expect(check(readOf(tunde), { type: "document/held", document: HOME_LICENCE }).met).toBe(true);
    const result = tunde.endTurn([slot("activity.buy-car-finance")]);
    const car = content.obligation["obligation.car"]!.car!;
    const deposit = bp(car.price, car.depositBp);
    expect(moneyOf(result, "car-deposit")).toEqual([{ type: "wallet/debited", currency: "GBP", pocket: "bank", amount: deposit, reason: "car-deposit" }]);
    const opened = Object.values(tunde.state.obligation.items).find((item) => item.entry === "obligation.car");
    // The obligation kind takes the first payment in the same month, so only the principal is pinned here.
    expect(opened).toMatchObject({ principal: car.price - deposit });
    expect(opened?.outstanding).toBeLessThanOrEqual(car.price - deposit);
    expect(hasCar(tunde.state, content)).toBe(true);

    const ada = flown(content, { kinds: creditMet() });
    ada.endTurn();
    ada.expectRejected({ type: "activity/now", activity: "activity.buy-car-finance", param: null }, "not-legal");
  });

  test("[R-CAR-006] given the tuning, when the driving test's fee is read, then it is the practical test's £62, as the page says", () => {
    expect(content.tuning.car.testFee).toBe(6200);
  });

  test("[R-CAR-006] given a driver who arrives, when months pass, then the home licence holds for the 12 months from the first month abroad and not the 13th, and a non-driver never holds it", () => {
    const tunde = flown(content, { from: "scenario.tunde" });
    const held = () => check(readOf(tunde), { type: "document/held", document: HOME_LICENCE }).met;
    expect(held()).toBe(false);
    tunde.endTurn();
    const first = tunde.state.turn.month;
    expect(tunde.state.document[HOME_LICENCE]).toMatchObject({ state: "held", expiresMonth: first + 12 });
    playMonths(tunde, 11);
    expect(held()).toBe(true);
    playMonths(tunde, 1);
    expect(held()).toBe(false);

    const ada = flown(content);
    ada.endTurn();
    expect(check(readOf(ada), { type: "document/held", document: HOME_LICENCE }).met).toBe(false);
  });

  test("[R-CAR-006] [R-CAR-002] [R-LADDER-004] given a driver with a car, when the home licence runs out after 12 months, then the car's activities close and the car cannot be bought, until the UK test is passed", () => {
    const needing = (used: Content): Content => ({ ...used, activity: { ...used.activity, "activity.call-home": { ...used.activity["activity.call-home"]!, needsCar: true } } });
    const tunde = flown(content, { from: "scenario.tunde", kinds: creditMet(), change: needing });
    applyEffects(tunde, [
      { type: "money/add", currency: "GBP", pocket: "bank", amount: 3000000, reason: "gift" },
      { type: "obligation/open", obligation: "obligation.car", principal: 855000 },
    ]);
    const allowed = (id: Id<"activity">) => tunde.view().activities.find((option) => option.id === id)?.allowed;
    tunde.endTurn();
    playMonths(tunde, 11);
    expect(hasCar(tunde.state, tunde.content)).toBe(true);
    expect(allowed("activity.call-home")).toBe(true);
    playMonths(tunde, 1);
    expect(check(readOf(tunde), { type: "document/held", document: HOME_LICENCE }).met).toBe(false);
    expect(allowed("activity.call-home")).toBe(false);
    // The credit file is judged by the registry in play, so the purchase is judged through a turn.
    tunde.expectRejected({ type: "activity/now", activity: "activity.call-home", param: null }, "not-legal");
    tunde.expectRejected({ type: "activity/now", activity: "activity.buy-car-finance", param: null }, "not-legal");
    for (let month = 0; month < 12 && !check(readOf(tunde), { type: "document/held", document: UK_LICENCE }).met; month += 1) {
      if (tunde.state.turn.banked < 1) tunde.grant(tuning.turn.cap);
      tunde.endTurn([slot("activity.driving-test")]);
    }
    expect(allowed("activity.call-home")).toBe(true);
    tunde.endTurn([slot("activity.call-home")]);
  });

  test("[R-CAR-006] given earlier attempts, when the pass chance is worked out, then it is 5500 plus 500 for each, capped at 9000", () => {
    expect([0, 1, 6, 7, 8, 20].map((attempts) => passChanceBp(attempts, tuning.car))).toEqual([5500, 6000, 8500, 9000, 9000, 9000]);
  });

  test("[R-CAR-006] given a learner in the UK, when the test is taken until it is passed, then the lessons are paid once and the fee each time, the draw on `status` decides, and a pass grants the UK licence", () => {
    const game = flown(content);
    const before = game.state.wallet.totals.out;
    let attempts = 0;
    for (let month = 0; month < 12 && !check(readOf(game), { type: "document/held", document: UK_LICENCE }).met; month += 1) {
      const n = game.state.draws.status ?? 0;
      const passes = draw(game.state.seed, "status", n, 10000) < passChanceBp(attempts, tuning.car);
      const result = game.endTurn([slot("activity.driving-test")]);
      attempts += 1;
      expect(moneyOf(result, "fee-test")).toEqual([{ type: "wallet/debited", currency: "GBP", pocket: "bank", amount: tuning.car.testFee, reason: "fee-test" }]);
      expect(moneyOf(result, "study")).toEqual(attempts === 1 ? [{ type: "wallet/debited", currency: "GBP", pocket: "bank", amount: tuning.car.lessons, reason: "study" }] : []);
      expect(result.events).toContainEqual({ type: "activity/driving-test", attempt: attempts, passed: passes });
      expect(drivingAttempts(game.state)).toBe(attempts);
    }
    expect(check(readOf(game), { type: "document/held", document: UK_LICENCE }).met).toBe(true);
    expect(game.state.document[UK_LICENCE]?.expiresMonth).toBeNull();
    expect((game.state.wallet.totals.out.study?.GBP ?? 0) - (before.study?.GBP ?? 0)).toBe(tuning.car.lessons);
    game.expectRejected({ type: "turn/end", slots: [slot("activity.driving-test")] }, "not-legal");
    // The attempts are no job's months.
    expect(check(readOf(game), { type: "activity/tenure", activities: [], months: 1 }).met).toBe(false);
    expect(activityKind.invariants?.(game.state, content)).toEqual([]);
  });
});

describe("requirements the activity kind judges", () => {
  test("[R-LADDER-002] given the local tenure requirement, when it is judged at home with no job months, then it is not met and shows what is needed", () => {
    const ada = start({ content, scenario: "scenario.ada" });
    const requirement: Requirement = { type: "activity/local-tenure", months: 1 };
    expect(check({ state: ada.state, world: ada.world(), content }, requirement)).toEqual({ met: false, have: 0, need: 1 });
  });
});
