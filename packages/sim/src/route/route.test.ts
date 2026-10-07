import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../engine/check";
import { convertMinor, mulDiv } from "../engine/int";
import { checkInvariants } from "../engine/invariants";
import type { ActivityEntry, Content, Currency, Id, ReadCtx, ReportLine, Requirement, RouteStateName, SchoolEntry, ForeignCurrency } from "../engine/types";
import { legalCommands } from "../testing/legal";
import type { Game } from "../testing/play";
import type { RouteKindEvent } from "./route.events";
import {
  ASHBY,
  KINGSMERE,
  NORTHGATE,
  READY_PAPERS,
  UK,
  UNIT,
  answerFirst,
  applyEffects,
  draw,
  drawnQuestions,
  readyLife,
  seedWhere,
  slot,
  toAnswer,
  toApplied,
  toDecision,
  toDeposit,
  toHeld,
  toKnown,
  toOffer,
  uk,
  watchHear,
} from "./route.journey";
import type { LifeOptions, Watch } from "./route.journey";
import { FRIEND, fundsRequired, fundsShown, offerChanceBp, refusalChanceBp, refusalReasons, routeKind, unexplainedBp } from "./route.logic";

const numbers = content.tuning.route;
/** The UK master's own base chance of refusal (R-ROUTE-016). */
const UK_BASE = content.route[UK]!.refusalBaseBp;
const school = (id: Id<"school">): SchoolEntry => content.school[id]!;
const CAS: Id<"document"> = "document.cas";
const TB: Id<"document"> = "document.tb-certificate";
const WINDOW: Id<"var"> = "var.uk-study-window";
const GRADE: Id<"quality"> = "quality.edu-grade";
/** The questions the interview may ask with a clean file, in content order. */
const CLEAN_POOL = ["why-uk", "who-pays", "after", "course", "living"];

/** Never refused, or always: the floor and the ceiling of R-ROUTE-016 pinned together. */
const ALWAYS_GRANTED: Partial<typeof numbers> = { refusalMinBp: 0, refusalMaxBp: 0 };
const ALWAYS_REFUSED: Partial<typeof numbers> = { refusalMinBp: 10000, refusalMaxBp: 10000 };

/** The first seed whose first Northgate answer is an offer for a grade of second upper. */
const OFFERED = seedWhere((seed) => draw(seed, "school", 1, 10000) < offerChanceBp(school(NORTHGATE), 4, numbers));

function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

function judge(game: Game, requirement: Requirement) {
  return check(readOf(game), requirement);
}

function living(game: Game): number {
  const vars = game.world().vars;
  return (vars["var.uk-living-line"] ?? 0) * (vars["var.uk-living-months"] ?? 0);
}

function toPence(game: Game, amount: number, currency: Currency): number {
  const rates = game.world().rates;
  const official = Object.fromEntries(Object.entries(rates).map(([key, rate]) => [key, rate.official])) as Record<ForeignCurrency, number>;
  return convertMinor(amount, currency, "GBP", official);
}

function routeLines(lines: ReportLine[]): ReportLine[] {
  return lines.filter((line) => line.key.startsWith("line.route."));
}

/** Content whose activities are changed by `change`, keyed by id. */
function withActivity(id: Id<"activity">, change: (entry: ActivityEntry) => ActivityEntry): (used: Content) => Content {
  return (used) => ({ ...used, activity: { ...used.activity, [id]: change(used.activity[id]!) } });
}

/** The interview score of answering each question with its first answer, from the page's table. */
function firstScore(question: string, prep: number, unexplained: number): number {
  switch (question) {
    case "why-uk":
      return prep >= 20 ? 2 : 0;
    case "who-pays":
      return unexplained <= 2000 ? 2 : -2;
    case "after":
      return 2;
    case "course":
      return prep >= 40 ? 2 : -1;
    case "deposit":
      return 0;
    case "living":
      return prep >= 20 ? 1 : -1;
    default:
      throw new Error(`No question ${question}.`);
  }
}

function life(options: LifeOptions = {}): Game {
  return readyLife(content, { seed: OFFERED, ...options });
}

describe("the states of a route", () => {
  test("[R-ROUTE-001] given a ready life played to the end, when its route's states are listed, then it went unknown, heard, known, applying, granted, departed and nothing else", () => {
    const game = life({ tuning: ALWAYS_GRANTED });
    const seen: RouteStateName[] = [uk(game).state];
    const note = () => {
      if (seen.at(-1) !== uk(game).state) seen.push(uk(game).state);
    };
    for (let month = 0; month < 5 && uk(game).state === "unknown"; month += 1) {
      game.endTurn();
      note();
    }
    game.endTurn([slot("activity.look-into-route", UK)]);
    note();
    toHeld(game);
    note();
    game.endTurn([slot("activity.apply-for-visa")]);
    note();
    answerFirst(game);
    game.endTurn();
    note();
    game.accept({ type: "route/depart", route: UK });
    note();
    expect(seen).toEqual(["unknown", "heard", "known", "applying", "granted", "departed"]);
    expect(checkInvariants(game.state, game.content)).toEqual([]);
  });

  test("[R-ROUTE-001] given a route not yet granted, when it is flown or paid on without an offer, then each is rejected and the route stays where it was", () => {
    const game = life();
    game.expectRejected({ type: "route/depart", route: UK }, "not-legal");
    game.expectRejected({ type: "route/pay-deposit", route: UK, school: NORTHGATE }, "not-legal");
    toKnown(game);
    game.expectRejected({ type: "route/depart", route: UK }, "not-legal");
    toApplied(game);
    game.expectRejected({ type: "route/depart", route: UK }, "not-legal");
    expect(uk(game).state).toBe("applying");
  });

  test("[R-ROUTE-001] given a known route, when talk of it reaches the character again, then it stays known and no chance is drawn", () => {
    // Only the UK route's hearing: the meetup also hears the talent route, which is not under test here.
    const sure = withActivity("activity.meetup", (entry) => ({
      ...entry,
      effects: entry.effects.filter((effect) => effect.type !== "route/hear" || effect.route === UK).map((effect) => (effect.type === "route/hear" ? { ...effect, chanceBp: 10000 } : effect)),
    }));
    const watch: Watch = { calls: 0, draws: {} };
    const game = life({ change: sure, kinds: watchHear(watch) });
    toKnown(game);
    const calls = watch.calls;
    const draws = watch.draws.offer ?? 0;
    game.endTurn([slot("activity.meetup")]);
    expect(uk(game).state).toBe("known");
    expect(watch.calls).toBeGreaterThan(calls);
    expect(watch.draws.offer ?? 0).toBe(draws);
  });

  test("[R-ROUTE-001] given an unknown route, when an event moves it along no arrow of the page, then evolve refuses it", () => {
    const game = life();
    const jump: RouteKindEvent = { type: "route/moved", route: UK, to: "departed" };
    expect(() => routeKind.evolve(game.state.route, jump, game.state, game.content)).toThrow("cannot move from unknown to departed");
  });
});

