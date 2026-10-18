// A grant withdrawn before the flight reopens the chapters it closed: chapter:done-chapter-stays-done and chapter:met-items-close-the-chapter,
// person:joint-collapses-with-bond. A dependant's grant not yet used is voided
// when the joint collapses; the chapters that grant closed come back, and a flight makes such closes final.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Id } from "../engine/types";
import { BOND, joint } from "../testing/person.journey";
import { slot } from "../testing/route.journey";
import { start } from "../testing/play";
import type { Game } from "../testing/play";
import { closed, eventsOf } from "../testing/read";
import { grantedRoute, leanRoute } from "./chapter.logic";
import { CARE_ROUTE, DECISION, FEET, FILE, LANDING, SEND_OFF, SKILLED, UK_DEPENDANT, UK_PARTNER, UK_ROUTE } from "../testing/ids";

const CARE_FILE: Id<"chapter"> = "chapter.build-the-file-care";

/** Tunde with the master's heard of, the month he looks into it: the first chapter closes on its items at this month's end. */
function aboutToLookIntoUk(): Game {
  const game = start({ scenario: "scenario.tunde", content });
  for (let month = 0; month < 8 && game.state.route[UK_ROUTE]?.state !== "heard"; month += 1) game.endTurn();
  expect(game.state.chapter.current).toBe(FEET);
  return game;
}

/** Tunde leaning to the master's, in the master's file. */
function inTheFile(): Game {
  const game = aboutToLookIntoUk();
  game.endTurn([slot("activity.look-into-route", UK_ROUTE)]);
  expect(game.state.chapter.current).toBe(FILE);
  expect(leanRoute(game.state.route, content, game.state.chapter.chosen)).toBe(UK_ROUTE);
  return game;
}

/**
 * A dependant's visa behind a partner's skilled worker grant, granted and not yet used. A grant takes a bond and a
 * decision; the joint and the route's state are written as those would leave them.
 */
function grantDependant(game: Game): void {
  joint(game, SKILLED, "them", { stage: "married" });
  game.state = { ...game.state, route: { ...game.state.route, [UK_DEPENDANT]: { ...game.state.route[UK_DEPENDANT]!, state: "granted" } } };
}

function grant(game: Game, route: Id<"route">): void {
  game.state = { ...game.state, route: { ...game.state.route, [route]: { ...game.state.route[route]!, state: "granted" } } };
}

describe("a dependant grant withdrawn before the flight", () => {
  test("[chapter:done-chapter-stays-done] [chapter:met-items-close-the-chapter] [person:joint-collapses-with-bond] given a life leaning to the master's whose dependant grant closed the file and decision day, when the joint collapses and the month ends, then both reopen, the file is current under the lean again, no refill is taken back, and the report says the visa is gone", () => {
    const game = inTheFile();
    grantDependant(game);
    expect(closed(game.endTurn())).toEqual([{ type: "chapter/closed", chapter: FILE, next: DECISION, onGrant: UK_DEPENDANT }]);
    expect(closed(game.endTurn())).toEqual([{ type: "chapter/closed", chapter: DECISION, next: SEND_OFF, onGrant: UK_DEPENDANT }]);
    expect(game.state.chapter).toMatchObject({
      current: SEND_OFF,
      done: [FEET, FILE, DECISION],
      byGrant: [
        { chapter: FILE, route: UK_DEPENDANT },
        { chapter: DECISION, route: UK_DEPENDANT },
      ],
    });
    expect(game.view().plan.route).toBe(UK_DEPENDANT);

    // person:joint-collapses-with-bond: the bond ends, and the grant not yet used is voided back to known.
    game.accept({ type: "people/end", bond: BOND });
    expect(game.state.route[UK_DEPENDANT]?.state).toBe("known");
    expect(grantedRoute(game.state.route, content)).toBeNull();
    const banked = game.state.turn.banked;
    const result = game.endTurn();

    expect(eventsOf(result, "chapter/reopened")).toEqual([{ type: "chapter/reopened", chapters: [FILE, DECISION], current: FILE }]);
    expect(closed(result)).toEqual([]);
    expect(game.state.chapter.current).toBe(FILE);
    expect(game.state.chapter.done).toEqual([FEET]);
    expect(game.state.chapter.byGrant).toBeUndefined();
    // No refill is taken back, and none is paid: the month spent its one turn.
    expect(eventsOf(result, "turn/refilled")).toEqual([]);
    expect(game.state.turn.banked).toBe(banked - 1);
    expect(result.lines).toContainEqual(expect.objectContaining({ key: "line.chapter.reopened", params: { chapter: FILE }, tone: "bad", attention: true }));
    // The plan names the lean again, and the Japa app's checklist is the file's (chapter:items-are-live-requirements, chapter:chapters-follow-lean-route).
    const view = game.view();
    expect(view.plan.route).toBe(UK_ROUTE);
    expect(view.chapter).toMatchObject({ current: FILE, done: [FEET], closes: false, next: DECISION });
    expect(view.chapter.items.map((item) => item.id)).toEqual(content.chapter[FILE]!.items.map((item) => item.id));
    expect(content.chapter[FILE]!.items.every((item) => (text[`${FILE}.item.${item.id}`] ?? "") !== "")).toBe(true);

    // Reopened, the file is a chapter like any other: the next month keeps it open on its own items.
    expect(closed(game.endTurn())).toEqual([]);
    expect(game.state.chapter.current).toBe(FILE);
  });

  test("[chapter:done-chapter-stays-done] [chapter:chapters-follow-lean-route] given the nurse in the care file whose dependant grant closed it as the master's file, when the grant is withdrawn, then the chapter that comes back is the care file, the variant standing in under the lean as it is now", () => {
    const game = start({ scenario: "scenario.ngozi", content });
    for (let month = 0; month < 8 && game.state.route[CARE_ROUTE]?.state !== "heard"; month += 1) game.endTurn();
    game.endTurn([slot("activity.look-into-route", CARE_ROUTE)]);
    expect(game.state.chapter.current).toBe(CARE_FILE);
    grantDependant(game);
    // Under the grant the file is judged as the master's base, the grant's own stand-in (chapter:chapters-follow-lean-route).
    expect(closed(game.endTurn())).toEqual([{ type: "chapter/closed", chapter: FILE, next: DECISION, onGrant: UK_DEPENDANT }]);
    game.accept({ type: "people/end", bond: BOND });
    const result = game.endTurn();
    expect(eventsOf(result, "chapter/reopened")).toEqual([{ type: "chapter/reopened", chapters: [FILE], current: CARE_FILE }]);
    expect(game.view().chapter.items.map((item) => item.id)).toEqual(content.chapter[CARE_FILE]!.items.map((item) => item.id));
    expect(game.view().plan.route).toBe(CARE_ROUTE);
  });

  test("[chapter:done-chapter-stays-done] [chapter:met-items-close-the-chapter] given a dependant grant standing when the first chapter's own items close it, when the grant is withdrawn, then that close carries no onGrant and stays done, and only the file the grant closed reopens", () => {
    const game = aboutToLookIntoUk();
    grantDependant(game);
    const looked = game.endTurn([slot("activity.look-into-route", UK_ROUTE)]);
    // Earned by the items: the grant stood too, but the close does not rest on it.
    expect(closed(looked)).toEqual([{ type: "chapter/closed", chapter: FEET, next: FILE }]);
    expect(game.state.chapter.byGrant).toBeUndefined();
    expect(closed(game.endTurn())).toEqual([{ type: "chapter/closed", chapter: FILE, next: DECISION, onGrant: UK_DEPENDANT }]);
    game.accept({ type: "people/end", bond: BOND });
    const result = game.endTurn();
    expect(eventsOf(result, "chapter/reopened")).toEqual([{ type: "chapter/reopened", chapters: [FILE], current: FILE }]);
    expect(game.state.chapter).toMatchObject({ current: FILE, done: [FEET] });
  });

  test("[chapter:done-chapter-stays-done] given closes earned by the items alone and no grant, when a later month ends, then nothing reopens and nothing is remembered", () => {
    const game = inTheFile();
    const result = game.endTurn();
    expect(eventsOf(result, "chapter/reopened")).toEqual([]);
    expect(game.state.chapter).toMatchObject({ current: FILE, done: [FEET] });
    expect(game.state.chapter.byGrant).toBeUndefined();
  });
});

