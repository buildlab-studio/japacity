import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../engine/check";
import type { ChapterEntry, Content, Id, ReadCtx, ReportLine, State } from "../engine/types";
import { writeRoute } from "../japacity/japacity.fixtures";
import { registry } from "../kinds";
import { slot, toHeard, toKnown } from "../route/route.journey";
import { miniContent } from "../testing/miniContent";
import { start } from "../testing/play";
import type { Game } from "../testing/play";
import { chapterKind } from "./chapter.logic";

const UK: Id<"route"> = "route.uk-masters";
const FEET: Id<"chapter"> = "chapter.find-your-feet";
const FILE: Id<"chapter"> = "chapter.build-the-file";
const ONE: Id<"chapter"> = "chapter.one";
const TWO: Id<"chapter"> = "chapter.two";
const cap = miniContent.tuning.turn.cap;

function chapterLines(lines: ReportLine[]): ReportLine[] {
  return lines.filter((line) => line.key.startsWith("line.chapter."));
}

function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

function done(game: Game, chapter: Id<"chapter">): boolean {
  return check(readOf(game), { type: "chapter/done", chapter }).met;
}

/** Tunde has a job and four years in it; only the route items of chapter 1 are left. */
function tunde(): Game {
  return start({ scenario: "scenario.tunde", content });
}

describe("the first chapter", () => {
  test("[R-CHAPTER-001] given a new character, when the state is built, then the current chapter is the first by order and none is done", () => {
    expect(start({ scenario: "scenario.ada", content }).state.chapter).toEqual({ current: FEET, done: [] });
    expect(content.chapter[FEET]?.order).toBe(1);
    expect(start({ content: miniContent }).state.chapter).toEqual({ current: ONE, done: [] });
  });

  test("[R-CHAPTER-001] given chapters listed out of order, when the state is built, then the lowest order is current", () => {
    const one = miniContent.chapter[ONE]!;
    const two = miniContent.chapter[TWO]!;
    const reversed: Content = { ...miniContent, chapter: { [TWO]: { ...two, order: 1 }, [ONE]: { ...one, order: 2 } } };
    expect(start({ content: reversed }).state.chapter).toEqual({ current: TWO, done: [] });
  });
});

describe("closing a chapter", () => {
  test("[R-CHAPTER-002] given every item of the current chapter met, when the turn ends, then it is done, the next by order opens and the bank is refilled", () => {
    const game = tunde();
    // The route is heard of by month 3 (R-ROUTE-003), but not yet looked into.
    for (let month = 0; month < 3; month += 1) {
      const result = game.endTurn();
      expect(result.events.filter((event) => event.type.startsWith("chapter/"))).toEqual([]);
    }
    expect(game.state.route[UK]?.state).toBe("heard");
    expect(game.state.chapter).toEqual({ current: FEET, done: [] });
    expect(game.state.turn.banked).toBe(cap - 3);

    const result = game.endTurn([slot("activity.look-into-route", UK)]);
    expect(game.state.route[UK]?.state).toBe("known");
    const types = result.events.map((event) => event.type);
    expect(result.events.find((event) => event.type === "chapter/closed")).toEqual({ type: "chapter/closed", chapter: FEET, next: FILE });
    // The close comes first, then the refill it pays for, then the report.
    expect(types.indexOf("chapter/closed")).toBeLessThan(types.indexOf("turn/refilled"));
    expect(types.indexOf("turn/refilled")).toBeLessThan(types.indexOf("turn/ended"));
    expect(game.state.chapter).toEqual({ current: FILE, done: [FEET] });
    expect(game.state.turn.banked).toBe(content.tuning.turn.cap);
  });

  test("[R-CHAPTER-002] given an item still unmet, when turns end, then the chapter stays open and the bank is not refilled", () => {
    const game = start({ scenario: "scenario.plain", content: miniContent });
    for (let month = 1; month <= 4; month += 1) {
      const result = game.endTurn();
      expect(chapterLines(result.lines)).toEqual([]);
      expect(game.state.turn.banked).toBe(cap - month);
    }
    expect(game.state.chapter).toEqual({ current: ONE, done: [] });
  });

  test("[R-CHAPTER-002] given the next chapter already met as well, when the turn ends, then only one chapter closes, and the next closes a turn later", () => {
    const game = start({ scenario: "scenario.worker", content: miniContent });
    // The worker has a job and a passport: both chapters' items hold from the start.
    expect(game.view().chapter.items).toEqual([{ id: "job", met: true }]);
    const first = game.endTurn();
    expect(first.events.filter((event) => event.type === "chapter/closed")).toEqual([{ type: "chapter/closed", chapter: ONE, next: TWO }]);
    expect(game.state.chapter).toEqual({ current: TWO, done: [ONE] });
    expect(game.view().chapter.items).toEqual([{ id: "passport", met: true }]);
    expect(game.state.turn.banked).toBe(cap);

    const second = game.endTurn();
    expect(second.events.filter((event) => event.type === "chapter/closed")).toEqual([{ type: "chapter/closed", chapter: TWO, next: null }]);
    expect(game.state.turn.banked).toBe(cap);
  });

  test("[R-CHAPTER-002] given a chapter closing, when its lines are read, then the close asks for attention and the opening is quiet, and both have words", () => {
    const game = tunde();
    toHeard(game);
    const result = game.endTurn([slot("activity.look-into-route", UK)]);
    expect(chapterLines(result.lines)).toEqual([
      { key: "line.chapter.closed", params: { chapter: FEET }, tone: "good", attention: true, counts: [] },
      { key: "line.chapter.opened", params: { chapter: FILE }, tone: "plain", attention: false, counts: [] },
    ]);
    expect(game.state.turn.report?.attention).toBe(true);
    for (const key of ["line.chapter.closed", "line.chapter.opened", `${FEET}.close`, `${FILE}.open`]) expect(text[key]).toBeTruthy();
  });
});

