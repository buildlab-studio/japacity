// Chapters: docs/rules/chapter.md. One chapter is current at a time; finishing
// it refills the turn bank, so the guided checklist is also how a new player
// is kept in turns.
import { check } from "../engine/check";
import type { RegisteredKind } from "../engine/kind";
import { emit } from "../engine/kind";
import { reject } from "../engine/reject";
import type { BaseEvent, ChapterEntry, ChapterSlice, Command, Content, Ctx, Id, PlayerView, ReadCtx, Rejection, ReportLine, Requirement, RequirementResult, RouteSlice } from "../engine/types";
import { checklistView, routePercent } from "../japacity/japacity.logic";
import { cardOf, cardsAllowed, reportLines, topActivities } from "./chapter.card";
import type { ChapterEvent } from "./chapter.events";

/** The chapter whose close makes the send-off card (R-CHAPTER-006). */
const SEND_OFF: Id<"chapter"> = "chapter.send-off";
const CLOSED_LINE = "line.chapter.closed";

/** The way out the base chapters are written for: the lean when the life leans to no variant's route (R-CHAPTER-009). */
const BASE_ROUTE: Id<"route"> = "route.uk-masters";

/** Every base chapter in content, by order. A variant only ever stands in for its base (R-CHAPTER-009). */
function byOrder(content: Content): ChapterEntry[] {
  return Object.values(content.chapter)
    .filter((entry) => entry.variantOf === undefined)
    .sort((a, b) => a.order - b.order);
}

function entryOf(content: Content, id: Id<"chapter">): ChapterEntry {
  const entry = content.chapter[id];
  if (entry === undefined) throw new Error(`The content has no chapter ${id}.`);
  return entry;
}

/** R-CHAPTER-009: the base chapter a chapter stands in for, or itself when it is a base. */
export function baseChapterOf(content: Content, id: Id<"chapter">): Id<"chapter"> {
  return content.chapter[id]?.variantOf ?? id;
}

/** The routes the variants are written for, in content's order, then the base's: the order a tie is broken in. */
function leanCandidates(content: Content): Id<"route">[] {
  const named = Object.values(content.chapter).flatMap((entry) => (entry.route === undefined ? [] : [entry.route]));
  return [...new Set([...named, BASE_ROUTE])];
}

/**
 * R-CHAPTER-009: the way out the life leans to. "the first own-effort route the life has heard
 * of or looked into" is read in time, not by the page's list. The route looked into first wins, else the
 * route heard of first; the page's order (care, talent, points, the Gulf, the master's) only breaks a tie
 * in the same month. Every graduate hears of Canada's points by month 5, so a list read first would turn a
 * master's life to the points file; read in time, the nurse who reads the care page first gets the care
 * file and a life that looked into the master's first keeps the master's file. The master's when the life
 * has heard of none of them. A way the player made the plan (`chosen`, the `chapter/lean` command) comes
 * before all of these while it is heard of or further on.
 */
export function leanRoute(routes: RouteSlice, content: Content, chosen: Id<"route"> | null = null): Id<"route"> {
  return planOf(routes, content, chosen) ?? BASE_ROUTE;
}

/** True when the life has heard of the route or gone further with it. */
function live(routes: RouteSlice, id: Id<"route">): boolean {
  return routes[id] !== undefined && routes[id].state !== "unknown";
}

/** R-CHAPTER-009: the lean as the view names it: the chosen way, else the order in time, else none heard of. */
function planOf(routes: RouteSlice, content: Content, chosen: Id<"route"> | null): Id<"route"> | null {
  const candidates = leanCandidates(content);
  if (chosen !== null && candidates.includes(chosen) && live(routes, chosen)) return chosen;
  const first = (month: (id: Id<"route">) => number | null): Id<"route"> | null => {
    let best: { id: Id<"route">; month: number } | null = null;
    for (const id of candidates) {
      const at = month(id);
      if (at !== null && (best === null || at < best.month)) best = { id, month: at };
    }
    return best?.id ?? null;
  };
  const looked = first((id) => (live(routes, id) ? (routes[id]?.knownMonth ?? null) : null));
  const heard = first((id) => (live(routes, id) ? (routes[id]?.heardMonth ?? null) : null));
  return looked ?? heard;
}

/**
 * Each way the plan can take that the life has heard of, with the figure the japacity kind gives it: its
 * own once looked into (R-JAPACITY-001, 002), and while only heard of, the sum its checklist earns now,
 * so the switch can say what making it the plan would do.
 */
