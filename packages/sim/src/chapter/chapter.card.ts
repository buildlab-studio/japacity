// The share card's common fields (docs/rules/share.md R-SHARE-001, 002, 004).
// Each kind says when its own card is due; this file fills the rest the same
// way for all of them. A card is read from the state and never stored.
import { divFloor } from "../engine/int";
import type { Content, Id, PlayerView, ReadCtx, ReportLine, State } from "../engine/types";
import { japacity, routePercent } from "../japacity/japacity.logic";

export type Card = NonNullable<PlayerView["card"]>;
export type CardKind = Card["kind"];

const STANDING: Id<"quality"> = "quality.standing";

/**
 * The activities played in the most months (R-ACTIVITY-012), most first, then by id. An act that repeats counts each
 * time it is done (R-ACTIVITY-019), so its count is read as months: a month's worth is `tuning.turn.repeatPerSlot`.
 */
export function topActivities(state: State, content: Content): Id<"activity">[] {
  const monthsOf = (id: Id<"activity">, count: number): number =>
    content.activity[id]?.repeat === true ? divFloor(count + content.tuning.turn.repeatPerSlot - 1, content.tuning.turn.repeatPerSlot) : count;
  return (Object.entries(state.activity.played) as [Id<"activity">, number][])
    .map(([id, count]) => [id, monthsOf(id, count)] as [Id<"activity">, number])
    .filter(([, months]) => months > 0)
    .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, content.tuning.chapter.cardLines)
    .map(([id]) => id);
}

/**
 * The lines of the last turn's report with this key. A moment told at the end
 * of a turn keeps its card through the month that follows, until the next
 * turn ends.
 */
export function reportLines(read: ReadCtx, key: string): ReportLine[] {
  return read.state.turn.report?.lines.filter((line) => line.key === key) ?? [];
}

/**
 * R-SHARE-002: no card for a moment on the road chain or after the life has
 * ended; the road's own cards are the only ones there.
 */
export function cardsAllowed(read: ReadCtx): boolean {
  return read.state.place.where !== "road" && !read.state.turn.ended;
}

/**
 * R-SHARE-004: the card for a moment. `route` is the moment's own route where
 * it has one, else the route of the character's japacity figure; `chapter` is
 * the chapter a chapter card closes, else the chapter current.
 * `name` is the player's own choice (R-SHARE-008) and nothing in the state
 * holds one; the first name is words (`share.first-name.<scenario>`),
 * which the simulation does not read, so it stays null and the client names
 * the character, as `apps/client/src/shared/share/face.ts` does.
 */
export function cardOf(read: ReadCtx, kind: CardKind, moment: { route?: Id<"route"> | null; chapter?: Id<"chapter"> | null } = {}): Card {
  const route = moment.route === undefined ? japacity(read).route : moment.route;
  return {
    kind,
    chapter: moment.chapter === undefined ? read.state.chapter.current : moment.chapter,
    route,
    percent: route === null ? null : routePercent(read, route),
    months: read.state.turn.month,
    standing: read.state.quality[STANDING] ?? 0,
    topActivities: topActivities(read.state, read.content),
    name: null,
  };
}
