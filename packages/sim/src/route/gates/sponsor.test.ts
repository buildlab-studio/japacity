import { fc, test } from "@fast-check/vitest";
import { content, text } from "@japacity/content";
import { describe, expect } from "vitest";

import { check } from "../../engine/check";
import type { Registry } from "../../engine/kind";
import { stepWith } from "../../engine/step";
import type { Content, Ctx, Effect, Id, ReadCtx, ReportLine, Requirement, RouteState, ScenarioEntry, Terms, Tuning } from "../../engine/types";
import { registry } from "../../kinds";
import type { Game } from "../../testing/play";
import { applyEffects, draw, READY, readyLife, slot, UK, UNIT, withEffects } from "../route.journey";
import type { LifeOptions } from "../route.journey";
import { refusalChanceBp, unknownRoute } from "../route.logic";
import { findChanceBp, findSponsor, sponsorGate, sponsorJob } from "./sponsor";

const CARE: Id<"route"> = "route.uk-care";
const SKILLED: Id<"route"> = "route.uk-skilled";
const APPLY_CARE: Id<"activity"> = "activity.apply-uk-care";
const APPLY_SKILLED: Id<"activity"> = "activity.apply-uk-skilled";
const numbers = content.tuning.route;
const care = content.route[CARE]!;
const skilled = content.route[SKILLED]!;
const CARE_BAR = content.var["var.uk-care-salary"]!.start;
const SKILLED_BAR = content.var["var.uk-skilled-salary"]!.start;
const MAINTENANCE = content.var["var.uk-skilled-maintenance"]!.start;
const CARE_FEE = content.var["var.uk-care-visa-fee"]!.start;

/** The floor and the ceiling of R-ROUTE-016 pinned together: never refused, or always. */
const ALWAYS_GRANTED: Partial<Tuning["route"]> = { refusalMinBp: 0, refusalMaxBp: 0 };
const ALWAYS_REFUSED: Partial<Tuning["route"]> = { refusalMinBp: 10000, refusalMaxBp: 10000 };

/** Everything the care route asks for, in date: passport, licence, verification, English at band 4.0, TB. */
type Papers = ScenarioEntry["documents"];
const CARE_PAPERS: Papers = [
  { document: "document.passport", monthsLeft: 40, value: null },
  { document: "document.nursing-licence", monthsLeft: 30, value: null },
  { document: "document.nmcn-verification", monthsLeft: 24, value: null },
  { document: "document.english-test", monthsLeft: 24, value: 40 },
  { document: "document.tb-certificate", monthsLeft: 24, value: null },
];
const SKILLED_PAPERS: Papers = [
  { document: "document.passport", monthsLeft: 40, value: null },
  { document: "document.english-test", monthsLeft: 24, value: 40 },
  { document: "document.tb-certificate", monthsLeft: 24, value: null },
];

function without(papers: Papers, document: Id<"document">): Papers {
  return papers.filter((paper) => paper.document !== document);
}

function withEnglish(papers: Papers, band: number): Papers {
  return papers.map((paper) => (paper.document === "document.english-test" ? { ...paper, value: band } : paper));
}

/** The ready life's scenario with its job and tenure replaced. */
function working(job: Id<"activity"> | null, tenure: Record<Id<"activity">, number>): (used: Content) => Content {
  return (used) => ({ ...used, scenario: { ...used.scenario, [READY]: { ...used.scenario[READY]!, job, tenure } } });
}

/** Ngozi with the care route's papers in hand and the care window opened by the world (R-SPONSOR-005). */
function ngozi(options: LifeOptions = {}): Game {
  return readyLife(content, { from: "scenario.ngozi", documents: CARE_PAPERS, quiet: true, vars: () => ({ "var.uk-care-window": 2 }), ...options });
}

/** Ada with 24 months of work behind her and the skilled route's papers in hand. */
function worker(options: LifeOptions = {}): Game {
  return readyLife(content, { documents: SKILLED_PAPERS, quiet: true, change: working(null, { "activity.job-teacher": 24 }), ...options });
}

function routeOf(game: Game, route: Id<"route">): RouteState {
  return game.state.route[route]!;
}

function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

/**
 * Talk of the route reaches the character, then it is looked into. Looking
 * into a route needs the UK master's heard (the activity names it), which
 * every life here with a degree has by month 3.
 */
