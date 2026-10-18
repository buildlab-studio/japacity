// activity:now-acts-and-month-acts: a now-act (an application, a paper, a visit) is refused in a slot, so each probe sends one as
// activity/now, and an application checked as applying is read in the month it is sent.
import { fc, test } from "@fast-check/vitest";
import { content, text } from "@japacity/content";
import { describe, expect } from "vitest";

import { check } from "../../engine/check";
import type { Content, Ctx, Effect, Id, ReadCtx, Requirement, RouteState, Terms } from "../../engine/types";
import { ALWAYS_GRANTED } from "../../testing/place.journey";
import type { Game } from "../../testing/play";
import { judge, readOf } from "../../testing/read";
import { answerFirst, applyEffects, linesOf, readyLife, slot } from "../../testing/route.journey";
import type { LifeOptions } from "../../testing/route.journey";
import { refusalChanceBp, unknownRoute } from "../route.logic";
import { contractGate, contractJob } from "./contract";
import { AGE, GULF_ROUTE, UK_ROUTE } from "../../testing/ids";

const APPLY: Id<"activity"> = "activity.apply-gulf-contract";
const MEDICAL: Id<"document"> = "document.medical";
const AGENT: Id<"offer"> = "offer.gulf-agent";
const gulf = content.route[GULF_ROUTE]!;
const numbers = content.tuning.route;
const MAX_AGE = gulf.contract!.maxAgeMonths;

/** An agent's terms as the offer draws them: ₦1,000,000, AED 1,800 a month in fils, a guard. */
const GUARD: Terms = { fee: 100000000, salary: 180000, role: 1 };
const CLEANER: Terms = { fee: 100000000, salary: 150000, role: 2 };

function life(options: LifeOptions = {}): Game {
  return readyLife(content, { quiet: true, ...options });
}

function routeOf(game: Game, route: Id<"route"> = GULF_ROUTE): RouteState {
  return game.state.route[route]!;
}