describe("hearing of a route and looking into it", () => {
  // Only the UK route's hearing: the meetup also hears the talent route, which is not under test here.
  const meetupChance = (chanceBp: number) =>
    withActivity("activity.meetup", (entry) => ({
      ...entry,
      effects: entry.effects.filter((effect) => effect.type !== "route/hear" || effect.route === UK).map((effect) => (effect.type === "route/hear" ? { ...effect, chanceBp } : effect)),
    }));

  test("[R-ROUTE-002] given a meetup whose chance to hear is certain, when it is played, then the route is heard of via the meetup, after one draw on the offer stream", () => {
    const watch: Watch = { calls: 0, draws: {} };
    const game = life({ quiet: true, change: meetupChance(10000), kinds: watchHear(watch) });
    const result = game.endTurn([slot("activity.meetup")]);
    expect(uk(game).state).toBe("heard");
    expect(uk(game).heardMonth).toBe(1);
    expect(watch.draws).toEqual({ offer: 1 });
    expect(routeLines(result.lines)).toContainEqual({ key: "line.route.heard", params: { route: UK, via: "meetup" }, tone: "good", attention: false, counts: [] });
  });

  test("[R-ROUTE-002] given a meetup whose chance to hear is nil, when it is played, then the draw is made and the route stays unknown", () => {
    const watch: Watch = { calls: 0, draws: {} };
    const game = life({ quiet: true, change: meetupChance(0), kinds: watchHear(watch) });
    game.endTurn([slot("activity.meetup")]);
    expect(uk(game).state).toBe("unknown");
    expect(watch.draws).toEqual({ offer: 1 });
  });

  test("[R-ROUTE-002] given the real meetup's chance, when it is played, then the route is heard exactly when the offer draw falls under it", () => {
    const chanceBp = content.activity["activity.meetup"]!.effects.find((effect) => effect.type === "route/hear");
    if (chanceBp?.type !== "route/hear" || chanceBp.chanceBp === undefined) throw new Error("The meetup has no chance to hear.");
    for (const seed of ["seed-0", "seed-1", "seed-2", "seed-3", "seed-4", "seed-5"]) {
      const game = life({ quiet: true, seed });
      game.endTurn([slot("activity.meetup")]);
      expect(uk(game).state).toBe(draw(seed, "offer", 0, 10000) < chanceBp.chanceBp ? "heard" : "unknown");
    }
  });

  test("[R-ROUTE-002] given no degree, when a certain meetup is played, then hearIf fails and the route stays unknown", () => {
    const game = life({ quiet: true, change: meetupChance(10000), qualities: { "quality.edu-level": 2 } });
    game.endTurn([slot("activity.meetup")]);
    expect(uk(game).state).toBe("unknown");
  });

  test("[R-ROUTE-003] given a degree and no news, when months pass, then the route is unknown before its hearBy month and heard through a friend in it", () => {
    const game = life({ quiet: true });
    const hearBy = content.route[UK]!.hearBy ?? 0;
    for (let month = 1; month < hearBy; month += 1) {
      game.endTurn();
      expect(uk(game).state).toBe("unknown");
    }
    const result = game.endTurn();
    expect(game.state.turn.month).toBe(hearBy);
    expect(uk(game)).toMatchObject({ state: "heard", heardMonth: hearBy });
    expect(routeLines(result.lines)).toEqual([{ key: "line.route.heard", params: { route: UK, via: FRIEND }, tone: "good", attention: false, counts: [] }]);
  });

  test("[R-ROUTE-003] given no degree, when months pass well beyond hearBy, then nobody tells them and the route stays unknown", () => {
    const game = life({ quiet: true, qualities: { "quality.edu-level": 2 } });
    for (let month = 0; month < 6; month += 1) game.endTurn();
    expect(uk(game).state).toBe("unknown");
  });

  test("[R-ROUTE-004] given a heard route, when it is looked into, then it is known from that month and its checklist is shown from then on", () => {
    const game = life({ quiet: true });
    for (let month = 0; month < 3; month += 1) game.endTurn();
    expect(game.view().routes[0]?.checklist).toEqual([]);
    const result = game.endTurn([slot("activity.look-into-route", UK)]);
    expect(uk(game)).toMatchObject({ state: "known", knownMonth: 4 });
    expect(routeLines(result.lines)).toEqual([{ key: "line.route.looked-into", params: { route: UK }, tone: "good", attention: false, counts: [] }]);
    const view = game.view().routes[0]!;
    expect(view.checklist.map((item) => item.id)).toEqual(content.route[UK]!.checklist.map((item) => item.id));
    expect(view.checklist.find((item) => item.id === "degree")).toEqual({ id: "degree", weight: 6, met: true, have: null, need: null, earned: 6 });
  });

  test("[R-ROUTE-004] given a known route with funds short, when the view is read, then the slow funds item carries what is shown and needed and earns its share rounded down", () => {
    const game = life({ pockets: { NGN: { bank: 2000000 * UNIT, cash: 500000 * UNIT } } });
    toKnown(game);
    const funds = game.view().routes[0]!.checklist.find((item) => item.id === "funds")!;
    const shown = fundsShown(readOf(game), UK);
    const required = fundsRequired(readOf(game), UK);
    expect(shown).toBeLessThan(required);
    expect(funds).toEqual({ id: "funds", weight: 28, met: false, have: shown, need: required, earned: mulDiv(28, shown, required) });
    expect(funds.earned).toBeGreaterThan(0);
    expect(game.view().routes[0]!.checklist.find((item) => item.id === "deposit")).toMatchObject({ met: false, have: null, need: null, earned: 0 });
  });
});

