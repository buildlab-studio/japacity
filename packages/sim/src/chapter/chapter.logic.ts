// Chapters: docs/rules/chapter.md. One chapter is current at a time; finishing
// it refills the turn bank, so the guided checklist is also how a new player
// is kept in turns.
import { check } from "../engine/check";
import type { RegisteredKind } from "../engine/kind";
import { emit } from "../engine/kind";
import { reject } from "../engine/reject";
import type { BaseEvent, ChapterEntry, ChapterSlice, Command, Content, Ctx, Id, PlayerView, ReadCtx, Rejection, ReportLine, Requirement, RequirementResult, RouteEntry, RouteSlice } from "../engine/types";
import { checklistEarned, japacity, routePercent } from "../japacity/japacity.logic";
import { cardOf, cardsAllowed, reportLines, topActivities } from "./chapter.card";
import type { ChapterEvent } from "./chapter.events";

/** The chapter whose close makes the send-off card (chapter:send-off-card-on-close). */
const SEND_OFF: Id<"chapter"> = "chapter.send-off";
/** The last chapter a grant finishes on its own (chapter:met-items-close-the-chapter). */
const DECISION_DAY: Id<"chapter"> = "chapter.decision-day";
const CLOSED_LINE = "line.chapter.closed";
const REOPENED_LINE = "line.chapter.reopened";

/** The way out the base chapters are written for: the lean when the life leans to no variant's route (chapter:chapters-follow-lean-route). */
const BASE_ROUTE: Id<"route"> = "route.uk-masters";

/** Every base chapter in content, by order. A variant only ever stands in for its base (chapter:chapters-follow-lean-route). */
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

/** chapter:chapters-follow-lean-route: the base chapter a chapter stands in for, or itself when it is a base. */
function baseChapterOf(content: Content, id: Id<"chapter">): Id<"chapter"> {
  return content.chapter[id]?.variantOf ?? id;
}

/** The routes the variants are written for, in content's order, then the base's: the order a tie is broken in. */
function leanCandidates(content: Content): Id<"route">[] {
  const named = Object.values(content.chapter).flatMap((entry) => (entry.route === undefined ? [] : [entry.route]));
  return [...new Set([...named, BASE_ROUTE])];
}

/**
 * chapter:chapters-follow-lean-route: the way out the life leans to. "The first own-effort route the life has heard
 * of or looked into" is read in time, not by the page's list. The route looked into first wins, else the
 * route heard of first; the page's order (care, talent, points, the Gulf, the master's) only breaks a tie
 * in the same month. Every graduate hears of Canada's points by month 5, so a list read first would turn a
 * master's life to the points file; read in time, the nurse who reads the care page first gets the care
 * file and a life that looked into the master's first keeps the master's file. The master's when the life
 * has heard of none of them. A way the player made the plan (`chosen`, the `chapter/lean` command) comes
 * before all of these while it is heard of or further on. A route granted or flown comes before everything
 * (`grantedRoute`).
 */
export function leanRoute(routes: RouteSlice, content: Content, chosen: Id<"route"> | null = null): Id<"route"> {
  return planOf(routes, content, chosen) ?? BASE_ROUTE;
}

/**
 * The routes a visa is granted and flown on: every route with a country, a partner's and a dependant's among
 * them, never the road (`FLOWN_ROUTES` in chapter.data.ts, chapter:met-items-close-the-chapter).
 */
function flightRoutes(content: Content): RouteEntry[] {
  return Object.values(content.route).filter((entry) => entry.country !== null && entry.gate !== "road");
}

/**
 * chapter:chapters-follow-lean-route: the grant decides the plan. The route flown, else the one granted, in
 * content's order; null while none is. The chapters follow it before the chosen way and the time order.
 */
