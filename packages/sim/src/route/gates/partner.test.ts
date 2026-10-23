// activity:now-acts-and-month-acts: a now-act (an application, a paper, a visit) is refused in a slot, so each probe sends one as
// activity/now, and an application checked as applying is read in the month it is sent.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../../engine/check";
import type { Content, Id, RouteState } from "../../engine/types";
import type { Game } from "../../testing/play";
import type { LifeOptions } from "../../testing/route.journey";
import { applyEffects, draw, pastDecision, READY_PAPERS, seedWhere, slot } from "../../testing/route.journey";
import { refusalChanceBp } from "../route.logic";
import { partnerGate } from "./partner";
import { answerInterview, BOND, facts, interviewOpen, joint, life, scored, setFacts, setPeople } from "../../testing/person.journey";
import { ALWAYS_GRANTED } from "../../testing/place.journey";
import { pounds, readOf, routeOf } from "../../testing/read";
import { CA_SPOUSE, UK_PARTNER } from "../../testing/ids";

const ukPartner = content.route[UK_PARTNER]!;
const caSpouse = content.route[CA_SPOUSE]!;
const APPLY_UK: Id<"activity"> = "activity.apply-uk-partner";
const APPLY_CA: Id<"activity"> = "activity.apply-canada-spouse";
const FEE = content.var["var.uk-partner-fee"]!.start;
const SURCHARGE_YEAR = content.var["var.uk-surcharge-year"]!.start;
const SETTLED = facts({ where: "abroad", country: "country.uk", status: "status.uk-settled", meetsFloor: { [UK_PARTNER]: true } });
const CA_RESIDENT = facts({ where: "abroad", country: "country.canada", status: "status.canada-resident" });

/** The graduate married to a sponsor whose facts are `sponsor`, the joint agreed with the sponsor leading on `route`. */
function married(route: Id<"route">, sponsor = SETTLED, options: LifeOptions = {}): Game {
  const game = life(content, options);
  joint(game, route, "them", { stage: "married", facts: sponsor });
  return game;
}

/** A month for the route to be heard of (person:partner-routes-heard-via-bond), then a slot to look into it. */
function toKnown(game: Game, route: Id<"route">): void {
  game.endTurn();
  expect(routeOf(game, route).state).toBe("heard");
  game.endTurn([slot("activity.look-into-route", route)]);
  expect(routeOf(game, route).state).toBe("known");
}

/** The application sent, which opens the interview (interview:partner-application-opens-interview), and this side's answers in: the result waits for the sponsor's. */
function applied(route: Id<"route"> = UK_PARTNER, sponsor = SETTLED, options: LifeOptions = {}): Game {
  const game = married(route, sponsor, options);
  toKnown(game, route);
  game.endTurn([slot(route === UK_PARTNER ? APPLY_UK : APPLY_CA)]);
  expect(routeOf(game, route).state).toBe("applying");
  expect(game.state.interview.open?.route).toBe(route);
  answerInterview(game);
  return game;
}

describe("person:partner-routes-heard-via-bond: hearing of the partner route", () => {
  test("[person:partner-routes-heard-via-bond] given a married partner whose facts show them settled in the UK, when a month ends, then the UK partner route is heard of and can be looked into", () => {
    const game = married(UK_PARTNER);
    toKnown(game, UK_PARTNER);
    expect(game.view().routes.find((view) => view.id === UK_PARTNER)?.checklist.length).toBe(ukPartner.checklist.length);
  });

  test("[person:partner-routes-heard-via-bond] given a partner in the UK on a sponsored worker's visa, or a partner only courting, when a month ends, then the route is not heard of", () => {
    const worker = married(UK_PARTNER, { ...SETTLED, status: "status.uk-sponsored" });
    worker.endTurn();
    expect(routeOf(worker, UK_PARTNER).state).toBe("unknown");
    const courting = life(content);
    joint(courting, UK_PARTNER, "them", { stage: "courting", facts: SETTLED });
    courting.endTurn();
    expect(routeOf(courting, UK_PARTNER).state).toBe("unknown");
  });

  test("[person:partner-routes-heard-via-bond] given a resident partner in Canada, when a month ends, then the spouse route into Canada is heard of and the UK one is not", () => {
    const game = married(CA_SPOUSE, CA_RESIDENT);
    game.endTurn();
    expect(routeOf(game, CA_SPOUSE).state).toBe("heard");
    expect(routeOf(game, UK_PARTNER).state).toBe("unknown");
  });
});