describe("the window", () => {
  test("[R-ROUTE-005] given the window variable at 2, 1 and 0, when the view is read, then the window is open, narrowing and closed", () => {
    for (const [value, window] of [
      [2, "open"],
      [1, "narrowing"],
      [0, "closed"],
    ] as const) {
      const game = life({ vars: () => ({ [WINDOW]: value }) });
      expect(game.view().routes[0]?.window).toBe(window);
    }
  });

  test("[R-ROUTE-005] given a window that closes after an offer, when the player applies to a school or for the visa, then both are refused, but the deposit can still be paid", () => {
    let window = 2;
    const game = life({ vars: () => ({ [WINDOW]: window }) });
    toOffer(game);
    window = 0;
    game.expectRejected({ type: "turn/end", slots: [slot("activity.apply-to-school", ASHBY)] }, "not-legal");
    game.accept({ type: "route/pay-deposit", route: UK, school: NORTHGATE });
    game.endTurn();
    expect(uk(game).funds.heldMonths).toBe(1);
    game.expectRejected({ type: "turn/end", slots: [slot("activity.apply-for-visa")] }, "not-legal");
    window = 1;
    game.endTurn([slot("activity.apply-for-visa")]);
    expect(uk(game).state).toBe("applying");
  });

  test("[R-ROUTE-005] given activities that forget the window, when they are played with it closed, then the route's own effects send nothing", () => {
    const open = (entry: ActivityEntry): ActivityEntry => ({ ...entry, requires: entry.requires.filter((requirement) => requirement.type !== "var/min") });
    const change = (used: Content) => withActivity("activity.apply-for-visa", open)(withActivity("activity.apply-to-school", open)(used));
    let window = 2;
    const game = life({ change, vars: () => ({ [WINDOW]: window }) });
    toHeld(game);
    window = 0;
    const fees = game.state.wallet.pockets.GBP.bank;
    game.endTurn([slot("activity.apply-to-school", ASHBY), slot("activity.apply-for-visa")]);
    expect(uk(game).schools[ASHBY]).toBeUndefined();
    expect(uk(game).state).toBe("known");
    expect(uk(game).visa).toBeNull();
    expect(game.state.setpiece.open).toBeNull();
    // The visa slot's fees were taken before its effect looked at the window.
    expect(game.state.wallet.pockets.GBP.bank).toBeLessThan(fees);
  });

  test("[R-ROUTE-005] given an application sent, when the window closes before decision day, then it is still decided", () => {
    let window = 2;
    const game = life({ tuning: ALWAYS_GRANTED, vars: () => ({ [WINDOW]: window }) });
    toApplied(game);
    answerFirst(game);
    window = 0;
    game.endTurn();
    expect(uk(game).state).toBe("granted");
  });
});

describe("schools", () => {
  test("[R-ROUTE-006] given a known route, when two schools are applied to in one month, then each answer is due after a wait drawn on the school stream between its two figures", () => {
    const seed = "seed-3";
    const game = life({ seed });
    toKnown(game);
    const month = game.state.turn.month + 1;
    const result = game.endTurn([slot("activity.apply-to-school", NORTHGATE), slot("activity.apply-to-school", ASHBY)]);
    const [low, high] = school(ASHBY).answerMonths;
    expect(school(NORTHGATE).answerMonths).toEqual([1, 1]);
    expect(uk(game).schools[NORTHGATE]).toEqual({ state: "pending", readyMonth: month + 1, discount: 0 });
    expect(uk(game).schools[ASHBY]).toEqual({ state: "pending", readyMonth: month + low + draw(seed, "school", 1, high - low + 1), discount: 0 });
    expect(game.state.draws.school).toBe(2);
    // Lines about other routes (a friend mentioning one) are not under test here.
    expect(routeLines(result.lines).filter((line) => line.params.route === undefined || line.params.route === UK).map((line) => line.key)).toEqual(["line.route.school-applied", "line.route.school-applied"]);
  });

  test("[R-ROUTE-006] given a band exactly at a school's minimum, when it is applied to, then it is accepted; a step under, the turn is refused", () => {
    const at = life({ documents: READY_PAPERS.map((paper) => (paper.document === "document.english-test" ? { ...paper, value: school(ASHBY).minBand } : paper)) });
    toKnown(at);
    at.endTurn([slot("activity.apply-to-school", ASHBY)]);
    expect(uk(at).schools[ASHBY]?.state).toBe("pending");
    const under = life({ documents: READY_PAPERS.map((paper) => (paper.document === "document.english-test" ? { ...paper, value: school(ASHBY).minBand - 5 } : paper)) });
    toKnown(under);
    under.expectRejected({ type: "turn/end", slots: [slot("activity.apply-to-school", ASHBY)] }, "not-legal");
    under.endTurn([slot("activity.apply-to-school", NORTHGATE)]);
    expect(uk(under).schools[NORTHGATE]?.state).toBe("pending");
  });

  test("[R-ROUTE-006] given a grade under a school's minimum, when it is applied to, then the turn is refused; at the minimum, it is accepted", () => {
    const game = life({ qualities: { [GRADE]: school(ASHBY).minGrade - 1 } });
    toKnown(game);
    game.expectRejected({ type: "turn/end", slots: [slot("activity.apply-to-school", ASHBY)] }, "not-legal");
    game.endTurn([slot("activity.apply-to-school", NORTHGATE)]);
    expect(school(NORTHGATE).minGrade).toBe(school(ASHBY).minGrade - 1);
    expect(uk(game).schools[NORTHGATE]?.state).toBe("pending");
  });

  test("[R-ROUTE-006] given an application pending or an offer held, when the same school is applied to again, then the turn is refused", () => {
    const game = life();
    toKnown(game);
    game.endTurn([slot("activity.apply-to-school", NORTHGATE)]);
    game.expectRejected({ type: "turn/end", slots: [slot("activity.apply-to-school", NORTHGATE)] }, "not-legal");
    game.endTurn();
    expect(uk(game).schools[NORTHGATE]?.state).toBe("offer");
    game.expectRejected({ type: "turn/end", slots: [slot("activity.apply-to-school", NORTHGATE)] }, "not-legal");
  });

  test("[R-ROUTE-007] given a school and a grade, when the chance of an offer is worked out, then it is the base plus 5% a grade above the minimum, at most 95%", () => {
    const northgate = school(NORTHGATE);
    expect(offerChanceBp(northgate, northgate.minGrade, numbers)).toBe(northgate.offerBp);
    expect(offerChanceBp(northgate, northgate.minGrade + 1, numbers)).toBe(northgate.offerBp + 500);
    expect(offerChanceBp(northgate, northgate.minGrade + 2, numbers)).toBe(9500);
    expect(offerChanceBp(northgate, northgate.minGrade + 3, numbers)).toBe(9500);
    expect(offerChanceBp({ ...northgate, offerBp: 9499 }, northgate.minGrade, numbers)).toBe(9499);
    expect(offerChanceBp({ ...northgate, offerBp: 9499 }, northgate.minGrade + 1, numbers)).toBe(9500);
    expect(offerChanceBp(school(KINGSMERE), school(KINGSMERE).minGrade, numbers)).toBe(school(KINGSMERE).offerBp);
  });

  test("[R-ROUTE-007] given a school whose wait is two months, when one month passes, then it has not answered; when its month comes, it answers", () => {
    const seed = seedWhere((candidate) => draw(candidate, "school", 0, 2) === 1);
    const game = life({ seed });
    toKnown(game);
    game.endTurn([slot("activity.apply-to-school", ASHBY)]);
    const due = uk(game).schools[ASHBY]!.readyMonth;
    expect(due).toBe(game.state.turn.month + 2);
    game.endTurn();
    expect(uk(game).schools[ASHBY]?.state).toBe("pending");
    const result = game.endTurn();
    expect(game.state.turn.month).toBe(due);
    expect(uk(game).schools[ASHBY]?.state).not.toBe("pending");
    expect(routeLines(result.lines).every((line) => line.attention)).toBe(true);
  });

  test("[R-ROUTE-007] given several seeds, when Northgate answers a second upper, then it offers exactly when the school draw falls under its chance, with the automatic discount", () => {
    const chance = offerChanceBp(school(NORTHGATE), 4, numbers);
    const outcomes = new Set<boolean>();
    for (let i = 0; i < 40 && outcomes.size < 2; i += 1) {
      const seed = `seed-${String(i)}`;
      const game = readyLife(content, { seed });
      toAnswer(game, NORTHGATE);
      const offered = draw(seed, "school", 1, 10000) < chance;
      outcomes.add(offered);
      expect(uk(game).schools[NORTHGATE]).toMatchObject(offered ? { state: "offer", discount: school(NORTHGATE).autoDiscount!.amount } : { state: "rejected", discount: 0 });
    }
    expect(outcomes).toEqual(new Set([true, false]));
  });

  test("[R-ROUTE-007] given a second lower, when Northgate offers, then there is no automatic discount", () => {
    const seed = seedWhere((candidate) => draw(candidate, "school", 1, 10000) < offerChanceBp(school(NORTHGATE), 3, numbers));
    const game = readyLife(content, { seed, qualities: { [GRADE]: 3 } });
    toOffer(game, NORTHGATE);
    expect(uk(game).schools[NORTHGATE]?.discount).toBe(0);
  });

  test("[R-ROUTE-007] given Ashby's merit discount, when it offers, then the discount is given exactly when its own draw succeeds", () => {
    const ashby = school(ASHBY);
    const offers = (seed: string) => draw(seed, "school", 1, 10000) < offerChanceBp(ashby, 4, numbers);
    const merit = seedWhere((seed) => offers(seed) && draw(seed, "school", 2, 10000) < ashby.meritDiscount!.bp);
    const plain = seedWhere((seed) => offers(seed) && draw(seed, "school", 2, 10000) >= ashby.meritDiscount!.bp);
    const won = readyLife(content, { seed: merit });
    const result = (() => {
      toKnown(won);
      won.endTurn([slot("activity.apply-to-school", ASHBY)]);
      let last = won.endTurn();
      if (uk(won).schools[ASHBY]?.state === "pending") last = won.endTurn();
      return last;
    })();
    expect(uk(won).schools[ASHBY]).toMatchObject({ state: "offer", discount: ashby.meritDiscount!.amount });
    expect(won.state.draws.school).toBe(3);
    expect(routeLines(result.lines)).toContainEqual({
      key: "line.route.school-offer",
      params: { school: ASHBY, discount: { currency: "GBP", amount: ashby.meritDiscount!.amount } },
      tone: "good",
      attention: true,
      counts: [],
    });
    const lost = readyLife(content, { seed: plain });
    toOffer(lost, ASHBY);
    expect(uk(lost).schools[ASHBY]).toMatchObject({ state: "offer", discount: 0 });
  });
});

