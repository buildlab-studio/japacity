// The family group as the phone's Chats shows it (docs/rules/world.md R-WORLD-019; text.md
// R-TEXT-003): at most `familyFeed.perMonth` posts a month from `familyPosts`, the posts any month
// may carry turning by a hash of the life and the month, so a month reads the same twice. A post
// keyed to a report line waits until the view shows that line has happened.
// the view has no feed of its own (family.data.ts says the news kind reads it once the
// lead adds a view field), so what has happened is read from the view as it stands now.
import { familyFeed, familyNames, familyPosts, text, type FamilyPost } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

/** How many months back the group's thread reaches. */
export const FEED_MONTHS = 6;

export interface FeedLine {
  id: FamilyPost["id"];
  /** Who sent it, as the group shows them. */
  from: string;
  words: string;
  /** The raw month the post arrived in. */
  month: number;
}

/** A small string hash, so the same life and month always pick the same post. */
function hash(value: string): number {
  let out = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 16777619) >>> 0;
  }
  return out;
}

/** True when the view shows the event a keyed post waits for has happened. */
export function happened(view: PlayerView, line: string): boolean {
  if ((view.report?.lines ?? []).some((shown) => shown.key === line)) return true;
  const states = view.routes.map((route) => route.state);
  const abroad = view.place.where === "abroad";
  switch (line) {
    case "line.route.applied":
      return view.routes.some((route) => route.visa !== null) || states.some((state) => state === "applying" || state === "granted" || state === "departed");
    case "line.route.granted":
      return states.some((state) => state === "granted" || state === "departed");
    case "line.route.departed":
    case "line.place.arrived":
      return abroad || states.includes("departed");
    case "line.activity.salary-first-foreign":
      return abroad && view.job.id !== null && view.job.months > 0;
    case "line.setpiece.december-go":
      return view.place.returns.length > 0;
    default:
      return false;
  }
}

function senderWords(view: PlayerView, post: FamilyPost): string {
  const name = familyNames[view.scenario]?.[post.from];
  const key = `family.from.${post.from}`;
  if (name === undefined && text[`${key}.plain`] !== undefined) return text[`${key}.plain`] ?? key;
  return (text[key] ?? key).replace("{name}", name ?? "");
}

/** The group's posts over the last few months, oldest first. */
export function familyFeedLines(view: PlayerView): FeedLine[] {
  const general = familyPosts.filter((post) => post.after === null);
  const keyed = familyPosts.filter((post) => post.after !== null && happened(view, post.after));
  const first = Math.max(0, view.month - FEED_MONTHS + 1);
  const months: number[] = [];
  for (let month = first; month <= view.month; month += 1) months.push(month);
  // The posts that wait on an event take the latest months, newest last, so what just happened is
  // what the group is talking about; the other months carry the posts any month may carry.
  const latestKeyed = keyed.slice(-months.length);
  const lines: FeedLine[] = [];
  months.forEach((month, index) => {
    const keyedIndex = index - (months.length - latestKeyed.length);
    const post = keyedIndex >= 0 ? latestKeyed[keyedIndex] : general[hash(`${view.scenario}|${String(month)}`) % general.length];
    if (post === undefined || familyFeed.perMonth < 1) return;
    lines.push({ id: post.id, from: senderWords(view, post), words: text[`${post.id}.text`] ?? post.id, month });
  });
  return lines;
}
