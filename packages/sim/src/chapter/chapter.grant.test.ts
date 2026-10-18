// The chapters follow the grant: docs/rules/chapter.md R-CHAPTER-002 and R-CHAPTER-009.
// A life that leans to the master's and flies on the skilled worker's route still gets its send-off and its chapters abroad.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Id, SavedCommand, StepResult } from "../engine/types";
import { slot } from "../testing/route.journey";
import { start } from "../testing/play";
import type { Game } from "../testing/play";
import { closed } from "../testing/read";
import { replayedGame } from "../testing/recorded";
import { chapterCard, grantedRoute, leanRoute } from "./chapter.logic";
import { CARE_ROUTE, DECISION, FILE, LANDING, SEND_OFF, SKILLED, UK_PARTNER, UK_ROUTE } from "../testing/ids";

const cap = content.tuning.turn.cap;

type Accepted = Extract<StepResult, { ok: true }>;

/** Plays the recorded commands from `from` until one is accepted that leaves `until` true. Returns its result and the next index. */
function playTo(game: Game, commands: SavedCommand[], from: number, until: (game: Game) => boolean): { result: Accepted; next: number } {
  for (let index = from; index < commands.length; index += 1) {
    const { command, sender } = commands[index]!;
    const result = game.accept(command, sender);
    if (until(game)) return { result, next: index + 1 };
  }
  throw new Error("The recorded life never got there.");
}

const routeIs = (route: Id<"route">, state: string) => (game: Game) => game.state.route[route]?.state === state;