export function grantedRoute(routes: RouteSlice, content: Content): Id<"route"> | null {
  const flights = flightRoutes(content);
  const first = (state: "granted" | "departed"): Id<"route"> | null => flights.find((entry) => routes[entry.id]?.state === state)?.id ?? null;
  return first("departed") ?? first("granted");
}

/** True when a route has been flown. */
function flown(routes: RouteSlice, content: Content): boolean {
  return flightRoutes(content).some((entry) => routes[entry.id]?.state === "departed");
}

/** True when the life has heard of the route or gone further with it. */
function live(routes: RouteSlice, id: Id<"route">): boolean {
  return routes[id] !== undefined && routes[id].state !== "unknown";
}

/**
 * chapter:chapters-follow-lean-route: the lean as the view names it: the route granted or flown, else the chosen way,
 * else the order in time, else none heard of.
 */
export function planOf(routes: RouteSlice, content: Content, chosen: Id<"route"> | null): Id<"route"> | null {
  const granted = grantedRoute(routes, content);
  if (granted !== null) return granted;
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
 * own once looked into (japacity:figure-sums-checklist-items, japacity:granted-route-scores-full), and while only heard of, the sum its checklist earns now,
 * so the switch can say what making it the plan would do.
 */
function waysOf(read: ReadCtx): PlayerView["plan"]["ways"] {
  // The route granted is a way of the plan even with no file of its own.
  const granted = grantedRoute(read.state.route, read.content);
  const candidates = leanCandidates(read.content);
  return (granted === null || candidates.includes(granted) ? candidates : [...candidates, granted])
    .filter((id) => read.content.route[id] !== undefined && live(read.state.route, id))
    .map((route) => {
      return { route, percent: routePercent(read, route) ?? checklistEarned(read, route) };
    });
}

/** The states past the plan: once a visa is granted the chapters follow the grant, not a lean (chapter:chapters-follow-lean-route). */
const PAST_PLAN = new Set(["granted", "departed"]);

/** chapter:chapters-follow-lean-route: the player makes a way heard of or looked into the plan; the chapters follow it from the next close. */
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

/** chapter:chapters-follow-lean-route: the chapter that takes a base's turn: its variant for the lean route when content has one, else the base. */
function standingIn(content: Content, base: ChapterEntry, lean: Id<"route">): Id<"chapter"> {
  return Object.values(content.chapter).find((entry) => entry.variantOf === base.id && entry.route === lean)?.id ?? base.id;
}

/** The base a chapter stands in for, or itself when it is a base (chapter:chapters-follow-lean-route). */
function baseOf(content: Content, entry: ChapterEntry): ChapterEntry {
  return entry.variantOf === undefined ? entry : entryOf(content, entry.variantOf);
}

/**
 * The chapter that follows by its base's order, or null after the last (chapter:no-chapter-after-last), with the
 * lean read again as the chapter closes (chapter:chapters-follow-lean-route). A base already done is passed over: only a
 * reopening (chapter:done-chapter-stays-done) leaves a done chapter after the current one.
 */
function nextAfter(content: Content, entry: ChapterEntry, routes: RouteSlice, chapters: ChapterSlice): Id<"chapter"> | null {
  const base = baseOf(content, entry);
  const done = new Set(chapters.done.map((id) => baseChapterOf(content, id)));
  const next = byOrder(content).find((candidate) => candidate.order > base.order && !done.has(candidate.id));
  return next === undefined ? null : standingIn(content, next, leanRoute(routes, content, chapters.chosen ?? null));
}

/**
 * chapter:chapters-follow-lean-route: the chapter the current one is judged as. Once an own route is granted or
 * flown, the variant standing in for its base under that route, whichever variant happened to be current.
 */
function judgedEntry(content: Content, current: Id<"chapter">, routes: RouteSlice): ChapterEntry {
  const entry = entryOf(content, current);
  const grant = grantedRoute(routes, content);
  return grant === null ? entry : entryOf(content, standingIn(content, baseOf(content, entry), grant));
}

/**
 * chapter:met-items-close-the-chapter: why the chapter is finished, or null while it is not. `items`: every item met, or the one
 * item the entry names in `closesOn`. `grant`: a chapter whose base comes at or before
 * decision day once a route is granted or flown, its items unmet: a route with no variant of its own (the
 * skilled worker's) could never meet the master's items the base names. The items are read first, so a
 * close the items earn never rests on the grant (chapter:done-chapter-stays-done).
 */
function finishedBy(content: Content, entry: ChapterEntry, routes: RouteSlice, met: (requirement: Requirement) => boolean): "items" | "grant" | null {
  const alone = entry.closesOn === undefined ? undefined : entry.items.find((item) => item.id === entry.closesOn);
  if (alone !== undefined && met(alone.requirement)) return "items";
  if (entry.items.every((item) => met(item.requirement))) return "items";
  const decision = content.chapter[DECISION_DAY];
  if (decision !== undefined && grantedRoute(routes, content) !== null && baseOf(content, entry).order <= decision.order) return "grant";
  return null;
}

function finished(content: Content, entry: ChapterEntry, routes: RouteSlice, met: (requirement: Requirement) => boolean): boolean {
  return finishedBy(content, entry, routes, met) !== null;
}

/**
 * chapter:done-chapter-stays-done: a grant withdrawn before the flight (person:joint-collapses-with-bond) reopens the chapters closed on
 * it. Read from the state: closes on a grant are kept, the character is at home, and no route is granted or
 * flown any more, which only a withdrawal brings about (a grant otherwise only goes on to the flight). The first
 * of them by order is current again as it stands in under the lean now (chapter:chapters-follow-lean-route); the rest come by order.
 */
function reopenWithdrawn(ctx: Ctx): BaseEvent[] {
  const byGrant = ctx.state.chapter.byGrant ?? [];
  if (byGrant.length === 0 || ctx.state.place.where !== "home") return [];
  if (Object.values(ctx.state.route).some((held) => PAST_PLAN.has(held.state))) return [];
  const order = (id: Id<"chapter">): number => baseOf(ctx.content, entryOf(ctx.content, id)).order;
  const chapters = byGrant.map((each) => each.chapter).sort((a, b) => order(a) - order(b));
  const first = baseOf(ctx.content, entryOf(ctx.content, chapters[0]!));
  const current = standingIn(ctx.content, first, leanRoute(ctx.state.route, ctx.content, ctx.state.chapter.chosen ?? null));
  const reopened: ChapterEvent = { type: "chapter/reopened", chapters, current };
  return emit(ctx, "chapter", [reopened]);
}

/** chapter:done-chapter-stays-done: once a route is flown, the closes on the grant are final. */
function sealFlown(ctx: Ctx): BaseEvent[] {
  const byGrant = ctx.state.chapter.byGrant ?? [];
  if (byGrant.length === 0 || !flown(ctx.state.route, ctx.content)) return [];
  const sealed: ChapterEvent = { type: "chapter/sealed", chapters: byGrant.map((each) => each.chapter) };
  return emit(ctx, "chapter", [sealed]);
}

/**
 * chapter:met-items-close-the-chapter. The phase runs once a turn and looks only at the current
 * chapter, so at most one chapter closes in a turn even when the next one's
 * items already hold: it closes at the end of the following turn. The one
 * exception is the flight: on a turn an own route is flown, the
 * chapters close in order up to and including the send-off, each its own close
 * with its own refill, so a life that flew from an earlier chapter still lands.
 */
function closeFinished(ctx: Ctx): BaseEvent[] {
  // A turn that reopens closes nothing: the reopened chapter is judged from the next turn, one change of chapter a turn.
  const reopened = reopenWithdrawn(ctx);
  if (reopened.length > 0) return reopened;
  const events: BaseEvent[] = [];
  // Content with no send-off (the mini content) keeps one close a turn.
  const sendOff = ctx.content.chapter[SEND_OFF]?.order ?? 0;
  for (;;) {
    const { current } = ctx.state.chapter;
    if (current === null) break;
    const entry = judgedEntry(ctx.content, current, ctx.state.route);
    const by = finishedBy(ctx.content, entry, ctx.state.route, (requirement) => ctx.check(requirement).met);
    if (by === null) break;
    const next = nextAfter(ctx.content, entry, ctx.state.route, ctx.state.chapter);
    const grant = by === "grant" ? grantedRoute(ctx.state.route, ctx.content) : null;
    // chapter:done-chapter-stays-done: a close the grant made remembers the route it rested on.
    const closed: ChapterEvent = grant === null ? { type: "chapter/closed", chapter: entry.id, next } : { type: "chapter/closed", chapter: entry.id, next, onGrant: grant };
    // Applied first, so the report reads the close before the refill it pays for.
    emit(ctx, "chapter", [closed]);
    const refilled = ctx.apply([{ type: "turn/refill" }], { source: entry.id, param: null, terms: {} });
    events.push(closed, ...refilled);
    if (!flown(ctx.state.route, ctx.content) || baseOf(ctx.content, entry).order >= sendOff) break;
  }
  return [...events, ...sealFlown(ctx)];
}

function evolve(slice: ChapterSlice, event: ChapterEvent): ChapterSlice {
  switch (event.type) {
    case "chapter/closed": {
      // chapter:done-chapter-stays-done: done grows, and only a grant withdrawn before the flight takes chapters out of it.
      const closed = { ...slice, current: event.next, done: [...slice.done, event.chapter] };
      return event.onGrant === undefined ? closed : { ...closed, byGrant: [...(slice.byGrant ?? []), { chapter: event.chapter, route: event.onGrant }] };
    }
    case "chapter/leaned":
      return { ...slice, chosen: event.route };
    case "chapter/reopened": {
      const reopened = new Set(event.chapters);
      const rest = { ...slice, current: event.current, done: slice.done.filter((id) => !reopened.has(id)) };
      delete rest.byGrant;
      return rest;
    }
    case "chapter/sealed": {
      const rest = { ...slice };
      delete rest.byGrant;
      return rest;
    }
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
    // The visa is gone: the report names the chapter the life is back in (chapter:done-chapter-stays-done).
    case "chapter/reopened":
      return [{ key: REOPENED_LINE, params: { chapter: event.current }, tone: "bad", attention: true, counts: [] }];
    // The switch says what it did on the page; the month's report has nothing to add. The flight's own lines tell the flight.
    case "chapter/leaned":
    case "chapter/sealed":
      return [];
    default: {
      const never: never = event;
      throw new Error(`Unknown chapter event ${JSON.stringify(never)}.`);
    }
  }
}

/**
 * `chapter/done`: the chapter has been finished, whatever has happened since (chapter:done-chapter-stays-done). A base is
 * done when the variant that stood in for it is (chapter:chapters-follow-lean-route).
 */
function judgeDone(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "chapter/done") throw new Error(`The chapter kind cannot judge ${requirement.type}.`);
  return { met: read.state.chapter.done.some((id) => id === requirement.chapter || baseChapterOf(read.content, id) === requirement.chapter) };
}

