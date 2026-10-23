// The plan: the way out the chapters follow, named in the view, and the player's own choice of it
// (chapter:chapters-follow-lean-route).
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { checkInvariants } from "../engine/invariants";
import type { Content, Id } from "../engine/types";
import { checklistView, routePercent } from "../japacity/japacity.logic";
import { applyEffects, slot } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { readOf } from "../testing/read";
import { leanRoute } from "./chapter.logic";
import { CANADA_ROUTE, CARE_ROUTE, FEET, FILE, SKILLED, UK_ROUTE } from "../testing/ids";

const LOOK = "activity.look-into-route";

function life(scenario: Id<"scenario">): Game {
  return start({ scenario, content });
}

/** Months pass, every slot resting, until the route is heard of. */
function untilHeard(game: Game, route: Id<"route">, most = 8): void {
  for (let month = 0; month < most && game.state.route[route]?.state === "unknown"; month += 1) game.endTurn();
  expect(game.state.route[route]?.state).toBe("heard");
}

/** The nurse who has heard of the master's and of health care, and has read the care page. */
function nurseOnCare(): Game {
  const game = life("scenario.nurse");
  untilHeard(game, CARE_ROUTE);
  expect(game.state.route[UK_ROUTE]?.state).toBe("heard");
  game.endTurn([slot(LOOK, CARE_ROUTE)]);
  return game;
}

describe("the chapter ahead in the view", () => {
  test("[chapter:view-says-closes-and-next] given the nurse on care's file, when the view is read, then the chapter that follows is care's decision day; once the life makes the master's the plan it is the master's", () => {
    const game = nurseOnCare();
    expect(game.view().chapter.current).toBe("chapter.build-the-file-care");
    expect(game.view().chapter.next).toBe("chapter.decision-day-care");
    game.accept({ type: "chapter/lean", route: UK_ROUTE });
    expect(game.view().chapter.next).toBe("chapter.decision-day");
  });

  test("[chapter:view-says-closes-and-next] given a chapter that closes on one item, when that item alone is met, then the view says it closes though other items are open, and the month's end closes it into the chapter the view named", () => {
    const feet = content.chapter[FEET]!;
    const one: Content = { ...content, version: "test-closes-on", chapter: { ...content.chapter, [FEET]: { ...feet, closesOn: "job" } } };
    const game = start({ scenario: "scenario.graduate", content: one });
    expect(game.view().chapter).toMatchObject({ current: FEET, closes: false });
    applyEffects(game, [{ type: "activity/start-job", job: "activity.job-teacher" }]);
    const view = game.view().chapter;
    expect(view.items.find((item) => item.id === "job")?.met).toBe(true);
    expect(view.items.some((item) => !item.met)).toBe(true);
    expect(view.closes).toBe(true);
    game.endTurn();
    expect(game.state.chapter.current).toBe(view.next);
    // Without `closesOn`, the same job leaves it open.
    const plain = start({ scenario: "scenario.graduate", content });
    applyEffects(plain, [{ type: "activity/start-job", job: "activity.job-teacher" }]);
    expect(plain.view().chapter.closes).toBe(false);
  });

  test("[chapter:view-says-closes-and-next] given no chapter left, when the view is read, then nothing closes and nothing follows", () => {
    const game = life("scenario.graduate");
    game.state = { ...game.state, chapter: { ...game.state.chapter, current: null } };
    expect(game.view().chapter).toMatchObject({ current: null, closes: false, next: null });
  });
});

