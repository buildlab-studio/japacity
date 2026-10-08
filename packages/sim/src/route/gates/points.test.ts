import { fc, test } from "@fast-check/vitest";
import { content } from "@japacity/content";
import { describe, expect } from "vitest";

import { check } from "../../engine/check";
import { checkInvariants } from "../../engine/invariants";
import type { Content, Id, ReadCtx, ReportLine, RouteState, ScenarioEntry, State, Tuning } from "../../engine/types";
import type { Game } from "../../testing/play";
import { READY, READY_PAPERS, UNIT, applyEffects, readyLife, slot } from "../route.journey";
import type { LifeOptions } from "../route.journey";
import { refusalChanceBp } from "../route.logic";
import { GATES } from "./index";
import { invites, pointsFunds, pointsParts, pointsScore, pointsUnexplainedBp } from "./points";

const CANADA: Id<"route"> = "route.canada-points";
const ENTER_POOL: Id<"activity"> = "activity.enter-pool";
const LOOK_INTO: Id<"activity"> = "activity.look-into-route";
const ENGLISH: Id<"document"> = "document.english-test";
const ECA: Id<"document"> = "document.eca";
const ZAINAB: Id<"scenario"> = "scenario.zainab";
const ADA: Id<"scenario"> = "scenario.ada";
const JOB: Id<"activity"> = "activity.job-junior-dev";

const entry = content.route[CANADA]!;
const block = entry.points!;
const table = content.points[block.table]!;
const startVar = (id: Id<"var">): number => content.var[id]!.start;
const CUTOFF = block.cutoffVar;
const CARE_CUTOFF = block.careCutoffVar!;
const FEE = startVar(block.feeVar);
const DECISION_MONTHS = startVar(block.decisionVar);
/** Zainab's score on the page's worked example. */
const ZAINAB_SCORE = 404;

const ALWAYS_GRANTED: Partial<Tuning["route"]> = { refusalMinBp: 0, refusalMaxBp: 0 };
const ALWAYS_REFUSED: Partial<Tuning["route"]> = { refusalMinBp: 10000, refusalMaxBp: 10000 };

/** The ready papers and a credential assessment, so a life reaches the pool in a few turns. */
const ECA_PAPERS: ScenarioEntry["documents"] = [...READY_PAPERS, { document: ECA, monthsLeft: 60, value: null }];
/** Funds in pounds, the fee in Canadian dollars, and naira cash for the upkeep. */
const POCKETS: ScenarioEntry["pockets"] = {
  NGN: { bank: 2000000 * UNIT, cash: 3000000 * UNIT },
  GBP: { bank: 40000 * UNIT, cash: 0 },
  CAD: { bank: 5000 * UNIT, cash: 0 },
};
/** Funds in pounds and nothing the Canadian fee can be paid from while the bank queue holds the naira leg (R-WALLET-009). */
const NO_FEE_POCKETS: ScenarioEntry["pockets"] = { NGN: { bank: 0, cash: 3000000 * UNIT }, GBP: { bank: 40000 * UNIT, cash: 0 } };
const QUEUED: Record<Id<"var">, number> = { "var.fx-bank-queue": 1 };

function zainab(options: LifeOptions = {}): Game {
  return readyLife(content, { from: ZAINAB, quiet: true, documents: ECA_PAPERS, pockets: POCKETS, ...options });
}

function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

function canada(game: Game): RouteState {
  return game.state.route[CANADA]!;
}

function gate(game: Game): { poolMonth: number | null; invitedMonth: number | null } {
  const held = canada(game).gate;
  if (held?.gate !== "points") throw new Error("The Canada route holds no points gate state.");
  return { poolMonth: held.poolMonth, invitedMonth: held.invitedMonth };
}

function routeKeys(lines: ReportLine[]): string[] {
  return lines.filter((line) => line.key.startsWith("line.route.")).map((line) => line.key);
}

function stepMet(game: Game, step: string): boolean {
  return check(readOf(game), { type: "route/gate-step", route: CANADA, step }).met;
}

