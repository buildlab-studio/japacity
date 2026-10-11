// The chapters follow the grant: docs/rules/chapter.md R-CHAPTER-002 and R-CHAPTER-009.
// A life that leans to the master's and flies on the skilled worker's route still gets its send-off and its chapters abroad.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Id, SavedCommand, StepResult } from "../engine/types";
import { lifeSaves } from "../goldens/lives.data";
import { slot } from "../route/route.journey";
import { start } from "../testing/play";
import type { Game } from "../testing/play";
import { grantedRoute, leanRoute } from "./chapter.logic";

const UK: Id<"route"> = "route.uk-masters";
const SKILLED: Id<"route"> = "route.uk-skilled";
const CARE: Id<"route"> = "route.uk-care";
const FILE: Id<"chapter"> = "chapter.build-the-file";
const DECISION: Id<"chapter"> = "chapter.decision-day";
const SEND_OFF: Id<"chapter"> = "chapter.send-off";
const LANDING: Id<"chapter"> = "chapter.landing";
const cap = content.tuning.turn.cap;

type Accepted = Extract<StepResult, { ok: true }>;

/** A recorded life, replayed command by command through the real content. */
function recorded(name: string): { game: Game; commands: SavedCommand[] } {
  const save = lifeSaves[name];
  if (save === undefined) throw new Error(`The ${name} life is not recorded.`);
  return { game: start({ scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed, content }), commands: save.commands };
}

/** Plays the recorded commands from `from` until one is accepted that leaves `until` true. Returns its result and the next index. */
function playTo(game: Game, commands: SavedCommand[], from: number, until: (game: Game) => boolean): { result: Accepted; next: number } {
  for (let index = from; index < commands.length; index += 1) {
    const { command, sender } = commands[index]!;
    const result = game.accept(command, sender);
    if (until(game)) return { result, next: index + 1 };
  }
  throw new Error("The recorded life never got there.");
}

function closed(result: { events: { type: string }[] }): unknown[] {
  return result.events.filter((event) => event.type === "chapter/closed");
}

const routeIs = (route: Id<"route">, state: string) => (game: Game) => game.state.route[route]?.state === state;

describe("a grant on a route with no file of its own", () => {
  test("[R-CHAPTER-002] [R-CHAPTER-009] given Ada's abroad life leaning to the master's at decision day, when the skilled worker's visa is granted, then decision day closes on the grant's turn, the bank is refilled and the lean is now the skilled route", () => {
    // A first pass finds the command whose turn brings the grant; the second stops just before it.
    const granting = playTo(recorded("ada-abroad").game, recorded("ada-abroad").commands, 0, routeIs(SKILLED, "granted")).next - 1;
    const { game, commands } = recorded("ada-abroad");
    playTo(game, commands, 0, (now) => now.state.v === granting);
    // Up to the turn of the grant the life leans to the master's, at decision day.
    expect(commands[granting]?.command.type).toBe("turn/end");
    expect(leanRoute(game.state.route, content, game.state.chapter.chosen)).toBe(UK);
    expect(game.state.chapter.current).toBe(DECISION);
    const { result } = playTo(game, commands, granting, routeIs(SKILLED, "granted"));
    expect(closed(result)).toEqual([{ type: "chapter/closed", chapter: DECISION, next: SEND_OFF }]);
    expect(game.state.turn.banked).toBe(cap);
    expect(leanRoute(game.state.route, content, game.state.chapter.chosen)).toBe(SKILLED);
    expect(grantedRoute(game.state.route, content)).toBe(SKILLED);
    // The master's items of decision day were never met: the grant closed it.
    expect(game.state.route[UK]?.state).toBe("known");
  });

  test("[R-CHAPTER-002] [R-CHAPTER-006] [R-CHAPTER-009] given Ada granted the skilled worker's visa, when she flies, then the send-off card is in the view, the month ends with the send-off closed and the next month abroad Landing is current", () => {
    const { game, commands } = recorded("ada-abroad");
    const flight = playTo(game, commands, 0, routeIs(SKILLED, "departed"));
    expect(game.state.chapter.current).toBe(SEND_OFF);
    expect(game.view().card).toMatchObject({ kind: "send-off", route: SKILLED, chapter: SEND_OFF, months: game.state.turn.month });
    expect(game.view().chapter).toMatchObject({ current: SEND_OFF, items: [{ id: "departed", met: true }], closes: true, next: LANDING });
    const month = game.state.turn.month;
    const { result } = playTo(game, commands, flight.next, (now) => now.state.turn.month > month);
    expect(closed(result)).toEqual([{ type: "chapter/closed", chapter: SEND_OFF, next: LANDING }]);
    expect(game.state.chapter.current).toBe(LANDING);
    expect(game.view().chapter.items.map((item) => item.id)).toEqual(content.chapter[LANDING]!.items.map((item) => item.id));
    expect(game.view().card?.kind).not.toBe("send-off");
  });

  test("[R-CHAPTER-002] [R-CHAPTER-006] [R-CHAPTER-009] given Tunde's abroad life flying with decision day still open, when he flies, then the send-off card shows from the flight, and the month's end closes decision day and the send-off in order, each its own close with its own refill", () => {
    const { game, commands } = recorded("tunde-abroad");
    const flight = playTo(game, commands, 0, routeIs(SKILLED, "departed"));
    // The grant's turn closed the file: one close a turn until the flight.
    expect(game.state.chapter).toMatchObject({ current: DECISION, done: ["chapter.find-your-feet", FILE] });
    expect(game.view().chapter).toMatchObject({ current: DECISION, closes: true, next: SEND_OFF });
    expect(game.view().card).toMatchObject({ kind: "send-off", route: SKILLED, chapter: SEND_OFF });
    const month = game.state.turn.month;
    const { result } = playTo(game, commands, flight.next, (now) => now.state.turn.month > month);
    expect(closed(result)).toEqual([
      { type: "chapter/closed", chapter: DECISION, next: SEND_OFF },
      { type: "chapter/closed", chapter: SEND_OFF, next: LANDING },
    ]);
    const types = result.events.map((event) => event.type).filter((type) => type === "chapter/closed" || type === "turn/refilled");
    expect(types).toEqual(["chapter/closed", "turn/refilled", "chapter/closed", "turn/refilled"]);
    expect(result.lines.filter((line) => line.key === "line.chapter.closed").map((line) => line.params.chapter)).toEqual([DECISION, SEND_OFF]);
    expect(game.state.chapter.current).toBe(LANDING);
  });
});