describe("person:partner-gate-needs: applying on the partner gate", () => {
  test("[person:partner-gate-needs] given a married sponsor settled in the UK who meets the floor, when the application is sent, then the fee and three years of surcharge are paid and it is decided three months on", () => {
    const game = married(UK_PARTNER);
    toKnown(game, UK_PARTNER);
    const before = pounds(game);
    game.endTurn([slot(APPLY_UK)]);
    const held = routeOf(game, UK_PARTNER);
    expect(held.state).toBe("applying");
    expect(before - pounds(game)).toBe(FEE + 3 * SURCHARGE_YEAR);
    expect(held.visa?.surchargePaid).toBe(3 * SURCHARGE_YEAR);
    expect(held.visa?.decisionMonth).toBe(held.visa!.submittedMonth + ukPartner.partner!.decisionMonths);
    expect(held.gate).toEqual({ gate: "partner", bond: BOND });
  });

  test("[person:partner-gate-needs] given the sponsor's facts saying the floor is not met, or saying nothing of it, when the application is sent, then the slot is not legal", () => {
    for (const meetsFloor of [{ [UK_PARTNER]: false }, {}]) {
      const game = married(UK_PARTNER, { ...SETTLED, meetsFloor });
      toKnown(game, UK_PARTNER);
      expect(check(readOf(game), { type: "route/gate-step", route: UK_PARTNER, step: "floor" }).met).toBe(false);
      game.expectRejected({ type: "activity/now", activity: APPLY_UK, param: null }, "not-legal");
    }
  });

  test("[person:partner-gate-needs] given partners, not married, for 23 of the applicant's months and then for 24, when the application is sent, then only 24 is enough for the UK", () => {
    const game = life(content);
    joint(game, UK_PARTNER, "them", { stage: "partner", facts: SETTLED });
    toKnown(game, UK_PARTNER);
    setPeople(game, (slice) => ({ ...slice, bonds: { [BOND]: { ...slice.bonds[BOND]!, partnerMonth: game.state.turn.month - 23 } } }));
    game.expectRejected({ type: "activity/now", activity: APPLY_UK, param: null }, "not-legal");
    setPeople(game, (slice) => ({ ...slice, bonds: { [BOND]: { ...slice.bonds[BOND]!, partnerMonth: game.state.turn.month - 24 } } }));
    game.accept({ type: "activity/now", activity: APPLY_UK, param: null });
    expect(routeOf(game, UK_PARTNER).state).toBe("applying");
  });

  test("[person:partner-gate-needs] given partners for years but not married, when Canada's spouse route is asked, then it is never reached: only marriage counts there", () => {
    const game = life(content);
    joint(game, CA_SPOUSE, "them", { stage: "partner", partnerMonth: -120, facts: CA_RESIDENT });
    expect(partnerGate.reached(readOf(game), caSpouse, routeOf(game, CA_SPOUSE), "married")).toBe(false);
    expect(partnerGate.reached(readOf(game), caSpouse, routeOf(game, CA_SPOUSE), "sponsor")).toBe(true);
  });

  test("[person:partner-gate-needs] given no degree and an English band of 3.0 or one of 2.5, when the UK application is sent, then only 3.0 is enough", () => {
    const band = (value: number): LifeOptions => ({
      documents: READY_PAPERS.map((paper) => (paper.document === "document.english-test" ? { ...paper, value } : paper)),
      qualities: { "quality.education-level": 2 },
    });
    const low = married(UK_PARTNER, SETTLED, band(ukPartner.partner!.bandMin! - 5));
    toKnown(low, UK_PARTNER);
    low.expectRejected({ type: "activity/now", activity: APPLY_UK, param: null }, "not-legal");
    const edge = married(UK_PARTNER, SETTLED, band(ukPartner.partner!.bandMin!));
    toKnown(edge, UK_PARTNER);
    edge.accept({ type: "activity/now", activity: APPLY_UK, param: null });
    expect(routeOf(edge, UK_PARTNER).state).toBe("applying");
  });

  test("[person:partner-gate-needs] [document:degree-english-statement] given a band of 2.5 with a bachelor's degree, or with the degree's English statement, when the UK application is sent, then the English is met", () => {
    const low = READY_PAPERS.map((paper) => (paper.document === "document.english-test" ? { ...paper, value: ukPartner.partner!.bandMin! - 5 } : paper));
    const graduate = married(UK_PARTNER, SETTLED, { documents: low });
    toKnown(graduate, UK_PARTNER);
    graduate.accept({ type: "activity/now", activity: APPLY_UK, param: null });
    expect(routeOf(graduate, UK_PARTNER).state).toBe("applying");
    const statement = married(UK_PARTNER, SETTLED, {
      documents: [...low, { document: "document.degree-english", monthsLeft: null, value: null }],
      qualities: { "quality.education-level": 2 },
    });
    toKnown(statement, UK_PARTNER);
    statement.accept({ type: "activity/now", activity: APPLY_UK, param: null });
    expect(routeOf(statement, UK_PARTNER).state).toBe("applying");
  });

  test("[person:partner-gate-needs] given a joint with the applicant leading, or the sponsor gone home, when the gate is asked, then applying is not legal", () => {
    const leading = married(UK_PARTNER);
    toKnown(leading, UK_PARTNER);
    setPeople(leading, (slice) => ({ ...slice, joint: { ...slice.joint!, lead: "me" } }));
    expect(leading.expectRejected({ type: "activity/now", activity: APPLY_UK, param: null }, "not-legal").code).toBe("not-legal");
    const home = married(UK_PARTNER);
    toKnown(home, UK_PARTNER);
    setFacts(home, (now) => ({ ...now, where: "home", country: null }));
    expect(home.expectRejected({ type: "activity/now", activity: APPLY_UK, param: null }, "not-legal").code).toBe("not-legal");
  });

  test("[person:partner-gate-needs] given Canada's spouse route with no floor, when a resident spouse's facts say nothing of a floor, then the application goes in and the fee is taken", () => {
    const game = applied(CA_SPOUSE, CA_RESIDENT);
    expect(routeOf(game, CA_SPOUSE).visa?.surchargePaid).toBe(0);
    expect(routeOf(game, CA_SPOUSE).visa?.decisionMonth).toBe(routeOf(game, CA_SPOUSE).visa!.submittedMonth + caSpouse.partner!.decisionMonths);
  });
});

