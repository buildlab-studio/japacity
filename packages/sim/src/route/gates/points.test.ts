// activity:now-acts-and-month-acts: a now-act (an application, a paper, a visit) is refused in a slot, so each probe sends one as
// activity/now, and an application checked as applying is read in the month it is sent.
import { fc, test } from "@fast-check/vitest";
import { content } from "@japacity/content";
import { describe, expect } from "vitest";

import { check } from "../../engine/check";
import { checkInvariants } from "../../engine/invariants";
import type { Content, Id, ReadCtx, RouteState, ScenarioEntry, State, Tuning } from "../../engine/types";
import { ALWAYS_GRANTED } from "../../testing/place.journey";
import type { Game } from "../../testing/play";
import { readOf, routeKeys } from "../../testing/read";
import { READY_PAPERS, UNIT, applyEffects, readyLife, slot } from "../../testing/route.journey";
import type { LifeOptions } from "../../testing/route.journey";
import { refusalChanceBp } from "../route.logic";
import { GATES } from "./index";
import { invites, pointsFunds, pointsParts, pointsScore, pointsUnexplainedBp } from "./points";
import { GRADUATE, CANADA_ROUTE, ENGLISH, JUNIOR_DEV, LOOK_INTO, READY } from "../../testing/ids";

const ENTER_POOL: Id<"activity"> = "activity.enter-pool";
const ECA: Id<"document"> = "document.eca";
const DEVELOPER: Id<"scenario"> = "scenario.developer";

const entry = content.route[CANADA_ROUTE]!;
const block = entry.points!;
const table = content.points[block.table]!;
const startVar = (id: Id<"var">): number => content.var[id]!.start;
const CUTOFF = block.cutoffVar;
const CARE_CUTOFF = block.careCutoffVar!;
const FEE = startVar(block.feeVar);
const DECISION_MONTHS = startVar(block.decisionVar);
/** The developer's score on the page's worked example. */
const DEVELOPER_SCORE = 404;

const ALWAYS_REFUSED: Partial<Tuning["route"]> = { refusalMinBp: 10000, refusalMaxBp: 10000 };

/** The ready papers and a credential assessment, so a life reaches the pool in a few turns. */
const ECA_PAPERS: ScenarioEntry["documents"] = [...READY_PAPERS, { document: ECA, monthsLeft: 60, value: null }];
/** Funds in pounds, the fee in Canadian dollars, and naira cash for the upkeep. */
const POCKETS: ScenarioEntry["pockets"] = {
  NGN: { bank: 2000000 * UNIT, cash: 3000000 * UNIT },
  GBP: { bank: 40000 * UNIT, cash: 0 },
  CAD: { bank: 5000 * UNIT, cash: 0 },
};
/** Funds in pounds and nothing the Canadian fee can be paid from while the bank queue holds the naira leg (wallet:foreign-fee-payment-order). */
const NO_FEE_POCKETS: ScenarioEntry["pockets"] = { NGN: { bank: 0, cash: 3000000 * UNIT }, GBP: { bank: 40000 * UNIT, cash: 0 } };
const QUEUED: Record<Id<"var">, number> = { "var.fx-bank-queue": 1 };

function developer(options: LifeOptions = {}): Game {
  return readyLife(content, { from: DEVELOPER, quiet: true, documents: ECA_PAPERS, pockets: POCKETS, ...options });
}

const EDUCATION_CUTOFF = block.educationCutoffVar!;

/** The developer's life with `months` of its 18 months of work in the teacher's job and the rest in its own, so the score stays the page's 404. */
function teacher(months: number, vars: Record<Id<"var">, number>): Game {
  return developer({
    vars: () => vars,
    change: (used) => {
      const ready = used.scenario[READY]!;
      const tenure = months >= 18 ? { "activity.job-teacher": months } : { "activity.job-teacher": months, [JUNIOR_DEV]: 18 - months };
      return { ...used, scenario: { ...used.scenario, [READY]: { ...ready, tenure } } };
    },
  });
}

function canada(game: Game): RouteState {
  return game.state.route[CANADA_ROUTE]!;
}

function gate(game: Game): { poolMonth: number | null; invitedMonth: number | null } {
  const held = canada(game).gate;
  if (held?.gate !== "points") throw new Error("The Canada route holds no points gate state.");
  return { poolMonth: held.poolMonth, invitedMonth: held.invitedMonth };
}

