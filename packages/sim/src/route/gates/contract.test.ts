import { fc, test } from "@fast-check/vitest";
import { content, text } from "@japacity/content";
import { describe, expect } from "vitest";

import { check } from "../../engine/check";
import { stepWith } from "../../engine/step";
import type { Ctx, Effect, Id, ReadCtx, ReportLine, Requirement, RouteState, Terms, Tuning } from "../../engine/types";
import type { Game } from "../../testing/play";
import { applyEffects, readyLife, slot, UK, withEffects } from "../route.journey";
import type { LifeOptions } from "../route.journey";
import { refusalChanceBp, unknownRoute } from "../route.logic";
import { contractGate, contractJob } from "./contract";

const GULF: Id<"route"> = "route.gulf-contract";
const APPLY: Id<"activity"> = "activity.apply-gulf-contract";
const MEDICAL: Id<"document"> = "document.medical";
const AGENT: Id<"offer"> = "offer.gulf-agent";
const AGE: Id<"quality"> = "quality.age-months";
const gulf = content.route[GULF]!;
const numbers = content.tuning.route;
const MAX_AGE = gulf.contract!.maxAgeMonths;

const ALWAYS_GRANTED: Partial<Tuning["route"]> = { refusalMinBp: 0, refusalMaxBp: 0 };

/** An agent's terms as the offer draws them: ₦1,000,000, AED 1,800 a month in fils, a guard. */
const GUARD: Terms = { fee: 100000000, salary: 180000, role: 1 };
const CLEANER: Terms = { fee: 100000000, salary: 150000, role: 2 };

function life(options: LifeOptions = {}): Game {
  return readyLife(content, { quiet: true, ...options });
}

function routeOf(game: Game, route: Id<"route"> = GULF): RouteState {
  return game.state.route[route]!;
}

function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

function judge(game: Game, requirement: Requirement): boolean {
  return check(readOf(game), requirement).met;
}

/** The motor park makes the route heard (R-CONTRACT-001); looking into it needs the UK master's heard, by month 3. */
function toKnown(game: Game): void {
  game.endTurn([slot("activity.ask-around")]);
  for (let month = 0; month < 5 && routeOf(game, UK).state !== "heard"; month += 1) game.endTurn();
  game.endTurn([slot("activity.look-into-route", GULF)]);
  expect(routeOf(game).state).toBe("known");
}

/** The work medical, requested and waited for. */
function toMedical(game: Game): void {
  game.endTurn([slot("activity.gulf-medical")]);
  for (let month = 0; month < 3 && !judge(game, { type: "document/held", document: MEDICAL }); month += 1) game.endTurn();
  expect(judge(game, { type: "document/held", document: MEDICAL })).toBe(true);
}

function agentEffects(fraud: boolean): Effect[] {
  const take = content.offer[AGENT]!.choices.find((choice) => choice.id === "take")!;
  return fraud ? take.fraudEffects! : take.effects;
}

function takeAgent(game: Game, terms: Terms = GUARD, fraud = false): void {
  applyEffects(game, agentEffects(fraud), terms);
}

/** Known, the medical held and an honest guard's contract taken. */
function ready(options: LifeOptions = {}): Game {
  const game = life(options);
  toKnown(game);
  toMedical(game);
  takeAgent(game);
  return game;
}

/** no route event writes `secret.sponsorFraud`; the override is tested with it set as the event would set it. */
function hideFraud(game: Game): void {
  game.state = { ...game.state, route: { ...game.state.route, [GULF]: { ...routeOf(game), secret: { sponsorFraud: true } } } };
}

function asCtx(read: ReadCtx): Ctx {
  return { ...read, check: (requirement: Requirement) => check(read, requirement) } as unknown as Ctx;
}

function linesOf(game: Game, effects: Effect[], terms: Terms): ReportLine[] {
  const result = stepWith(withEffects(effects, terms), game.state, { type: "offer/choose", offer: "x", choice: "y", basedOn: game.state.v }, game.world(), game.content);
  if (!result.ok) throw new Error(`The effects were rejected with ${result.code}: ${result.detail}`);
  return result.lines.filter((line) => line.key.startsWith("line.route."));
}