describe("done stays done", () => {
  test("[R-CHAPTER-003] given a chapter done, when its items come undone, then it stays done and chapter/done still holds", () => {
    const game = start({ scenario: "scenario.worker", content: miniContent });
    expect(done(game, ONE)).toBe(false);
    game.endTurn();
    expect(done(game, ONE)).toBe(true);
    game.accept({ type: "activity/quit" });
    expect(game.state.activity.job).toBeNull();
    game.endTurn();
    expect(game.state.chapter.done).toContain(ONE);
    expect(done(game, ONE)).toBe(true);
    expect(done(game, TWO)).toBe(true);
  });

  test("[R-CHAPTER-003] given chapter 1 done, when the route slips back to heard, then chapter 1 stays done and chapter 2 stays current", () => {
    const game = tunde();
    toKnown(game);
    // No event takes a route back along an arrow (R-ROUTE-001), so the slip is written into the state.
    writeRoute(game, UK, "heard");
    game.endTurn();
    expect(game.state.chapter).toEqual({ current: FILE, done: [FEET] });
    expect(done(game, FEET)).toBe(true);
    expect(done(game, FILE)).toBe(false);
  });
});

describe("the last chapter", () => {
  test("[R-CHAPTER-004] given the last chapter done, when the turn ends, then there is no current chapter, no opening line, and nothing more closes", () => {
    const game = start({ scenario: "scenario.worker", content: miniContent });
    game.endTurn();
    const last = game.endTurn();
    expect(chapterLines(last.lines)).toEqual([{ key: "line.chapter.closed", params: { chapter: TWO }, tone: "good", attention: true, counts: [] }]);
    expect(game.state.chapter).toEqual({ current: null, done: [ONE, TWO] });
    expect(game.view().chapter).toEqual({ current: null, items: [], done: [ONE, TWO] });
    const after = game.endTurn();
    expect(after.events.filter((event) => event.type.startsWith("chapter/"))).toEqual([]);
    expect(game.state.turn.banked).toBe(cap - 1);
  });

  test("[R-CHAPTER-004] given the real chapters, when they are put in order, then the send-off is last and nothing follows it", () => {
    const ordered = Object.values(content.chapter).sort((a: ChapterEntry, b: ChapterEntry) => a.order - b.order);
    expect(ordered.map((entry) => entry.id)).toEqual([FEET, FILE, "chapter.decision-day", "chapter.send-off"]);
  });
});

describe("the chapter in the view", () => {
  test("[R-CHAPTER-005] given a current chapter, when the view is read, then each item is shown met or not as the state is now", () => {
    const game = tunde();
    expect(game.view().chapter).toEqual({
      current: FEET,
      items: [
        { id: "job", met: true },
        { id: "pay", met: true },
        { id: "heard", met: false },
        { id: "known", met: false },
      ],
      done: [],
    });
    game.accept({ type: "activity/quit" });
    expect(game.view().chapter.items.slice(0, 2)).toEqual([
      { id: "job", met: false },
      { id: "pay", met: true },
    ]);
  });

  test("[R-CHAPTER-005] given no job, when the view is read, then the job item is not met", () => {
    expect(start({ scenario: "scenario.plain", content: miniContent }).view().chapter).toEqual({ current: ONE, items: [{ id: "job", met: false }], done: [] });
  });
});

describe("what must hold", () => {
  const good = start({ scenario: "scenario.worker", content: miniContent });
  good.endTurn();

  function broken(chapter: State["chapter"]): string[] {
    return chapterKind.invariants?.({ ...good.state, chapter }, miniContent) ?? [];
  }

  test("[R-CHAPTER-003] given a played state, when the invariants are checked, then they hold", () => {
    expect(broken(good.state.chapter)).toEqual([]);
    expect(registry().find((kind) => kind.kind === "chapter")).toBe(chapterKind);
  });

  test("[R-CHAPTER-003] given a broken chapter record, when the invariants are checked, then each fault is named", () => {
    expect(broken({ current: "chapter.nowhere", done: [] })).toEqual(["The current chapter chapter.nowhere is not in content."]);
    expect(broken({ current: ONE, done: [ONE] })).toEqual([`The current chapter ${ONE} is also done.`]);
    expect(broken({ current: TWO, done: ["chapter.gone"] })).toEqual(["The done chapter chapter.gone is not in content."]);
    expect(broken({ current: null, done: [ONE, ONE] })).toEqual([`A chapter is done more than once: ${ONE}, ${ONE}.`]);
  });
});