describe("place:removal-bans-the-country: a removal's ban and the partner gate", () => {
  /** The UK overstayer's ban made short, so a test can play past it. */
  const SHORT_BAN = 2;
  const shortBan = (used: Content): Content => ({
    ...used,
    status: { ...used.status, "status.uk-overstayer": { ...used.status["status.uk-overstayer"]!, banMonths: SHORT_BAN } },
  });

  test("[place:removal-bans-the-country] [route-gates:deception-bans-country] [person:partner-gate-needs] given a removal from the UK with a ban of 2 months and a married sponsor settled there, when the partner application is sent, then while the ban holds it is not offered and is refused with nothing taken, and it goes in from the month the ban lifts", () => {
    const game = married(UK_PARTNER, SETTLED, { change: shortBan });
    toKnown(game, UK_PARTNER);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }, { type: "status/grant", status: "status.uk-student" }, { type: "status/remove" }]);
    expect(game.state.place.where).toBe("home");
    const lifts = game.state.turn.month + SHORT_BAN;
    while (game.state.turn.month < lifts) {
      expect(game.view().activities.find((offered) => offered.id === APPLY_UK)?.allowed).toBe(false);
      game.expectRejected({ type: "activity/now", activity: APPLY_UK, param: null }, "not-legal");
      expect(routeOf(game, UK_PARTNER).state).toBe("known");
      game.endTurn();
    }
    expect(game.view().activities.find((offered) => offered.id === APPLY_UK)?.allowed).toBe(true);
    game.accept({ type: "activity/now", activity: APPLY_UK, param: null });
    expect(routeOf(game, UK_PARTNER).state).toBe("applying");
  });

  test("[place:removal-bans-the-country] [person:partner-gate-needs] given a removal from Canada and a married sponsor resident there, when the spouse application is sent while the ban holds, then it is not offered and is refused with nothing taken", () => {
    const game = married(CA_SPOUSE, CA_RESIDENT);
    toKnown(game, CA_SPOUSE);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.canada" }, { type: "status/grant", status: "status.canada-overstayer" }, { type: "status/remove" }]);
    expect(game.state.place.where).toBe("home");
    expect(game.view().activities.find((offered) => offered.id === APPLY_CA)?.allowed).toBe(false);
    game.expectRejected({ type: "activity/now", activity: APPLY_CA, param: null }, "not-legal");
    expect(routeOf(game, CA_SPOUSE).state).toBe("known");
  });
});