/** How many months of age pass between a fresh life and the turn that applies, played as `ready` plays it. */
function monthsToApply(): number {
  const game = ready();
  return (game.state.quality[AGE] ?? 0) - (life().state.quality[AGE] ?? 0);
}

describe("R-CONTRACT-001: hearing of the Gulf", () => {
  test("[R-CONTRACT-001] given a life at home, when months pass without the motor park, then the Gulf is never heard of by itself", () => {
    const game = life();
    for (let month = 0; month < 8; month += 1) game.endTurn();
    expect(routeOf(game).state).toBe("unknown");
  });

  test("[R-CONTRACT-001] given a life with schooling, when it asks around at the motor park and then looks into the Gulf, then the route is heard and then known with its short checklist", () => {
    const game = life();
    game.endTurn([slot("activity.ask-around")]);
    expect(routeOf(game).state).toBe("heard");
    toKnown(game);
    const view = game.view().routes.find((route) => route.id === GULF)!;
    expect(view.checklist.map((item) => item.id)).toEqual(["passport", "medical", "agent", "applied"]);
  });

  test("[R-CONTRACT-003] given no schooling, when it asks around at the motor park, then the Gulf is not heard of; with secondary school it is", () => {
    const none = life({ qualities: { "quality.edu-level": 0 } });
    none.endTurn([slot("activity.ask-around")]);
    expect(routeOf(none).state).toBe("unknown");
    const secondary = life({ qualities: { "quality.edu-level": 1 } });
    secondary.endTurn([slot("activity.ask-around")]);
    expect(routeOf(secondary).state).toBe("heard");
  });
});

describe("R-CONTRACT-002: the agent", () => {
  test("[R-CONTRACT-002] given the Gulf known, when the window is open or shut, then the agent may come up only while it is open", () => {
    const when = content.offer[AGENT]!.when;
    const open = life();
    toKnown(open);
    expect(when.every((requirement) => judge(open, requirement))).toBe(true);
    const shut = life({ vars: (tick) => ({ "var.uae-window": tick < 6 ? 2 : 0 }) });
    toKnown(shut);
    for (let month = 0; month < 6; month += 1) shut.endTurn();
    expect(when.every((requirement) => judge(shut, requirement))).toBe(false);
  });

  test("[R-CONTRACT-002] given an honest agent taken, when it is carried out, then the fee leaves cash as an agent's fee and the agent is recorded with the salary in fils and the role", () => {
    const game = life();
    toKnown(game);
    const cash = game.state.wallet.pockets.NGN.cash;
    const fees = game.state.wallet.totals.out["fee-agent"]?.NGN ?? 0;
    takeAgent(game, GUARD);
    expect(game.state.wallet.pockets.NGN.cash).toBe(cash - 100000000);
    expect(game.state.wallet.totals.out["fee-agent"]?.NGN).toBe(fees + 100000000);
    expect(routeOf(game).gate).toEqual({ gate: "contract", agent: { employer: "gulf-agent", salary: 180000, role: "guard" } });
  });

  test("[R-CONTRACT-002] given an agent whose role term is 2, when the agent is taken, then the role is a cleaner", () => {
    const game = life();
    toKnown(game);
    takeAgent(game, CLEANER);
    expect(routeOf(game).gate).toEqual({ gate: "contract", agent: { employer: "gulf-agent", salary: 150000, role: "cleaner" } });
  });

  test("[R-CONTRACT-002] given a fraud agent, when it is taken, then the same fee goes and the same agent is recorded, and the view shows nothing different", () => {
    const honest = life();
    const fraud = life();
    toKnown(honest);
    toKnown(fraud);
    takeAgent(honest, GUARD, false);
    takeAgent(fraud, GUARD, true);
    expect(fraud.state.wallet).toEqual(honest.state.wallet);
    expect(routeOf(fraud).gate).toEqual(routeOf(honest).gate);
    const view = (game: Game) => game.view().routes.find((route) => route.id === GULF);
    expect(view(fraud)).toEqual(view(honest));
  });

  test("[R-CONTRACT-002] given an agent taken, when it is carried out, then a line names the route", () => {
    const game = life();
    toKnown(game);
    expect(linesOf(game, agentEffects(false), GUARD)).toEqual([
      { key: "line.route.agent-recorded", params: { route: GULF }, tone: "plain", attention: true, counts: [] },
    ]);
    expect(text["line.route.agent-recorded"]).toBeDefined();
  });

  test("[R-GATE-001] given the contract route, when its steps are asked for, then the agent is the one step and the sponsor gate's salary step is never reached", () => {
    const game = life();
    toKnown(game);
    expect(contractGate.steps).toEqual(["sponsor"]);
    expect(contractGate.initial()).toEqual({ gate: "contract", agent: null });
    expect(unknownRoute("contract").gate).toEqual({ gate: "contract", agent: null });
    expect(judge(game, { type: "route/gate-step", route: GULF, step: "sponsor" })).toBe(false);
    takeAgent(game);
    expect(judge(game, { type: "route/gate-step", route: GULF, step: "sponsor" })).toBe(true);
    expect(judge(game, { type: "route/gate-step", route: GULF, step: "salary" })).toBe(false);
  });
});

