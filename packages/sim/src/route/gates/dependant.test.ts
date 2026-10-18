// R-ACTIVITY-015: a now-act (an application, a paper, a visit) is refused in a slot, so each probe sends one as
// activity/now, and an application checked as applying is read in the month it is sent.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../../engine/check";
import type { Id, PersonFacts, RouteStateName } from "../../engine/types";
import type { Game } from "../../testing/play";
import type { LifeOptions } from "../../testing/route.journey";
import { pastDecision, slot } from "../../testing/route.journey";
import { dependantFee, dependantGate, leadStatusMonths } from "./dependant";
import { applyAs, facts, interviewOpen, joint, life, scored, setFacts } from "../../testing/person.journey";
import { ALWAYS_GRANTED } from "../../testing/place.journey";
import { pounds, readOf, routeOf } from "../../testing/read";
import { CANADA_ROUTE, CA_ACCOMPANY, SKILLED, UK_DEPENDANT } from "../../testing/ids";

const ukDependant = content.route[UK_DEPENDANT]!;
const APPLY_UK: Id<"activity"> = "activity.apply-uk-dependant";
const APPLY_CA: Id<"activity"> = "activity.apply-ca-accompany";
const SKILLED_FEE = content.var["var.uk-skilled-visa-fee"]!.start;
const SURCHARGE_YEAR = content.var["var.uk-surcharge-year"]!.start;
const MAINTENANCE = content.var["var.uk-dependant-maintenance"]!.start;
const EXEMPT = ukDependant.dependant!.leadMonthsExempt!;

/** A lead at home whose skilled worker application is in this state. */
function leadOn(route: Id<"route">, state: RouteStateName, over: Partial<PersonFacts> = {}): PersonFacts {
  return facts({ joint: { route, state }, ...over });
}

/**
 * Ada married to a lead on `lead`, the joint agreed with the lead leading, and
 * the dependant route known at once as R-PEOPLE-021 makes it: the people kind's
 * hearing and looking into, played here as effects and a slot.
 */
function joined(lead: Id<"route">, dependant: Id<"route">, leadFacts: PersonFacts, options: LifeOptions = {}): Game {
  const game = life(content, options);
  joint(game, lead, "them", { stage: "married", facts: leadFacts });
  applyAs(game, [{ type: "route/hear", route: dependant, via: "partner" }]);
  game.endTurn([slot("activity.look-into-route", dependant)]);
  expect(routeOf(game, dependant).state).toBe("known");
  return game;
}

/** R-ACTIVITY-015: the application is sent at once and the month is left open. */
function sent(leadState: RouteStateName = "applying", options: LifeOptions = {}): Game {
  const game = joined(SKILLED, UK_DEPENDANT, leadOn(SKILLED, leadState), options);
  game.accept({ type: "activity/now", activity: APPLY_UK, param: null });
  expect(routeOf(game, UK_DEPENDANT).state).toBe("applying");
  return game;
}

describe("R-PEOPLE-019, 020: who may bring a partner", () => {
  test("[R-PEOPLE-019] given the routes, when their dependants are read, then the skilled and talent routes bring the UK dependant, the points route the Canadian one, and the rest none", () => {
    expect(content.route[SKILLED]?.dependants).toBe(UK_DEPENDANT);
    expect(content.route["route.uk-talent"]?.dependants).toBe(UK_DEPENDANT);
    expect(content.route[CANADA_ROUTE]?.dependants).toBe(CA_ACCOMPANY);
    for (const id of ["route.uk-masters", "route.uk-care", "route.gulf-contract", "route.road"] as const) expect(content.route[id]?.dependants).toBeNull();
  });

  test("[R-PEOPLE-020] given the statuses, when their dependants are read, then the sponsored worker lists four jobs, talent is any, and the rest none", () => {
    expect(content.status["status.uk-sponsored"]?.dependants).toEqual(["activity.job-uk-skilled", "activity.job-uk-senior-dev", "activity.job-uk-graduate", "activity.job-uk-nurse"]);
    expect(content.status["status.uk-talent"]?.dependants).toBe("any");
    const others = Object.values(content.status).filter((status) => !["status.uk-sponsored", "status.uk-talent"].includes(status.id));
    expect(others.every((status) => status.dependants === "none")).toBe(true);
  });
});