function toKnown(game: Game, route: Id<"route">): void {
  applyEffects(game, [{ type: "route/hear", route, via: "friend" }]);
  for (let month = 0; month < 5 && routeOf(game, UK).state !== "heard"; month += 1) game.endTurn();
  game.endTurn([slot("activity.look-into-route", route)]);
  expect(routeOf(game, route).state).toBe("known");
}

/** A sponsor offer's take, as the offer kind carries it out, with the salary drawn as `salary`. */
function takeSponsor(game: Game, route: Id<"route">, salary: number, fraud = false, employer = "care-home"): void {
  applyEffects(game, [{ type: "route/record-sponsor", route, employer, salary: 0, fraud }], { salary });
}

/** The offer's own choice effects from content: the honest ones, or the fraud's. */
function offerEffects(offer: Id<"offer">, fraud: boolean): Effect[] {
  const take = content.offer[offer]!.choices.find((choice) => choice.id === "take")!;
  return fraud ? take.fraudEffects! : take.effects;
}

/**
 * no route event writes `secret.sponsorFraud`, so a fraud recorded
 * through `route/record-sponsor` is not kept. The decision's override is
 * tested with the secret set on the state, as the event would set it.
 */
function hideFraud(game: Game, route: Id<"route">): void {
  game.state = { ...game.state, route: { ...game.state.route, [route]: { ...routeOf(game, route), secret: { sponsorFraud: true } } } };
}

function pounds(game: Game): number {
  const pocket = game.state.wallet.pockets.GBP;
  return pocket.bank + pocket.cash;
}

function judge(game: Game, requirement: Requirement): boolean {
  return check(readOf(game), requirement).met;
}

function checklistItem(game: Game, route: Id<"route">, item: string) {
  return game.view().routes.find((view) => view.id === route)!.checklist.find((entry) => entry.id === item)!;
}

/** The route's report lines from carrying out effects as an offer's take would. */
function linesOf(game: Game, effects: Effect[], terms: Terms): ReportLine[] {
  const result = stepWith(withEffects(effects, terms), game.state, { type: "offer/choose", offer: "x", choice: "y", basedOn: game.state.v }, game.world(), game.content);
  if (!result.ok) throw new Error(`The effects were rejected with ${result.code}: ${result.detail}`);
  return result.lines.filter((line) => line.key.startsWith("line.route."));
}

/** Ngozi known on the care route with an honest sponsor at the bar, ready to apply. */
function readyToApply(options: LifeOptions = {}): Game {
  const game = ngozi(options);
  toKnown(game, CARE);
  takeSponsor(game, CARE, CARE_BAR);
  return game;
}

/** A Ctx-taking route function run as one accepted command, through the real engine. */
function runAsCommand(game: Game, run: (ctx: Ctx) => void): void {
  const kinds: Registry = registry().map((kind) =>
    kind.kind !== "offer"
      ? kind
      : {
          ...kind,
          commands: {
            ...kind.commands,
            "offer/choose": (ctx) => {
              run(ctx);
              return [];
            },
          },
        },
  );
  const result = stepWith(kinds, game.state, { type: "offer/choose", offer: "x", choice: "y", basedOn: game.state.v }, game.world(), game.content);
  if (!result.ok) throw new Error(`The command was rejected with ${result.code}: ${result.detail}`);
  game.state = result.state;
}

describe("the sponsor gate's place in the route kind", () => {
  test("[R-GATE-001] given the UK master's known, when a sponsor is recorded on it, then the study gate is untouched", () => {
    const game = readyLife(content, { quiet: true });
    for (let month = 0; month < 5 && routeOf(game, UK).state !== "heard"; month += 1) game.endTurn();
    game.endTurn([slot("activity.look-into-route", UK)]);
    const before = routeOf(game, UK);
    takeSponsor(game, UK, 5000000);
    expect(routeOf(game, UK)).toEqual(before);
    expect(routeOf(game, UK).gate).toEqual({ gate: "study" });
  });

  test("[R-GATE-001] given the care route, when its steps are asked for, then only `sponsor` and `salary` are named and any other step is never reached", () => {
    const game = readyToApply();
    expect(sponsorGate.steps).toEqual(["sponsor", "salary"]);
    expect(judge(game, { type: "route/gate-step", route: CARE, step: "sponsor" })).toBe(true);
    expect(judge(game, { type: "route/gate-step", route: CARE, step: "pool" })).toBe(false);
  });

  test("[R-GATE-001] given a fresh sponsor route, when it starts, then no sponsor is recorded", () => {
    expect(sponsorGate.initial()).toEqual({ gate: "sponsor", sponsor: null });
    expect(unknownRoute("sponsor").gate).toEqual({ gate: "sponsor", sponsor: null });
  });

  test("[R-GATE-002] given the sponsor gate, when its decision is asked for, then the draw reads strictness, earlier refusals and the good grade, and not the unexplained share or the interview", () => {
    const game = readyToApply();
    const decision = sponsorGate.decision(readOf(game), care, routeOf(game, CARE));
    expect(decision.terms).toEqual({ strictness: true, unexplained: false, refusals: true, interview: false, goodGrade: true });
    expect(decision.override).toBeNull();
  });
});