function stepMet(game: Game, step: string): boolean {
  return check(readOf(game), { type: "route/gate-step", route: CANADA_ROUTE, step }).met;
}

/** Months pass until the route is heard of (by month 5), then it is looked into. */
function toKnown(game: Game): void {
  for (let month = 0; month < 6 && canada(game).state === "unknown"; month += 1) game.endTurn();
  expect(canada(game).state).toBe("heard");
  game.endTurn([slot(LOOK_INTO, CANADA_ROUTE)]);
  expect(canada(game).state).toBe("known");
}

/**
 * From a known route, the pool entered and the month ended. Returns the route lines of both. activity:now-acts-and-month-acts: entering
 * the pool is an act done at once, sent as `activity/now`, so the profile is recorded in the month it is sent.
 */
function enterPool(game: Game): string[] {
  return routeKeys(game.endTurn([slot(ENTER_POOL)]).lines);
}

function toPool(game: Game): string[] {
  toKnown(game);
  const sent = game.state.turn.month;
  const keys = enterPool(game);
  expect(gate(game).poolMonth).toBe(sent);
  return keys;
}

/** A state like the game's with the score's inputs set, for the table's edges. */
function scoreInputs(base: State, inputs: { months: number; level: number; band: number | null; work: number }): State {
  const document = { ...base.document };
  if (inputs.band === null) delete document[ENGLISH];
  else document[ENGLISH] = { state: "held", readyMonth: null, expiresMonth: null, value: inputs.band };
  return {
    ...base,
    quality: { ...base.quality, "quality.age-months": inputs.months, "quality.education-level": inputs.level },
    document,
    activity: { ...base.activity, tenure: inputs.work === 0 ? {} : { [JUNIOR_DEV]: inputs.work } },
  };
}