describe("the plan in the view", () => {
  test("[chapter:chapters-follow-lean-route] given a life that has heard of no way out, when the view is read, then it names no plan", () => {
    const game = life("scenario.graduate");
    expect(Object.values(game.state.route).every((held) => held.state === "unknown")).toBe(true);
    expect(game.view().plan.route).toBeNull();
    expect(game.view().plan.ways).toEqual([]);
  });

  test("[chapter:chapters-follow-lean-route] given the nurse who heard of care and the master's, when the life reads the care page, then the view's plan is health care", () => {
    const game = nurseOnCare();
    expect(game.view().plan.route).toBe(CARE_ROUTE);
  });

  test("[chapter:chapters-follow-lean-route] given a route only heard of, when the view is read, then the plan is the route heard of first", () => {
    const game = life("scenario.nurse");
    untilHeard(game, UK_ROUTE);
    expect(game.view().plan.route).toBe(UK_ROUTE);
  });

  test("[chapter:chapters-follow-lean-route] [japacity:figure-sums-checklist-items] given the nurse on care, when the ways are read, then each own-effort way heard of carries its figure as the japacity kind sums it, the looked-into one as its route's figure", () => {
    const game = nurseOnCare();
    const read = readOf(game);
    const ways = game.view().plan.ways;
    const sum = (route: Id<"route">) => checklistView(read, route).reduce((total, item) => total + item.earned, 0);
    expect(ways.map((way) => way.route).sort()).toEqual(
      (Object.keys(game.state.route) as Id<"route">[]).filter((id) => [CARE_ROUTE, UK_ROUTE, CANADA_ROUTE, "route.uk-talent", "route.gulf-contract"].includes(id) && game.state.route[id]?.state !== "unknown").sort(),
    );
    expect(ways.find((way) => way.route === CARE_ROUTE)?.percent).toBe(routePercent(read, CARE_ROUTE));
    // The master's is only heard of: no figure of its own (japacity:heard-routes-have-no-figure), but the sum its checklist would earn.
    expect(routePercent(read, UK_ROUTE)).toBeNull();
    expect(ways.find((way) => way.route === UK_ROUTE)?.percent).toBe(sum(UK_ROUTE));
    // The nurse's licence and months on the ward count for care, not for the master's: the master's earns its degree, grade and passport,
    // and its English is the degree (route:degree-meets-masters-english).
    expect(checklistView(read, UK_ROUTE).filter((item) => item.met).map((item) => item.id).sort()).toEqual(["degree", "english", "grade", "passport"]);
    // A route with no file of its own is never a way the plan can take.
    expect(ways.some((way) => way.route === SKILLED)).toBe(false);
  });
});

describe("making another way the plan", () => {
  test("[chapter:chapters-follow-lean-route] given the nurse on care, when the life makes the master's the plan, then the choice is kept and the lean is the master's, read before the route looked into first", () => {
    const game = nurseOnCare();
    const result = game.accept({ type: "chapter/lean", route: UK_ROUTE });
    expect(result.events).toContainEqual({ type: "chapter/leaned", route: UK_ROUTE });
    expect(game.state.chapter.chosen).toBe(UK_ROUTE);
    expect(leanRoute(game.state.route, content, game.state.chapter.chosen)).toBe(UK_ROUTE);
    expect(game.view().plan.route).toBe(UK_ROUTE);
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[chapter:chapters-follow-lean-route] given the nurse who heard of both, when the life makes the master's the plan and reads both pages in the month, then the first chapter closes to the master's file, not the care file", () => {
    const game = life("scenario.nurse");
    untilHeard(game, CARE_ROUTE);
    game.accept({ type: "chapter/lean", route: UK_ROUTE });
    const result = game.endTurn([slot(LOOK, CARE_ROUTE), slot(LOOK, UK_ROUTE)]);
    expect(result.events.find((event) => event.type === "chapter/closed")).toEqual({ type: "chapter/closed", chapter: FEET, next: FILE });
    expect(game.state.chapter.current).toBe(FILE);
  });

  test("[chapter:chapters-follow-lean-route] given a way chosen as the plan, when it is chosen again, then it is refused: it is the plan already; another way may still be chosen", () => {
    const game = nurseOnCare();
    game.accept({ type: "chapter/lean", route: UK_ROUTE });
    game.expectRejected({ type: "chapter/lean", route: UK_ROUTE }, "not-legal");
    game.accept({ type: "chapter/lean", route: CARE_ROUTE });
    expect(game.view().plan.route).toBe(CARE_ROUTE);
  });

  test("[chapter:chapters-follow-lean-route] given a way never heard of, a way with no file of its own and a route not in content, when each is made the plan, then each is refused", () => {
    const game = nurseOnCare();
    expect(game.state.route["route.uk-talent"]?.state ?? "unknown").toBe("unknown");
    game.expectRejected({ type: "chapter/lean", route: "route.uk-talent" }, "not-legal");
    untilHeard(game, SKILLED, 12);
    game.expectRejected({ type: "chapter/lean", route: SKILLED }, "not-legal");
    game.expectRejected({ type: "chapter/lean", route: "route.nowhere" }, "unknown-id");
  });

  test("[chapter:chapters-follow-lean-route] given a chosen route in the state, when the invariants are read, then a route not in content is named", () => {
    const game = nurseOnCare();
    const broken = { ...game.state, chapter: { ...game.state.chapter, chosen: "route.nowhere" as Id<"route"> } };
    expect(checkInvariants(broken, content).some((problem) => problem.includes("route.nowhere"))).toBe(true);
  });
});