describe("the deposit", () => {
  test("[R-ROUTE-008] given an offer, when its deposit is paid, then it is paid as a pound fee for the school, the school is the route's, and the confirmation is granted", () => {
    const game = life();
    toOffer(game);
    expect(judge(game, { type: "route/offer", route: UK }).met).toBe(true);
    expect(judge(game, { type: "route/deposit", route: UK }).met).toBe(false);
    const before = game.state.wallet.pockets.GBP.bank;
    const result = game.accept({ type: "route/pay-deposit", route: UK, school: NORTHGATE });
    const deposit = school(NORTHGATE).deposit;
    expect(game.state.wallet.pockets.GBP.bank).toBe(before - deposit);
    expect(game.state.wallet.totals.out["fee-school"]).toEqual({ GBP: deposit });
    expect(uk(game)).toMatchObject({ school: NORTHGATE, depositPaid: deposit });
    expect(game.state.document[CAS]?.state).toBe("held");
    expect(judge(game, { type: "route/deposit", route: UK }).met).toBe(true);
    expect(routeLines(result.lines)).toEqual([{ key: "line.route.deposit-paid", params: { school: NORTHGATE, amount: { currency: "GBP", amount: deposit } }, tone: "good", attention: false, counts: [] }]);
  });

  test("[R-ROUTE-008] given no offer from a school, a deposit already paid, or a school not on the route, when a deposit is paid, then it is rejected and nothing changes", () => {
    const game = life();
    toOffer(game);
    game.expectRejected({ type: "route/pay-deposit", route: UK, school: ASHBY }, "not-legal");
    game.expectRejected({ type: "route/pay-deposit", route: UK, school: "school.nowhere" }, "unknown-id");
    game.expectRejected({ type: "route/pay-deposit", route: "route.nowhere", school: NORTHGATE }, "unknown-id");
    game.accept({ type: "route/pay-deposit", route: UK, school: NORTHGATE });
    game.expectRejected({ type: "route/pay-deposit", route: UK, school: NORTHGATE }, "not-legal");
    expect(uk(game).depositPaid).toBe(school(NORTHGATE).deposit);
    expect(uk(game).schools[ASHBY]).toBeUndefined();
  });

  test("[R-ROUTE-008] given too little money, when a deposit is paid, then it is rejected with cannot-afford", () => {
    const game = life({ pockets: { NGN: { bank: 0, cash: 100000 * UNIT }, GBP: { bank: school(NORTHGATE).deposit - 1, cash: 0 } } });
    toOffer(game);
    game.expectRejected({ type: "route/pay-deposit", route: UK, school: NORTHGATE }, "cannot-afford");
    expect(uk(game)).toMatchObject({ school: null, depositPaid: 0 });
    expect(game.state.document[CAS]).toBeUndefined();
  });

  test("[R-ROUTE-008] given naira only, when the deposit is paid, then the pounds are bought from the naira bank at the official rate and paid to the school", () => {
    const game = life({ pockets: { NGN: { bank: 20000000 * UNIT, cash: 0 } } });
    toOffer(game);
    const naira = game.state.wallet.pockets.NGN.bank;
    game.accept({ type: "route/pay-deposit", route: UK, school: NORTHGATE });
    expect(game.state.wallet.pockets.NGN.bank).toBeLessThan(naira);
    expect(game.state.wallet.pockets.GBP).toEqual({ bank: 0, cash: 0, locked: 0 });
    expect(game.state.wallet.totals.out["fee-school"]).toEqual({ GBP: school(NORTHGATE).deposit });
  });

  test("[R-ROUTE-008] given an offer and pounds enough for any deposit, when the legal list is read, then it offers the deposit and the deposit is accepted", () => {
    const game = life();
    toOffer(game);
    const deposit = legalCommands(game.view()).find((command) => command.type === "route/pay-deposit");
    expect(deposit).toEqual({ type: "route/pay-deposit", route: UK, school: NORTHGATE });
    game.accept(deposit!);
    expect(legalCommands(game.view()).some((command) => command.type === "route/pay-deposit")).toBe(false);
  });
});

