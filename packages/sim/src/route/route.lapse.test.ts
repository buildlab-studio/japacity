// A route flown and then lost (route:lapsed-route-known-again), the master's English (route:degree-meets-masters-english), an application
// made from inside the country (route:visa-application-needs, route-gates:in-country-grant-switches-status) and the authorisation to return
// into Canada (route-gates:canada-return-asks-authorisation).
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../engine/check";
import type { Content, Id, RouteState } from "../engine/types";
import { ALWAYS_GRANTED, flown, offeredSeed, playMonths } from "../testing/place.journey";
import { answerInterview, facts, joint, scored } from "../testing/person.journey";
import type { Game } from "../testing/play";
import { readOf } from "../testing/read";
import { READY_PAPERS, answerFirst, applyEffects, readyLife, toDecision, uk } from "../testing/route.journey";
import { CANADA_COUNTRY, CA_SPOUSE, CAS, NORTHGATE, OVERSTAYER, SETTLED, STUDENT, UK_COUNTRY, UK_ROUTE } from "../testing/ids";

const CANADA_OVERSTAYER: Id<"status"> = "status.canada-overstayer";

function route(game: Game, id: Id<"route"> = UK_ROUTE): RouteState {
  const held = game.state.route[id];
  if (held === undefined) throw new Error(`No ${id} is held.`);
  return held;
}

/** The UK overstayer's grace made long, so a master's can be applied for and decided inside it. */
const longGrace = (used: Content): Content => ({
  ...used,
  status: { ...used.status, [OVERSTAYER]: { ...used.status[OVERSTAYER]!, graceMonths: 12, detectBp: 0, rentCheckBp: 0 } },
});

describe("a route flown and then lost", () => {
  test("[route:lapsed-route-known-again] given the master's flown with its school and deposit, when the status lapses abroad, then the route is known again with its school, deposit, confirmation and months held cleared, and its record kept", () => {
    const game = flown(content);
    const before = route(game);
    expect(before.state).toBe("departed");
    expect(before.school).not.toBeNull();
    applyEffects(game, [{ type: "status/lose" }]);
    const after = route(game);
    expect(after.state).toBe("known");
    expect(after).toMatchObject({ school: null, depositPaid: 0, refusals: before.refusals, lastRefusal: before.lastRefusal, heardMonth: before.heardMonth });
    expect(after.funds.heldMonths).toBe(0);
    expect(after.visa).toBeNull();
    expect(check(readOf(game), { type: "document/held", document: CAS }).met).toBe(false);
  });

  test("[route:lapsed-route-known-again] [return:routes-run-again-from-home] given the master's flown, when the character comes home by choice, then it is known again; a return with papers keeps it departed", () => {
    const back = flown(content);
    back.accept({ type: "return/home" });
    expect(route(back).state).toBe("known");
    const papers = flown(content);
    applyEffects(papers, [{ type: "status/grant", status: SETTLED }]);
    papers.accept({ type: "return/home" });
    expect(papers.state.place.returns.at(-1)?.shape).toBe("with-papers");
    expect(route(papers).state).toBe("departed");
  });

  test("[route:lapsed-route-known-again] given the master's flown, when the character is removed, then it is known again", () => {
    const game = flown(content);
    applyEffects(game, [{ type: "status/remove" }]);
    expect(game.state.place.where).toBe("home");
    expect(route(game).state).toBe("known");
  });
});

describe("the degree is the master's English", () => {
  const NO_TEST = READY_PAPERS.filter((paper) => paper.document !== "document.english-test");

  test("[route:degree-meets-masters-english] given a graduate with no English result, when the master's checklist is read, then its English item is met by the degree", () => {
    const game = readyLife(content, { documents: NO_TEST });
    const english = content.route[UK_ROUTE]!.checklist.find((item) => item.id === "english")!;
    expect(check(readOf(game), english.requirement).met).toBe(true);
    const unschooled = readyLife(content, { documents: NO_TEST, qualities: { "quality.education-level": 2 } });
    expect(check(readOf(unschooled), english.requirement).met).toBe(false);
  });

  test("[route:degree-meets-masters-english] [route:applying-to-a-school] [route:visa-application-needs] given a graduate with no English result, when the master's is played to its decision, then no school and no step asks for a band", () => {
    const game = readyLife(content, { documents: NO_TEST, seed: offeredSeed(content), tuning: ALWAYS_GRANTED });
    toDecision(game);
    expect(uk(game).state).toBe("granted");
    expect(game.state.document["document.english-test"]).toBeUndefined();
  });
});