function waysOf(read: ReadCtx): PlayerView["plan"]["ways"] {
  return leanCandidates(read.content)
    .filter((id) => read.content.route[id] !== undefined && live(read.state.route, id))
    .map((route) => {
      const percent = routePercent(read, route) ?? checklistView(read, route).reduce((total, item) => total + item.earned, 0);
      return { route, percent: Math.min(100, Math.max(0, percent)) };
    });
}

/** The states past the plan: once a visa is granted the chapters no longer follow a lean. */
const PAST_PLAN = new Set(["granted", "departed"]);

/** R-CHAPTER-009: the player makes a way heard of or looked into the plan; the chapters follow it from the next close. */
function leanCommand(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "chapter/lean") throw new Error(`chapter/lean cannot handle ${command.type}.`);
  const { route } = command;
  if (ctx.content.route[route] === undefined) return reject("unknown-id", `${String(route)} is not a route.`);
  if (!leanCandidates(ctx.content).includes(route)) return reject("not-legal", `${route} has no file of its own for the chapters to follow.`);
  if (!live(ctx.state.route, route)) return reject("not-legal", `Nobody has told the character of ${route} yet.`);
  if (ctx.state.place.where !== "home" || Object.values(ctx.state.route).some((held) => PAST_PLAN.has(held.state))) {
    return reject("not-legal", "A visa is granted: the plan is done.");
  }
  // A lean read from the order in time may still be chosen: the choice holds it when another page is read first.
  if (ctx.state.chapter.chosen === route) return reject("not-legal", `${route} is the plan already.`);
  const leaned: ChapterEvent = { type: "chapter/leaned", route };
  return [leaned];
}

/** R-CHAPTER-009: the chapter that takes a base's turn: its variant for the lean route when content has one, else the base. */
function standingIn(content: Content, base: ChapterEntry, lean: Id<"route">): Id<"chapter"> {
  return Object.values(content.chapter).find((entry) => entry.variantOf === base.id && entry.route === lean)?.id ?? base.id;
}

/**
 * The chapter that follows by its base's order, or null after the last (R-CHAPTER-004), with the
 * lean read again as the chapter closes (R-CHAPTER-009).
 */
function nextAfter(content: Content, entry: ChapterEntry, routes: RouteSlice, chosen: Id<"route"> | null): Id<"chapter"> | null {
  const base = entry.variantOf === undefined ? entry : entryOf(content, entry.variantOf);
  const next = byOrder(content).find((candidate) => candidate.order > base.order);
  return next === undefined ? null : standingIn(content, next, leanRoute(routes, content, chosen));
}

/** R-CHAPTER-002: every item met, or the one item the entry names in `closesOn`. */
function finished(entry: ChapterEntry, met: (requirement: Requirement) => boolean): boolean {
  const alone = entry.closesOn === undefined ? undefined : entry.items.find((item) => item.id === entry.closesOn);
  if (alone !== undefined && met(alone.requirement)) return true;
  return entry.items.every((item) => met(item.requirement));
}

/**
 * R-CHAPTER-002. The phase runs once a turn and looks only at the current
 * chapter, so at most one chapter closes in a turn even when the next one's
 * items already hold: it closes at the end of the following turn.
 */
function closeFinished(ctx: Ctx): BaseEvent[] {
  const { current } = ctx.state.chapter;
  if (current === null) return [];
  const entry = entryOf(ctx.content, current);
  if (!finished(entry, (requirement) => ctx.check(requirement).met)) return [];
  const closed: ChapterEvent = { type: "chapter/closed", chapter: current, next: nextAfter(ctx.content, entry, ctx.state.route, ctx.state.chapter.chosen ?? null) };
  // Applied first, so the report reads the close before the refill it pays for.
  emit(ctx, "chapter", [closed]);
  const refilled = ctx.apply([{ type: "turn/refill" }], { source: current, param: null, terms: {} });
  return [closed, ...refilled];
}

function evolve(slice: ChapterSlice, event: ChapterEvent): ChapterSlice {
  switch (event.type) {
    case "chapter/closed":
      // R-CHAPTER-003: done only grows. Nothing ever takes a chapter out of it.
      return { ...slice, current: event.next, done: [...slice.done, event.chapter] };
    case "chapter/leaned":
      return { ...slice, chosen: event.route };
    default: {
      const never: never = event;
      throw new Error(`Unknown chapter event ${JSON.stringify(never)}.`);
    }
  }
}

/**
 * The close asks for attention: the interface shows the chapter's `.close`
 * words, then the next one's `.open`. The opening line is quieter, since it
 * follows the close in the same report.
 */