// ---------------------------------------------------------------------------
// The send-off card: chapter:send-off-card-on-close
// ---------------------------------------------------------------------------

export { topActivities };

/**
 * The flight has been taken this month and the send-off closes at the end of it:
 * the send-off is current, or a chapter before it, which the
 * flight's turn closes in order up to the send-off (chapter:met-items-close-the-chapter).
 */
function sendOffDue(read: ReadCtx): boolean {
  const { current } = read.state.chapter;
  const sendOff = read.content.chapter[SEND_OFF];
  if (current === null || sendOff === undefined) return false;
  if (baseOf(read.content, entryOf(read.content, current)).order > sendOff.order) return false;
  return finished(read.content, sendOff, read.state.route, (requirement) => check(read, requirement).met);
}

/**
 * chapter:send-off-card-on-close: the card of the flight month, read from the state and never
 * stored. It shows from the flight until the month after it is played,
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
 * share:cards-due-at-set-moments: a chapter card through the month after a chapter closes. The
 * send-off's close has the send-off card (chapter:send-off-card-on-close) and no second one.
 */
export function chapterCard(read: ReadCtx): PlayerView["card"] {
  if (!cardsAllowed(read)) return null;
  const closes = reportLines(read, CLOSED_LINE);
  // A chapter closed in the same report as the send-off (the flight's turn, chapter:met-items-close-the-chapter) has no card of its own: the
  // send-off card is that report's (chapter:send-off-card-on-close).
  if (closes.some((line) => line.params.chapter === SEND_OFF)) return null;
  for (const line of closes) {
    const chapter = line.params.chapter as Id<"chapter">;
    // The way out the chapters follow stands on the card while no route's figure counts yet (chapter:chapters-follow-lean-route): the nurse's care
    // work, shut to applicants from abroad, has its own figure from the month its page is read.
    const route = japacity(read).route ?? planOf(read.state.route, read.content, read.state.chapter.chosen ?? null);
    if (chapter !== SEND_OFF) return cardOf(read, "chapter", { chapter, route });
  }
  return null;
}

