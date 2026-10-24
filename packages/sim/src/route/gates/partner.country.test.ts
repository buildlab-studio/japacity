// The partner route from inside the country (person:partner-route-in-country), the dependant route in the grace only, and an overstay on
// the record of later applications (status:overstay-counts-as-refusal).
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Content, Id } from "../../engine/types";
import { earlierRefusals } from "../route.logic";
import { answerInterview, facts, joint, scored } from "../../testing/person.journey";
import { flown, playMonths } from "../../testing/place.journey";
import type { Game } from "../../testing/play";
import { readOf, routeOf } from "../../testing/read";
import { applyEffects } from "../../testing/route.journey";
import { CANADA_ROUTE, OVERSTAYER, UK_COUNTRY, UK_PARTNER, UK_ROUTE } from "../../testing/ids";

const APPLY_UK: Id<"activity"> = "activity.apply-uk-partner";
const PARTNER_STATUS: Id<"status"> = "status.uk-partner";
const SETTLED_SPONSOR = facts({ where: "abroad", country: UK_COUNTRY, status: "status.uk-settled", meetsFloor: { [UK_PARTNER]: true } });

function overstayer(detectBp: number): (used: Content) => Content {
  return (used) => ({ ...used, status: { ...used.status, [OVERSTAYER]: { ...used.status[OVERSTAYER]!, detectBp, rentCheckBp: 0 } } });
}

/** Flown to the UK, the status lost, married to a settled partner there, and the partner route known. */
function lapsedAndMarried(detectBp: number): Game {
  const game = flown(content, { change: overstayer(detectBp) });
  applyEffects(game, [{ type: "status/lose" }, { type: "document/void", document: "document.tb-certificate" }]);
  joint(game, UK_PARTNER, "them", { stage: "married", facts: SETTLED_SPONSOR });
  applyEffects(game, [{ type: "route/hear", route: UK_PARTNER, via: "test" }, { type: "route/look-into", route: UK_PARTNER }]);
  expect(routeOf(game, UK_PARTNER).state).toBe("known");
  return game;
}

function overstay(game: Game) {
  return game.state.status.current?.overstay;
}