function lines(event: ChapterEvent): ReportLine[] {
  switch (event.type) {
    case "chapter/closed": {
      const closed: ReportLine = { key: CLOSED_LINE, params: { chapter: event.chapter }, tone: "good", attention: true, counts: [] };
      if (event.next === null) return [closed];
      const opened: ReportLine = { key: "line.chapter.opened", params: { chapter: event.next }, tone: "plain", attention: false, counts: [] };
      return [closed, opened];
    }
    // The switch says what it did on the page; the month's report has nothing to add.
    case "chapter/leaned":
      return [];
    default: {
      const never: never = event;
      throw new Error(`Unknown chapter event ${JSON.stringify(never)}.`);
    }
  }
}

/**
 * `chapter/done`: the chapter has been finished, whatever has happened since (R-CHAPTER-003). A base is
 * done when the variant that stood in for it is (R-CHAPTER-009).
 */
function judgeDone(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "chapter/done") throw new Error(`The chapter kind cannot judge ${requirement.type}.`);
  return { met: read.state.chapter.done.some((id) => id === requirement.chapter || baseChapterOf(read.content, id) === requirement.chapter) };
}

// ---------------------------------------------------------------------------
// The send-off card: R-CHAPTER-006
// ---------------------------------------------------------------------------

export { topActivities };

/**
 * The send-off is current and every item of it is met: the flight has been
 * taken this month and the chapter closes at the end of it.
 */
function sendOffDue(read: ReadCtx): boolean {
  if (read.state.chapter.current !== SEND_OFF) return false;
  return finished(entryOf(read.content, SEND_OFF), (requirement) => check(read, requirement).met);
}

/**
 * R-CHAPTER-006: the card of the flight month, read from the state and never
 * stored. it shows from the flight until the month after it is played,
 * when the send-off closes, so its standing and its lines are the flight
 * month's. The route is the one flown; the figure is its japacity figure,
 * whole once departed.
 */
export function sendOffCard(read: ReadCtx): PlayerView["card"] {
  if (!sendOffDue(read)) return null;
  const route = (Object.keys(read.content.route) as Id<"route">[]).find((id) => read.state.route[id]?.state === "departed") ?? null;
  return cardOf(read, "send-off", { route, chapter: SEND_OFF });
}

/**
 * R-SHARE-001: a chapter card through the month after a chapter closes. The
 * send-off's close has the send-off card (R-CHAPTER-006) and no second one.
 */
export function chapterCard(read: ReadCtx): PlayerView["card"] {
  if (!cardsAllowed(read)) return null;
  for (const line of reportLines(read, CLOSED_LINE)) {
    const chapter = line.params.chapter as Id<"chapter">;
    if (chapter !== SEND_OFF) return cardOf(read, "chapter", { chapter });
  }
  return null;
}

export const chapterKind: RegisteredKind<ChapterSlice, ChapterEvent> = {
  kind: "chapter",
  // R-CHAPTER-001.
  initial(_scenario, content) {
    return { current: byOrder(content)[0]?.id ?? null, done: [] };
  },
  commands: { "chapter/lean": leanCommand },
  phases: { chapter: closeFinished },
  evolve,
  lines,
  requirements: { "chapter/done": judgeDone },
  invariants(state, content) {
    const problems: string[] = [];
    const { current, done } = state.chapter;
    if (current !== null && content.chapter[current] === undefined) problems.push(`The current chapter ${current} is not in content.`);
    if (current !== null && done.includes(current)) problems.push(`The current chapter ${current} is also done.`);
    for (const id of done) {
      if (content.chapter[id] === undefined) problems.push(`The done chapter ${id} is not in content.`);
    }
    // R-CHAPTER-009: one chapter takes each base's turn, the base or one of its variants. Repeats of one id are named above.
    const bases = [...new Set(done)].map((id) => baseChapterOf(content, id));
    if (new Set(bases).size !== bases.length) problems.push(`A base chapter's turn is done twice, by it and a variant: ${done.join(", ")}.`);
    if (current !== null && !done.includes(current) && bases.includes(baseChapterOf(content, current))) problems.push(`The current chapter ${current} stands in for one already done.`);
    if (new Set(done).size !== done.length) problems.push(`A chapter is done more than once: ${done.join(", ")}.`);
    const { chosen } = state.chapter;
    if (chosen !== undefined && content.route[chosen] === undefined) problems.push(`The chosen plan ${chosen} is not a route in content.`);
    return problems;
  },
  // R-CHAPTER-005: each item of the current chapter, judged against the state as it is now.
  view: (read) => {
    const { current, done } = read.state.chapter;
    const items = current === null ? [] : entryOf(read.content, current).items.map((item) => ({ id: item.id, met: check(read, item.requirement).met }));
    const lean = planOf(read.state.route, read.content, read.state.chapter.chosen ?? null);
    return { chapter: { current, items, done }, plan: { route: lean, ways: waysOf(read) } };
  },
};
