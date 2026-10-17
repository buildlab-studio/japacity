import { content } from "@japacity/content";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { checkContent } from "../engine/content";
import type { Content, Effect, Id, ReadCtx, RouteEntry, RouteStateName } from "../engine/types";
import { miniContent } from "../testing/miniContent";
import { finishPrologue, start } from "../testing/play";
import type { Game } from "../testing/play";
import { offeredWith, readyLife, toApplied, toDecision, toHeard, toKnown } from "../testing/route.journey";
import { carryOut, judgeWith, writeRoute } from "../testing/japacity.fixtures";
import { checklistView, japacity, routePercent } from "./japacity.logic";

const UK: Id<"route"> = "route.uk-masters";
const TWIN: Id<"route"> = "route.uk-twin";
const WINDOW = "var.uk-study-window";
const uk = content.route[UK]!;

function weight(id: string, entry: RouteEntry = uk): number {
  const item = entry.checklist.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`The route has no item ${id}.`);
  return item.weight;
}

/** The game's state under its world, with the study window set when given. */
function readOf(game: Game, window?: number): ReadCtx {
  const world = game.world();
  return {
    state: game.state,
    world: window === undefined ? world : { ...world, vars: { ...world.vars, [WINDOW]: window } },
    content: game.content,
  };
}

function ada(used: Content = content): Game {
  return start({ scenario: "scenario.ada", content: used });
}

/** Ada with the route heard of and looked into, month by month through the real route kind. */
function adaKnown(used: Content = content): Game {
  const game = ada(used);
  toKnown(game);
  return game;
}

/** Never refused: the floor and the ceiling of R-ROUTE-016 pinned together. */
const ALWAYS_GRANTED = { refusalMinBp: 0, refusalMaxBp: 0 };

/** The first seed whose first Northgate answer is an offer for Ada's grade. */
const OFFERED = (() => {
  for (let i = 0; i < 1000; i += 1) {
    const seed = `seed-${String(i)}`;
    if (offeredWith(seed, content, "school.northgate", content.scenario["scenario.ada"]!.qualities["quality.edu-grade"] ?? 0)) return seed;
  }
  throw new Error("No seed gives an offer.");
})();

/**
 * Ada with her papers and money in hand, played through the real route kind
 * to the visa application, the grant, or the flight.
 */
function readyAt(to: "applying" | "granted" | "departed"): Game {
  const game = readyLife(content, { seed: OFFERED, tuning: ALWAYS_GRANTED });
  if (to === "applying") {
    toApplied(game);
    return game;
  }
  toDecision(game);
  if (to === "departed") game.accept({ type: "route/depart", route: UK });
  return game;
}

/** Every pound in the bank moved to cash, where it never counts as funds shown (R-ROUTE-010). */
function poundsToCash(game: Game): void {
  game.accept({ type: "wallet/move", currency: "GBP", amount: game.state.wallet.pockets.GBP.bank, to: "cash" });
}

/** Months pass until both routes are heard of. */
function bothHeard(game: Game): void {
  for (let month = 0; month < 5 && (game.state.route[UK]?.state === "unknown" || game.state.route[TWIN]?.state === "unknown"); month += 1) game.endTurn();
  expect([game.state.route[UK]?.state, game.state.route[TWIN]?.state]).toEqual(["heard", "heard"]);
}

/** Sets a quality to a value through `quality/add`, which clamps. */
function setQuality(game: Game, quality: Id<"quality">, value: number): void {
  const now = game.state.quality[quality] ?? 0;
  if (now !== value) carryOut(game, [{ type: "quality/add", quality, amount: value - now }]);
}

/** The real content with the English item made slow: the English quality against 60. */
const slowEnglish: Content = {
  ...content,
  route: {
    ...content.route,
    [UK]: {
      ...uk,
      checklist: uk.checklist.map((item) =>
        item.id === "english" ? { ...item, partial: true, requirement: { type: "quality/min", quality: "quality.english", value: 60 } } : item,
      ),
    },
  },
};

/** The real content with a second route just like the first, placed before or after it. */
function withTwin(first: boolean): Content {
  const twin: RouteEntry = { ...uk, id: TWIN };
  // Every other route stays, since activities name them; only the twin's place against the UK route changes.
  return { ...content, route: first ? { [TWIN]: twin, ...content.route } : { ...content.route, [TWIN]: twin } };
}