describe("funds", () => {
  test("[R-ROUTE-009] given no offer, an offer, then a deposit, when the funds required are worked out, then they follow the cheapest school, its discount, then the deposit paid", () => {
    const game = life();
    toKnown(game);
    const northgate = school(NORTHGATE);
    expect(fundsRequired(readOf(game), UK)).toBe(northgate.tuition + living(game));
    toOffer(game);
    const discount = northgate.autoDiscount!.amount;
    expect(fundsRequired(readOf(game), UK)).toBe(northgate.tuition - discount + living(game));
    game.accept({ type: "route/pay-deposit", route: UK, school: NORTHGATE });
    expect(fundsRequired(readOf(game), UK)).toBe(northgate.tuition - discount - northgate.deposit + living(game));
    expect(living(game)).toBe(117100 * 9);
  });

  test("[R-ROUTE-009] given an offer from a dearer school only, when the funds required are worked out, then they follow that school and not the cheaper one with no offer", () => {
    const ashby = school(ASHBY);
    const seed = seedWhere((candidate) => draw(candidate, "school", 0, 2) === 0 && draw(candidate, "school", 1, 10000) < offerChanceBp(ashby, 4, numbers));
    const game = readyLife(content, { seed });
    toOffer(game, ASHBY);
    const discount = uk(game).schools[ASHBY]!.discount;
    expect(fundsRequired(readOf(game), UK)).toBe(ashby.tuition - discount + living(game));
    expect(ashby.tuition - discount).toBeGreaterThan(school(NORTHGATE).tuition);
  });

  test("[R-ROUTE-010] given bank, cash and locked money in three currencies and family support, when the funds shown are worked out, then every bank and locked pocket and the support count at the official rate, and cash never does", () => {
    const game = life({
      pockets: {
        NGN: { bank: 3000000 * UNIT, cash: 500000 * UNIT },
        GBP: { bank: 5000 * UNIT, cash: 900 * UNIT },
        USD: { bank: 2000 * UNIT, cash: 700 * UNIT },
      },
    });
    toKnown(game);
    const bankOnly = toPence(game, 3000000 * UNIT, "NGN") + 5000 * UNIT + toPence(game, 2000 * UNIT, "USD");
    expect(fundsShown(readOf(game), UK)).toBe(bankOnly);
    applyEffects(game, [
      { type: "money/add", currency: "USD", pocket: "bank", amount: 1000 * UNIT, reason: "held-funds", locked: true },
      { type: "route/support", route: UK, currency: "NGN", amount: 9000000 * UNIT },
    ]);
    expect(uk(game).support).toEqual({ currency: "NGN", amount: 9000000 * UNIT });
    expect(fundsShown(readOf(game), UK)).toBe(bankOnly + toPence(game, 1000 * UNIT, "USD") + toPence(game, 9000000 * UNIT, "NGN"));
    game.accept({ type: "wallet/move", currency: "GBP", amount: 5000 * UNIT, to: "cash" });
    expect(fundsShown(readOf(game), UK)).toBe(bankOnly - 5000 * UNIT + toPence(game, 1000 * UNIT, "USD") + toPence(game, 9000000 * UNIT, "NGN"));
  });

  test("[R-ROUTE-010] given the family pledge's support effect, when it is carried out with the pledge's terms, then the support on the route reads the term and is told", () => {
    const game = life();
    const show = 4500000 * UNIT;
    applyEffects(game, [{ type: "route/support", route: UK, currency: "NGN", amount: { term: "show" } }], { show });
    expect(uk(game).support).toEqual({ currency: "NGN", amount: show });
    expect(game.view().routes[0]?.support).toEqual({ currency: "NGN", amount: show });
  });

  test("[R-ROUTE-011] given a known route with no deposit, when months pass, then no funds check runs", () => {
    const game = life();
    toOffer(game);
    game.endTurn();
    game.endTurn();
    expect(uk(game).funds).toEqual({ heldMonths: 0, covered: false, shown: 0, required: 0 });
  });

  test("[R-ROUTE-011] given a deposit paid, when funds are covered, short, then covered again at month ends, then the months held count up, go back to zero, and the change asks for attention", () => {
    const game = life();
    toDeposit(game);
    const first = routeLines(game.endTurn().lines).find((line) => line.key.startsWith("line.route.funds"));
    // Shown was valued at the month end's rates; required does not move with the rate.
    expect(uk(game).funds).toMatchObject({ heldMonths: 1, covered: true, required: fundsRequired(readOf(game), UK) });
    expect(uk(game).funds.shown).toBeGreaterThanOrEqual(uk(game).funds.required);
    expect(first).toMatchObject({ key: "line.route.funds-covered", attention: true, params: { months: 1 } });
    const second = routeLines(game.endTurn().lines).find((line) => line.key.startsWith("line.route.funds"));
    expect(uk(game).funds.heldMonths).toBe(2);
    expect(second).toMatchObject({ key: "line.route.funds-covered", attention: false, params: { months: 2 } });
    const pounds = game.state.wallet.pockets.GBP.bank;
    game.accept({ type: "wallet/move", currency: "GBP", amount: pounds, to: "cash" });
    const short = routeLines(game.endTurn().lines).find((line) => line.key.startsWith("line.route.funds"));
    expect(uk(game).funds).toMatchObject({ heldMonths: 0, covered: false });
    expect(short).toMatchObject({ key: "line.route.funds-short", attention: true, tone: "bad" });
    expect(judge(game, { type: "route/funds", route: UK, heldMonths: 0 })).toEqual({ met: false, have: fundsShown(readOf(game), UK), need: fundsRequired(readOf(game), UK) });
    game.accept({ type: "wallet/move", currency: "GBP", amount: pounds, to: "bank" });
    game.endTurn();
    expect(uk(game).funds).toMatchObject({ heldMonths: 1, covered: true });
  });

  test("[R-ROUTE-011] given an application pending, when its month ends, then no funds check runs", () => {
    const game = life();
    toHeld(game);
    const held = uk(game).funds;
    const result = game.endTurn([slot("activity.apply-for-visa")]);
    expect(uk(game).state).toBe("applying");
    expect(uk(game).funds).toEqual(held);
    expect(routeLines(result.lines).some((line) => line.key.startsWith("line.route.funds"))).toBe(false);
  });
});