describe("a grant on a route with a file of its own", () => {
  /** Ada's careful life at decision day on the master's, the month before her grant. */
  function atDecision(): Game {
    const { game, commands } = recorded("ada-careful");
    playTo(game, commands, 0, (now) => now.state.chapter.current === DECISION);
    return game;
  }

  /** A grant takes years of play; the route's state is written as the decision would leave it. */
  function grantCare(game: Game): void {
    game.state = { ...game.state, route: { ...game.state.route, [CARE]: { ...game.state.route[CARE]!, state: "granted" } } };
  }

  test("[R-CHAPTER-009] given a life leaning to the master's at decision day, when care work is granted, then the view's items are care's decision day, and the month's end closes care's decision day in its place", () => {
    const game = atDecision();
    expect(leanRoute(game.state.route, content)).toBe(UK);
    expect(game.view().chapter.items.map((item) => item.id)).toEqual(["deposit", "held", "tb", "applied", "granted"]);
    grantCare(game);
    expect(leanRoute(game.state.route, content)).toBe(CARE);
    expect(game.view().chapter).toMatchObject({ current: DECISION, closes: true, next: SEND_OFF });
    expect(game.view().chapter.items.map((item) => item.id)).toEqual(["tb", "police", "applied", "granted"]);
    expect(game.view().chapter.items.find((item) => item.id === "granted")?.met).toBe(true);
    const result = game.endTurn();
    expect(closed(result)).toEqual([{ type: "chapter/closed", chapter: "chapter.decision-day-care", next: SEND_OFF }]);
    expect(game.state.chapter.done).toContain("chapter.decision-day-care");
    expect(game.state.chapter.done).not.toContain(DECISION);
  });

  test("[R-CHAPTER-009] given a life in the master's file, when care work is granted, then the file closes as care's and care's decision day follows, whatever the lean was", () => {
    const game = start({ scenario: "scenario.tunde", content });
    for (let month = 0; month < 8 && game.state.route[UK]?.state !== "heard"; month += 1) game.endTurn();
    game.endTurn([slot("activity.look-into-route", UK)]);
    expect(game.state.chapter.current).toBe(FILE);
    grantCare(game);
    const result = game.endTurn();
    expect(closed(result)).toEqual([{ type: "chapter/closed", chapter: "chapter.build-the-file-care", next: "chapter.decision-day-care" }]);
    expect(game.view().chapter.items.map((item) => item.id)).toEqual(["tb", "police", "applied", "granted"]);
  });
});

describe("the own routes", () => {
  test("[R-CHAPTER-009] given the real content, when the routes a grant leads by are listed, then they are the routes whose flight closes the send-off: every way of the player's own effort, never the road, a partner's or a dependant's", () => {
    const item = content.chapter[SEND_OFF]!.items[0]!.requirement;
    const flown = item.type === "any" ? item.of.flatMap((each) => (each.type === "route/state" ? [each.route] : [])) : [];
    const leading = Object.keys(content.route).filter((id) => {
      const routes = { [id]: { state: "granted" } } as unknown as Parameters<typeof grantedRoute>[0];
      return grantedRoute(routes, content) === id;
    });
    expect(leading.sort()).toEqual([...flown].sort());
    expect(leading).toContain(SKILLED);
    expect(leading).not.toContain("route.road");
  });
});