describe("a route's figure", () => {
  test("[R-JAPACITY-001] given Ada with the route known, when the figure is worked out, then the met items earn their whole weight and every other item nothing", () => {
    const game = adaKnown();
    const read = readOf(game);
    // Her degree and her second upper are met; nothing else on the list is yet.
    expect(routePercent(read, UK, judgeWith(read))).toBe(weight("degree") + weight("grade"));
    const items = checklistView(read, UK, judgeWith(read));
    expect(items.map((item) => item.id)).toEqual(uk.checklist.map((item) => item.id));
    expect(items.find((item) => item.id === "degree")).toEqual({ id: "degree", weight: weight("degree"), met: true, have: null, need: null, earned: weight("degree") });
    expect(items.find((item) => item.id === "passport")).toEqual({ id: "passport", weight: weight("passport"), met: false, have: null, need: null, earned: 0 });
  });

  test("[R-JAPACITY-001] given Ada with the route known, when her passport and transcript are issued, then each adds its whole weight", () => {
    const game = adaKnown();
    carryOut(game, [{ type: "document/grant", document: "document.passport" }]);
    let read = readOf(game);
    expect(routePercent(read, UK, judgeWith(read))).toBe(weight("degree") + weight("grade") + weight("passport"));
    carryOut(game, [{ type: "document/grant", document: "document.transcript" }]);
    read = readOf(game);
    expect(routePercent(read, UK, judgeWith(read))).toBe(weight("degree") + weight("grade") + weight("passport") + weight("transcript"));
  });

  test("[R-JAPACITY-001] given a slow item, when have moves from 0 to the need, then it earns weight times have over need rounded down, and its whole weight once met", () => {
    const game = adaKnown(slowEnglish);
    const english = weight("english");
    const base = weight("degree") + weight("grade");
    const earnedAt = (value: number): number => {
      setQuality(game, "quality.english", value);
      const read = readOf(game);
      return (routePercent(read, UK, judgeWith(read)) ?? -1) - base;
    };
    expect(english).toBe(12);
    // 12 * have / 60, rounded down.
    expect(earnedAt(0)).toBe(0);
    expect(earnedAt(4)).toBe(0);
    expect(earnedAt(5)).toBe(1);
    expect(earnedAt(55)).toBe(11);
    expect(earnedAt(59)).toBe(11);
    expect(earnedAt(60)).toBe(english);
    expect(earnedAt(100)).toBe(english);
  });

  test("[R-JAPACITY-001] given a slow item part filled, when the checklist is shown, then it carries have and need and the share it earned", () => {
    const game = adaKnown(slowEnglish);
    setQuality(game, "quality.english", 55);
    const read = readOf(game);
    const item = checklistView(read, UK, judgeWith(read)).find((candidate) => candidate.id === "english");
    expect(item).toEqual({ id: "english", weight: 12, met: false, have: 55, need: 60, earned: 11 });
  });

  test("[R-JAPACITY-002] given a route granted or departed, when the figure is worked out, then it is 100 whatever the checklist says", () => {
    for (const to of ["granted", "departed"] as const) {
      const game = readyLife(content, { seed: OFFERED, tuning: ALWAYS_GRANTED });
      toDecision(game);
      // With the pounds in cash the funds are not shown, so the checklist has unmet items.
      poundsToCash(game);
      if (to === "departed") game.accept({ type: "route/depart", route: UK });
      expect(game.state.route[UK]?.state).toBe(to);
      const read = readOf(game);
      expect(checklistView(read, UK).some((item) => !item.met)).toBe(true);
      expect(routePercent(read, UK)).toBe(100);
    }
  });

  test("[R-JAPACITY-005] given a route only heard of, or unknown, when the figure is asked for, then there is none", () => {
    const game = ada();
    expect(routePercent(readOf(game), UK)).toBeNull();
    toHeard(game);
    expect(routePercent(readOf(game), UK)).toBeNull();
    toKnown(game);
    expect(routePercent(readOf(game), UK)).not.toBeNull();
  });
});