describe("the visa application", () => {
  test("[R-ROUTE-012] given a deposit paid this month, when the visa is applied for, then it is refused until the funds have been held at a month end", () => {
    const game = life();
    toDeposit(game);
    expect(judge(game, { type: "route/funds", route: UK, heldMonths: 1 }).met).toBe(false);
    game.expectRejected({ type: "turn/end", slots: [slot("activity.apply-for-visa")] }, "not-legal");
    game.endTurn();
    expect(judge(game, { type: "route/funds", route: UK, heldMonths: 1 }).met).toBe(true);
    const before = game.state.wallet.pockets.GBP.bank;
    game.endTurn([slot("activity.apply-for-visa")]);
    const vars = game.world().vars;
    expect(game.state.wallet.totals.out["fee-visa"]).toEqual({ GBP: vars["var.uk-visa-fee"] });
    expect(game.state.wallet.totals.out["fee-surcharge"]).toEqual({ GBP: vars["var.uk-surcharge"] });
    expect(game.state.wallet.pockets.GBP.bank).toBe(before - vars["var.uk-visa-fee"]! - vars["var.uk-surcharge"]!);
    expect(uk(game).state).toBe("applying");
  });

  test("[R-ROUTE-012] given no TB certificate, when the visa is applied for, then it is refused", () => {
    const game = life({ documents: READY_PAPERS.filter((paper) => paper.document !== TB) });
    toHeld(game);
    game.expectRejected({ type: "turn/end", slots: [slot("activity.apply-for-visa")] }, "not-legal");
    expect(judge(game, { type: "route/funds", route: UK, heldMonths: 1 }).met).toBe(true);
    expect(uk(game).state).toBe("known");
  });

  test("[R-ROUTE-013] given lots in the wallet, when the unexplained share is worked out, then it is their value in pence over the funds required, capped at 100%", () => {
    const game = life({ pockets: { NGN: { bank: 1000000 * UNIT, cash: 120000000 * UNIT }, GBP: { bank: 40000 * UNIT, cash: 0 } } });
    toKnown(game);
    expect(unexplainedBp(readOf(game), UK)).toBe(0);
    const small = 600000 * UNIT;
    game.accept({ type: "wallet/move", currency: "NGN", amount: small, to: "bank" });
    const required = fundsRequired(readOf(game), UK);
    const share = mulDiv(toPence(game, small, "NGN"), 10000, required);
    expect(share).toBeGreaterThan(0);
    expect(unexplainedBp(readOf(game), UK)).toBe(share);
    expect(judge(game, { type: "route/unexplained-max", route: UK, bp: share })).toEqual({ met: true, have: share, need: share });
    expect(judge(game, { type: "route/unexplained-max", route: UK, bp: share - 1 }).met).toBe(false);
    game.accept({ type: "wallet/move", currency: "NGN", amount: 100000000 * UNIT, to: "bank" });
    expect(unexplainedBp(readOf(game), UK)).toBe(10000);
    expect(game.view().routes[0]?.unexplainedBp).toBe(10000);
  });

  test("[R-ROUTE-014] given an application sent, when it is recorded, then the month, the decision month, the share and the day's living line, months and strictness are kept", () => {
    const game = life({ vars: () => ({ "var.uk-living-line": 118000, "var.uk-study-strictness": 61 }) });
    toHeld(game);
    const share = unexplainedBp(readOf(game), UK);
    const result = game.endTurn([slot("activity.apply-for-visa")]);
    const month = game.state.turn.month;
    expect(uk(game).visa).toEqual({
      submittedMonth: month,
      decisionMonth: month + numbers.decisionMonths,
      rules: { livingLine: 118000, livingMonths: 9, strictness: 61 },
      unexplainedBp: share,
      interviewScore: null,
      surchargePaid: game.world().vars["var.uk-surcharge"],
    });
    expect(game.view().routes[0]?.visa).toEqual({ submittedMonth: month, decisionMonth: month + 1 });
    expect(routeLines(result.lines)).toContainEqual({ key: "line.route.applied", params: { route: UK, month: month + 1 }, tone: "plain", attention: false, counts: [] });
  });

  test("[R-ROUTE-014] given strictness that rises after the application, when the decision is made, then it uses the strictness of the day it was sent", () => {
    const chanceAt = (strictness: number, interview: number) =>
      refusalChanceBp(numbers, UK_BASE, { strictness, unexplainedBp: 0, refusals: 0, interviewScore: interview, grade: 4 });
    const scoreOf = (seed: string) => drawnQuestions(seed, CLEAN_POOL, 3).reduce((sum, question) => sum + firstScore(question, 0, 0), 0);
    const seed = seedWhere((candidate) => {
      if (draw(candidate, "school", 1, 10000) >= offerChanceBp(school(NORTHGATE), 4, numbers)) return false;
      const decision = draw(candidate, "visa", 3, 10000);
      return decision >= chanceAt(50, scoreOf(candidate)) && decision < chanceAt(100, scoreOf(candidate));
    });
    let strictness = 50;
    const game = readyLife(content, { seed, vars: () => ({ "var.uk-study-strictness": strictness }) });
    toApplied(game);
    answerFirst(game);
    strictness = 100;
    game.endTurn();
    expect(uk(game).visa?.rules.strictness).toBe(50);
    expect(uk(game).state).toBe("granted");
  });

  test("[R-ROUTE-015] given a visa application sent, when the turn has ended, then the interview is open and blocks the next turn until it is answered", () => {
    const game = life();
    toApplied(game);
    expect(game.state.setpiece.open).toMatchObject({ entry: content.route[UK]!.interview, route: UK });
    expect(game.state.turn.report?.attention).toBe(true);
    game.expectRejected({ type: "turn/end", slots: [] }, "setpiece-open");
    answerFirst(game);
    game.endTurn();
    expect(game.state.setpiece.open).toBeNull();
  });
});