describe("a grant on a route with no file of its own", () => {
  test("[R-CHAPTER-002] [R-CHAPTER-009] given Tunde's abroad life leaning to the master's at decision day, when the skilled worker's visa is granted, then decision day closes on the grant's turn, the bank is refilled and the lean is now the skilled route", () => {
    // With the lives recorded under decision 0013, Tunde's abroad life is the one granted at decision day (month 19);
    // Ada's is granted while still building the file and flies with decision day open, read below.
    // A first pass finds the command whose turn brings the grant; the second stops just before it.
    const granting = playTo(replayedGame("tunde-abroad", content).game, replayedGame("tunde-abroad", content).commands, 0, routeIs(SKILLED, "granted")).next - 1;
    const { game, commands } = replayedGame("tunde-abroad", content);
    playTo(game, commands, 0, (now) => now.state.v === granting);
    // Up to the turn of the grant the life leans to the master's, at decision day.
    expect(commands[granting]?.command.type).toBe("turn/end");
    expect(leanRoute(game.state.route, content, game.state.chapter.chosen)).toBe(UK_ROUTE);
    expect(game.state.chapter.current).toBe(DECISION);
    const { result } = playTo(game, commands, granting, routeIs(SKILLED, "granted"));
    // R-CHAPTER-003: a close the grant made carries the route it rested on.
    expect(closed(result)).toEqual([{ type: "chapter/closed", chapter: DECISION, next: SEND_OFF, onGrant: SKILLED }]);
    expect(game.state.turn.banked).toBe(cap);
    expect(leanRoute(game.state.route, content, game.state.chapter.chosen)).toBe(SKILLED);
    expect(grantedRoute(game.state.route, content)).toBe(SKILLED);
    // The master's items of decision day were never met: the grant closed it.
    expect(game.state.route[UK_ROUTE]?.state).toBe("known");
  });

  test("[R-CHAPTER-002] [R-CHAPTER-006] [R-CHAPTER-009] given Tunde granted the skilled worker's visa, when he flies, then the send-off card is in the view, the month ends with the send-off closed and the next month abroad Landing is current", () => {
    // Decision 0013's re-recording: Tunde's abroad life reaches the send-off on the grant and flies from it.
    const { game, commands } = replayedGame("tunde-abroad", content);
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

  test("[R-CHAPTER-002] [R-CHAPTER-006] [R-CHAPTER-009] given Ada's abroad life flying with decision day still open, when she flies, then the send-off card shows from the flight, and the month's end closes decision day and the send-off in order, each its own close with its own refill", () => {
    // Decision 0013's re-recording: Ada's abroad life is granted while building the file (month 40) and flies that month.
    const { game, commands } = replayedGame("ada-abroad", content);
    const flight = playTo(game, commands, 0, routeIs(SKILLED, "departed"));
    // The grant's turn closed the file: one close a turn until the flight.
    expect(game.state.chapter).toMatchObject({ current: DECISION, done: ["chapter.find-your-feet", FILE] });
    expect(game.view().chapter).toMatchObject({ current: DECISION, closes: true, next: SEND_OFF });
    expect(game.view().card).toMatchObject({ kind: "send-off", route: SKILLED, chapter: SEND_OFF });
    const month = game.state.turn.month;
    const { result } = playTo(game, commands, flight.next, (now) => now.state.turn.month > month);
    // R-CHAPTER-003: decision day closed on the flight's grant says so; the send-off's own item closed it.
    expect(closed(result)).toEqual([
      { type: "chapter/closed", chapter: DECISION, next: SEND_OFF, onGrant: SKILLED },
      { type: "chapter/closed", chapter: SEND_OFF, next: LANDING },
    ]);
    const types = result.events.map((event) => event.type).filter((type) => type === "chapter/closed" || type === "turn/refilled");
    expect(types).toEqual(["chapter/closed", "turn/refilled", "chapter/closed", "turn/refilled"]);
    expect(result.lines.filter((line) => line.key === "line.chapter.closed").map((line) => line.params.chapter)).toEqual([DECISION, SEND_OFF]);
    expect(game.state.chapter.current).toBe(LANDING);
  });
});

describe("the plan follows the grant", () => {
  test("[R-CHAPTER-009] given Ada's abroad life leaning to the master's, when the skilled worker's visa is granted, then the view's plan names the skilled route and its ways carry it, though it has no file of its own", () => {
    const { game, commands } = replayedGame("ada-abroad", content);
    playTo(game, commands, 0, routeIs(SKILLED, "known"));
    expect(game.view().plan.route).toBe(UK_ROUTE);
    expect(game.view().plan.ways.map((way) => way.route)).not.toContain(SKILLED);
    playTo(game, commands, game.state.v, routeIs(SKILLED, "granted"));
    const { plan } = game.view();
    expect(plan.route).toBe(SKILLED);
    expect(plan.ways.map((way) => way.route)).toContain(SKILLED);
    expect(plan.ways.find((way) => way.route === SKILLED)?.percent).toBe(game.view().routes.find((route) => route.id === SKILLED)?.percent);
    expect(Object.values(content.chapter).some((entry) => entry.route === SKILLED)).toBe(false);
  });
});

describe("the flight's report has one card", () => {
  test("[R-CHAPTER-006] [R-SHARE-001] given Ada's flight turn closing decision day and the send-off in one report, when the view is read in the first month abroad, then no chapter card is due for decision day", () => {
    // Decision 0013's re-recording: Ada's abroad life is the one whose flight turn closes both.
    const { game, commands } = replayedGame("ada-abroad", content);
    const flight = playTo(game, commands, 0, routeIs(SKILLED, "departed"));
    const month = game.state.turn.month;
    playTo(game, commands, flight.next, (now) => now.state.turn.month > month);
    const closes = game.state.turn.report?.lines.filter((line) => line.key === "line.chapter.closed").map((line) => line.params.chapter);
    expect(closes).toEqual([DECISION, SEND_OFF]);
    expect(chapterCard({ state: game.state, world: game.world(), content })).toBeNull();
    expect(game.view().card?.kind).not.toBe("chapter");
  });
});

describe("a grant on a route with a file of its own", () => {
  /** Ada's careful life at decision day on the master's, the month before her grant. */
  function atDecision(): Game {
    const { game, commands } = replayedGame("ada-careful", content);
    playTo(game, commands, 0, (now) => now.state.chapter.current === DECISION);
    return game;
  }

  /** A grant takes years of play; the route's state is written as the decision would leave it. */
  function grantCare(game: Game): void {
    game.state = { ...game.state, route: { ...game.state.route, [CARE_ROUTE]: { ...game.state.route[CARE_ROUTE]!, state: "granted" } } };
  }

  test("[R-CHAPTER-009] given a life leaning to the master's at decision day, when care work is granted, then the view's items are care's decision day, and the month's end closes care's decision day in its place", () => {
    const game = atDecision();
    expect(leanRoute(game.state.route, content)).toBe(UK_ROUTE);
    expect(game.view().chapter.items.map((item) => item.id)).toEqual(["deposit", "held", "tb", "applied", "granted"]);
    grantCare(game);
    expect(leanRoute(game.state.route, content)).toBe(CARE_ROUTE);
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
    for (let month = 0; month < 8 && game.state.route[UK_ROUTE]?.state !== "heard"; month += 1) game.endTurn();
    game.endTurn([slot("activity.look-into-route", UK_ROUTE)]);
    expect(game.state.chapter.current).toBe(FILE);
    grantCare(game);
    const result = game.endTurn();
    // R-CHAPTER-003: the grant closed the file, and the close says so.
    expect(closed(result)).toEqual([{ type: "chapter/closed", chapter: "chapter.build-the-file-care", next: "chapter.decision-day-care", onGrant: CARE_ROUTE }]);
    expect(game.view().chapter.items.map((item) => item.id)).toEqual(["tb", "police", "applied", "granted"]);
  });
});

describe("the routes a grant leads by", () => {
  test("[R-CHAPTER-002] [R-CHAPTER-009] given the real content, when the routes a grant leads by are listed, then they are the routes whose flight closes the send-off: every route with a country, a partner's and a dependant's among them, never the road", () => {
    const item = content.chapter[SEND_OFF]!.items[0]!.requirement;
    const flown = item.type === "any" ? item.of.flatMap((each) => (each.type === "route/state" ? [each.route] : [])) : [];
    const leading = Object.keys(content.route).filter((id) => {
      const routes = { [id]: { state: "granted" } } as unknown as Parameters<typeof grantedRoute>[0];
      return grantedRoute(routes, content) === id;
    });
    expect(leading.sort()).toEqual([...flown].sort());
    expect(leading).toContain(SKILLED);
    expect(leading).toEqual(expect.arrayContaining([UK_PARTNER, "route.ca-spouse", "route.uk-dependant", "route.ca-accompany"]));
    expect(leading).not.toContain("route.road");
  });
});

describe("a partner's route", () => {
  test("[R-CHAPTER-002] [R-CHAPTER-006] [R-CHAPTER-009] given a life in the master's file granted the partner visa, when the grant's turn ends, the life flies on it and the month ends, then the file closes, the send-off card shows from the flight, and decision day and the send-off close on the flight's turn", () => {
    const game = start({ scenario: "scenario.tunde", content });
    for (let month = 0; month < 8 && game.state.route[UK_ROUTE]?.state !== "heard"; month += 1) game.endTurn();
    game.endTurn([slot("activity.look-into-route", UK_ROUTE)]);
    expect(game.state.chapter.current).toBe(FILE);
    // A partner's grant takes a bond and a decision; the route's state is written as the decision would leave it.
    game.state = { ...game.state, route: { ...game.state.route, [UK_PARTNER]: { ...game.state.route[UK_PARTNER]!, state: "granted" } } };
    // R-CHAPTER-003: the closes the grant made carry the route they rested on.
    expect(closed(game.endTurn())).toEqual([{ type: "chapter/closed", chapter: FILE, next: DECISION, onGrant: UK_PARTNER }]);
    expect(leanRoute(game.state.route, content)).toBe(UK_PARTNER);
    expect(game.view().plan.route).toBe(UK_PARTNER);
    game.accept({ type: "route/depart", route: UK_PARTNER });
    expect(game.state.place).toMatchObject({ where: "abroad", country: "country.uk" });
    expect(game.view().card).toMatchObject({ kind: "send-off", route: UK_PARTNER, chapter: SEND_OFF });
    const result = game.endTurn();
    expect(closed(result)).toEqual([
      { type: "chapter/closed", chapter: DECISION, next: SEND_OFF, onGrant: UK_PARTNER },
      { type: "chapter/closed", chapter: SEND_OFF, next: LANDING },
    ]);
    expect(game.state.chapter.current).toBe(LANDING);
  });
});