describe("an application made in country", () => {
  test("[route:visa-application-needs] [status:grace-allows-in-country-applications] [route-gates:in-country-grant-switches-status] given a UK overstayer in the grace with no TB certificate, when the master's is applied for and granted in country, then it departs in the same month with no flight and the student status replaces the overstay", () => {
    const game = flown(content, { change: longGrace });
    applyEffects(game, [{ type: "status/lose" }, { type: "document/void", document: "document.tb-certificate" }]);
    expect(uk(game).state).toBe("known");
    game.accept({ type: "activity/now", activity: "activity.apply-to-school", param: NORTHGATE });
    playMonths(game, 1);
    expect(uk(game).schools[NORTHGATE]?.state).toBe("offer");
    game.accept({ type: "route/pay-deposit", route: UK_ROUTE, school: NORTHGATE });
    playMonths(game, 1);
    expect(uk(game).funds.heldMonths).toBe(1);
    const flights = game.state.wallet.totals.out.flight?.NGN ?? 0;
    game.accept({ type: "activity/now", activity: "activity.apply-for-visa", param: null });
    expect(uk(game).state).toBe("applying");
    expect(uk(game).visa?.inCountry).toBe(true);
    answerFirst(game);
    const decided = game.endTurn();
    expect(uk(game).state).toBe("departed");
    expect(game.state.status.current?.entry).toBe(STUDENT);
    expect(game.state.status.current?.overstay).toBeUndefined();
    expect(game.state.place).toMatchObject({ where: "abroad", country: UK_COUNTRY });
    expect(game.state.wallet.totals.out.flight?.NGN ?? 0).toBe(flights);
    expect(decided.lines.map((line) => line.key)).toContain("line.route.switched");
  });

  test("[status:grace-allows-in-country-applications] given a UK overstayer past the grace, when the master's application is asked for in country, then it is not legal", () => {
    const game = flown(content, { change: (used) => ({ ...used, status: { ...used.status, [OVERSTAYER]: { ...used.status[OVERSTAYER]!, detectBp: 0, rentCheckBp: 0 } } }) });
    applyEffects(game, [{ type: "status/lose" }]);
    playMonths(game, 2);
    expect(game.expectRejected({ type: "activity/now", activity: "activity.apply-to-school", param: NORTHGATE }, "not-legal").code).toBe("not-legal");
    expect(uk(game).schools[NORTHGATE]).toBeUndefined();
  });
});

describe("the authorisation to return into Canada", () => {
  const ARC = content.var["var.canada-arc-fee"]!.start;
  const REMOVAL = content.var["var.canada-removal-cost"]!.start;
  const SPONSOR_FEE = content.var["var.canada-sponsor-fee"]!.start;
  const shortBan = (used: Content): Content => ({ ...used, status: { ...used.status, [CANADA_OVERSTAYER]: { ...used.status[CANADA_OVERSTAYER]!, banMonths: 2 } } });

  /** Removed from Canada, home, married to a resident of Canada and the spouse route known. */
  function removedFromCanada(): Game {
    const game = readyLife(content, { quiet: true, change: shortBan });
    applyEffects(game, [{ type: "place/move", to: "abroad", country: CANADA_COUNTRY }, { type: "status/grant", status: CANADA_OVERSTAYER }, { type: "status/remove" }]);
    joint(game, CA_SPOUSE, "them", { stage: "married", facts: facts({ where: "abroad", country: CANADA_COUNTRY, status: "status.canada-resident" }) });
    applyEffects(game, [{ type: "money/add", currency: "CAD", pocket: "bank", amount: 2 * (ARC + REMOVAL + SPONSOR_FEE), reason: "gift" }]);
    return game;
  }

  test("[route-gates:canada-return-asks-authorisation] given a removal from Canada whose ban has lifted, when the first application into Canada is sent, then it also pays the authorisation and the removal costs, once, as visa fees; the route's view names them until then", () => {
    expect([ARC, REMOVAL]).toEqual([49250, 384000]);
    const game = removedFromCanada();
    playMonths(game, 2);
    applyEffects(game, [{ type: "route/hear", route: CA_SPOUSE, via: "test" }, { type: "route/look-into", route: CA_SPOUSE }]);
    expect(route(game, CA_SPOUSE).state).toBe("known");
    const view = game.view().routes.find((held) => held.id === CA_SPOUSE);
    expect(view?.authorisation).toEqual({ arc: { currency: "CAD", amount: ARC }, removal: { currency: "CAD", amount: REMOVAL } });
    const visaFees = game.state.wallet.totals.out["fee-visa"]?.CAD ?? 0;
    game.accept({ type: "activity/now", activity: "activity.apply-canada-spouse", param: null });
    expect(route(game, CA_SPOUSE).state).toBe("applying");
    expect((game.state.wallet.totals.out["fee-visa"]?.CAD ?? 0) - visaFees).toBe(SPONSOR_FEE + ARC + REMOVAL);
    expect(game.view().routes.find((held) => held.id === CA_SPOUSE)?.authorisation).toBeUndefined();
    answerInterview(game);
    scored(game, CA_SPOUSE, "fail");
    while (route(game, CA_SPOUSE).state === "applying") playMonths(game, 1);
    const again = game.state.wallet.totals.out["fee-visa"]?.CAD ?? 0;
    game.accept({ type: "activity/now", activity: "activity.apply-canada-spouse", param: null });
    expect((game.state.wallet.totals.out["fee-visa"]?.CAD ?? 0) - again).toBe(SPONSOR_FEE);
  });
});