describe("R-PEOPLE-021: a lead already abroad", () => {
  test("[R-PEOPLE-021] given a lead on a sponsored visa in the UK in a listed job, and one in an unlisted job, when the lead step is read, then only the listed job lets the partner join", () => {
    const listed = joined(SKILLED, UK_DEPENDANT, facts({ where: "abroad", country: "country.uk", status: "status.uk-sponsored", job: "activity.job-uk-skilled" }));
    expect(check(readOf(listed), { type: "route/gate-step", route: UK_DEPENDANT, step: "lead" }).met).toBe(true);
    const unlisted = joined(SKILLED, UK_DEPENDANT, facts({ where: "abroad", country: "country.uk", status: "status.uk-sponsored", job: "activity.job-uk-care" }));
    expect(check(readOf(unlisted), { type: "route/gate-step", route: UK_DEPENDANT, step: "lead" }).met).toBe(false);
    unlisted.expectRejected({ type: "activity/now", activity: APPLY_UK, param: null }, "not-legal");
  });
});

describe("R-PEOPLE-022: applying as a dependant", () => {
  test("[R-PEOPLE-022] given a lead applying for the skilled visa and the maintenance held a month, when the dependant applies, then the lead route's fee and three years of surcharge are paid", () => {
    const game = joined(SKILLED, UK_DEPENDANT, leadOn(SKILLED, "applying"));
    expect(routeOf(game, UK_DEPENDANT).funds).toMatchObject({ heldMonths: 1, required: MAINTENANCE });
    const before = pounds(game);
    game.accept({ type: "activity/now", activity: APPLY_UK, param: null });
    expect(routeOf(game, UK_DEPENDANT).state).toBe("applying");
    expect(before - pounds(game)).toBe(SKILLED_FEE + 3 * SURCHARGE_YEAR);
    expect(routeOf(game, UK_DEPENDANT).visa?.surchargePaid).toBe(3 * SURCHARGE_YEAR);
    expect(dependantFee(readOf(game), ukDependant, leadOn(SKILLED, "applying"))?.map((fee) => fee.reason)).toEqual(["fee-visa", "fee-surcharge", "fee-surcharge", "fee-surcharge"]);
  });

  test("[R-PEOPLE-022] given pounds only in cash, so no funds are shown, when the lead has 11 and then 12 months in the UK, then only at 12 is the maintenance not asked", () => {
    const options: LifeOptions = { pockets: { NGN: { bank: 0, cash: 100000000 }, GBP: { bank: 0, cash: 1000000 } } };
    const short = joined(SKILLED, UK_DEPENDANT, leadOn(SKILLED, "applying", { monthsInCountry: EXEMPT - 1 }), options);
    expect(routeOf(short, UK_DEPENDANT).funds.heldMonths).toBe(0);
    short.expectRejected({ type: "activity/now", activity: APPLY_UK, param: null }, "not-legal");
    const exempt = joined(SKILLED, UK_DEPENDANT, leadOn(SKILLED, "applying", { monthsInCountry: EXEMPT }), options);
    expect(routeOf(exempt, UK_DEPENDANT).funds).toMatchObject({ heldMonths: 1, required: 0 });
    exempt.accept({ type: "activity/now", activity: APPLY_UK, param: null });
    expect(routeOf(exempt, UK_DEPENDANT).state).toBe("applying");
  });

  test("[R-PEOPLE-022] given a lead whose application is not in, and no status that allows joining, when the dependant applies, then the lead step is not reached and it is not legal", () => {
    const game = joined(SKILLED, UK_DEPENDANT, leadOn(SKILLED, "known"));
    expect(check(readOf(game), { type: "route/gate-step", route: UK_DEPENDANT, step: "lead" }).met).toBe(false);
    game.expectRejected({ type: "activity/now", activity: APPLY_UK, param: null }, "not-legal");
  });

  test("[R-PEOPLE-022] given no joint, or a joint the applicant leads, when the gate's steps are read, then the joint step is not reached", () => {
    const game = joined(SKILLED, UK_DEPENDANT, leadOn(SKILLED, "applying"));
    expect(dependantGate.reached(readOf(game), ukDependant, routeOf(game, UK_DEPENDANT), "joint")).toBe(true);
    game.state = { ...game.state, people: { ...game.state.people, joint: { ...game.state.people.joint!, lead: "me" } } };
    expect(dependantGate.reached(readOf(game), ukDependant, routeOf(game, UK_DEPENDANT), "joint")).toBe(false);
    game.expectRejected({ type: "activity/now", activity: APPLY_UK, param: null }, "not-legal");
  });

  test("[R-PEOPLE-022] given a lead in Canada's pool applying, when the spouse applies alongside, then the accompanying fee is paid in Canadian money and no funds are asked", () => {
    const pockets: LifeOptions["pockets"] = { NGN: { bank: 200000000, cash: 150000000 }, CAD: { bank: 300000, cash: 0 } };
    const game = joined(CANADA_ROUTE, CA_ACCOMPANY, leadOn(CANADA_ROUTE, "applying"), { pockets });
    expect(dependantGate.funds?.(readOf(game), content.route[CA_ACCOMPANY]!, routeOf(game, CA_ACCOMPANY))).toBeNull();
    const before = game.state.wallet.pockets.CAD.bank;
    game.accept({ type: "activity/now", activity: APPLY_CA, param: null });
    expect(routeOf(game, CA_ACCOMPANY).state).toBe("applying");
    expect(routeOf(game, CA_ACCOMPANY).visa?.surchargePaid).toBe(0);
    expect(before - game.state.wallet.pockets.CAD.bank).toBe(content.var["var.ca-accompany-fee"]!.start);
  });
});