describe("R-SPONSOR-001: sponsor offers and looking for one", () => {
  test("[R-SPONSOR-001] given the care route known, when its window is open or closed, then the care home's offer may come up only while it is open", () => {
    const open = ngozi();
    toKnown(open, CARE);
    const when = content.offer["offer.sponsor-care-home"]!.when;
    expect(when.every((requirement) => judge(open, requirement))).toBe(true);
    const shut = ngozi({ vars: () => ({ "var.uk-care-window": 0 }) });
    applyEffects(shut, [{ type: "route/hear", route: CARE, via: "friend" }]);
    for (let month = 0; month < 5 && routeOf(shut, UK).state !== "heard"; month += 1) shut.endTurn();
    shut.endTurn([slot("activity.look-into-route", CARE)]);
    expect(when.every((requirement) => judge(shut, requirement))).toBe(false);
  });

  test("[R-SPONSOR-001] given a route's find figure, when the chance is worked out, then it adds 20 for each point of network and stops at 9500", () => {
    const quality = content.tuning.quality;
    expect(findChanceBp(care, 0, quality)).toBe(care.sponsor!.findBp);
    expect(findChanceBp(care, 25, quality)).toBe(care.sponsor!.findBp + 20 * 25);
    const near = { ...care, sponsor: { ...care.sponsor!, findBp: 9000 } };
    expect(findChanceBp(near, 24, quality)).toBe(9480);
    expect(findChanceBp(near, 25, quality)).toBe(9500);
    expect(findChanceBp(near, 26, quality)).toBe(9500);
  });

  test("[R-SPONSOR-001] given the care route known, when a sponsor is looked for, then one draw on `job` at the route's chance decides whether one care offer opens at once", () => {
    let hits = 0;
    let misses = 0;
    for (let index = 0; index < 40; index += 1) {
      const seed = `find-${String(index)}`;
      const game = ngozi({ seed });
      toKnown(game, CARE);
      const position = game.state.draws.job ?? 0;
      const chance = findChanceBp(care, game.state.quality["quality.network"] ?? 0, content.tuning.quality);
      const hit = draw(seed, "job", position, 10000) < chance;
      const before = new Set(Object.keys(game.state.offer.items));
      runAsCommand(game, (ctx) => findSponsor(ctx, CARE));
      const fresh = Object.values(game.state.offer.items).filter((item) => !before.has(item.id)).map((item) => item.entry);
      expect(fresh.length).toBe(hit ? 1 : 0);
      // Ngozi's care of 60 lets the trust's offer come up as well as the care home's.
      expect(fresh.every((entry) => entry === "offer.sponsor-care-home" || entry === "offer.sponsor-trust")).toBe(true);
      hits += hit ? 1 : 0;
      misses += hit ? 0 : 1;
      expect((game.state.draws.job ?? 0) - position).toBeGreaterThanOrEqual(1);
    }
    expect(hits).toBeGreaterThan(0);
    expect(misses).toBeGreaterThan(0);
  });

  test("[R-SPONSOR-001] given the care window closed, when a sponsor is looked for, then nothing is drawn and nothing opens", () => {
    const game = ngozi({ vars: (tick) => ({ "var.uk-care-window": tick < 5 ? 2 : 0 }) });
    toKnown(game, CARE);
    for (let month = 0; month < 6; month += 1) game.endTurn();
    const position = game.state.draws.job ?? 0;
    const before = Object.keys(game.state.offer.items).length;
    runAsCommand(game, (ctx) => findSponsor(ctx, CARE));
    expect(game.state.draws.job ?? 0).toBe(position);
    expect(Object.keys(game.state.offer.items).length).toBe(before);
  });
});

