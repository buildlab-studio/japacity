// Someone who went and the licensed adviser: docs/rules/advice.md R-ADVICE-003
// and 004. Both read the route's checklist; the friend as it stood when they
// left, the adviser as it stands now, item by item, with the months away.
import { check } from "../engine/check";
import type { ChecklistItem, Id, NewsEntry, ReadCtx, RouteEntry } from "../engine/types";
import { beingMade } from "../document/document.logic";

export const FRIEND: Id<"activity"> = "activity.ask-someone-who-went";
export const ADVISER: Id<"activity"> = "activity.see-adviser";

/** What the adviser says of one route (R-ADVICE-004). */
export interface AdviserRoute {
  route: Id<"route">;
  fits: boolean;
  missing: string[];
  months: number;
}

/** The month that world tick `tick` falls in for this character (R-DIRECTOR-002: one tick is one month played). */
function monthOfTick(read: ReadCtx, tick: number): number {
  return read.state.turn.month - read.state.tick + tick;
}

/**
 * R-ADVICE-003: the month the person who went left. nothing records
 * when a friend, a partner abroad or a recurring person left, so they are read
 * as having left before this life's world began: the month of tick 0.
 */
export function leftMonth(read: ReadCtx): number {
  return monthOfTick(read, 0);
}

/** A story that moves the world's variables: what changes a route's rules under the era. */
function movesRules(story: NewsEntry): boolean {
  return story.standIn.sets.length > 0 || (story.director?.adds.length ?? 0) > 0;
}

/** The stories in force or ended that touch the route and move its rules. */
function changesTo(read: ReadCtx, route: Id<"route">): { story: NewsEntry; since: number }[] {
  return read.world.news.flatMap((news) => {
    const story = read.content.news[news.id];
    if (story === undefined || !story.touches.includes(route) || !movesRules(story)) return [];
    return news.stage === "in-force" || news.stage === "ended" ? [{ story, since: news.since }] : [];
  });
}

/**
 * R-ADVICE-003: a route's `changedMonth`, the last month a story that touches
 * it and moves the era's variables came into force or ended. Null when none
 * has. an ended story's month is when it ended, since a story that
 * reverts changes the rules again then.
 */
export function changedMonth(read: ReadCtx, route: Id<"route">): number | null {
  const changes = changesTo(read, route);
  if (changes.length === 0) return null;
  return monthOfTick(read, Math.max(...changes.map((change) => change.since)));
}

/** The variables the stories that changed the route move. */
function changedVars(read: ReadCtx, route: Id<"route">): string[] {
  return changesTo(read, route).flatMap(({ story }) => [...story.standIn.sets.map((set) => set.var), ...(story.director?.adds.map((add) => add.var) ?? [])]);
}

/**
 * R-ADVICE-003: the one item a friend has wrong when the rules changed since
 * they left: the first item that reads a variable the change moved, else the
 * heaviest item, the first on a tie. Null when nothing changed since.
 */
export function wrongItem(read: ReadCtx, entry: RouteEntry): string | null {
  const changed = changedMonth(read, entry.id);
  if (changed === null || changed <= leftMonth(read) || entry.checklist.length === 0) return null;
  const vars = changedVars(read, entry.id);
  const reading = entry.checklist.find((item) => vars.some((id) => JSON.stringify(item.requirement).includes(`"${id}"`)));
  if (reading !== undefined) return reading.id;
  return entry.checklist.reduce((best, item) => (item.weight > best.weight ? item : best)).id;
}

function routeEntry(read: ReadCtx, route: Id<"route">): RouteEntry {
  const entry = read.content.route[route];
  if (entry === undefined) throw new Error(`There is no route ${route} in content.`);
  return entry;
}

/** What the friend says of a route: the checklist as it stood, the wrong item, and whether the player meets it now. */
export function friendWord(read: ReadCtx, route: Id<"route">): { month: number; items: string[]; wrong: string | null; metWrong: boolean } {
  const entry = routeEntry(read, route);
  const wrong = wrongItem(read, entry);
  const item = entry.checklist.find((candidate) => candidate.id === wrong);
  return { month: leftMonth(read), items: entry.checklist.map((candidate) => candidate.id), wrong, metWrong: item !== undefined && check(read, item.requirement).met };
}

const AT_LEAST = 1;

/**
 * R-ADVICE-004: the months one missing item is away, at least one, since doing
 * anything takes a month. A paper: its ready month if it is being made, else
 * its shortest wait. A school's offer: the answer due, else the shortest
 * answer wait among the route's schools. Funds held: the months still to hold.
 * the window's next opening is not known ahead (the director opens
 * it), so a closed window adds no months.
 */
export function monthsAway(read: ReadCtx, entry: RouteEntry, item: ChecklistItem): number {
  const { state, content } = read;
  const month = state.turn.month;
  const requirement = item.requirement;
  switch (requirement.type) {
    case "document/held": {
      const doc = state.document[requirement.document];
      const due = doc === undefined ? null : beingMade(doc);
      if (due !== null) return Math.max(AT_LEAST, due - month);
      return Math.max(AT_LEAST, content.document[requirement.document]?.wait[0] ?? AT_LEAST);
    }
    case "route/offer": {
      const pending = Object.values(state.route[requirement.route]?.schools ?? {}).filter((application) => application.state === "pending");
      if (pending.length > 0) return Math.max(AT_LEAST, Math.min(...pending.map((application) => application.readyMonth)) - month);
      const waits = entry.schools.flatMap((school) => content.school[school]?.answerMonths[0] ?? []);
      return Math.max(AT_LEAST, waits.length === 0 ? AT_LEAST : Math.min(...waits));
    }
    case "route/funds":
      return Math.max(AT_LEAST, requirement.heldMonths - (state.route[requirement.route]?.funds.heldMonths ?? 0));
    default:
      return AT_LEAST;
  }
}

/** R-ADVICE-004: every route heard or known, in content order, the road never (R-ROAD-001). */
export function adviserRoutes(read: ReadCtx): Id<"route">[] {
  return (Object.keys(read.content.route) as Id<"route">[]).filter((route) => {
    const state = read.state.route[route]?.state;
    return routeEntry(read, route).gate !== "road" && (state === "heard" || state === "known");
  });
}

/** R-ADVICE-004: the adviser's reading of the whole file. Always true: it judges each item as it stands. */
export function adviserReading(read: ReadCtx): AdviserRoute[] {
  return adviserRoutes(read).map((route) => {
    const entry = routeEntry(read, route);
    const missing = entry.checklist.filter((item) => !check(read, item.requirement).met);
    const months = missing.reduce((longest, item) => Math.max(longest, monthsAway(read, entry, item)), 0);
    return { route, fits: missing.length === 0, missing: missing.map((item) => item.id), months };
  });
}
