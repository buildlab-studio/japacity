// The plan: the way out the chapters follow, named in the view, and the player's own choice of it
// (docs/rules/chapter.md R-CHAPTER-009; the design's switch).
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { checkInvariants } from "../engine/invariants";
import type { Id, ReadCtx } from "../engine/types";
import { checklistView, routePercent } from "../japacity/japacity.logic";
import { slot } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { leanRoute } from "./chapter.logic";

const UK: Id<"route"> = "route.uk-masters";
const CARE: Id<"route"> = "route.uk-care";
const POINTS: Id<"route"> = "route.canada-points";
const SKILLED: Id<"route"> = "route.uk-skilled";
const FEET: Id<"chapter"> = "chapter.find-your-feet";
const FILE: Id<"chapter"> = "chapter.build-the-file";
const LOOK = "activity.look-into-route";

function life(scenario: Id<"scenario">): Game {
  return start({ scenario, content });
}

/** Months pass, every slot resting, until the route is heard of. */
function untilHeard(game: Game, route: Id<"route">, most = 8): void {
  for (let month = 0; month < most && game.state.route[route]?.state === "unknown"; month += 1) game.endTurn();
  expect(game.state.route[route]?.state).toBe("heard");
}

/** The nurse who has heard of the master's and of care work, and has read the care page. */
function nurseOnCare(): Game {
  const game = life("scenario.ngozi");
  untilHeard(game, CARE);
  expect(game.state.route[UK]?.state).toBe("heard");
  game.endTurn([slot(LOOK, CARE)]);
  return game;
}

function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

describe("the plan in the view", () => {
  test("[R-CHAPTER-009] given a life that has heard of no way out, when the view is read, then it names no plan", () => {
    const game = life("scenario.ada");
    expect(Object.values(game.state.route).every((held) => held.state === "unknown")).toBe(true);
    expect(game.view().plan.route).toBeNull();
    expect(game.view().plan.ways).toEqual([]);
  });

  test("[R-CHAPTER-009] given the nurse who heard of care and the master's, when she reads the care page, then the view's plan is care work", () => {
    const game = nurseOnCare();
    expect(game.view().plan.route).toBe(CARE);
  });

  test("[R-CHAPTER-009] given a route only heard of, when the view is read, then the plan is the route heard of first", () => {
    const game = life("scenario.ngozi");
    untilHeard(game, UK);
    expect(game.view().plan.route).toBe(UK);
  });

  test("[R-CHAPTER-009] [R-JAPACITY-001] given the nurse on care, when the ways are read, then each own-effort way heard of carries its figure as the japacity kind sums it, the looked-into one as its route's figure", () => {
    const game = nurseOnCare();
    const read = readOf(game);
    const ways = game.view().plan.ways;
    const sum = (route: Id<"route">) => checklistView(read, route).reduce((total, item) => total + item.earned, 0);
    expect(ways.map((way) => way.route).sort()).toEqual(
      (Object.keys(game.state.route) as Id<"route">[]).filter((id) => [CARE, UK, POINTS, "route.uk-talent", "route.gulf-contract"].includes(id) && game.state.route[id]?.state !== "unknown").sort(),
    );
    expect(ways.find((way) => way.route === CARE)?.percent).toBe(routePercent(read, CARE));
    // The master's is only heard of: no figure of its own (R-JAPACITY-005), but the sum its checklist would earn.
    expect(routePercent(read, UK)).toBeNull();
    expect(ways.find((way) => way.route === UK)?.percent).toBe(sum(UK));
    // The nurse's licence and months on the ward count for care, not for the master's.
    expect(sum(UK)).toBeLessThan(routePercent(read, CARE) ?? 0);
    // A route with no file of its own is never a way the plan can take.
    expect(ways.some((way) => way.route === SKILLED)).toBe(false);
  });
});

describe("making another way the plan", () => {
  test("[R-CHAPTER-009] given the nurse on care, when she makes the master's the plan, then the choice is kept and the lean is the master's, read before the route looked into first", () => {
    const game = nurseOnCare();
    const result = game.accept({ type: "chapter/lean", route: UK });
    expect(result.events).toContainEqual({ type: "chapter/leaned", route: UK });
    expect(game.state.chapter.chosen).toBe(UK);
    expect(leanRoute(game.state.route, content, game.state.chapter.chosen)).toBe(UK);
    expect(game.view().plan.route).toBe(UK);
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[R-CHAPTER-009] given the nurse who heard of both, when she makes the master's the plan and reads both pages in the month, then the first chapter closes to the master's file, not the care file", () => {
    const game = life("scenario.ngozi");
    untilHeard(game, CARE);
    game.accept({ type: "chapter/lean", route: UK });
    const result = game.endTurn([slot(LOOK, CARE), slot(LOOK, UK)]);
    expect(result.events.find((event) => event.type === "chapter/closed")).toEqual({ type: "chapter/closed", chapter: FEET, next: FILE });
    expect(game.state.chapter.current).toBe(FILE);
  });

  test("[R-CHAPTER-009] given a way chosen as the plan, when it is chosen again, then it is refused: it is the plan already; another way may still be chosen", () => {
    const game = nurseOnCare();
    game.accept({ type: "chapter/lean", route: UK });
    game.expectRejected({ type: "chapter/lean", route: UK }, "not-legal");
    game.accept({ type: "chapter/lean", route: CARE });
    expect(game.view().plan.route).toBe(CARE);
  });

  test("[R-CHAPTER-009] given a way never heard of, a way with no file of its own and a route not in content, when each is made the plan, then each is refused", () => {
    const game = nurseOnCare();
    expect(game.state.route["route.uk-talent"]?.state ?? "unknown").toBe("unknown");
    game.expectRejected({ type: "chapter/lean", route: "route.uk-talent" }, "not-legal");
    untilHeard(game, SKILLED, 12);
    game.expectRejected({ type: "chapter/lean", route: SKILLED }, "not-legal");
    game.expectRejected({ type: "chapter/lean", route: "route.nowhere" }, "unknown-id");
  });

  test("[R-CHAPTER-009] given a chosen route in the state, when the invariants are read, then a route not in content is named", () => {
    const game = nurseOnCare();
    const broken = { ...game.state, chapter: { ...game.state.chapter, chosen: "route.nowhere" as Id<"route"> } };
    expect(checkInvariants(broken, content).some((problem) => problem.includes("route.nowhere"))).toBe(true);
  });
});