describe("R-SPONSOR-002: taking a sponsor", () => {
  test("[R-SPONSOR-002] given the care home's honest take, when it is carried out, then the employer and the drawn salary are recorded and no money moves", () => {
    const game = ngozi();
    toKnown(game, CARE);
    const wallet = game.state.wallet;
    applyEffects(game, offerEffects("offer.sponsor-care-home", false), { salary: 2650000, fee: 450000000 });
    expect(routeOf(game, CARE).gate).toEqual({ gate: "sponsor", sponsor: { employer: "care-home", salary: 2650000 } });
    expect(game.state.wallet).toEqual(wallet);
  });

  test("[R-SPONSOR-002] given the care home's fraud, when it is taken, then its fee leaves cash as an agent's fee and a sponsor is recorded all the same", () => {
    const pockets = { NGN: { bank: 2000000 * UNIT, cash: 6000000 * UNIT }, GBP: { bank: 40000 * UNIT, cash: 0 } };
    const honest = ngozi({ pockets });
    const fraud = ngozi({ pockets });
    toKnown(honest, CARE);
    toKnown(fraud, CARE);
    const terms: Terms = { salary: 2650000, fee: 450000000 };
    const cash = fraud.state.wallet.pockets.NGN.cash;
    const fees = fraud.state.wallet.totals.out["fee-agent"]?.NGN ?? 0;
    applyEffects(honest, offerEffects("offer.sponsor-care-home", false), terms);
    applyEffects(fraud, offerEffects("offer.sponsor-care-home", true), terms);
    expect(fraud.state.wallet.pockets.NGN.cash).toBe(cash - 450000000);
    expect(fraud.state.wallet.totals.out["fee-agent"]?.NGN).toBe(fees + 450000000);
    expect(routeOf(fraud, CARE).gate).toEqual(routeOf(honest, CARE).gate);
    // The fraud is never in the view: the two routes look the same.
    const view = (game: Game) => game.view().routes.find((route) => route.id === CARE);
    expect(view(fraud)).toEqual(view(honest));
  });

  test("[R-SPONSOR-002] given the trust's take, when its record names a salary, then that salary is recorded", () => {
    const game = ngozi();
    toKnown(game, CARE);
    applyEffects(game, offerEffects("offer.sponsor-trust", false), { salary: 3130000 });
    expect(routeOf(game, CARE).gate).toEqual({ gate: "sponsor", sponsor: { employer: "trust", salary: 3130000 } });
  });

  test("[R-SPONSOR-002] given the care route only heard of, when a sponsor's take arrives, then nothing is recorded", () => {
    const game = ngozi();
    applyEffects(game, [{ type: "route/hear", route: CARE, via: "friend" }]);
    takeSponsor(game, CARE, CARE_BAR);
    expect(routeOf(game, CARE).gate).toEqual({ gate: "sponsor", sponsor: null });
  });

  test("[R-SPONSOR-002] given a sponsor recorded, when a second one is taken, then the second replaces it", () => {
    const game = readyToApply();
    takeSponsor(game, CARE, 2800000, false, "trust");
    expect(routeOf(game, CARE).gate).toEqual({ gate: "sponsor", sponsor: { employer: "trust", salary: 2800000 } });
  });

  test("[R-SPONSOR-002] given a sponsor taken, when it is carried out, then a line names the route, and one under the bar says it cannot be used", () => {
    const game = ngozi();
    toKnown(game, CARE);
    expect(linesOf(game, [{ type: "route/record-sponsor", route: CARE, employer: "care-home", salary: 0, fraud: false }], { salary: CARE_BAR })).toEqual([
      { key: "line.route.sponsor-recorded", params: { route: CARE }, tone: "plain", attention: true, counts: [] },
    ]);
    expect(linesOf(game, [{ type: "route/record-sponsor", route: CARE, employer: "care-home", salary: 0, fraud: false }], { salary: CARE_BAR - 1 })).toEqual([
      { key: "line.route.sponsor-under-bar", params: { route: CARE }, tone: "plain", attention: true, counts: [] },
    ]);
    expect(text["line.route.sponsor-recorded"]).toBeDefined();
    expect(text["line.route.sponsor-under-bar"]).toBeDefined();
  });
});