describe("the partner route from inside the country", () => {
  test("[person:partner-route-in-country] [person:partner-gate-needs] given a UK overstayer past the grace with no TB certificate, when the partner route is applied for in country, then it goes in, made in country, with no TB asked and no flight", () => {
    const game = lapsedAndMarried(0);
    playMonths(game, 2);
    expect(overstay(game)?.graceUntil).toBeLessThan(game.state.turn.month);
    game.accept({ type: "activity/now", activity: APPLY_UK, param: null });
    expect(routeOf(game, UK_PARTNER).state).toBe("applying");
    expect(routeOf(game, UK_PARTNER).visa?.inCountry).toBe(true);
    expect(game.view().status?.overstay?.pending).toBe(true);
  });

  test("[status:grace-before-overstaying] [status:grace-allows-in-country-applications] given a partner application sent in country in the lapse's month, the UK's one month of grace, when months pass with detection certain, then the grace holds while it waits; after the refusal it ends at that month's end and detection follows", () => {
    const game = lapsedAndMarried(10000);
    const since = game.state.turn.month;
    expect(overstay(game)?.graceUntil).toBe(since);
    game.accept({ type: "activity/now", activity: APPLY_UK, param: null });
    const decision = routeOf(game, UK_PARTNER).visa!.decisionMonth;
    expect(decision).toBeGreaterThan(since + 1);
    answerInterview(game);
    scored(game, UK_PARTNER, "fail");
    while (game.state.turn.month < decision) {
      playMonths(game, 1);
      expect(overstay(game)?.noticeUntil).toBeNull();
      expect(game.view().status?.overstay).toMatchObject({ graceLeft: 1, pending: game.state.turn.month < decision });
    }
    expect(routeOf(game, UK_PARTNER).state).toBe("known");
    expect(overstay(game)?.graceUntil).toBe(decision);
    playMonths(game, 1);
    expect(overstay(game)?.graceUntil).toBe(decision);
    expect(overstay(game)?.noticeUntil).not.toBeNull();
  });

  test("[person:partner-route-in-country] [status:notice-ends-in-removal] [status:detection-gives-notice] given a notice standing and a partner application pending in country, when the notice's month comes, then it holds; after a refusal it ends at the next month's end", () => {
    const game = lapsedAndMarried(10000);
    playMonths(game, 2);
    const until = overstay(game)?.noticeUntil ?? null;
    expect(until).not.toBeNull();
    game.accept({ type: "activity/now", activity: APPLY_UK, param: null });
    const decision = routeOf(game, UK_PARTNER).visa!.decisionMonth;
    expect(decision).toBeGreaterThanOrEqual(until!);
    answerInterview(game);
    scored(game, UK_PARTNER, "fail");
    while (game.state.turn.month < decision) playMonths(game, 1);
    expect(routeOf(game, UK_PARTNER).state).toBe("known");
    expect(game.state.place.where).toBe("abroad");
    expect(overstay(game)?.noticeUntil).toBe(decision + 1);
    playMonths(game, 1);
    expect(game.state.place.where).toBe("home");
    expect(game.state.place.returns.at(-1)?.shape).toBe("removed");
  });

  test("[person:partner-route-in-country] [route-gates:in-country-grant-switches-status] given a partner application made in country past the grace, when it is granted, then the partner status replaces the overstay in country, and it settles at 120 months", () => {
    const game = lapsedAndMarried(0);
    playMonths(game, 2);
    game.accept({ type: "activity/now", activity: APPLY_UK, param: null });
    const decision = routeOf(game, UK_PARTNER).visa!.decisionMonth;
    answerInterview(game);
    scored(game, UK_PARTNER, "pass");
    while (game.state.turn.month < decision) playMonths(game, 1);
    expect(routeOf(game, UK_PARTNER).state).toBe("departed");
    expect(game.state.status.current).toMatchObject({ entry: PARTNER_STATUS, settleMonths: content.tuning.status.overstayPartnerSettleMonths });
    expect(game.state.status.current?.overstay).toBeUndefined();
    expect(game.view().status?.settleMonths).toBe(120);
    expect(game.state.place).toMatchObject({ where: "abroad", country: UK_COUNTRY });
  });

  test("[person:partner-route-in-country] [status:grace-allows-in-country-applications] given a UK overstayer, when the dependant route's act is read, then its in-country condition holds in the grace and not after it", () => {
    const game = lapsedAndMarried(0);
    const inCountry = content.activity["activity.apply-uk-dependant"]!.requires.find((requirement) => requirement.type === "any" && JSON.stringify(requirement).includes("grace"))!;
    const missing = (): boolean => (game.view().activities.find((option) => option.id === "activity.apply-uk-dependant")?.missing ?? []).some((requirement) => JSON.stringify(requirement) === JSON.stringify(inCountry));
    expect(missing()).toBe(false);
    playMonths(game, 2);
    expect(missing()).toBe(true);
  });
});

describe("an overstay on the record", () => {
  test("[status:overstay-counts-as-refusal] given a return home from a UK overstay past the grace, and then a removal, when a later UK application's earlier refusals are counted, then each counts one; a return in the grace counts none, and Canada's routes count nothing", () => {
    const inGrace = flown(content, { change: overstayer(0) });
    applyEffects(inGrace, [{ type: "status/lose" }]);
    inGrace.accept({ type: "return/home" });
    const uk = content.route[UK_ROUTE]!;
    expect(earlierRefusals(readOf(inGrace), uk, routeOf(inGrace, UK_ROUTE))).toBe(routeOf(inGrace, UK_ROUTE).refusals);

    const late = flown(content, { change: overstayer(0) });
    applyEffects(late, [{ type: "status/lose" }]);
    playMonths(late, 2);
    late.accept({ type: "return/home" });
    const own = routeOf(late, UK_ROUTE).refusals;
    expect(earlierRefusals(readOf(late), uk, routeOf(late, UK_ROUTE))).toBe(own + 1);
    applyEffects(late, [{ type: "place/move", to: "abroad", country: UK_COUNTRY }, { type: "status/grant", status: OVERSTAYER }, { type: "status/remove" }]);
    expect(earlierRefusals(readOf(late), uk, routeOf(late, UK_ROUTE))).toBe(own + 2);
    const canada = content.route[CANADA_ROUTE]!;
    expect(earlierRefusals(readOf(late), canada, routeOf(late, CANADA_ROUTE))).toBe(routeOf(late, CANADA_ROUTE).refusals);
  });
});