describe("the character's japacity", () => {
  test("[R-JAPACITY-003] given a known route, when the window is open, narrowing or closed, then it counts at 2 and 1 and not at 0", () => {
    const game = adaKnown();
    const figure = weight("degree") + weight("grade");
    for (const window of [2, 1]) {
      const read = readOf(game, window);
      expect(japacity(read, judgeWith(read))).toEqual({ percent: figure, route: UK });
    }
    const closed = readOf(game, 0);
    expect(japacity(closed, judgeWith(closed))).toEqual({ percent: null, route: null });
  });

  test("[R-JAPACITY-003] given a route applying, granted or departed, when the window is closed, then it still counts", () => {
    for (const to of ["applying", "granted", "departed"] as const) {
      const game = readyAt(to);
      expect(game.state.route[UK]?.state).toBe(to);
      const read = readOf(game, 0);
      const judge = judgeWith(read);
      expect(japacity(read, judge)).toEqual({ percent: routePercent(read, UK, judge), route: UK });
    }
    // Applying, the figure is still the checklist's: with the pounds in cash the funds are short and not held.
    const applying = readyAt("applying");
    poundsToCash(applying);
    const read = readOf(applying, 0);
    const items = checklistView(read, UK, judgeWith(read));
    expect(items.filter((item) => !item.met).map((item) => item.id)).toEqual(["funds", "held"]);
    const funds = items.find((item) => item.id === "funds")!.earned;
    expect(japacity(read, judgeWith(read)).percent).toBe(100 - weight("funds") - weight("held") + funds);
  });

  test("[R-JAPACITY-003] given no route that counts, when japacity is asked for, then it is empty", () => {
    const states: RouteStateName[] = ["unknown", "heard", "refused"];
    for (const to of states) {
      const game = ada();
      if (to === "heard") toHeard(game);
      if (to === "refused") {
        toKnown(game);
        writeRoute(game, UK, "refused");
      }
      expect(game.state.route[UK]?.state).toBe(to);
      const read = readOf(game);
      expect(japacity(read, judgeWith(read))).toEqual({ percent: null, route: null });
    }
    expect(japacity(readOf(ada()))).toEqual({ percent: null, route: null });
  });

  test("[R-JAPACITY-003] given two routes, when one is higher, then japacity is the higher whatever the order", () => {
    for (const first of [true, false]) {
      const game = readyLife(withTwin(first), { seed: OFFERED, tuning: ALWAYS_GRANTED });
      bothHeard(game);
      // Looking into a route needs the UK route still heard, so the twin is looked into first.
      game.endTurn([{ activity: "activity.look-into-route", param: TWIN }]);
      toDecision(game);
      // The twin's checklist reads the same file; with the pounds in cash its funds fall short.
      poundsToCash(game);
      expect([game.state.route[UK]?.state, game.state.route[TWIN]?.state]).toEqual(["granted", "known"]);
      const read = readOf(game);
      expect(routePercent(read, TWIN, judgeWith(read))).toBeLessThan(100);
      expect(japacity(read, judgeWith(read))).toEqual({ percent: 100, route: UK });
    }
  });

  test("[R-JAPACITY-003] given two routes with the same figure, when japacity is asked for, then the route first in content order is named", () => {
    for (const first of [true, false]) {
      const game = ada(withTwin(first));
      bothHeard(game);
      game.endTurn([{ activity: "activity.look-into-route", param: TWIN }]);
      toKnown(game);
      expect([game.state.route[UK]?.state, game.state.route[TWIN]?.state]).toEqual(["known", "known"]);
      const read = readOf(game);
      const result = japacity(read, judgeWith(read));
      expect(routePercent(read, UK, judgeWith(read))).toBe(routePercent(read, TWIN, judgeWith(read)));
      expect(result.route).toBe(first ? TWIN : UK);
    }
  });

  test("[R-JAPACITY-003] given the view, when a route is not yet known, then it shows no route yet", () => {
    const view = ada().view();
    expect(view.japacity).toEqual({ percent: null, route: null });
    expect(start({ content: miniContent }).view().japacity).toEqual({ percent: null, route: null });
  });
});