describe("R-SPONSOR-003: applying with a sponsor", () => {
  test("[R-SPONSOR-003] given Ngozi with an honest sponsor at the bar and every paper in hand, when she applies, then the application goes in and the care visa fee is paid", () => {
    const game = readyToApply();
    const before = pounds(game);
    game.endTurn([slot(APPLY_CARE)]);
    expect(routeOf(game, CARE).state).toBe("applying");
    expect(before - pounds(game)).toBe(CARE_FEE);
  });

  test("[R-SPONSOR-003] given no sponsor recorded, when Ngozi applies, then the turn is rejected", () => {
    const game = ngozi();
    toKnown(game, CARE);
    expect(game.expectRejected({ type: "turn/end", slots: [slot(APPLY_CARE)] }, "not-legal").code).toBe("not-legal");
  });

  test.each([
    ["the passport", "document.passport"],
    ["the licence", "document.nursing-licence"],
    ["the verification", "document.nmcn-verification"],
    ["the English result", "document.english-test"],
    ["the TB certificate", "document.tb-certificate"],
  ] as const)("[R-SPONSOR-003] given everything but %s, when Ngozi applies, then the turn is rejected", (_name, document) => {
    const game = readyToApply({ documents: without(CARE_PAPERS, document) });
    expect(game.expectRejected({ type: "turn/end", slots: [slot(APPLY_CARE)] }, "not-legal").code).toBe("not-legal");
  });

  test("[R-SPONSOR-003] given an English band one under the route's 40, when Ngozi applies, then the turn is rejected; at 40 it goes in", () => {
    const under = readyToApply({ documents: withEnglish(CARE_PAPERS, care.sponsor!.bandMin - 1) });
    expect(under.expectRejected({ type: "turn/end", slots: [slot(APPLY_CARE)] }, "not-legal").code).toBe("not-legal");
    const at = readyToApply({ documents: withEnglish(CARE_PAPERS, care.sponsor!.bandMin) });
    at.endTurn([slot(APPLY_CARE)]);
    expect(routeOf(at, CARE).state).toBe("applying");
  });

  test("[R-SPONSOR-003] given a sponsor one penny a year under the care bar, when Ngozi applies, then the turn is rejected; at the bar it goes in", () => {
    const under = ngozi();
    toKnown(under, CARE);
    takeSponsor(under, CARE, CARE_BAR - 1);
    expect(under.expectRejected({ type: "turn/end", slots: [slot(APPLY_CARE)] }, "not-legal").code).toBe("not-legal");
    const at = ngozi();
    toKnown(at, CARE);
    takeSponsor(at, CARE, CARE_BAR);
    at.endTurn([slot(APPLY_CARE)]);
    expect(routeOf(at, CARE).state).toBe("applying");
  });

  test("[R-SPONSOR-003] given a qualification paper missing, when the gate is asked, then applying is held back even past the slot", () => {
    const game = readyToApply();
    const ready = routeOf(game, CARE);
    const cause = { source: APPLY_CARE, param: null, terms: {} };
    const asCtx = (read: ReadCtx): Ctx => ({ ...read, check: (requirement: Requirement) => check(read, requirement) }) as unknown as Ctx;
    expect(sponsorGate.mayApply(asCtx(readOf(game)), care, ready, cause)).toBe(true);
    const documents = Object.fromEntries(Object.entries(game.state.document).filter(([id]) => id !== "document.nmcn-verification"));
    const lacking = { ...readOf(game), state: { ...game.state, document: documents } };
    expect(sponsorGate.mayApply(asCtx(lacking), care, ready, cause)).toBe(false);
  });
});

