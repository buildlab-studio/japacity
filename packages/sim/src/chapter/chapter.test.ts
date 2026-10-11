import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../engine/check";
import { newState } from "../engine/state";
import { step } from "../engine/step";
import type { ChapterEntry, Content, Id, ReadCtx, ReportLine, Sender, State } from "../engine/types";
import { lifeSaves } from "../goldens/lives.data";
import { writeRoute } from "../japacity/japacity.fixtures";
import { registry } from "../kinds";
import { slot, toHeard, toKnown } from "../route/route.journey";
import { miniContent } from "../testing/miniContent";
import { start } from "../testing/play";
import type { Game, Loose } from "../testing/play";
import { standInWorld } from "../world/standIn";
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

describe("a chapter that one item closes", () => {
  const DECISION: Id<"chapter"> = "chapter.decision-day";
  const HELD = content.chapter[DECISION]!.items.find((item) => item.id === "held")!.requirement;
  const save = lifeSaves["tunde-borrower"]!;

  /**
   * Replays the tunde-borrower golden up to the turn that brings the grant,
   * then, while the visa is pending, takes every banked pound, naira and
   * dollar out to cash and hands back any held funds, so the `held` item
   * lapses; then plays that turn. Returns the turn's result and the state.
   */
  function grantWithHeldLapsed(used: Content) {
    const worldAt = (tick: number) => standInWorld(save.worldSeed, tick, used);
    let state = newState(save.scenario, save.seed, used);
    const send = (command: Loose, tick: number, sender: Sender = "player") => {
      const result = step(state, { ...command, basedOn: state.v }, worldAt(tick), used, sender);
      if (!result.ok) throw new Error(`${command.type} was rejected with ${result.code}: ${result.detail}`);
      state = result.state;
      return result;
    };
    // The first pass finds the command whose turn brings the grant.
    const granting = save.commands.findIndex(({ command, tick, sender }) => {
      send(command, tick, sender);
      return state.route[UK]?.state === "granted";
    });
    expect(granting).toBeGreaterThan(0);
    state = newState(save.scenario, save.seed, used);
    for (const [index, { command, tick, sender }] of save.commands.entries()) {
      if (index === granting) {
        for (const owed of Object.values(state.obligation.items)) {
          if (used.obligation[owed.entry]?.type === "held-funds") send({ type: "obligation/pay", obligation: owed.id, amount: owed.outstanding }, tick);
        }
        for (const currency of ["NGN", "GBP", "USD"] as const) {
          const { bank } = state.wallet.pockets[currency];
          if (bank > 0) send({ type: "wallet/move", currency, amount: bank, to: "cash" }, tick);
        }
        expect(check({ state, world: worldAt(tick), content: used }, HELD).met).toBe(false);
        // The granting month is ended with nothing planned: a recorded pick that needed the funds just moved out would refuse the whole turn.
        const result = send(command.type === "turn/end" ? { type: "turn/end", slots: [] } : command, tick, sender);
        return { result, state, world: worldAt(tick) };
      }
      send(command, tick, sender);
    }
    throw new Error("The golden never reaches its grant.");
  }

  test("[R-CHAPTER-002] given the tunde-borrower golden with its funds no longer held while the visa is pending, when the grant comes, then decision day closes on `granted` alone", () => {
    expect(content.chapter[DECISION]?.closesOn).toBe("granted");
    const { result, state, world } = grantWithHeldLapsed(content);
    expect(state.route[UK]?.state).toBe("granted");
    expect(check({ state, world, content }, HELD).met).toBe(false);
    expect(result.events).toContainEqual({ type: "chapter/closed", chapter: DECISION, next: "chapter.send-off" });
    expect(state.chapter.current).toBe("chapter.send-off");
  });

  // a grant finishes the chapters up to decision day
  // whatever their items say, so with no closesOn the grant still closes it. It stayed open before. The closesOn
  // item alone is tested below on chapters no grant reaches.
  test("[R-CHAPTER-002] given the same file with no closesOn on decision day, when the grant comes, then the grant closes it all the same, though not every item holds", () => {
    const open: ChapterEntry = { ...content.chapter[DECISION]! };
    delete open.closesOn;
    const without: Content = { ...content, chapter: { ...content.chapter, [DECISION]: open } };
    const { result, state, world } = grantWithHeldLapsed(without);
    expect(state.route[UK]?.state).toBe("granted");
    expect(check({ state, world, content: without }, HELD).met).toBe(false);
    expect(result.events).toContainEqual({ type: "chapter/closed", chapter: DECISION, next: "chapter.send-off" });
    expect(state.chapter.current).toBe("chapter.send-off");
  });

  /** The mini content's first chapter with a second item that never holds, closed by its job alone or not. */
  function oneItemCloses(closesOn: string | null): Content {
    const one: ChapterEntry = {
      ...miniContent.chapter[ONE]!,
      items: [...miniContent.chapter[ONE]!.items, { id: "never", requirement: { type: "chapter/done", chapter: TWO } }],
      ...(closesOn === null ? {} : { closesOn }),
    };
    return { ...miniContent, chapter: { ...miniContent.chapter, [ONE]: one } };
  }

  test("[R-CHAPTER-002] given a chapter whose closesOn item is met and another item unmet, with no grant anywhere, when the turn ends, then it closes on that item alone; with no closesOn it stays open", () => {
    const alone = start({ scenario: "scenario.worker", content: oneItemCloses("job") });
    expect(alone.endTurn().events.filter((event) => event.type === "chapter/closed")).toEqual([{ type: "chapter/closed", chapter: ONE, next: TWO }]);
    const every = start({ scenario: "scenario.worker", content: oneItemCloses(null) });
    expect(every.view().chapter.items).toEqual([
      { id: "job", met: true },
      { id: "never", met: false },
    ]);
    expect(every.endTurn().events.filter((event) => event.type === "chapter/closed")).toEqual([]);
    expect(every.state.chapter.current).toBe(ONE);
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
    // with no chapter left, nothing closes and nothing follows.
    expect(game.view().chapter).toEqual({ current: null, items: [], done: [ONE, TWO], closes: false, next: null });
    const after = game.endTurn();
    expect(after.events.filter((event) => event.type.startsWith("chapter/"))).toEqual([]);
    expect(game.state.turn.banked).toBe(cap - 1);
  });

  test("[R-CHAPTER-004] given the real chapters, when they are put in order, then the main journey runs from finding your feet to the send-off and on to landing and secure, and nothing follows the last", () => {
    const ordered = Object.values(content.chapter).sort((a: ChapterEntry, b: ChapterEntry) => a.order - b.order);
    // R-CHAPTER-009: the variants stand in for a base in its turn, so the journey is the bases'.
    const journey = ordered.filter((entry) => entry.variantOf === undefined);
    expect(journey.map((entry) => entry.id)).toEqual([FEET, FILE, "chapter.decision-day", "chapter.send-off", "chapter.landing", "chapter.secure"]);
    expect(new Set(ordered.map((entry) => entry.order)).size).toBe(ordered.length);
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
      // the chapter does not close with two items open, and the master's file follows.
      closes: false,
      next: FILE,
    });
    game.accept({ type: "activity/quit" });
    expect(game.view().chapter.items.slice(0, 2)).toEqual([
      { id: "job", met: false },
      { id: "pay", met: true },
    ]);
  });

  test("[R-CHAPTER-005] given no job, when the view is read, then the job item is not met", () => {
    expect(start({ scenario: "scenario.plain", content: miniContent }).view().chapter).toEqual({ current: ONE, items: [{ id: "job", met: false }], done: [], closes: false, next: TWO });
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