/** The motor park makes the route heard (route-gates:gulf-route-heard-at-park); looking into it needs the UK master's heard, by month 3. */
function toKnown(game: Game): void {
  // A second ask at the park looks the Gulf into once it is heard (decision 0001), so the hub's look-into is needed only while it is still heard.
  if (routeOf(game).state === "unknown") game.endTurn([slot("activity.ask-around")]);
  for (let month = 0; month < 5 && routeOf(game, UK_ROUTE).state !== "heard"; month += 1) game.endTurn();
  if (routeOf(game).state === "heard") game.endTurn([slot("activity.look-into-route", GULF_ROUTE)]);
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

/** Sets `secret.sponsorFraud` as the agent's `route/gate-updated` event would, so the override is tested on its own. */
function hideFraud(game: Game): void {
  game.state = { ...game.state, route: { ...game.state.route, [GULF_ROUTE]: { ...routeOf(game), secret: { sponsorFraud: true } } } };
}

function asCtx(read: ReadCtx): Ctx {
  return { ...read, check: (requirement: Requirement) => check(read, requirement) } as unknown as Ctx;
}

/** How many months of age pass between a fresh life and the turn that applies, played as `ready` plays it. */
function monthsToApply(): number {
  const game = ready();
  return (game.state.quality[AGE] ?? 0) - (life().state.quality[AGE] ?? 0);
}

describe("route-gates:gulf-route-heard-at-park: hearing of the Gulf", () => {
  test("[route-gates:gulf-route-heard-at-park] given a life at home, when months pass without the motor park, then the Gulf is never heard of by itself", () => {
    const game = life();
    for (let month = 0; month < 8; month += 1) game.endTurn();
    expect(routeOf(game).state).toBe("unknown");
  });

  test("[route-gates:gulf-route-heard-at-park] given a life with schooling, when it asks around at the motor park and then looks into the Gulf, then the route is heard and then known with its short checklist", () => {
    const game = life();
    game.endTurn([slot("activity.ask-around")]);
    expect(routeOf(game).state).toBe("heard");
    toKnown(game);
    const view = game.view().routes.find((route) => route.id === GULF_ROUTE)!;
    expect(view.checklist.map((item) => item.id)).toEqual(["passport", "medical", "agent", "police", "applied"]);
  });

  test("[route-gates:gulf-route-heard-at-park] [chapter:chapters-follow-lean-route] given a life that has heard of the Gulf, when it asks around at the motor park, then the ask looks the Gulf into there; a first ask only hears of it, and a life that never heard of it is not looked into by the ask alone", () => {
    const game = life();
    game.endTurn([slot("activity.ask-around")]);
    expect(routeOf(game).state).toBe("heard");
    game.endTurn([slot("activity.ask-around")]);
    expect(routeOf(game).state).toBe("known");
    const ask = content.activity["activity.ask-around"]!.effects;
    expect(ask[0]).toEqual({ type: "route/look-into", route: GULF_ROUTE });
    expect(ask.findIndex((effect) => effect.type === "route/hear")).toBeGreaterThan(0);
  });

  test("[route-gates:gulf-application-needs] given no schooling, when it asks around at the motor park, then the Gulf is not heard of; with secondary school it is", () => {
    const none = life({ qualities: { "quality.edu-level": 0 } });
    none.endTurn([slot("activity.ask-around")]);
    expect(routeOf(none).state).toBe("unknown");
    const secondary = life({ qualities: { "quality.edu-level": 1 } });
    secondary.endTurn([slot("activity.ask-around")]);
    expect(routeOf(secondary).state).toBe("heard");
  });
});

describe("route-gates:gulf-agent-offer: the agent", () => {
  test("[route-gates:gulf-agent-offer] given the Gulf known, when the window is open or shut, then the agent may come up only while it is open", () => {
    const when = content.offer[AGENT]!.when;
    const open = life();
    toKnown(open);
    expect(when.every((requirement) => judge(open, requirement))).toBe(true);
    const shut = life({ vars: (tick) => ({ "var.uae-window": tick < 6 ? 2 : 0 }) });
    toKnown(shut);
    for (let month = 0; month < 6; month += 1) shut.endTurn();
    expect(when.every((requirement) => judge(shut, requirement))).toBe(false);
  });

  test("[route-gates:gulf-agent-offer] [wallet:money-lands-as-in-lagos] given an honest agent taken, when it is carried out, then the fee, over the line for cash, leaves the bank first as an agent's fee and the agent is recorded with the salary in fils and the role", () => {
    const game = life();
    toKnown(game);
    const { bank, cash } = game.state.wallet.pockets.NGN;
    const fees = game.state.wallet.totals.out["fee-agent"]?.NGN ?? 0;
    expect(100000000).toBeGreaterThan(game.content.tuning.wallet.cashUpTo);
    takeAgent(game, GUARD);
    const fromBank = Math.min(bank, 100000000);
    expect(game.state.wallet.pockets.NGN).toMatchObject({ bank: bank - fromBank, cash: cash - (100000000 - fromBank) });
    expect(game.state.wallet.totals.out["fee-agent"]?.NGN).toBe(fees + 100000000);
    expect(routeOf(game).gate).toEqual({ gate: "contract", agent: { employer: "gulf-agent", salary: 180000, role: "guard" } });
  });

  test("[route-gates:gulf-agent-offer] given an agent whose role term is 2, when the agent is taken, then the role is a cleaner", () => {
    const game = life();
    toKnown(game);
    takeAgent(game, CLEANER);
    expect(routeOf(game).gate).toEqual({ gate: "contract", agent: { employer: "gulf-agent", salary: 150000, role: "cleaner" } });
  });

  test("[route-gates:gulf-agent-offer] given a fraud agent, when it is taken, then the same fee goes and the same agent is recorded, and the view shows nothing different", () => {
    const honest = life();
    const fraud = life();
    toKnown(honest);
    toKnown(fraud);
    takeAgent(honest, GUARD, false);
    takeAgent(fraud, GUARD, true);
    expect(fraud.state.wallet).toEqual(honest.state.wallet);
    expect(routeOf(fraud).gate).toEqual(routeOf(honest).gate);
    const view = (game: Game) => game.view().routes.find((route) => route.id === GULF_ROUTE);
    expect(view(fraud)).toEqual(view(honest));
  });

  test("[route-gates:gulf-agent-offer] given an agent taken, when it is carried out, then a line names the route", () => {
    const game = life();
    toKnown(game);
    expect(linesOf(game, agentEffects(false), GUARD)).toEqual([
      { key: "line.route.agent-recorded", params: { route: GULF_ROUTE }, tone: "plain", attention: true, counts: [] },
    ]);
    expect(text["line.route.agent-recorded"]).toBeDefined();
  });

  test("[route-gates:route-runs-its-gate-steps] given the contract route, when its steps are asked for, then the agent is the one step and the sponsor gate's salary step is never reached", () => {
    const game = life();
    toKnown(game);
    expect(contractGate.steps).toEqual(["sponsor"]);
    expect(contractGate.initial()).toEqual({ gate: "contract", agent: null });
    expect(unknownRoute("contract").gate).toEqual({ gate: "contract", agent: null });
    expect(judge(game, { type: "route/gate-step", route: GULF_ROUTE, step: "sponsor" })).toBe(false);
    takeAgent(game);
    expect(judge(game, { type: "route/gate-step", route: GULF_ROUTE, step: "sponsor" })).toBe(true);
    expect(judge(game, { type: "route/gate-step", route: GULF_ROUTE, step: "salary" })).toBe(false);
  });
});

describe("route-gates:gulf-application-needs: applying and the decision", () => {
  test("[route-gates:gulf-application-needs] given an agent, the passport and the medical, when the papers are sent, then the route is applying and no fee is taken", () => {
    const game = ready();
    const visaFees = game.state.wallet.totals.out["fee-visa"];
    const foreign = { GBP: game.state.wallet.pockets.GBP, AED: game.state.wallet.pockets.AED };
    // activity:now-acts-and-month-acts: the papers are sent at once, so the route is applying in the month they are sent.
    game.accept({ type: "activity/now", activity: APPLY, param: null });
    expect(routeOf(game).state).toBe("applying");
    expect(game.state.wallet.totals.out["fee-visa"]).toEqual(visaFees);
    expect({ GBP: game.state.wallet.pockets.GBP, AED: game.state.wallet.pockets.AED }).toEqual(foreign);
  });

  test("[route-gates:gulf-application-needs] given no agent, when the papers are sent, then the turn is rejected", () => {
    const game = life();
    toKnown(game);
    toMedical(game);
    expect(game.expectRejected({ type: "activity/now", activity: APPLY, param: null }, "not-legal").code).toBe("not-legal");
  });

  test("[route-gates:gulf-application-needs] given no medical, when the papers are sent, then the turn is rejected", () => {
    const game = life();
    toKnown(game);
    takeAgent(game);
    expect(game.expectRejected({ type: "activity/now", activity: APPLY, param: null }, "not-legal").code).toBe("not-legal");
  });

  test("[route-gates:gulf-application-needs] given no passport, when the papers are sent, then the turn is rejected", () => {
    const game = ready({ documents: [] });
    expect(game.expectRejected({ type: "activity/now", activity: APPLY, param: null }, "not-legal").code).toBe("not-legal");
  });

  test("[route-gates:gulf-application-needs] given an age of 539 months on the day, when the papers are sent, then they go in; at 540 the turn is rejected", () => {
    const months = monthsToApply();
    const start = (life().state.quality[AGE] ?? 0) - (content.scenario["scenario.ada"]!.qualities[AGE] ?? 0);
    const young = ready({ qualities: { [AGE]: MAX_AGE - 1 - months - start } });
    expect(young.state.quality[AGE]).toBe(MAX_AGE - 1);
    young.accept({ type: "activity/now", activity: APPLY, param: null });
    expect(routeOf(young).state).toBe("applying");
    const old = ready({ qualities: { [AGE]: MAX_AGE - months - start } });
    expect(old.state.quality[AGE]).toBe(MAX_AGE);
    expect(old.expectRejected({ type: "activity/now", activity: APPLY, param: null }, "not-legal").code).toBe("not-legal");
  });

  test("[route-gates:gulf-application-needs] given the gate asked past the slot, when the medical is gone or the age reaches the cap, then applying is held back", () => {
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

  test("[route-gates:gulf-application-needs] given an honest agent and the draw pinned to grant, when the decision month ends, then the contract is granted", () => {
    const game = ready({ tuning: ALWAYS_GRANTED });
    game.endTurn([slot(APPLY)]);
    game.endTurn();
    expect(routeOf(game).state).toBe("granted");
  });

  test("[route-gates:gulf-application-needs] given a fraud agent and the draw pinned to grant, when the decision month ends, then it is refused with the reason agent, no draw is made, and nothing bans", () => {
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
    "[route-gates:gate-decision-draw-terms] given any file, when the contract's chance is worked out, then it is the route's base alone between the floor and the ceiling",
    (unexplainedBp, interviewScore, strictness, refusals, grade) => {
      const held: RouteState = { ...unknownRoute("contract"), state: "applying", refusals };
      const read = { state: { route: { [GULF_ROUTE]: held } }, world: { vars: {} }, content } as unknown as ReadCtx;
      const decision = contractGate.decision(read, gulf, held);
      expect(decision.override).toBeNull();
      const got = refusalChanceBp(numbers, gulf.refusalBaseBp, { strictness, unexplainedBp, refusals, interviewScore, grade }, decision.terms);
      expect(got).toBe(Math.min(numbers.refusalMaxBp, Math.max(numbers.refusalMinBp, gulf.refusalBaseBp)));
    },
  );
});

describe("route-gates:employer-flies-and-holds-passport: going out on the contract", () => {
  test("[route-gates:employer-flies-and-holds-passport] given a granted contract, when the character flies, then they are in the Emirates as a Gulf worker", () => {
    const game = ready({ tuning: ALWAYS_GRANTED });
    game.endTurn([slot(APPLY)]);
    game.endTurn();
    game.accept({ type: "route/depart", route: GULF_ROUTE });
    expect(routeOf(game).state).toBe("departed");
    expect(game.state.status.current?.entry).toBe("status.gulf-worker");
    expect(game.state.place).toMatchObject({ where: "abroad", country: "country.uae" });
  });

  test("[route-gates:employer-flies-and-holds-passport] given the agent's role, when the job abroad is asked for, then a guard's contract gives the guard's job and a cleaner's the cleaner's", () => {
    const guard = ready();
    expect(contractJob(routeOf(guard))).toBe("activity.job-gulf-guard");
    const cleaner = life();
    toKnown(cleaner);
    expect(contractJob(routeOf(cleaner))).toBeNull();
    takeAgent(cleaner, CLEANER);
    expect(contractJob(routeOf(cleaner))).toBe("activity.job-gulf-cleaner");
  });
});

describe("the Gulf contract renewed by the employer", () => {
  const WORKER: Id<"status"> = "status.gulf-worker";

  /** The employer's chance set to this figure. */
  function renewAt(renewBp: number): (used: Content) => Content {
    return (used) => ({ ...used, status: { ...used.status, [WORKER]: { ...used.status[WORKER]!, renewBp } } });
  }

  /** One month, any open scene answered first (the December visit comes to the Emirates too). */
  function month(game: Game) {
    if (game.state.setpiece.open !== null) answerFirst(game);
    if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
    return game.endTurn();
  }

  /** A guard flown out on the contract, months played until the contract's last month is next. */
  function toLastMonth(renewBp: number): Game {
    const game = ready({ tuning: ALWAYS_GRANTED, change: renewAt(renewBp) });
    game.endTurn([slot(APPLY)]);
    game.endTurn();
    game.accept({ type: "route/depart", route: GULF_ROUTE });
    const expires = game.state.status.current!.expiresMonth!;
    while (game.state.turn.month < expires - 2) month(game);
    expect(game.state.status.current?.entry).toBe(WORKER);
    return game;
  }

  function feesPaid(game: Game): number {
    return Object.values(game.state.wallet.totals.out["fee-visa"] ?? {}).reduce((sum, amount) => sum + (amount ?? 0), 0);
  }

  test("[status:renewing-a-status] given the Gulf contract's entry, when it is read, then the employer renews at 60 in 100 for 24 months and the player has no fee to pay", () => {
    expect(content.status[WORKER]).toMatchObject({ renewBp: 6000, renewMonths: 24, renewFeeVar: null });
  });

  test("[status:renewing-a-status] given a Gulf worker in the contract's last month and the employer's draw won, when the month ends, then the contract runs 24 months more with no fee and a line; the player still cannot ask", () => {
    const game = toLastMonth(10000);
    const expires = game.state.status.current!.expiresMonth!;
    const fees = feesPaid(game);
    const draws = game.state.draws.status ?? 0;
    const result = month(game);
    expect(game.state.turn.month).toBe(expires - 1);
    expect(game.state.status.current).toMatchObject({ entry: WORKER, expiresMonth: expires + 24 });
    expect(game.state.draws.status ?? 0).toBe(draws + 1);
    expect(feesPaid(game)).toBe(fees);
    expect(result.lines).toContainEqual({ key: "line.status.employer-renewed", params: { status: WORKER, months: 24 }, tone: "good", attention: true, counts: [] });
    expect(text["line.status.employer-renewed"]).toContain("{months}");
    game.expectRejected({ type: "status/renew" }, "not-legal");
    expect(game.view().status?.renew).toBeNull();
    month(game);
    expect(game.state.status.current?.entry).toBe(WORKER);
  });

  test("[status:renewing-a-status] given the months before the last, when they end, then no draw is made on the status stream", () => {
    const game = ready({ tuning: ALWAYS_GRANTED, change: renewAt(10000) });
    game.endTurn([slot(APPLY)]);
    game.endTurn();
    game.accept({ type: "route/depart", route: GULF_ROUTE });
    const expires = game.state.status.current!.expiresMonth!;
    const before = game.state.status.current!;
    for (let played = 0; played < 3; played += 1) month(game);
    expect(game.state.draws.status ?? 0).toBe(0);
    expect(game.state.status.current?.expiresMonth).toBe(expires);
    expect(before.expiresMonth).toBe(expires);
  });

  test("[status:renewing-a-status] given the employer's draw lost, when the contract's last month and the next end, then it is not renewed and lapses", () => {
    const game = toLastMonth(0);
    const expires = game.state.status.current!.expiresMonth!;
    month(game);
    expect(game.state.status.current).toMatchObject({ entry: WORKER, expiresMonth: expires });
    month(game);
    expect(game.state.status.current?.entry).toBe("status.uae-irregular");
  });
});