export const chapterKind: RegisteredKind<ChapterSlice, ChapterEvent> = {
  kind: "chapter",
  // chapter:first-chapter-starts-current.
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
    // chapter:chapters-follow-lean-route: one chapter takes each base's turn, the base or one of its variants. Repeats of one id are named above.
    const bases = [...new Set(done)].map((id) => baseChapterOf(content, id));
    if (new Set(bases).size !== bases.length) problems.push(`A base chapter's turn is done twice, by it and a variant: ${done.join(", ")}.`);
    if (current !== null && !done.includes(current) && bases.includes(baseChapterOf(content, current))) problems.push(`The current chapter ${current} stands in for one already done.`);
    if (new Set(done).size !== done.length) problems.push(`A chapter is done more than once: ${done.join(", ")}.`);
    const { chosen } = state.chapter;
    if (chosen !== undefined && content.route[chosen] === undefined) problems.push(`The chosen plan ${chosen} is not a route in content.`);
    // chapter:done-chapter-stays-done: the closes kept on a grant are done chapters, on a route in content.
    for (const kept of state.chapter.byGrant ?? []) {
      if (!done.includes(kept.chapter)) problems.push(`The chapter ${kept.chapter} closed on a grant is not done.`);
      if (content.route[kept.route] === undefined) problems.push(`The grant ${kept.route} a chapter closed on is not a route in content.`);
    }
    return problems;
  },
  // chapter:items-are-live-requirements: each item of the current chapter, judged against the state as it is now. chapter:view-says-closes-and-next: whether it
  // closes at this month's end as the phase would judge it, and the chapter that follows it with the lean as it stands.
  view: (read) => {
    const { current, done } = read.state.chapter;
    // chapter:chapters-follow-lean-route: the items are the variant's the phase judges, the grant's once there is one.
    const entry = current === null ? undefined : judgedEntry(read.content, current, read.state.route);
    const items = entry === undefined ? [] : entry.items.map((item) => ({ id: item.id, met: check(read, item.requirement).met }));
    const closes = entry !== undefined && finished(read.content, entry, read.state.route, (requirement) => check(read, requirement).met);
    const next = entry === undefined ? null : nextAfter(read.content, entry, read.state.route, read.state.chapter);
    const lean = planOf(read.state.route, read.content, read.state.chapter.chosen ?? null);
    return { chapter: { current, items, done, closes, next }, plan: { route: lean, ways: waysOf(read) } };
  },
};