/** Months pass until the route is heard of (by month 5), then it is looked into. */
function toKnown(game: Game): void {
  for (let month = 0; month < 6 && canada(game).state === "unknown"; month += 1) game.endTurn();
  expect(canada(game).state).toBe("heard");
  game.endTurn([slot(LOOK_INTO, CANADA)]);
  expect(canada(game).state).toBe("known");
}

/** From a known route, the pool slot. Returns the turn's route lines. */
function enterPool(game: Game): string[] {
  return routeKeys(game.endTurn([slot(ENTER_POOL)]).lines);
}

function toPool(game: Game): string[] {
  toKnown(game);
  const keys = enterPool(game);
  expect(gate(game).poolMonth).toBe(game.state.turn.month);
  return keys;
}

/** A state like the game's with the score's inputs set, for the table's edges. */
function scoreInputs(base: State, inputs: { months: number; level: number; band: number | null; work: number }): State {
  const document = { ...base.document };
  if (inputs.band === null) delete document[ENGLISH];
  else document[ENGLISH] = { state: "held", readyMonth: null, expiresMonth: null, value: inputs.band };
  return {
    ...base,
    quality: { ...base.quality, "quality.age-months": inputs.months, "quality.edu-level": inputs.level },
    document,
    activity: { ...base.activity, tenure: inputs.work === 0 ? {} : { [JOB]: inputs.work } },
  };
}