describe("R-SPONSOR-004: the sponsor's decision", () => {
  test("[R-SPONSOR-004] given an honest sponsor and the draw pinned to grant, when the decision month ends, then the visa is granted", () => {
    const game = readyToApply({ tuning: ALWAYS_GRANTED });
    game.endTurn([slot(APPLY_CARE)]);
    game.endTurn();
    expect(routeOf(game, CARE).state).toBe("granted");
  });

  test("[R-SPONSOR-004] given an honest sponsor and the draw pinned to refuse, when the decision month ends, then the refusal gives no sponsor reason and bans nothing", () => {
    const game = readyToApply({ tuning: ALWAYS_REFUSED });
    game.endTurn([slot(APPLY_CARE)]);
    expect(sponsorGate.decision(readOf(game), care, routeOf(game, CARE))).toMatchObject({ override: null, bans: false });
    game.endTurn();
    expect(routeOf(game, CARE).state).toBe("known");
    expect(routeOf(game, CARE).lastRefusal?.reasons).not.toContain("sponsor");
  });

  test("[R-SPONSOR-004] given a fraud sponsor and the draw pinned to grant, when the decision month ends, then the visa is refused with the reason sponsor and no visa draw is made", () => {
    const game = readyToApply({ tuning: ALWAYS_GRANTED });
    hideFraud(game, CARE);
    game.endTurn([slot(APPLY_CARE)]);
    const draws = game.state.draws.visa ?? 0;
    game.endTurn();
    expect(routeOf(game, CARE).state).toBe("known");
    expect(routeOf(game, CARE).lastRefusal?.reasons[0]).toBe("sponsor");
    expect(game.state.draws.visa ?? 0).toBe(draws);
  });

  test.prop([fc.integer({ min: 0, max: 10000 }), fc.integer({ min: -12, max: 12 }), fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 4 }), fc.integer({ min: 0, max: 5 })])(
    "[R-SPONSOR-004] given any file, when an honest sponsor's chance is worked out, then it is the base plus 10 a strictness point plus 800 a refusal less 200 for a second upper, and the unexplained share and the interview never move it",
    (unexplainedBp, interviewScore, strictness, refusals, grade) => {
      const held: RouteState = { ...unknownRoute("sponsor"), state: "applying", refusals };
      const read = { state: { route: { [CARE]: held } }, world: { vars: {} }, content } as unknown as ReadCtx;
      const { terms } = sponsorGate.decision(read, care, held);
      const got = refusalChanceBp(numbers, care.refusalBaseBp, { strictness, unexplainedBp, refusals, interviewScore, grade }, terms);
      const raw = care.refusalBaseBp + 10 * strictness + 800 * refusals - (grade >= numbers.goodGrade ? 200 : 0);
      expect(got).toBe(Math.min(numbers.refusalMaxBp, Math.max(numbers.refusalMinBp, raw)));
    },
  );
});

describe("R-GATE-005: the deception ban", () => {
  test("[R-GATE-005] given a fraud sponsor, when the decision is asked for, then its refusal is the one that bans; an honest sponsor's never does", () => {
    const game = readyToApply();
    hideFraud(game, CARE);
    expect(sponsorGate.decision(readOf(game), care, routeOf(game, CARE))).toMatchObject({ override: "sponsor", bans: true });
    const honest = readyToApply();
    expect(sponsorGate.decision(readOf(honest), care, routeOf(honest, CARE))).toMatchObject({ override: null, bans: false });
  });
});

describe("R-SPONSOR-005: the care route's papers and window", () => {
  test("[R-SPONSOR-005] given the care window as content starts it, closed, when Ngozi applies with everything in hand, then the turn is rejected", () => {
    expect(content.var["var.uk-care-window"]!.start).toBe(0);
    const game = readyToApply({ vars: () => ({}) });
    expect(game.expectRejected({ type: "turn/end", slots: [slot(APPLY_CARE)] }, "not-legal").code).toBe("not-legal");
  });

  test("[R-SPONSOR-005] given the care window closed, when Ngozi meets the care bar, then she still hears of the route", () => {
    const game = readyLife(content, { from: "scenario.ngozi", quiet: true });
    for (let month = 0; month < care.hearBy! + 1 && routeOf(game, CARE).state === "unknown"; month += 1) game.endTurn();
    expect(routeOf(game, CARE).state).toBe("heard");
  });

  test("[R-SPONSOR-005] given 23 months in a nursing job, when the verification is requested, then the turn is rejected; at 24 it is being made", () => {
    const papers = without(CARE_PAPERS, "document.nmcn-verification");
    const short = ngozi({ documents: papers, change: working(null, { "activity.job-nurse": 23 }) });
    expect(short.expectRejected({ type: "turn/end", slots: [slot("activity.request-verification")] }, "not-legal").code).toBe("not-legal");
    const enough = ngozi({ documents: papers, change: working(null, { "activity.job-nurse": 24 }) });
    enough.endTurn([slot("activity.request-verification")]);
    expect(judge(enough, { type: "document/pending", document: "document.nmcn-verification" })).toBe(true);
  });

  test("[R-SPONSOR-005] given the care route, when its qualification papers are listed, then they are the licence and the verification", () => {
    expect(care.sponsor!.documents).toEqual(["document.nursing-licence", "document.nmcn-verification"]);
  });
});

