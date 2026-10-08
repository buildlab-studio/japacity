// Chapters: docs/rules/chapter.md. One chapter is current at a time; finishing
// it refills the turn bank, so the guided checklist is also how a new player
// is kept in turns.
import { check } from "../engine/check";
import type { RegisteredKind } from "../engine/kind";
import { emit } from "../engine/kind";
import type { BaseEvent, ChapterEntry, ChapterSlice, Content, Ctx, Id, PlayerView, ReadCtx, ReportLine, Requirement, RequirementResult, State } from "../engine/types";
import { routePercent } from "../japacity/japacity.logic";
import type { ChapterEvent } from "./chapter.events";

/** The chapter whose close makes the send-off card (R-CHAPTER-006). */
const SEND_OFF: Id<"chapter"> = "chapter.send-off";
const STANDING: Id<"quality"> = "quality.standing";
/** The card names the three lines the player chose most. */
const TOP_ACTIVITIES = 3;

/** Every chapter in content, by order. */
function byOrder(content: Content): ChapterEntry[] {
  return Object.values(content.chapter).sort((a, b) => a.order - b.order);
}

/** The chapter that follows by order, or null after the last (R-CHAPTER-004). */
function nextAfter(content: Content, entry: ChapterEntry): Id<"chapter"> | null {
  return byOrder(content).find((candidate) => candidate.order > entry.order)?.id ?? null;
}

function entryOf(content: Content, id: Id<"chapter">): ChapterEntry {
  const entry = content.chapter[id];
  if (entry === undefined) throw new Error(`The content has no chapter ${id}.`);
  return entry;
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
  const closed: ChapterEvent = { type: "chapter/closed", chapter: current, next: nextAfter(ctx.content, entry) };
  // Applied first, so the report reads the close before the refill it pays for.
  emit(ctx, "chapter", [closed]);
  const refilled = ctx.apply([{ type: "turn/refill" }], { source: current, param: null, terms: {} });
  return [closed, ...refilled];
}

function evolve(slice: ChapterSlice, event: ChapterEvent): ChapterSlice {
  switch (event.type) {
    case "chapter/closed":
      // R-CHAPTER-003: done only grows. Nothing ever takes a chapter out of it.
      return { current: event.next, done: [...slice.done, event.chapter] };
    default: {
      const never: never = event.type;
      throw new Error(`Unknown chapter event ${String(never)}.`);
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
      const closed: ReportLine = { key: "line.chapter.closed", params: { chapter: event.chapter }, tone: "good", attention: true, counts: [] };
      if (event.next === null) return [closed];
      const opened: ReportLine = { key: "line.chapter.opened", params: { chapter: event.next }, tone: "plain", attention: false, counts: [] };
      return [closed, opened];
    }
    default: {
      const never: never = event.type;
      throw new Error(`Unknown chapter event ${String(never)}.`);
    }
  }
}

/** `chapter/done`: the chapter has been finished, whatever has happened since (R-CHAPTER-003). */
function judgeDone(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "chapter/done") throw new Error(`The chapter kind cannot judge ${requirement.type}.`);
  return { met: read.state.chapter.done.includes(requirement.chapter) };
}

// ---------------------------------------------------------------------------
// The send-off card: R-CHAPTER-006
// ---------------------------------------------------------------------------

/** The activities played in the most months (R-ACTIVITY-012), most first, then by id. */
export function topActivities(state: State): Id<"activity">[] {
  return (Object.entries(state.activity.played) as [Id<"activity">, number][])
    .filter(([, months]) => months > 0)
    .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, TOP_ACTIVITIES)
    .map(([id]) => id);
}

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
  return {
    kind: "send-off",
    route,
    percent: route === null ? null : routePercent(read, route),
    months: read.state.turn.month,
    standing: read.state.quality[STANDING] ?? 0,
    topActivities: topActivities(read.state),
  };
}

export const chapterKind: RegisteredKind<ChapterSlice, ChapterEvent> = {
  kind: "chapter",
  // R-CHAPTER-001.
  initial(_scenario, content) {
    return { current: byOrder(content)[0]?.id ?? null, done: [] };
  },
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
    if (new Set(done).size !== done.length) problems.push(`A chapter is done more than once: ${done.join(", ")}.`);
    return problems;
  },
  // R-CHAPTER-005: each item of the current chapter, judged against the state as it is now.
  view: (read) => {
    const { current, done } = read.state.chapter;
    const items = current === null ? [] : entryOf(read.content, current).items.map((item) => ({ id: item.id, met: check(read, item.requirement).met }));
    return { chapter: { current, items, done } };
  },
};