describe("decision day", () => {
  test("[R-ROUTE-016] given a file, when the chance of refusal is worked out, then each figure moves it by the page's amount and it stays between the floor and the ceiling", () => {
    const clean = { strictness: 50, unexplainedBp: 0, refusals: 0, interviewScore: 0, grade: 4 };
    expect(refusalChanceBp(numbers, UK_BASE, clean)).toBe(900 + 500 - 200);
    expect(refusalChanceBp(numbers, UK_BASE, { ...clean, grade: 3 })).toBe(900 + 500);
    expect(refusalChanceBp(numbers, UK_BASE, { ...clean, strictness: 51 })).toBe(900 + 510 - 200);
    expect(refusalChanceBp(numbers, UK_BASE, { ...clean, unexplainedBp: 99 })).toBe(1200);
    expect(refusalChanceBp(numbers, UK_BASE, { ...clean, unexplainedBp: 100 })).toBe(1240);
    expect(refusalChanceBp(numbers, UK_BASE, { ...clean, unexplainedBp: 2999 })).toBe(1200 + 29 * 40);
    expect(refusalChanceBp(numbers, UK_BASE, { ...clean, refusals: 1 })).toBe(2000);
    expect(refusalChanceBp(numbers, UK_BASE, { ...clean, interviewScore: 2 })).toBe(900);
    expect(refusalChanceBp(numbers, UK_BASE, { ...clean, interviewScore: -2 })).toBe(1500);
    // The floor: 900 + 10 * 5 - 150 * 3 - 200 is exactly 300.
    expect(refusalChanceBp(numbers, UK_BASE, { ...clean, strictness: 5, interviewScore: 3 })).toBe(300);
    expect(refusalChanceBp(numbers, UK_BASE, { ...clean, strictness: 4, interviewScore: 3 })).toBe(numbers.refusalMinBp);
    expect(refusalChanceBp(numbers, UK_BASE, { ...clean, strictness: 6, interviewScore: 3 })).toBe(310);
    expect(refusalChanceBp(numbers, UK_BASE, { ...clean, strictness: 0, interviewScore: 20 })).toBe(numbers.refusalMinBp);
    // The ceiling: 900 + 10 * 90 + 800 * 8 - 200 is exactly 8000.
    expect(refusalChanceBp(numbers, UK_BASE, { ...clean, strictness: 90, refusals: 8 })).toBe(8000);
    expect(refusalChanceBp(numbers, UK_BASE, { ...clean, strictness: 91, refusals: 8 })).toBe(numbers.refusalMaxBp);
    expect(refusalChanceBp(numbers, UK_BASE, { ...clean, strictness: 89, refusals: 8 })).toBe(7990);
    expect(refusalChanceBp(numbers, UK_BASE, { ...clean, refusals: 20 })).toBe(numbers.refusalMaxBp);
    expect([numbers.refusalMinBp, numbers.refusalMaxBp]).toEqual([300, 8000]);
  });

  test("[R-ROUTE-016] given several lives that reach decision day, when it comes, then each is refused exactly when its one visa draw falls under the chance worked out from its file", () => {
    const outcomes = new Set<string>();
    for (let i = 0; i < 60 && outcomes.size < 2; i += 1) {
      const seed = `seed-${String(i)}`;
      if (draw(seed, "school", 1, 10000) >= offerChanceBp(school(NORTHGATE), 4, numbers)) continue;
      const game = readyLife(content, { seed });
      toApplied(game);
      answerFirst(game);
      const score = uk(game).visa!.interviewScore!;
      expect(score).toBe(drawnQuestions(seed, CLEAN_POOL, 3).reduce((sum, question) => sum + firstScore(question, 0, 0), 0));
      expect(game.state.draws.visa).toBe(3);
      game.endTurn();
      expect(game.state.draws.visa).toBe(4);
      const chance = refusalChanceBp(numbers, UK_BASE, { strictness: 50, unexplainedBp: 0, refusals: 0, interviewScore: score, grade: 4 });
      const state = draw(seed, "visa", 3, 10000) < chance ? "known" : "granted";
      outcomes.add(state);
      expect(uk(game).state).toBe(state);
    }
    expect(outcomes).toEqual(new Set(["known", "granted"]));
  });

  test("[R-ROUTE-017] given a file that cannot be refused, when decision day comes, then the route is granted and the player is told", () => {
    const game = life({ tuning: ALWAYS_GRANTED });
    toApplied(game);
    answerFirst(game);
    const result = game.endTurn();
    expect(uk(game).state).toBe("granted");
    expect(uk(game).visa).not.toBeNull();
    expect(routeLines(result.lines)).toContainEqual({ key: "line.route.granted", params: { route: UK }, tone: "good", attention: true, counts: [] });
  });

  test("[R-ROUTE-018] given a refusal, when decision day comes, then the route is known again, the surcharge is back at once, the deposit less the fee is booked, the school, confirmation and months held are cleared, and the offer stands", () => {
    const game = life({ tuning: ALWAYS_REFUSED });
    toApplied(game);
    answerFirst(game);
    const pounds = game.state.wallet.pockets.GBP.bank;
    const result = game.endTurn();
    const month = game.state.turn.month;
    const surcharge = game.world().vars["var.uk-surcharge"]!;
    const back = school(NORTHGATE).deposit - numbers.depositAdminFee;
    expect(uk(game)).toMatchObject({
      state: "known",
      refusals: 1,
      school: null,
      depositPaid: 0,
      visa: null,
      depositRefund: { amount: back, readyMonth: month + numbers.depositRefundMonths },
      lastRefusal: { month, reasons: ["credibility"] },
    });
    expect(uk(game).funds.heldMonths).toBe(0);
    expect(uk(game).schools[NORTHGATE]?.state).toBe("offer");
    expect(game.state.document[CAS]).toBeUndefined();
    expect(game.state.wallet.pockets.GBP.bank).toBe(pounds + surcharge);
    expect(game.state.wallet.totals.in.refund).toEqual({ GBP: surcharge });
    expect(routeLines(result.lines)).toContainEqual({ key: "line.route.refused", params: { route: UK, reason: "credibility" }, tone: "bad", attention: true, counts: [] });
    expect(checkInvariants(game.state, game.content)).toEqual([]);
  });

  test("[R-ROUTE-018] given a refused deposit booked, when months pass, then the refund lands in the pound bank in its month and not before, and the deposit can be paid again", () => {
    const game = life({ tuning: ALWAYS_REFUSED });
    toDecision(game);
    const due = uk(game).depositRefund!;
    expect(due.amount).toBe(school(NORTHGATE).deposit - numbers.depositAdminFee);
    game.endTurn();
    expect(uk(game).depositRefund).toEqual(due);
    const pounds = game.state.wallet.pockets.GBP.bank;
    const result = game.endTurn();
    expect(game.state.turn.month).toBe(due.readyMonth);
    expect(uk(game).depositRefund).toBeNull();
    expect(game.state.wallet.pockets.GBP.bank).toBe(pounds + due.amount);
    expect(routeLines(result.lines)).toContainEqual({ key: "line.route.deposit-refunded", params: { route: UK, amount: { currency: "GBP", amount: due.amount } }, tone: "good", attention: false, counts: [] });
    game.accept({ type: "route/pay-deposit", route: UK, school: NORTHGATE });
    expect(uk(game).school).toBe(NORTHGATE);
    expect(game.state.document[CAS]?.state).toBe("held");
  });

  test("[R-ROUTE-019] given the figures of a refused file, when its reasons are listed, then funds, interview and history come first in that order, and credibility only alone", () => {
    const visa = { submittedMonth: 1, decisionMonth: 2, rules: { livingLine: 1, livingMonths: 1, strictness: 1 }, unexplainedBp: 0, interviewScore: 0, surchargePaid: 0 };
    expect(refusalReasons(visa, 0, numbers)).toEqual(["credibility"]);
    expect(refusalReasons({ ...visa, unexplainedBp: 2999 }, 0, numbers)).toEqual(["credibility"]);
    expect(refusalReasons({ ...visa, unexplainedBp: 3000 }, 0, numbers)).toEqual(["funds"]);
    expect(refusalReasons({ ...visa, interviewScore: -1 }, 0, numbers)).toEqual(["interview"]);
    expect(refusalReasons({ ...visa, interviewScore: null }, 0, numbers)).toEqual(["credibility"]);
    expect(refusalReasons(visa, 1, numbers)).toEqual(["history"]);
    expect(refusalReasons({ ...visa, unexplainedBp: 10000, interviewScore: -3 }, 2, numbers)).toEqual(["funds", "interview", "history"]);
  });

  test("[R-ROUTE-019] given a second refusal with a poor interview, when it is recorded, then its reasons name the interview and the earlier refusal", () => {
    const game = life({ tuning: ALWAYS_REFUSED });
    toDecision(game);
    expect(uk(game).lastRefusal?.reasons).toEqual(["credibility"]);
    game.accept({ type: "route/pay-deposit", route: UK, school: NORTHGATE });
    game.endTurn();
    game.endTurn([slot("activity.apply-for-visa")]);
    for (let guard = 0; guard < 5; guard += 1) {
      const question = game.view().setpiece?.question;
      if (question === undefined || question === null) break;
      game.accept({ type: "setpiece/answer", question: question.id, answer: question.answers.at(-1)! });
    }
    expect(uk(game).visa?.interviewScore).toBeLessThan(0);
    game.endTurn();
    expect(uk(game).refusals).toBe(2);
    expect(uk(game).lastRefusal?.reasons).toEqual(["interview", "history"]);
  });

  test("[R-ROUTE-020] given a granted route, when the player departs, then the flight is paid in naira, the route is departed and the life at home is over", () => {
    const game = life({ tuning: ALWAYS_GRANTED });
    toDecision(game);
    expect(legalCommands(game.view())).toContainEqual({ type: "route/depart", route: UK });
    const naira = game.state.wallet.pockets.NGN;
    const flight = numbers.flight.amount as number;
    const result = game.accept({ type: "route/depart", route: UK });
    expect(game.state.wallet.pockets.NGN.bank + game.state.wallet.pockets.NGN.cash).toBe(naira.bank + naira.cash - flight);
    expect(game.state.wallet.totals.out.flight).toEqual({ NGN: flight });
    expect(uk(game).state).toBe("departed");
    expect(game.state.turn.ended).toBe(true);
    expect(routeLines(result.lines)).toEqual([{ key: "line.route.departed", params: { route: UK }, tone: "good", attention: true, counts: [] }]);
    game.expectRejected({ type: "turn/end", slots: [] }, "ended");
  });

  test("[R-ROUTE-020] given a granted route and too little naira for the flight, when the player departs, then it is rejected with cannot-afford", () => {
    const game = life({ tuning: ALWAYS_GRANTED, pockets: { NGN: { bank: 1000000 * UNIT, cash: 0 }, GBP: { bank: 40000 * UNIT, cash: 0 } } });
    toDecision(game);
    expect(uk(game).state).toBe("granted");
    game.expectRejected({ type: "route/depart", route: UK }, "cannot-afford");
    expect(game.state.turn.ended).toBe(false);
  });

  test("[R-ROUTE-020] given a granted route and held funds still open, when the player departs, then it is rejected until they are returned", () => {
    const game = life({ tuning: ALWAYS_GRANTED });
    toDecision(game);
    expect(uk(game).state).toBe("granted");
    // Held funds open through the real offer: the first honest agent to come up is taken at the least he will hold.
    const heldFunds = () => Object.values(game.state.obligation.items).find((item) => game.content.obligation[item.entry]?.type === "held-funds");
    for (let month = 0; month < 24 && heldFunds() === undefined; month += 1) {
      const agent = Object.values(game.state.offer.items).find((item) => item.entry === "offer.held-funds-agent" && !item.secret.fraud);
      const least = agent?.terms.min;
      if (agent === undefined || typeof least !== "number") game.endTurn();
      else game.accept({ type: "offer/choose", offer: agent.id, choice: "take", amount: least });
    }
    const held = heldFunds();
    if (held === undefined) throw new Error("No honest agent came up with this seed.");
    game.expectRejected({ type: "route/depart", route: UK }, "not-legal");
    expect(legalCommands(game.view()).some((command) => command.type === "route/depart")).toBe(false);
    game.accept({ type: "obligation/pay", obligation: held.id, amount: held.principal });
    game.accept({ type: "route/depart", route: UK });
  });
});