describe("the points gate", () => {
  const base = zainab();
  const read = (inputs: { months: number; level: number; band: number | null; work: number }, used: Content = content): ReadCtx => ({
    state: scoreInputs(base.state, inputs),
    world: base.world(),
    content: used,
  });
  const ZAINAB_INPUTS = { months: 300, level: 3, band: 70, work: 18 };

  describe("the score", () => {
    test("[R-POINTS-001] given Zainab at 25 with a bachelor's, band 7.0 and 18 months in a job, when her score is asked for, then it is 110 + 120 + 124 + 25 + 25 = 404", () => {
      const game = zainab();
      expect(pointsParts(readOf(game), CANADA)).toEqual({ age: 110, education: 120, language: 124, transfer: 50 });
      expect(pointsScore(readOf(game), CANADA)).toBe(ZAINAB_SCORE);
    });

    test("[R-POINTS-001] given Ada at 23 with band 6.5 and no job yet, when her score is asked for, then it is 110 + 120 + 92 + 13 = 335", () => {
      const papers = READY_PAPERS.map((paper) => (paper.document === ENGLISH ? { ...paper, value: 65 } : paper));
      const game = readyLife(content, { from: ADA, quiet: true, documents: papers });
      expect(pointsParts(readOf(game), CANADA)).toEqual({ age: 110, education: 120, language: 92, transfer: 13 });
      expect(pointsScore(readOf(game), CANADA)).toBe(335);
    });

    test.each(table.age.map((row, index) => [row.years, row.points, table.age[index - 1]?.points ?? 0] as const))(
      "[R-POINTS-001] given an age of %i whole years, when the age part is read, then it is %i, and a month younger it is the row before's %i",
      (years, points, before) => {
        expect(pointsParts(read({ ...ZAINAB_INPUTS, months: years * 12 }), CANADA).age).toBe(points);
        expect(pointsParts(read({ ...ZAINAB_INPUTS, months: years * 12 - 1 }), CANADA).age).toBe(before);
      },
    );

    test("[R-POINTS-001] given the age table, when the oldest age the quality allows is read, then the last row is a floor and scores 0", () => {
      expect(pointsParts(read({ ...ZAINAB_INPUTS, months: content.quality["quality.age-months"]!.max }), CANADA).age).toBe(0);
    });

    test.each([
      [0, 0],
      [1, 30],
      [2, 98],
      [3, 120],
      [4, 135],
      [5, 150],
    ])("[R-POINTS-001] given an education level of %i, when the education part is read, then it is %i", (level, points) => {
      expect(pointsParts(read({ ...ZAINAB_INPUTS, level }), CANADA).education).toBe(points);
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
    ])("[R-POINTS-001] given an English band of %s, when the language part is read, then the four abilities score %i", (band, points) => {
      expect(pointsParts(read({ ...ZAINAB_INPUTS, band }), CANADA).language).toBe(points);
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
    ])("[R-POINTS-001] given band %s and %i months of work with a degree, when transferability is read, then it is %i", (band, work, points) => {
      expect(pointsParts(read({ ...ZAINAB_INPUTS, band, work }), CANADA).transfer).toBe(points);
    });

    test("[R-POINTS-001] given a transferability cap below the two parts, when Zainab's score is asked for, then the transferable part stops at the cap", () => {
      const capped: Content = { ...content, points: { ...content.points, [block.table]: { ...table, transfer: { ...table.transfer, cap: 30 } } } };
      expect(pointsParts(read(ZAINAB_INPUTS, capped), CANADA).transfer).toBe(30);
      expect(pointsScore(read(ZAINAB_INPUTS, capped), CANADA)).toBe(ZAINAB_SCORE - 20);
    });

    // From 20: before it the table rises, on the 18th and the 20th birthdays.
    test.prop([
      fc.integer({ min: 240, max: 1199 }),
      fc.integer({ min: 0, max: 5 }),
      fc.option(fc.integer({ min: 8, max: 18 }).map((half) => half * 5)),
      fc.integer({ min: 0, max: 120 }),
    ])("[R-POINTS-001] given any age, education, band and work, when the score is asked for, then it is the sum of its parts, the transfer is within the cap, and from 20 a month older never scores more", (months, level, band, work) => {
      const now = read({ months, level, band, work });
      const parts = pointsParts(now, CANADA);
      expect(pointsScore(now, CANADA)).toBe(parts.age + parts.education + parts.language + parts.transfer);
      expect(parts.transfer).toBeLessThanOrEqual(table.transfer.cap);
      expect(pointsScore(read({ months: months + 1, level, band, work }), CANADA)).toBeLessThanOrEqual(pointsScore(now, CANADA));
    });
  });

  describe("the pool", () => {
    test("[R-POINTS-002] given the route known, the assessment, band 7.0, 12 months of work and the funds, when the pool slot is played, then a profile is recorded this month and the pool step is reached", () => {
      const game = zainab();
      toKnown(game);
      expect(stepMet(game, "pool")).toBe(false);
      const keys = enterPool(game);
      expect(gate(game)).toEqual({ poolMonth: game.state.turn.month, invitedMonth: null });
      expect(keys).toContain("line.route.pool-entered");
      expect(stepMet(game, "pool")).toBe(true);
      expect(game.view().routes.find((route) => route.id === CANADA)?.checklist.find((item) => item.id === "pool")?.met).toBe(true);
      expect(checkInvariants(game.state, game.content)).toEqual([]);
    });

    test("[R-POINTS-002] given no credential assessment, when the pool slot is played, then the turn is rejected", () => {
      const game = zainab({ documents: READY_PAPERS });
      toKnown(game);
      expect(game.expectRejected({ type: "turn/end", slots: [slot(ENTER_POOL)] }, "not-legal").code).toBe("not-legal");
    });

    test.each([
      [55, false],
      [60, true],
    ])("[R-POINTS-002] given an English band of %i, when the pool slot is played, then it is accepted: %s", (band, accepted) => {
      const papers = ECA_PAPERS.map((paper) => (paper.document === ENGLISH ? { ...paper, value: band } : paper));
      const game = zainab({ documents: papers });
      toKnown(game);
      expect(game.send({ type: "turn/end", slots: [slot(ENTER_POOL)] }).ok).toBe(accepted);
      expect(gate(game).poolMonth !== null).toBe(accepted);
    });

    test.each([
      [11, false],
      [12, true],
    ])("[R-POINTS-002] given %i months of work when the pool slot is sent, then it is accepted: %s", (months, accepted) => {
      // A first life counts the months the route takes to become known; the second starts that many months short.
      const probe = zainab();
      toKnown(probe);
      const played = (probe.state.activity.tenure[JOB] ?? 0) - 18;
      const game = zainab({ change: (used) => ({ ...used, scenario: { ...used.scenario, [READY]: { ...used.scenario[READY]!, tenure: { [JOB]: months - played } } } }) });
      toKnown(game);
      expect(game.state.activity.tenure[JOB]).toBe(months);
      expect(game.send({ type: "turn/end", slots: [slot(ENTER_POOL)] }).ok).toBe(accepted);
      expect(gate(game).poolMonth !== null).toBe(accepted);
    });

    test("[R-POINTS-002] given the window closed, when the pool slot is played, then the turn is rejected", () => {
      let closed = false;
      const game = zainab({ vars: () => (closed ? { [entry.window!]: 0 } : {}) });
      toKnown(game);
      closed = true;
      expect(game.expectRejected({ type: "turn/end", slots: [slot(ENTER_POOL)] }, "not-legal").code).toBe("not-legal");
    });

    test("[R-POINTS-002] given a live profile, when the pool slot is played again, then the turn is rejected", () => {
      const game = zainab();
      toPool(game);
      expect(game.expectRejected({ type: "turn/end", slots: [slot(ENTER_POOL)] }, "not-legal").code).toBe("not-legal");
    });

    test("[R-POINTS-002] given the funds read in Canadian cents, when the Canadian line is exactly what is shown, then the profile is recorded, and one cent more, then it is not", () => {
      // The same seed plays the same months, so a first life tells what is shown in the pool month's clocks.
      const probe = zainab({ vars: () => ({ [block.fundsVar]: 1000000000 }) });
      toKnown(probe);
      // The slot is judged when the turn is accepted, so what is shown then is the line to pin.
      const { shown } = pointsFunds(readOf(probe), CANADA);
      probe.expectRejected({ type: "turn/end", slots: [slot(ENTER_POOL)] }, "not-legal");
      expect(gate(probe).poolMonth).toBeNull();
      for (const [required, entered] of [
        [shown, true],
        [shown + 1, false],
      ] as const) {
        const game = zainab({ vars: () => ({ [block.fundsVar]: required }) });
        toKnown(game);
        // The slot's own requirement reads the Canadian line, so a short file cannot even plan the slot.
        if (entered) enterPool(game);
        else game.expectRejected({ type: "turn/end", slots: [slot(ENTER_POOL)] }, "not-legal");
        expect(gate(game).poolMonth !== null).toBe(entered);
      }
    });

    test("[R-POINTS-002] given money in several currencies, when the funds are read, then bank and locked pockets count in Canadian cents and cash does not", () => {
      const game = zainab({ pockets: { NGN: { bank: 0, cash: 5000000 * UNIT }, CAD: { bank: 2000 * UNIT, cash: 3000 * UNIT } } });
      applyEffects(game, [{ type: "money/add", currency: "CAD", pocket: "bank", amount: 500 * UNIT, reason: "gift", locked: true }]);
      expect(pointsFunds(readOf(game), CANADA)).toEqual({ shown: 2500 * UNIT, required: startVar(block.fundsVar) });
    });
  });

  describe("the invitation", () => {
    test("[R-POINTS-003] given a live profile and the cut-off at the score, when the month's clocks run, then the route is applying, decided after the decision months, and the fee is paid in Canadian cents as a visa fee", () => {
      const game = zainab({ vars: () => ({ [CUTOFF]: ZAINAB_SCORE }) });
      toKnown(game);
      expect(pointsScore(readOf(game), CANADA)).toBe(ZAINAB_SCORE);
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

    test("[R-POINTS-003] given the cut-off one point above the score, when the month's clocks run, then nobody is invited and the profile waits", () => {
      const game = zainab({ vars: () => ({ [CUTOFF]: ZAINAB_SCORE + 1 }) });
      toPool(game);
      game.endTurn();
      expect(canada(game).state).toBe("known");
      expect(gate(game).invitedMonth).toBeNull();
    });

    test.each([
      [60, true],
      [59, false],
    ])("[R-POINTS-003] given care at %i and the care cut-off at the score, when the clocks run, then an invitation comes: %s", (care, invited) => {
      const game = zainab({ qualities: { "quality.care": care }, vars: () => ({ [CARE_CUTOFF]: ZAINAB_SCORE }) });
      toPool(game);
      expect(invites(readOf(game), CANADA)).toBe(invited);
      expect(canada(game).state).toBe(invited ? "applying" : "known");
    });

    test("[R-POINTS-003] given two seeds, when the cut-off comes down to the score, then both are invited the same month and no visa draw is made: the cut-off decides", () => {
      const months = ["seed-1", "seed-2"].map((seed) => {
        const game = zainab({ seed, vars: () => ({ [CUTOFF]: ZAINAB_SCORE }) });
        toKnown(game);
        const draws = game.state.draws.visa ?? 0;
        enterPool(game);
        expect(game.state.draws.visa ?? 0).toBe(draws);
        return gate(game).invitedMonth;
      });
      expect(months[0]).not.toBeNull();
      expect(months[1]).toBe(months[0]);
    });

    test("[R-POINTS-003] given the window closed, when the cut-off comes down to the score, then no invitation comes until it opens", () => {
      let late: Record<Id<"var">, number> = {};
      const game = zainab({ vars: () => late });
      toPool(game);
      late = { [CUTOFF]: ZAINAB_SCORE, [entry.window!]: 0 };
      game.endTurn();
      expect(gate(game).invitedMonth).toBeNull();
      late = { [CUTOFF]: ZAINAB_SCORE };
      game.endTurn();
      expect(canada(game).state).toBe("applying");
    });

    test("[R-POINTS-003] given an invitation whose fee cannot be paid, when the next month's fee can be, then the application goes then", () => {
      const game = zainab({ pockets: NO_FEE_POCKETS, vars: () => ({ ...QUEUED, [CUTOFF]: ZAINAB_SCORE }) });
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

    test("[R-POINTS-003] given an invitation whose fee cannot be paid, when a month passes and it still cannot, then it lapses, the profile goes on, and the next month invites again", () => {
      const game = zainab({ pockets: NO_FEE_POCKETS, vars: () => ({ ...QUEUED, [CUTOFF]: ZAINAB_SCORE }) });
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
    test("[R-POINTS-004] given the points gate, when its decision is asked for, then it reads the unexplained share and earlier refusals only, with no override", () => {
      const game = zainab();
      expect(GATES.points.decision(readOf(game), entry, canada(game))).toEqual({
        terms: { strictness: false, unexplained: true, refusals: true, interview: false, goodGrade: false },
        override: null,
        bans: false,
      });
    });

    test("[R-POINTS-004] given the route's base, when the chance is worked out with the gate's terms, then strictness, the interview and the grade move nothing and the share and refusals do", () => {
      const numbers = content.tuning.route;
      const { terms } = GATES.points.decision(readOf(zainab()), entry, canada(zainab()));
      const plain = { strictness: 0, unexplainedBp: 0, refusals: 0, interviewScore: 0, grade: 0 };
      const chance = (file: Partial<typeof plain>): number => refusalChanceBp(numbers, entry.refusalBaseBp, { ...plain, ...file }, terms);
      expect(chance({})).toBe(entry.refusalBaseBp);
      expect(chance({ strictness: 90, interviewScore: 6, grade: 5 })).toBe(entry.refusalBaseBp);
      expect(chance({ unexplainedBp: 2599 })).toBe(entry.refusalBaseBp + 25 * numbers.refusalPerUnexplainedBp);
      expect(chance({ refusals: 2 })).toBe(entry.refusalBaseBp + 2 * numbers.refusalPerRefusalBp);
    });

    test("[R-POINTS-004] given an invitation sent, when the month before the decision passes it is still applying, and when the decision month comes it is granted; departing gives the resident status in Canada", () => {
      const game = zainab({ tuning: ALWAYS_GRANTED, vars: () => ({ [CUTOFF]: ZAINAB_SCORE }) });
      toPool(game);
      const decision = canada(game).visa!.decisionMonth;
      while (game.state.turn.month < decision - 1) game.endTurn();
      expect(canada(game).state).toBe("applying");
      game.endTurn();
      expect(canada(game).state).toBe("granted");
      game.accept({ type: "route/depart", route: CANADA });
      expect(game.state.status.current?.entry).toBe(entry.status);
      expect(game.state.place.country).toBe(entry.country);
    });

    test("[R-POINTS-004] given money from a flagged source, when the invitation sends the application, then the unexplained share is the lots over the Canadian line; a refusal names funds, refunds nothing, and the pool opens again", () => {
      const game = zainab({ tuning: ALWAYS_REFUSED, vars: () => ({ [CUTOFF]: ZAINAB_SCORE }) });
      toKnown(game);
      applyEffects(game, [{ type: "money/add", currency: "CAD", pocket: "bank", amount: 6000 * UNIT, reason: "gift", flagged: true }]);
      const share = pointsUnexplainedBp(readOf(game), CANADA);
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
    test("[R-POINTS-005] given a profile and no invitation, when 11 months pass it is live, and when the 12th passes it lapses and the pool may be entered again", () => {
      const game = zainab();
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
    ])("[R-POINTS-005] given the cut-off coming down in the profile's last month plus %i, when that month's clocks run, then an invitation comes: %s", (early, invited) => {
      let cutoff: Record<Id<"var">, number> = {};
      const game = zainab({ vars: () => cutoff });
      toPool(game);
      const pool = gate(game).poolMonth!;
      // The month the cut-off falls: the profile's 12th month, or the month it reaches 12.
      const falls = pool + block.profileMonths - early;
      while (game.state.turn.month < falls - 1) game.endTurn();
      cutoff = { [CUTOFF]: ZAINAB_SCORE };
      game.endTurn();
      expect(canada(game).state).toBe(invited ? "applying" : "known");
    });

    test("[R-POINTS-005] given a life a month short of 30, when a month passes, then the age part falls from 110 to 105 and the score with it", () => {
      const game = zainab({ qualities: { "quality.age-months": 359 } });
      const before = pointsScore(readOf(game), CANADA);
      game.endTurn();
      expect(pointsParts(readOf(game), CANADA).age).toBe(105);
      expect(pointsScore(readOf(game), CANADA)).toBe(before - 5);
    });
  });

  describe("the gate", () => {
    test("[R-GATE-001] given the points route, when its steps are listed, then they are pool and invited, and any other step is never reached", () => {
      const game = zainab({ vars: () => ({ [CUTOFF]: ZAINAB_SCORE }) });
      expect(GATES.points.steps).toEqual(["pool", "invited"]);
      toPool(game);
      expect(stepMet(game, "pool")).toBe(true);
      expect(stepMet(game, "sponsor")).toBe(false);
      expect(GATES.points.reached(readOf(game), entry, canada(game), "cooled")).toBe(false);
    });

    test("[R-GATE-001] given a known points route with a live profile, when an application is sent to it as a slot would, then nothing happens: only the invitation applies", () => {
      const game = zainab();
      toPool(game);
      const before = canada(game);
      applyEffects(game, [{ type: "route/apply", route: CANADA }]);
      expect(canada(game)).toEqual(before);
    });

    test("[R-GATE-002] given the points route, when the decision is drawn, then the route's own base is used in place of the tuning's", () => {
      expect(entry.refusalBaseBp).toBe(1000);
      const game = zainab({ tuning: { refusalMinBp: 0, refusalMaxBp: 10000 }, vars: () => ({ [CUTOFF]: ZAINAB_SCORE }) });
      const { terms } = GATES.points.decision(readOf(game), entry, canada(game));
      expect(refusalChanceBp({ ...content.tuning.route, refusalMinBp: 0, refusalMaxBp: 10000 }, entry.refusalBaseBp, { strictness: 50, unexplainedBp: 0, refusals: 0, interviewScore: 0, grade: 4 }, terms)).toBe(1000);
    });
  });
});