describe("R-SPONSOR-006: the skilled route", () => {
  test("[R-SPONSOR-006] given 23 months of work and a degree, when talk of the skilled route arrives, then it is not heard; at 24 months it is", () => {
    const short = worker({ change: working(null, { "activity.job-teacher": 23 }) });
    applyEffects(short, [{ type: "route/hear", route: SKILLED, via: "friend" }]);
    expect(routeOf(short, SKILLED).state).toBe("unknown");
    const enough = worker();
    applyEffects(enough, [{ type: "route/hear", route: SKILLED, via: "friend" }]);
    expect(routeOf(enough, SKILLED).state).toBe("heard");
  });

  test("[R-SPONSOR-006] given a skilled sponsor one penny under the bar, when the route is viewed, then the salary item is unmet and the sponsor cannot be used; at the bar it is met", () => {
    const game = worker();
    toKnown(game, SKILLED);
    takeSponsor(game, SKILLED, SKILLED_BAR - 1, false, "agency");
    expect(checklistItem(game, SKILLED, "sponsor").met).toBe(true);
    expect(checklistItem(game, SKILLED, "salary").met).toBe(false);
    game.endTurn();
    expect(game.expectRejected({ type: "turn/end", slots: [slot(APPLY_SKILLED)] }, "not-legal").code).toBe("not-legal");
    takeSponsor(game, SKILLED, SKILLED_BAR, false, "agency");
    expect(checklistItem(game, SKILLED, "salary").met).toBe(true);
    game.endTurn([slot(APPLY_SKILLED)]);
    expect(routeOf(game, SKILLED).state).toBe("applying");
  });

  test("[R-SPONSOR-003] given a skilled sponsor just taken, when the maintenance funds have not been held over a month end, then applying is rejected; after one covered month end it goes in", () => {
    const game = worker();
    toKnown(game, SKILLED);
    takeSponsor(game, SKILLED, 5000000, false, "tech-firm");
    expect(game.expectRejected({ type: "turn/end", slots: [slot(APPLY_SKILLED)] }, "not-legal").code).toBe("not-legal");
    game.endTurn();
    expect(routeOf(game, SKILLED).funds).toMatchObject({ heldMonths: 1, covered: true, required: MAINTENANCE });
    game.endTurn([slot(APPLY_SKILLED)]);
    expect(routeOf(game, SKILLED).state).toBe("applying");
  });

  test.each([
    [MAINTENANCE, true, 1],
    [MAINTENANCE - 1, false, 0],
  ])("[R-SPONSOR-003] given %i pence shown with a skilled sponsor, when the month ends, then the maintenance is covered: %s", (shown, covered, heldMonths) => {
    const game = worker({ pockets: { NGN: { bank: 0, cash: 1500000 * UNIT }, GBP: { bank: shown, cash: 0 } } });
    toKnown(game, SKILLED);
    takeSponsor(game, SKILLED, 5000000, false, "tech-firm");
    game.endTurn();
    expect(routeOf(game, SKILLED).funds).toEqual({ heldMonths, covered, shown, required: MAINTENANCE });
  });

  test("[R-SPONSOR-003] given the care route, which has no maintenance line, when months pass with a sponsor, then no funds check runs", () => {
    const game = readyToApply();
    const funds = routeOf(game, CARE).funds;
    game.endTurn();
    expect(routeOf(game, CARE).funds).toEqual(funds);
  });
});

describe("R-SPONSOR-007: departure on a sponsor", () => {
  test("[R-SPONSOR-007] given a granted care visa, when Ngozi flies, then she is in the UK on the sponsored status", () => {
    const game = readyToApply({ tuning: ALWAYS_GRANTED });
    game.endTurn([slot(APPLY_CARE)]);
    game.endTurn();
    game.accept({ type: "route/depart", route: CARE });
    expect(routeOf(game, CARE).state).toBe("departed");
    expect(game.state.status.current?.entry).toBe("status.uk-sponsored");
    expect(game.state.place).toMatchObject({ where: "abroad", country: "country.uk" });
  });

  test("[R-SPONSOR-007] given each sponsor route, when its job abroad is asked for, then it is the sponsor's job for that route", () => {
    expect(sponsorJob(care)).toBe("activity.job-uk-care");
    expect(sponsorJob(skilled)).toBe("activity.job-uk-skilled");
  });
});