describe("R-PEOPLE-023: the dependant's decision follows the lead", () => {
  test("[R-PEOPLE-023] given the lead still applying, when the decision month passes, then the dependant waits", () => {
    const game = sent("applying");
    pastDecision(game, UK_DEPENDANT);
    game.endTurn();
    expect(routeOf(game, UK_DEPENDANT).state).toBe("applying");
  });

  test("[R-PEOPLE-023] given the lead granted, when the decision comes, then one draw decides it", () => {
    const game = sent("applying", { tuning: ALWAYS_GRANTED });
    setFacts(game, (now) => ({ ...now, joint: { route: SKILLED, state: "granted" } }));
    const draws = game.state.draws.visa ?? 0;
    pastDecision(game, UK_DEPENDANT);
    expect(routeOf(game, UK_DEPENDANT).state).toBe("granted");
    expect(game.state.draws.visa).toBe(draws + 1);
  });

  test("[R-PEOPLE-023] given the lead refused, when the decision comes, then the dependant is refused for the lead with no draw, the fee kept and the surcharge refunded", () => {
    const game = sent("applying");
    setFacts(game, (now) => ({ ...now, joint: { route: SKILLED, state: "known" } }));
    const draws = game.state.draws.visa ?? 0;
    const before = game.state.wallet.pockets.GBP.bank;
    pastDecision(game, UK_DEPENDANT);
    expect(routeOf(game, UK_DEPENDANT).state).toBe("known");
    expect(routeOf(game, UK_DEPENDANT).lastRefusal?.reasons[0]).toBe("lead");
    expect(game.state.draws.visa ?? 0).toBe(draws);
    expect(game.state.wallet.pockets.GBP.bank - before).toBe(3 * SURCHARGE_YEAR);
  });

  test("[R-PEOPLE-023] given an interview open, then a fail, when the lead is granted, then the dependant waits for it and is then refused for the relationship", () => {
    const game = sent("granted");
    interviewOpen(game, UK_DEPENDANT);
    pastDecision(game, UK_DEPENDANT);
    expect(routeOf(game, UK_DEPENDANT).state).toBe("applying");
    scored(game, UK_DEPENDANT, "fail");
    game.endTurn();
    expect(routeOf(game, UK_DEPENDANT).lastRefusal?.reasons[0]).toBe("relationship");
  });
});

describe("R-PEOPLE-024: going, and the status that ends with the lead's", () => {
  function granted(statusMonthsLeft: number | null): Game {
    const game = sent("applying", { tuning: ALWAYS_GRANTED });
    setFacts(game, (now) => ({ ...now, where: "abroad", country: "country.uk", status: "status.uk-sponsored", statusMonthsLeft, joint: { route: SKILLED, state: "departed" } }));
    pastDecision(game, UK_DEPENDANT);
    expect(routeOf(game, UK_DEPENDANT).state).toBe("granted");
    return game;
  }

  test("[R-PEOPLE-024] given a granted dependant whose lead has 34 months left, when they fly, then they pay their own flight and their visa ends in 34 months", () => {
    const game = granted(34);
    const naira = game.state.wallet.pockets.NGN;
    const before = naira.bank + naira.cash;
    game.accept({ type: "route/depart", route: UK_DEPENDANT });
    const after = game.state.wallet.pockets.NGN;
    expect(before - (after.bank + after.cash)).toBe(content.tuning.route.flight.amount);
    expect(game.state.status.current).toMatchObject({ entry: "status.uk-dependant", expiresMonth: game.state.turn.month + 34 });
  });

  test("[R-PEOPLE-024] given the lead's visa ending in one month, when the dependant has flown, then the dependant's ends in the same month", () => {
    const game = granted(1);
    game.accept({ type: "route/depart", route: UK_DEPENDANT });
    const end = game.state.status.current!.expiresMonth!;
    expect(end).toBe(game.state.turn.month + 1);
    expect(leadStatusMonths(readOf(game))).toBe(1);
    game.endTurn();
    expect(game.state.status.current?.entry).not.toBe("status.uk-dependant");
  });

  test("[R-PEOPLE-024] given a lead whose status does not expire, when the dependant flies, then the dependant's does not either", () => {
    const game = granted(null);
    game.accept({ type: "route/depart", route: UK_DEPENDANT });
    expect(game.state.status.current?.expiresMonth).toBeNull();
  });
});