describe("R-CONTRACT-003: applying and the decision", () => {
  test("[R-CONTRACT-003] given an agent, the passport and the medical, when the papers are sent, then the route is applying and no fee is taken", () => {
    const game = ready();
    const visaFees = game.state.wallet.totals.out["fee-visa"];
    const foreign = { GBP: game.state.wallet.pockets.GBP, AED: game.state.wallet.pockets.AED };
    game.endTurn([slot(APPLY)]);
    expect(routeOf(game).state).toBe("applying");
    expect(game.state.wallet.totals.out["fee-visa"]).toEqual(visaFees);
    expect({ GBP: game.state.wallet.pockets.GBP, AED: game.state.wallet.pockets.AED }).toEqual(foreign);
  });

  test("[R-CONTRACT-003] given no agent, when the papers are sent, then the turn is rejected", () => {
    const game = life();
    toKnown(game);
    toMedical(game);
    expect(game.expectRejected({ type: "turn/end", slots: [slot(APPLY)] }, "not-legal").code).toBe("not-legal");
  });

  test("[R-CONTRACT-003] given no medical, when the papers are sent, then the turn is rejected", () => {
    const game = life();
    toKnown(game);
    takeAgent(game);
    expect(game.expectRejected({ type: "turn/end", slots: [slot(APPLY)] }, "not-legal").code).toBe("not-legal");
  });

  test("[R-CONTRACT-003] given no passport, when the papers are sent, then the turn is rejected", () => {
    const game = ready({ documents: [] });
    expect(game.expectRejected({ type: "turn/end", slots: [slot(APPLY)] }, "not-legal").code).toBe("not-legal");
  });

  test("[R-CONTRACT-003] given an age of 539 months on the day, when the papers are sent, then they go in; at 540 the turn is rejected", () => {
    const months = monthsToApply();
    const start = (life().state.quality[AGE] ?? 0) - (content.scenario["scenario.ada"]!.qualities[AGE] ?? 0);
    const young = ready({ qualities: { [AGE]: MAX_AGE - 1 - months - start } });
    expect(young.state.quality[AGE]).toBe(MAX_AGE - 1);
    young.endTurn([slot(APPLY)]);
    expect(routeOf(young).state).toBe("applying");
    const old = ready({ qualities: { [AGE]: MAX_AGE - months - start } });
    expect(old.state.quality[AGE]).toBe(MAX_AGE);
    expect(old.expectRejected({ type: "turn/end", slots: [slot(APPLY)] }, "not-legal").code).toBe("not-legal");
  });

  test("[R-CONTRACT-003] given the gate asked past the slot, when the medical is gone or the age reaches the cap, then applying is held back", () => {
    const game = ready();
    const held = routeOf(game);
    const cause = { source: APPLY, param: null, terms: {} };
    expect(contractGate.mayApply(asCtx(readOf(game)), gulf, held, cause)).toBe(true);
    const documents = Object.fromEntries(Object.entries(game.state.document).filter(([id]) => id !== MEDICAL));
    expect(contractGate.mayApply(asCtx({ ...readOf(game), state: { ...game.state, document: documents } }), gulf, held, cause)).toBe(false);
    const aged = { ...game.state, quality: { ...game.state.quality, [AGE]: MAX_AGE } };
    expect(contractGate.mayApply(asCtx({ ...readOf(game), state: aged }), gulf, held, cause)).toBe(false);
    const younger = { ...game.state, quality: { ...game.state.quality, [AGE]: MAX_AGE - 1 } };
    expect(contractGate.mayApply(asCtx({ ...readOf(game), state: younger }), gulf, held, cause)).toBe(true);
  });

  test("[R-CONTRACT-003] given an honest agent and the draw pinned to grant, when the decision month ends, then the contract is granted", () => {
    const game = ready({ tuning: ALWAYS_GRANTED });
    game.endTurn([slot(APPLY)]);
    game.endTurn();
    expect(routeOf(game).state).toBe("granted");
  });

  test("[R-CONTRACT-003] given a fraud agent and the draw pinned to grant, when the decision month ends, then it is refused with the reason agent, no draw is made, and nothing bans", () => {
    const game = ready({ tuning: ALWAYS_GRANTED });
    hideFraud(game);
    expect(contractGate.decision(readOf(game), gulf, routeOf(game))).toMatchObject({ override: "agent", bans: false });
    game.endTurn([slot(APPLY)]);
    const draws = game.state.draws.visa ?? 0;
    game.endTurn();
    expect(routeOf(game).state).toBe("known");
    expect(routeOf(game).lastRefusal?.reasons[0]).toBe("agent");
    expect(game.state.draws.visa ?? 0).toBe(draws);
    expect(routeOf(game).bannedUntil).toBeNull();
  });

  test.prop([fc.integer({ min: 0, max: 10000 }), fc.integer({ min: -12, max: 12 }), fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 })])(
    "[R-GATE-002] given any file, when the contract's chance is worked out, then it is the route's base alone between the floor and the ceiling",
    (unexplainedBp, interviewScore, strictness, refusals, grade) => {
      const held: RouteState = { ...unknownRoute("contract"), state: "applying", refusals };
      const read = { state: { route: { [GULF]: held } }, world: { vars: {} }, content } as unknown as ReadCtx;
      const decision = contractGate.decision(read, gulf, held);
      expect(decision.override).toBeNull();
      const got = refusalChanceBp(numbers, gulf.refusalBaseBp, { strictness, unexplainedBp, refusals, interviewScore, grade }, decision.terms);
      expect(got).toBe(Math.min(numbers.refusalMaxBp, Math.max(numbers.refusalMinBp, gulf.refusalBaseBp)));
    },
  );
});

describe("R-CONTRACT-004: going out on the contract", () => {
  test("[R-CONTRACT-004] given a granted contract, when the character flies, then they are in the Emirates as a Gulf worker", () => {
    const game = ready({ tuning: ALWAYS_GRANTED });
    game.endTurn([slot(APPLY)]);
    game.endTurn();
    game.accept({ type: "route/depart", route: GULF });
    expect(routeOf(game).state).toBe("departed");
    expect(game.state.status.current?.entry).toBe("status.gulf-worker");
    expect(game.state.place).toMatchObject({ where: "abroad", country: "country.uae" });
  });

  test("[R-CONTRACT-004] given the agent's role, when the job abroad is asked for, then a guard's contract gives the guard's job and a cleaner's the cleaner's", () => {
    const guard = ready();
    expect(contractJob(routeOf(guard))).toBe("activity.job-gulf-guard");
    const cleaner = life();
    toKnown(cleaner);
    expect(contractJob(routeOf(cleaner))).toBeNull();
    takeAgent(cleaner, CLEANER);
    expect(contractJob(routeOf(cleaner))).toBe("activity.job-gulf-cleaner");
  });
});