describe("person:partner-application-decided: the decision waits for the interview", () => {
  test("[person:partner-application-decided] given no interview result, or one still open, when the decision month passes, then the application waits", () => {
    const game = applied();
    pastDecision(game, UK_PARTNER);
    game.endTurn();
    expect(routeOf(game, UK_PARTNER).state).toBe("applying");
    interviewOpen(game, UK_PARTNER);
    game.endTurn();
    expect(routeOf(game, UK_PARTNER).state).toBe("applying");
  });

  test("[person:partner-application-decided] given a fail, when the decision comes, then it is refused for the relationship with no draw, and the surcharge comes back", () => {
    const game = applied();
    scored(game, UK_PARTNER, "fail");
    const draws = game.state.draws.visa ?? 0;
    const before = game.state.wallet.pockets.GBP.bank;
    pastDecision(game, UK_PARTNER);
    expect(routeOf(game, UK_PARTNER).state).toBe("known");
    expect(routeOf(game, UK_PARTNER).lastRefusal?.reasons[0]).toBe("relationship");
    expect(game.state.draws.visa ?? 0).toBe(draws);
    expect(game.state.wallet.pockets.GBP.bank - before).toBe(3 * SURCHARGE_YEAR);
  });

  test("[person:partner-application-decided] given caught, when the decision comes, then it is refused as a sham and every known or applying UK route is banned for the country's months", () => {
    const game = applied();
    scored(game, UK_PARTNER, "caught");
    pastDecision(game, UK_PARTNER);
    const held = routeOf(game, UK_PARTNER);
    expect(held.state).toBe("refused");
    expect(held.lastRefusal?.reasons[0]).toBe("sham");
    expect(held.bannedUntil).toBe(game.state.turn.month + content.country["country.uk"]!.deceptionBanMonths);
  });

  test("[person:partner-application-decided] given a seed whose draw falls between the base and the base plus the doubt, when the result is pass and when it is doubt, then pass is granted and doubt refused", () => {
    const base = refusalChanceBp(content.tuning.route, ukPartner.refusalBaseBp, { strictness: 0, unexplainedBp: 0, refusals: 0, interviewScore: 0, grade: 0 }, partnerGate.decision(readOf(life(content)), ukPartner, { visa: null } as RouteState).terms);
    const doubted = base + content.tuning.interview.doubtBp;
    // The interview's questions are drawn on `visa` first (interview:questions-drawn-from-record), so the decision's roll is the next one after them.
    const seed = seedWhere((candidate) => {
      const roll = draw(candidate, "visa", applied(UK_PARTNER, SETTLED, { seed: candidate }).state.draws.visa ?? 0, 10000);
      return roll >= base && roll < doubted;
    });
    const passed = applied(UK_PARTNER, SETTLED, { seed });
    scored(passed, UK_PARTNER, "pass");
    pastDecision(passed, UK_PARTNER);
    expect(routeOf(passed, UK_PARTNER).state).toBe("granted");
    const doubt = applied(UK_PARTNER, SETTLED, { seed });
    scored(doubt, UK_PARTNER, "doubt");
    pastDecision(doubt, UK_PARTNER);
    expect(routeOf(doubt, UK_PARTNER).state).toBe("known");
    expect(routeOf(doubt, UK_PARTNER).lastRefusal?.reasons).toEqual(["credibility"]);
  });

  test("[person:partner-application-decided] given an earlier refusal, when the gate's decision is read, then only earlier refusals are among its terms", () => {
    const game = applied();
    scored(game, UK_PARTNER, "pass");
    expect(partnerGate.decision(readOf(game), ukPartner, routeOf(game, UK_PARTNER)).terms).toEqual({ strictness: false, unexplained: false, refusals: true, interview: false, goodGrade: false });
  });

  test("[person:partner-application-decided] given a pass and a granted visa, when the applicant departs, then they are in the UK on the partner visa", () => {
    const game = applied(UK_PARTNER, SETTLED, { tuning: ALWAYS_GRANTED });
    scored(game, UK_PARTNER, "pass");
    pastDecision(game, UK_PARTNER);
    expect(routeOf(game, UK_PARTNER).state).toBe("granted");
    game.accept({ type: "route/depart", route: UK_PARTNER });
    expect(game.state.place).toMatchObject({ where: "abroad", country: "country.uk" });
    expect(game.state.status.current?.entry).toBe("status.uk-partner");
    expect(game.state.people.arrived).toEqual({ route: UK_PARTNER, month: game.state.turn.month });
  });
});