describe("a flight makes the closes final", () => {
  test("[chapter:done-chapter-stays-done] [chapter:met-items-close-the-chapter] [person:joint-collapses-with-bond] given a life whose partner grant closed the file and who flew on it, when a later dependant grant is withdrawn abroad, then every chapter stays done and the closes on the grant were sealed at the flight", () => {
    const game = inTheFile();
    grant(game, UK_PARTNER);
    expect(closed(game.endTurn())).toEqual([{ type: "chapter/closed", chapter: FILE, next: DECISION, onGrant: UK_PARTNER }]);
    expect(game.state.chapter.byGrant).toEqual([{ chapter: FILE, route: UK_PARTNER }]);
    game.accept({ type: "route/depart", route: UK_PARTNER });
    const flight = game.endTurn();
    expect(closed(flight)).toEqual([
      { type: "chapter/closed", chapter: DECISION, next: SEND_OFF, onGrant: UK_PARTNER },
      { type: "chapter/closed", chapter: SEND_OFF, next: LANDING },
    ]);
    expect(eventsOf(flight, "chapter/sealed")).toEqual([{ type: "chapter/sealed", chapters: [FILE, DECISION] }]);
    expect(game.state.chapter.byGrant).toBeUndefined();
    const after = game.state.chapter;

    grantDependant(game);
    game.accept({ type: "people/end", bond: BOND });
    expect(game.state.route[UK_DEPENDANT]?.state).toBe("known");
    const result = game.endTurn();
    expect(eventsOf(result, "chapter/reopened")).toEqual([]);
    expect(game.state.chapter.done).toEqual(after.done);
    expect(game.state.chapter.done).toEqual(expect.arrayContaining([FILE, DECISION, SEND_OFF]));
  });

  test("[chapter:done-chapter-stays-done] [person:joint-collapses-with-bond] given a dependant grant that closed the file, when the life flies on it, then the closes are sealed, and a withdrawal of the flown route changes nothing", () => {
    const game = inTheFile();
    grantDependant(game);
    game.endTurn();
    expect(game.state.chapter.byGrant).toEqual([{ chapter: FILE, route: UK_DEPENDANT }]);
    game.accept({ type: "route/depart", route: UK_DEPENDANT });
    game.endTurn();
    expect(game.state.chapter).toMatchObject({ current: LANDING, done: [FEET, FILE, DECISION, SEND_OFF] });
    expect(game.state.chapter.byGrant).toBeUndefined();
    game.accept({ type: "people/end", bond: BOND });
    expect(game.state.route[UK_DEPENDANT]?.state).toBe("departed");
    game.endTurn();
    expect(game.state.chapter).toMatchObject({ current: LANDING, done: [FEET, FILE, DECISION, SEND_OFF] });
  });
});