describe("whole numbers, derived each time", () => {
  test("[R-JAPACITY-004] given every route in the content, when its weights are added, then they come to exactly 100", () => {
    for (const used of [content, miniContent]) {
      for (const entry of Object.values(used.route)) {
        // The road has no checklist and no figure (R-ROAD-001).
        if (entry.gate === "road") continue;
        expect(entry.checklist.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
        expect(entry.checklist.every((item) => Number.isSafeInteger(item.weight) && item.weight >= 0)).toBe(true);
      }
    }
  });

  test("[R-JAPACITY-004] given a route whose weights do not add up to 100, when the content is checked, then it is refused", () => {
    const broken: Content = { ...content, route: { [UK]: { ...uk, checklist: uk.checklist.map((item) => (item.id === "degree" ? { ...item, weight: 7 } : item)) } } };
    expect(checkContent(broken).length).toBeGreaterThan(0);
    expect(checkContent(content)).toEqual([]);
  });

  const scenarios = Object.keys(content.scenario) as Id<"scenario">[];
  const routeStates: RouteStateName[] = ["unknown", "heard", "known", "applying", "granted", "refused", "departed"];
  const documents = Object.keys(content.document) as Id<"document">[];

  test.prop(
    [
      fc.constantFrom(...scenarios),
      fc.constantFrom(...routeStates),
      fc.integer({ min: 0, max: 2 }),
      fc.subarray(documents),
      fc.integer({ min: 0, max: 100 }),
      fc.string({ minLength: 1, maxLength: 6 }),
    ],
    { numRuns: 40 },
  )(
    "[R-JAPACITY-004] [R-JAPACITY-006] given any life, when japacity is worked out twice and from a copy, then it is the same whole number from 0 to 100 and reads only the state, the world and the content",
    (scenario, to, window, held, english, seed) => {
      const late = to === "applying" || to === "granted" || to === "departed";
      // The prologue life starts with every quality at its floor and its own steps to play; its figure is the prologue tests' business.
      fc.pre(scenario !== "scenario.prologue");
      // Past known, the life needs an offer from Northgate on its first answer; a seed that gives none is skipped.
      fc.pre(!late || offeredWith(seed, content, "school.northgate", content.scenario[scenario]!.qualities["quality.edu-grade"] ?? 0));
      const build = (): Game => {
        // The route is moved by the real route kind. Past known, the life is a ready one built from the scenario.
        const game = late ? readyLife(content, { from: scenario, seed, tuning: ALWAYS_GRANTED }) : start({ scenario, content, seed });
        finishPrologue(game);
        if (to === "heard") toHeard(game);
        if (to === "known" || to === "refused") toKnown(game);
        if (to === "refused") writeRoute(game, UK, "refused");
        if (to === "applying") toApplied(game);
        if (to === "granted" || to === "departed") toDecision(game);
        const effects: Effect[] = held.map((document) => ({ type: "document/grant", document }));
        if (effects.length > 0) carryOut(game, effects);
        setQuality(game, "quality.english", english);
        // A departed life takes no more commands (R-TURN-007), so it flies last.
        if (to === "departed") game.accept({ type: "route/depart", route: UK });
        expect(game.state.route[UK]?.state).toBe(to);
        return game;
      };
      const one = build();
      const two = build();
      expect(two.state).toEqual(one.state);

      const read = readOf(one, window);
      const first = japacity(read);
      expect(japacity(read)).toEqual(first);
      expect(japacity(readOf(two, window))).toEqual(first);
      const copy = JSON.parse(JSON.stringify({ state: read.state, world: read.world })) as Pick<ReadCtx, "state" | "world">;
      expect(japacity({ ...copy, content })).toEqual(first);

      if (first.percent !== null) {
        expect(Number.isSafeInteger(first.percent)).toBe(true);
        expect(first.percent).toBeGreaterThanOrEqual(0);
        expect(first.percent).toBeLessThanOrEqual(100);
      }
      const figure = routePercent(read, UK, judgeWith(read));
      if (figure !== null) expect(Number.isSafeInteger(figure) && figure >= 0 && figure <= 100).toBe(true);

      // Only the read is passed in, and of the state nothing hidden is touched.
      const touched = new Set<string>();
      const stateSpy = new Proxy(read.state, {
        get(target, key, receiver) {
          touched.add(`state.${String(key)}`);
          return Reflect.get(target, key, receiver) as unknown;
        },
      });
      const readSpy = new Proxy(
        { ...read, state: stateSpy },
        {
          get(target, key, receiver) {
            touched.add(String(key));
            return Reflect.get(target, key, receiver) as unknown;
          },
        },
      );
      expect(japacity(readSpy)).toEqual(first);
      expect([...touched].filter((key) => !key.startsWith("state.") && !["state", "world", "content"].includes(key))).toEqual([]);
      expect([...touched].filter((key) => ["state.seed", "state.draws"].includes(key))).toEqual([]);
    },
  );
});