describe("the points gate", () => {
  const base = developer();
  const read = (inputs: { months: number; level: number; band: number | null; work: number }, used: Content = content): ReadCtx => ({
    state: scoreInputs(base.state, inputs),
    world: base.world(),
    content: used,
  });
  const DEVELOPER_INPUTS = { months: 300, level: 3, band: 70, work: 18 };

  describe("the score", () => {
    test("[route-gates:points-score-from-table] given the developer at 25 with a bachelor's, band 7.0 and 18 months in a job, when its score is asked for, then it is 110 + 120 + 124 + 25 + 25 = 404", () => {
      const game = developer();
      expect(pointsParts(readOf(game), CANADA_ROUTE)).toEqual({ age: 110, education: 120, language: 124, transfer: 50 });
      expect(pointsScore(readOf(game), CANADA_ROUTE)).toBe(DEVELOPER_SCORE);
    });

    test("[route-gates:points-score-from-table] given the graduate at 23 with band 6.5 and no job yet, when its score is asked for, then it is 110 + 120 + 92 + 13 = 335", () => {
      const papers = READY_PAPERS.map((paper) => (paper.document === ENGLISH ? { ...paper, value: 65 } : paper));
      const game = readyLife(content, { from: GRADUATE, quiet: true, documents: papers });
      expect(pointsParts(readOf(game), CANADA_ROUTE)).toEqual({ age: 110, education: 120, language: 92, transfer: 13 });
      expect(pointsScore(readOf(game), CANADA_ROUTE)).toBe(335);
    });

    test.each(table.age.map((row, index) => [row.years, row.points, table.age[index - 1]?.points ?? 0] as const))(
      "[route-gates:points-score-from-table] given an age of %i whole years, when the age part is read, then it is %i, and a month younger it is the row before's %i",
      (years, points, before) => {
        expect(pointsParts(read({ ...DEVELOPER_INPUTS, months: years * 12 }), CANADA_ROUTE).age).toBe(points);
        expect(pointsParts(read({ ...DEVELOPER_INPUTS, months: years * 12 - 1 }), CANADA_ROUTE).age).toBe(before);
      },
    );

    test("[route-gates:points-score-from-table] given the age table, when the oldest age the quality allows is read, then the last row is a floor and scores 0", () => {
      expect(pointsParts(read({ ...DEVELOPER_INPUTS, months: content.quality["quality.age-months"]!.max }), CANADA_ROUTE).age).toBe(0);
    });

    test.each([
      [0, 0],
      [1, 30],
      [2, 98],
      [3, 120],
      [4, 135],
      [5, 150],
    ])("[route-gates:points-score-from-table] given an education level of %i, when the education part is read, then it is %i", (level, points) => {
      expect(pointsParts(read({ ...DEVELOPER_INPUTS, level }), CANADA_ROUTE).education).toBe(points);
    });

    test.each([
      [null, 0],
      [55, 0],
      [60, 68],
      [65, 92],
      [70, 124],
      [75, 124],
      [80, 136],
      [90, 136],
    ])("[route-gates:points-score-from-table] given an English band of %s, when the language part is read, then the four abilities score %i", (band, points) => {
      expect(pointsParts(read({ ...DEVELOPER_INPUTS, band }), CANADA_ROUTE).language).toBe(points);
    });

    test.each([
      // band, months of work, transferability
      [null, 40, 0],
      [55, 40, 0],
      [60, 0, 13],
      [65, 11, 13],
      [65, 12, 26],
      [65, 35, 26],
      [65, 36, 38],
      [70, 0, 25],
      [70, 11, 25],
      [70, 12, 50],
      [70, 35, 50],
      [70, 36, 75],
      [80, 120, 75],
    ])("[route-gates:points-score-from-table] given band %s and %i months of work with a degree, when transferability is read, then it is %i", (band, work, points) => {
      expect(pointsParts(read({ ...DEVELOPER_INPUTS, band, work }), CANADA_ROUTE).transfer).toBe(points);
    });

    test("[route-gates:points-score-from-table] given a transferability cap below the two parts, when the developer's score is asked for, then the transferable part stops at the cap", () => {
      const capped: Content = { ...content, points: { ...content.points, [block.table]: { ...table, transfer: { ...table.transfer, cap: 30 } } } };
      expect(pointsParts(read(DEVELOPER_INPUTS, capped), CANADA_ROUTE).transfer).toBe(30);
      expect(pointsScore(read(DEVELOPER_INPUTS, capped), CANADA_ROUTE)).toBe(DEVELOPER_SCORE - 20);
    });

    // From 20: before it the table rises, on the 18th and the 20th birthdays.
    test.prop([
      fc.integer({ min: 240, max: 1199 }),
      fc.integer({ min: 0, max: 5 }),
      fc.option(fc.integer({ min: 8, max: 18 }).map((half) => half * 5)),
      fc.integer({ min: 0, max: 120 }),
    ])("[route-gates:points-score-from-table] given any age, education, band and work, when the score is asked for, then it is the sum of its parts, the transfer is within the cap, and from 20 a month older never scores more", (months, level, band, work) => {
      const now = read({ months, level, band, work });
      const parts = pointsParts(now, CANADA_ROUTE);
      expect(pointsScore(now, CANADA_ROUTE)).toBe(parts.age + parts.education + parts.language + parts.transfer);
      expect(parts.transfer).toBeLessThanOrEqual(table.transfer.cap);
      expect(pointsScore(read({ months: months + 1, level, band, work }), CANADA_ROUTE)).toBeLessThanOrEqual(pointsScore(now, CANADA_ROUTE));
    });
  });

  describe("the pool", () => {
    test("[route-gates:entering-the-pool] given the route known, the assessment, band 7.0, 12 months of work and the funds, when the pool slot is played, then a profile is recorded this month and the pool step is reached", () => {
      const game = developer();
      toKnown(game);
      expect(stepMet(game, "pool")).toBe(false);
      const sent = game.state.turn.month;
      const keys = enterPool(game);
      expect(gate(game)).toEqual({ poolMonth: sent, invitedMonth: null });
      expect(keys).toContain("line.route.pool-entered");
      expect(stepMet(game, "pool")).toBe(true);
      expect(game.view().routes.find((route) => route.id === CANADA_ROUTE)?.checklist.find((item) => item.id === "pool")?.met).toBe(true);
      expect(checkInvariants(game.state, game.content)).toEqual([]);
    });

    test("[route-gates:entering-the-pool] given no credential assessment, when the pool slot is played, then the turn is rejected", () => {
      const game = developer({ documents: READY_PAPERS });
      toKnown(game);
      expect(game.expectRejected({ type: "activity/now", activity: ENTER_POOL, param: null }, "not-legal").code).toBe("not-legal");
    });

    test.each([
      [55, false],
      [60, true],
    ])("[route-gates:entering-the-pool] given an English band of %i, when the pool slot is played, then it is accepted: %s", (band, accepted) => {
      const papers = ECA_PAPERS.map((paper) => (paper.document === ENGLISH ? { ...paper, value: band } : paper));
      const game = developer({ documents: papers });
      toKnown(game);
      expect(game.send({ type: "activity/now", activity: ENTER_POOL, param: null }).ok).toBe(accepted);
      expect(gate(game).poolMonth !== null).toBe(accepted);
    });

    test.each([
      [11, false],
      [12, true],
    ])("[route-gates:entering-the-pool] given %i months of work when the pool slot is sent, then it is accepted: %s", (months, accepted) => {
      // A first life counts the months the route takes to become known; the second starts that many months short.
      const probe = developer();
      toKnown(probe);
      const played = (probe.state.activity.tenure[JUNIOR_DEV] ?? 0) - 18;
      const game = developer({ change: (used) => ({ ...used, scenario: { ...used.scenario, [READY]: { ...used.scenario[READY]!, tenure: { [JUNIOR_DEV]: months - played } } } }) });
      toKnown(game);
      expect(game.state.activity.tenure[JUNIOR_DEV]).toBe(months);
      expect(game.send({ type: "activity/now", activity: ENTER_POOL, param: null }).ok).toBe(accepted);
      expect(gate(game).poolMonth !== null).toBe(accepted);
    });

    test("[route-gates:entering-the-pool] given the window closed, when the pool slot is played, then the turn is rejected", () => {
      let closed = false;
      const game = developer({ vars: () => (closed ? { [entry.window!]: 0 } : {}) });
      toKnown(game);
      closed = true;
      expect(game.expectRejected({ type: "activity/now", activity: ENTER_POOL, param: null }, "not-legal").code).toBe("not-legal");
    });

    test("[route-gates:entering-the-pool] given a live profile, when the pool slot is played again, then the turn is rejected", () => {
      const game = developer();
      toPool(game);
      expect(game.expectRejected({ type: "activity/now", activity: ENTER_POOL, param: null }, "not-legal").code).toBe("not-legal");
    });

    test("[route-gates:entering-the-pool] given the funds read in Canadian cents, when the Canadian line is exactly what is shown, then the profile is recorded, and one cent more, then it is not", () => {
      // The same seed plays the same months, so a first life tells what is shown in the pool month's clocks.
      const probe = developer({ vars: () => ({ [block.fundsVar]: 1000000000 }) });
      toKnown(probe);
      // The slot is judged when the turn is accepted, so what is shown then is the line to pin.
      const { shown } = pointsFunds(readOf(probe), CANADA_ROUTE);
      probe.expectRejected({ type: "activity/now", activity: ENTER_POOL, param: null }, "not-legal");
      expect(gate(probe).poolMonth).toBeNull();
      for (const [required, entered] of [
        [shown, true],
        [shown + 1, false],
      ] as const) {
        const game = developer({ vars: () => ({ [block.fundsVar]: required }) });
        toKnown(game);
        // The slot's own requirement reads the Canadian line, so a short file cannot even plan the slot.
        if (entered) enterPool(game);
        else game.expectRejected({ type: "activity/now", activity: ENTER_POOL, param: null }, "not-legal");
        expect(gate(game).poolMonth !== null).toBe(entered);
      }
    });

    test("[route-gates:entering-the-pool] given money in several currencies, when the funds are read, then bank and locked pockets count in Canadian cents and cash does not", () => {
      const game = developer({ pockets: { NGN: { bank: 0, cash: 5000000 * UNIT }, CAD: { bank: 2000 * UNIT, cash: 3000 * UNIT } } });
      applyEffects(game, [{ type: "money/add", currency: "CAD", pocket: "bank", amount: 500 * UNIT, reason: "gift", locked: true }]);
      expect(pointsFunds(readOf(game), CANADA_ROUTE)).toEqual({ shown: 2500 * UNIT, required: startVar(block.fundsVar) });
    });
  });

  describe("the invitation", () => {
    test("[route-gates:pool-draws-invite] given a live profile and the cut-off at the score, when the month's clocks run, then the route is applying, decided after the decision months, and the fee is paid in Canadian cents as a visa fee", () => {
      const game = developer({ vars: () => ({ [CUTOFF]: DEVELOPER_SCORE }) });
      toKnown(game);
      expect(pointsScore(readOf(game), CANADA_ROUTE)).toBe(DEVELOPER_SCORE);
      const cad = game.state.wallet.pockets.CAD.bank;
      const keys = enterPool(game);
      const month = game.state.turn.month;
      expect(keys).toEqual(expect.arrayContaining(["line.route.pool-entered", "line.route.invited", "line.route.applied"]));
      expect(canada(game).state).toBe("applying");
      expect(gate(game).invitedMonth).toBe(month);
      expect(canada(game).visa).toMatchObject({ submittedMonth: month, decisionMonth: month + DECISION_MONTHS, surchargePaid: 0 });
      expect(game.state.wallet.pockets.CAD.bank).toBe(cad - FEE);
      expect(game.state.wallet.totals.out["fee-visa"]).toEqual({ CAD: FEE });
      expect(stepMet(game, "invited")).toBe(true);
      expect(checkInvariants(game.state, game.content)).toEqual([]);
    });

    test("[route-gates:pool-draws-invite] given the cut-off one point above the score, when the month's clocks run, then nobody is invited and the profile waits", () => {
      const game = developer({ vars: () => ({ [CUTOFF]: DEVELOPER_SCORE + 1 }) });
      toPool(game);
      game.endTurn();
      expect(canada(game).state).toBe("known");
      expect(gate(game).invitedMonth).toBeNull();
    });

    test.each([
      [60, true],
      [59, false],
    ])("[route-gates:pool-draws-invite] given care at %i and the care cut-off at the score, when the clocks run, then an invitation comes: %s", (care, invited) => {
      const game = developer({ qualities: { "quality.care": care }, vars: () => ({ [CARE_CUTOFF]: DEVELOPER_SCORE }) });
      toPool(game);
      expect(invites(readOf(game), CANADA_ROUTE)).toBe(invited);
      expect(canada(game).state).toBe(invited ? "applying" : "known");
    });

    test.each([
      [60, true],
      [59, false],
    ])("[route-gates:points-view-carries-invites] given care at %i, the care cut-off at the score and the general cut-off above it, when the gate is viewed, then it says an invitation will come: %s", (care, invited) => {
      const game = developer({ qualities: { "quality.care": care }, vars: () => ({ [CARE_CUTOFF]: DEVELOPER_SCORE }) });
      toKnown(game);
      const viewed = game.view().routes.find((route) => route.id === CANADA_ROUTE)?.gate;
      if (viewed?.gate !== "points") throw new Error("Canada's gate is not the points gate.");
      expect(viewed.points).toBe(DEVELOPER_SCORE);
      expect(viewed.cutoff).toBeGreaterThan(viewed.points);
      expect(viewed.invites).toBe(invited);
      expect(viewed.invites).toBe(invites(readOf(game), CANADA_ROUTE));
    });

    test("[route-gates:points-view-carries-invites] given the general cut-off at the score, when the gate is viewed, then it says an invitation will come; one point above, it does not", () => {
      for (const [cutoff, invited] of [
        [DEVELOPER_SCORE, true],
        [DEVELOPER_SCORE + 1, false],
      ] as const) {
        const game = developer({ vars: () => ({ [CUTOFF]: cutoff }) });
        toKnown(game);
        const viewed = game.view().routes.find((route) => route.id === CANADA_ROUTE)?.gate;
        expect(viewed).toMatchObject({ gate: "points", invites: invited });
      }
    });

    test.each([
      [12, true],
      [11, false],
    ])("[route-gates:pool-draws-invite] given %i months across the teacher jobs and the education cut-off at the score while the general one is above it, when the clocks run, then an invitation comes: %s", (months, invited) => {
      const game = teacher(months, { [EDUCATION_CUTOFF]: DEVELOPER_SCORE });
      toPool(game);
      expect(pointsScore(readOf(game), CANADA_ROUTE)).toBe(DEVELOPER_SCORE);
      expect(invites(readOf(game), CANADA_ROUTE)).toBe(invited);
      expect(canada(game).state).toBe(invited ? "applying" : "known");
    });

    test("[route-gates:pool-draws-invite] given a teacher with the months and the education cut-off at its start, when the clocks run, then no invitation comes: the cut-off stands only while the education draw holds it", () => {
      expect(startVar(EDUCATION_CUTOFF)).toBe(9999);
      expect(table.educationMonths).toBe(12);
      expect(table.educationJobs).toContain("activity.job-teacher");
      const game = teacher(18, {});
      toPool(game);
      game.endTurn();
      expect(invites(readOf(game), CANADA_ROUTE)).toBe(false);
      expect(canada(game).state).toBe("known");
    });

    test("[route-gates:points-view-carries-invites] given a teacher with the months and the education cut-off at the score, when the gate is viewed, then it says an invitation will come and carries the teachers' cut-off; with no draw it carries none", () => {
      const game = teacher(12, { [EDUCATION_CUTOFF]: DEVELOPER_SCORE });
      toKnown(game);
      const viewed = game.view().routes.find((route) => route.id === CANADA_ROUTE)?.gate;
      expect(viewed).toMatchObject({ gate: "points", points: DEVELOPER_SCORE, invites: true, educationCutoff: DEVELOPER_SCORE });
      const none = teacher(12, {});
      toKnown(none);
      expect(none.view().routes.find((route) => route.id === CANADA_ROUTE)?.gate).toMatchObject({ gate: "points", invites: false, educationCutoff: null });
    });

    test("[route-gates:pool-draws-invite] given a live profile at the cut-off but the funds short when the invitation comes, when the clocks run, then nothing is sent or paid and the invitation holds a month; still short, it lapses and the profile goes on", () => {
      let vars: Record<Id<"var">, number> = { [CUTOFF]: DEVELOPER_SCORE + 1 };
      const game = developer({ vars: () => vars });
      toPool(game);
      const pool = gate(game).poolMonth;
      vars = { [CUTOFF]: DEVELOPER_SCORE, [block.fundsVar]: pointsFunds(readOf(game), CANADA_ROUTE).shown + 100000 };
      const cad = game.state.wallet.pockets.CAD.bank;
      expect(routeKeys(game.endTurn().lines)).toContain("line.route.invite-short");
      expect(canada(game).state).toBe("known");
      expect(gate(game).invitedMonth).toBe(game.state.turn.month);
      expect(game.state.wallet.pockets.CAD.bank).toBe(cad);
      expect(routeKeys(game.endTurn().lines)).toContain("line.route.invite-lapsed-short");
      expect(gate(game)).toEqual({ poolMonth: pool, invitedMonth: null });
    });

    test("[route-gates:pool-draws-invite] given an invitation held for funds short, when the money is back by the next month, then the application goes then", () => {
      let vars: Record<Id<"var">, number> = { [CUTOFF]: DEVELOPER_SCORE + 1 };
      const game = developer({ vars: () => vars });
      toPool(game);
      const line = pointsFunds(readOf(game), CANADA_ROUTE).shown + 100000;
      vars = { [CUTOFF]: DEVELOPER_SCORE, [block.fundsVar]: line };
      game.endTurn();
      expect(canada(game).state).toBe("known");
      applyEffects(game, [{ type: "money/add", currency: "CAD", pocket: "bank", amount: 200000, reason: "gift" }]);
      expect(routeKeys(game.endTurn().lines)).toContain("line.route.applied");
      expect(canada(game).state).toBe("applying");
    });

    test("[route-gates:pool-draws-invite] given two seeds, when the cut-off comes down to the score, then both are invited the same month and no visa draw is made: the cut-off decides", () => {
      const months = ["seed-1", "seed-2"].map((seed) => {
        const game = developer({ seed, vars: () => ({ [CUTOFF]: DEVELOPER_SCORE }) });
        toKnown(game);
        const draws = game.state.draws.visa ?? 0;
        enterPool(game);
        expect(game.state.draws.visa ?? 0).toBe(draws);
        return gate(game).invitedMonth;
      });
      expect(months[0]).not.toBeNull();
      expect(months[1]).toBe(months[0]);
    });

    test("[route-gates:pool-draws-invite] given the window closed, when the cut-off comes down to the score, then no invitation comes until it opens", () => {
      let late: Record<Id<"var">, number> = {};
      const game = developer({ vars: () => late });
      toPool(game);
      late = { [CUTOFF]: DEVELOPER_SCORE, [entry.window!]: 0 };
      game.endTurn();
      expect(gate(game).invitedMonth).toBeNull();
      late = { [CUTOFF]: DEVELOPER_SCORE };
      game.endTurn();
      expect(canada(game).state).toBe("applying");
    });

    test("[route-gates:pool-draws-invite] given an invitation whose fee cannot be paid, when the next month's fee can be, then the application goes then", () => {
      const game = developer({ pockets: NO_FEE_POCKETS, vars: () => ({ ...QUEUED, [CUTOFF]: DEVELOPER_SCORE }) });
      toKnown(game);
      const keys = enterPool(game);
      const invited = game.state.turn.month;
      expect(keys).toContain("line.route.invite-unpaid");
      expect(canada(game).state).toBe("known");
      expect(gate(game).invitedMonth).toBe(invited);
      expect(stepMet(game, "invited")).toBe(true);
      applyEffects(game, [{ type: "money/add", currency: "CAD", pocket: "bank", amount: FEE, reason: "gift" }]);
      game.endTurn();
      expect(canada(game).state).toBe("applying");
      expect(canada(game).visa?.decisionMonth).toBe(invited + 1 + DECISION_MONTHS);
      expect(game.state.wallet.pockets.CAD.bank).toBe(0);
    });

    test("[route-gates:pool-draws-invite] given an invitation whose fee cannot be paid, when a month passes and it still cannot, then it lapses, the profile goes on, and the next month invites again", () => {
      const game = developer({ pockets: NO_FEE_POCKETS, vars: () => ({ ...QUEUED, [CUTOFF]: DEVELOPER_SCORE }) });
      toPool(game);
      const pool = gate(game).poolMonth;
      expect(routeKeys(game.endTurn().lines)).toContain("line.route.invite-lapsed");
      expect(gate(game)).toEqual({ poolMonth: pool, invitedMonth: null });
      expect(stepMet(game, "invited")).toBe(false);
      expect(routeKeys(game.endTurn().lines)).toContain("line.route.invite-unpaid");
      expect(gate(game).invitedMonth).toBe(game.state.turn.month);
    });
  });

  describe("the decision", () => {
    test("[route-gates:points-decision-gives-residence] given the points gate, when its decision is asked for, then it reads the unexplained share and earlier refusals only, with no override", () => {
      const game = developer();
      expect(GATES.points.decision(readOf(game), entry, canada(game))).toEqual({
        terms: { strictness: false, unexplained: true, refusals: true, interview: false, goodGrade: false },
        override: null,
        bans: false,
      });
    });

    test("[route-gates:points-decision-gives-residence] given the route's base, when the chance is worked out with the gate's terms, then strictness, the interview and the grade move nothing and the share and refusals do", () => {
      const numbers = content.tuning.route;
      const { terms } = GATES.points.decision(readOf(developer()), entry, canada(developer()));
      const plain = { strictness: 0, unexplainedBp: 0, refusals: 0, interviewScore: 0, grade: 0 };
      const chance = (file: Partial<typeof plain>): number => refusalChanceBp(numbers, entry.refusalBaseBp, { ...plain, ...file }, terms);
      expect(chance({})).toBe(entry.refusalBaseBp);
      expect(chance({ strictness: 90, interviewScore: 6, grade: 5 })).toBe(entry.refusalBaseBp);
      expect(chance({ unexplainedBp: 2599 })).toBe(entry.refusalBaseBp + 25 * numbers.refusalPerUnexplainedBp);
      expect(chance({ refusals: 2 })).toBe(entry.refusalBaseBp + 2 * numbers.refusalPerRefusalBp);
    });

    test("[route-gates:points-decision-gives-residence] given an invitation sent, when the month before the decision passes it is still applying, and when the decision month comes it is granted; departing gives the resident status in Canada", () => {
      const game = developer({ tuning: ALWAYS_GRANTED, vars: () => ({ [CUTOFF]: DEVELOPER_SCORE }) });
      toPool(game);
      const decision = canada(game).visa!.decisionMonth;
      while (game.state.turn.month < decision - 1) game.endTurn();
      expect(canada(game).state).toBe("applying");
      game.endTurn();
      expect(canada(game).state).toBe("granted");
      game.accept({ type: "route/depart", route: CANADA_ROUTE });
      expect(game.state.status.current?.entry).toBe(entry.status);
      expect(game.state.place.country).toBe(entry.country);
    });

    test("[route-gates:points-decision-gives-residence] given money from a flagged source, when the invitation sends the application, then the unexplained share is the lots over the Canadian line; a refusal names funds, refunds nothing, and the pool opens again", () => {
      const game = developer({ tuning: ALWAYS_REFUSED, vars: () => ({ [CUTOFF]: DEVELOPER_SCORE }) });
      toKnown(game);
      applyEffects(game, [{ type: "money/add", currency: "CAD", pocket: "bank", amount: 6000 * UNIT, reason: "gift", flagged: true }]);
      const share = pointsUnexplainedBp(readOf(game), CANADA_ROUTE);
      expect(share).toBeGreaterThanOrEqual(content.tuning.route.fundsReasonBp);
      enterPool(game);
      expect(canada(game).visa?.unexplainedBp).toBe(share);
      const decision = canada(game).visa!.decisionMonth;
      while (game.state.turn.month < decision) game.endTurn();
      expect(canada(game).state).toBe("known");
      expect(canada(game).refusals).toBe(1);
      expect(canada(game).lastRefusal?.reasons[0]).toBe("funds");
      expect(game.state.wallet.totals.in.refund).toBeUndefined();
      game.endTurn();
      expect(gate(game)).toEqual({ poolMonth: null, invitedMonth: null });
      expect(enterPool(game)).toContain("line.route.pool-entered");
    });
  });

  describe("the profile's clock", () => {
    test("[route-gates:profile-lapses-and-score-ages] given a profile and no invitation, when 11 months pass it is live, and when the 12th passes it lapses and the pool may be entered again", () => {
      const game = developer();
      toPool(game);
      const pool = gate(game).poolMonth!;
      while (game.state.turn.month < pool + block.profileMonths - 1) game.endTurn();
      expect(gate(game).poolMonth).toBe(pool);
      expect(routeKeys(game.endTurn().lines)).toContain("line.route.profile-lapsed");
      expect(gate(game).poolMonth).toBeNull();
      expect(stepMet(game, "pool")).toBe(false);
      expect(enterPool(game)).toContain("line.route.pool-entered");
    });

    test.each([
      [1, true],
      [0, false],
    ])("[route-gates:profile-lapses-and-score-ages] given the cut-off coming down in the profile's last month plus %i, when that month's clocks run, then an invitation comes: %s", (early, invited) => {
      let cutoff: Record<Id<"var">, number> = {};
      const game = developer({ vars: () => cutoff });
      toPool(game);
      const pool = gate(game).poolMonth!;
      // The month the cut-off falls: the profile's 12th month, or the month it reaches 12.
      const falls = pool + block.profileMonths - early;
      while (game.state.turn.month < falls - 1) game.endTurn();
      cutoff = { [CUTOFF]: DEVELOPER_SCORE };
      game.endTurn();
      expect(canada(game).state).toBe(invited ? "applying" : "known");
    });

    test("[route-gates:profile-lapses-and-score-ages] given a life a month short of 30, when a month passes, then the age part falls from 110 to 105 and the score with it", () => {
      const game = developer({ qualities: { "quality.age-months": 359 } });
      const before = pointsScore(readOf(game), CANADA_ROUTE);
      game.endTurn();
      expect(pointsParts(readOf(game), CANADA_ROUTE).age).toBe(105);
      expect(pointsScore(readOf(game), CANADA_ROUTE)).toBe(before - 5);
    });
  });

  describe("the gate", () => {
    test("[route-gates:route-runs-its-gate-steps] given the points route, when its steps are listed, then they are pool and invited, and any other step is never reached", () => {
      const game = developer({ vars: () => ({ [CUTOFF]: DEVELOPER_SCORE }) });
      expect(GATES.points.steps).toEqual(["pool", "invited"]);
      toPool(game);
      expect(stepMet(game, "pool")).toBe(true);
      expect(stepMet(game, "sponsor")).toBe(false);
      expect(GATES.points.reached(readOf(game), entry, canada(game), "cooled")).toBe(false);
    });

    test("[route-gates:route-runs-its-gate-steps] given a known points route with a live profile, when an application is sent to it as a slot would, then nothing happens: only the invitation applies", () => {
      const game = developer();
      toPool(game);
      const before = canada(game);
      applyEffects(game, [{ type: "route/apply", route: CANADA_ROUTE }]);
      expect(canada(game)).toEqual(before);
    });

    test("[route-gates:gate-decision-draw-terms] given the points route, when the decision is drawn, then the route's own base is used in place of the tuning's", () => {
      expect(entry.refusalBaseBp).toBe(1000);
      const game = developer({ tuning: { refusalMinBp: 0, refusalMaxBp: 10000 }, vars: () => ({ [CUTOFF]: DEVELOPER_SCORE }) });
      const { terms } = GATES.points.decision(readOf(game), entry, canada(game));
      expect(refusalChanceBp({ ...content.tuning.route, refusalMinBp: 0, refusalMaxBp: 10000 }, entry.refusalBaseBp, { strictness: 50, unexplainedBp: 0, refusals: 0, interviewScore: 0, grade: 4 }, terms)).toBe(1000);
    });
  });
});