describe("person:partner-status-renews: the partner visa", () => {
  test("[person:partner-status-renews] given the partner visa granted on arrival, when it is read, then it lasts 33 months, allows any work, renews for 30 and counts to settlement at 60 months", () => {
    const game = applied(UK_PARTNER, SETTLED, { tuning: ALWAYS_GRANTED });
    scored(game, UK_PARTNER, "pass");
    pastDecision(game, UK_PARTNER);
    game.accept({ type: "route/depart", route: UK_PARTNER });
    expect(game.state.status.current?.expiresMonth).toBe(game.state.turn.month + 33);
    const status = content.status["status.uk-partner"]!;
    expect(status).toMatchObject({ work: "any", renewMonths: 30, renewFeeVar: "var.uk-partner-renew-fee", countsToSettlement: true, settleMonthsVar: "var.uk-partner-settle-months" });
    expect(content.var["var.uk-partner-settle-months"]!.start).toBe(60);
    expect(game.view().status?.renew?.months).toBe(30);
  });

  test("[person:partner-status-renews] given the partner visa held, when it is renewed with the sponsor meeting the floor, then it runs 30 months more; with the floor no longer met, or the bond ended, the renewal is not legal", () => {
    const flown = (): Game => {
      const game = applied(UK_PARTNER, SETTLED, { tuning: ALWAYS_GRANTED });
      scored(game, UK_PARTNER, "pass");
      pastDecision(game, UK_PARTNER);
      game.accept({ type: "route/depart", route: UK_PARTNER });
      const pounds = game.state.wallet.pockets.GBP;
      game.state = { ...game.state, wallet: { ...game.state.wallet, pockets: { ...game.state.wallet.pockets, GBP: { ...pounds, bank: pounds.bank + 1000000 } } } };
      return game;
    };
    const renewed = flown();
    const expires = renewed.state.status.current!.expiresMonth!;
    renewed.accept({ type: "status/renew" });
    expect(renewed.state.status.current?.expiresMonth).toBe(expires + 30);
    const under = flown();
    setFacts(under, (now) => ({ ...now, meetsFloor: { [UK_PARTNER]: false } }));
    under.expectRejected({ type: "status/renew" }, "not-legal");
    const ended = flown();
    setPeople(ended, (slice) => ({ ...slice, bonds: { [BOND]: { ...slice.bonds[BOND]!, stage: "ended", ended: { month: ended.state.turn.month, by: "them" } } }, joint: null }));
    ended.expectRejected({ type: "status/renew" }, "not-legal");
  });

  test("[status:one-renewability-test] given the partner visa held, when the sponsor no longer meets the floor or the bond has ended, then the view shows no renew terms, as the renewal is refused; with the floor met it shows them", () => {
    const flown = (): Game => {
      const game = applied(UK_PARTNER, SETTLED, { tuning: ALWAYS_GRANTED });
      scored(game, UK_PARTNER, "pass");
      pastDecision(game, UK_PARTNER);
      game.accept({ type: "route/depart", route: UK_PARTNER });
      return game;
    };
    expect(flown().view().status?.renew).not.toBeNull();
    const under = flown();
    setFacts(under, (now) => ({ ...now, meetsFloor: { [UK_PARTNER]: false } }));
    expect(under.view().status?.renew).toBeNull();
    under.expectRejected({ type: "status/renew" }, "not-legal");
    const ended = flown();
    setPeople(ended, (slice) => ({ ...slice, bonds: { [BOND]: { ...slice.bonds[BOND]!, stage: "ended", ended: { month: ended.state.turn.month, by: "them" } } }, joint: null }));
    expect(ended.view().status?.renew).toBeNull();
    ended.expectRejected({ type: "status/renew" }, "not-legal");
  });

  test("[person:tied-status-clock-on-breakup] given the partner and dependant visas, when their entries are read, then each is tied to the partner with a clock of 2 months, and permanent residence in Canada is not", () => {
    for (const id of ["status.uk-partner", "status.uk-dependant"] as const) expect(content.status[id]).toMatchObject({ tiedTo: "partner", clockMonths: 2 });
    expect(content.status["status.canada-resident"]?.tiedTo).toBeNull();
  });
});