describe("the route's words", () => {
  test("[R-ENGINE-014] given every line the route and the interview give on a life's way to a refusal, a refund and a flight, when the words are looked up, then each has words and names only figures its line carries", () => {
    const lines: ReportLine[] = [];
    // Only the UK route's hearing: the meetup also hears the talent route, which is not under test here.
    const sure = withActivity("activity.meetup", (entry) => ({
      ...entry,
      effects: entry.effects.filter((effect) => effect.type !== "route/hear" || effect.route === UK).map((effect) => (effect.type === "route/hear" ? { ...effect, chanceBp: 10000 } : effect)),
    }));
    const game = life({ tuning: ALWAYS_REFUSED, quiet: true, change: sure });
    const keep = (result: { lines: ReportLine[] }) => lines.push(...result.lines);
    keep(game.endTurn([slot("activity.meetup")]));
    keep(game.endTurn([slot("activity.look-into-route", UK)]));
    keep(game.endTurn([slot("activity.apply-to-school", NORTHGATE)]));
    keep(game.endTurn());
    keep(game.accept({ type: "route/pay-deposit", route: UK, school: NORTHGATE }));
    keep(game.endTurn());
    const pounds = game.state.wallet.pockets.GBP.bank;
    game.accept({ type: "wallet/move", currency: "GBP", amount: pounds, to: "cash" });
    keep(game.endTurn());
    game.accept({ type: "wallet/move", currency: "GBP", amount: pounds, to: "bank" });
    keep(game.endTurn());
    keep(game.endTurn([slot("activity.apply-for-visa")]));
    for (let guard = 0; guard < 5 && game.view().setpiece?.question; guard += 1) {
      const question = game.view().setpiece!.question!;
      keep(game.accept({ type: "setpiece/answer", question: question.id, answer: question.answers[0]! }));
    }
    keep(game.endTurn());
    keep(game.endTurn());
    keep(game.endTurn());
    applyEffects(game, []);
    const ours = lines.filter((line) => line.key.startsWith("line.route.") || line.key.startsWith("line.setpiece."));
    const keys = new Set(ours.map((line) => line.key));
    expect(keys).toEqual(
      new Set([
        "line.route.heard",
        "line.route.looked-into",
        "line.route.school-applied",
        "line.route.school-offer",
        "line.route.deposit-paid",
        "line.route.funds-covered",
        "line.route.funds-short",
        "line.route.applied",
        "line.setpiece.opened",
        "line.setpiece.closed",
        "line.route.refused",
        "line.route.deposit-refunded",
      ]),
    );
    const every = [
      ...ours,
      { key: "line.route.granted", params: { route: UK } },
      { key: "line.route.departed", params: { route: UK } },
      { key: "line.route.school-rejected", params: { school: NORTHGATE } },
      { key: "line.route.supported", params: { route: UK, amount: { currency: "NGN", amount: 1 } } },
    ];
    const wrong = every.flatMap((line) => {
      const words = text[line.key];
      if (words === undefined || words.trim() === "") return [`${line.key} has no words`];
      return [...words.matchAll(/\{([^}]+)\}/g)].filter((match) => !((match[1] ?? "") in line.params)).map((match) => `${line.key} names ${match[0]}`);
    });
    expect(wrong).toEqual([]);
  });
});
