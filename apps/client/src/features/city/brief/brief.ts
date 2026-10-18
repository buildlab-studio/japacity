// The brief and the marker (docs/design/13-the-lively-layer.md section 4): a
// chapter is handed over as a mission card by the person who sets it, in their voice, with its things as sticker tiles,
// the place of each under it, the reward as picture chips and the next brief faint. In the world the road shows only in
// the moment: the chip under the band for a moment after the card is handed, and while the player stands at the step's
// place, with the marker on the thing to do. Pure: the view and the words in, what to show out.
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";

import { TILE_TABLE } from "../../../shared/tiles/tiles.data";
import { hasWords, nameOf, say } from "../../../shared/words/text";
import { placeName } from "../city.words";
import { itemWayOf, STEP_ACTIVITY } from "../nudge/nudge";

/** How long the chip stands under the band after Let's go, before it slides into the Phone thumb. */
export const TUCK_MS = 2000;
/** How long the slide into the Phone thumb takes: under half a second (world:motions-under-half-second). */
export const TUCK_SLIDE_MS = 420;
/** How long a done thing's toast rides under the chip. */
export const DONE_TOAST_MS = 3000;

/** One thing of a brief: its words, the two-word place under it, whether it is in, and whether it is the one to do now. */
export interface BriefItem {
  id: string;
  words: string;
  place: string;
  met: boolean;
  now: boolean;
  /** The id whose tile is its picture: the act that does it, else the place it is done at. */
  picture: string;
}

/** A reward as a picture chip: the stand-in picture and its words. */
interface BriefReward {
  emoji: string;
  words: string;
}

export interface Brief {
  chapter: string;
  /** The base chapter a route's variant stands in for, whose words the brief takes. */
  base: string;
  /** The title with a wink, at most three words. */
  title: string;
  giver: { name: string; where: string };
  /** The giver's words, first person. */
  line: string;
  items: BriefItem[];
  rewards: BriefReward[];
  /** The brief after this one, faint at the foot. */
  next: { chapter: string; title: string } | null;
  /** The id whose tile is the brief's picture: the place of the thing to do now. */
  picture: string;
}

/** The base chapter whose words a chapter takes: a variant's base, else itself (chapter:chapters-follow-lean-route). */
export function baseOf(chapter: string): string {
  return content.chapter[chapter as Id<"chapter">]?.variantOf ?? chapter;
}

function slug(chapter: string): string {
  return chapter.replace(/^chapter\./, "");
}

/** A chapter's title with a wink, from the interface's words, else its name. */
export function briefTitle(chapter: string): string {
  const key = `${baseOf(chapter)}.brief.title`;
  return hasWords(key) ? say(key) : nameOf(chapter);
}

/** The stand-in pictures of the rewards, by the reward's place in its list, since the rewards have no tiles of their own. */
const REWARD_PICTURES: Readonly<Record<string, readonly string[]>> = {
  "find-your-feet": ["💰", "🧭"],
  "build-the-file": ["📘"],
  "decision-day": ["🛂"],
  "send-off": ["✈️"],
  landing: ["🏠"],
  secure: ["🔑"],
};

function rewardsOf(base: string): BriefReward[] {
  const pictures = REWARD_PICTURES[slug(base)] ?? [];
  return pictures.flatMap((emoji, index) => {
    const key = `${base}.brief.reward.${String(index + 1)}`;
    return hasWords(key) ? [{ emoji, words: say(key) }] : [];
  });
}

/** The two-word place under a thing: the stop it is done at, the phone, or the month itself. */
export function itemPlace(chapter: string, item: string): string {
  const own = `${baseOf(chapter)}.brief.at.${item}`;
  if (hasWords(own)) return say(own);
  const way = itemWayOf(chapter, item);
  if (way === null) return say("chapter.brief.at.month");
  if (way.app !== undefined) return say("chapter.brief.at.phone");
  if (way.go === null) return say("chapter.brief.at.month");
  const at = `chapter.brief.at.${way.go.replace(/^place\./, "")}`;
  if (hasWords(at)) return say(at);
  const name = placeName(way.go);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function itemPicture(chapter: string, item: string): string {
  return STEP_ACTIVITY[`${chapter}.${item}`] ?? itemWayOf(chapter, item)?.go ?? "place.ojuelegba";
}

/** The brief after a chapter: the next base chapter by order, never a variant (chapter:chapters-follow-lean-route). */
export function nextBase(chapter: string): string | null {
  const order = content.chapter[baseOf(chapter) as Id<"chapter">]?.order ?? Infinity;
  const later = Object.values(content.chapter)
    .filter((entry) => entry.variantOf === undefined && entry.order > order)
    .sort((a, b) => a.order - b.order);
  return later[0]?.id ?? null;
}

/**
 * The brief for the chapter the life is in, or null with none: its title and giver from the interface's words, the
 * giver's line (`line`, the opening the life's path chose), each item of the chapter with its place and whether it is in,
 * the first not in lit as the one to do now, the rewards, and the next brief by the view's own next chapter.
 */
export function briefOf(view: Pick<PlayerView, "chapter">, line: string): Brief | null {
  const chapter = view.chapter.current;
  if (chapter === null) return null;
  const base = baseOf(chapter);
  const firstOpen = view.chapter.items.find((item) => !item.met)?.id ?? null;
  const items = view.chapter.items.map((item) => ({
    id: item.id,
    words: hasWords(`${chapter}.item.${item.id}`) ? say(`${chapter}.item.${item.id}`) : item.id,
    place: itemPlace(chapter, item.id),
    met: item.met,
    now: item.id === firstOpen,
    picture: itemPicture(chapter, item.id),
  }));
  const next = view.chapter.next ?? nextBase(chapter);
  const giverKey = `${base}.brief.giver`;
  return {
    chapter,
    base,
    title: briefTitle(chapter),
    giver: { name: say(hasWords(giverKey) ? giverKey : "chapter.brief.giver"), where: say(hasWords(`${giverKey}.where`) ? `${giverKey}.where` : "chapter.brief.giver.where") },
    line,
    items,
    rewards: rewardsOf(base),
    next: next === null ? null : { chapter: next, title: briefTitle(next) },
    // The place of the thing to do now where it has a picture of its own, else that thing's act.
    picture: [itemWayOf(chapter, firstOpen ?? "")?.go, items.find((item) => item.now)?.picture, items[0]?.picture].find((id): id is string => id !== undefined && id !== null && TILE_TABLE[id] !== undefined) ?? "place.ojuelegba",
  };
}

/** The dots of the chip: one for each thing, in, the one now, or still to come. */
export function briefDots(items: readonly Pick<BriefItem, "met" | "now">[]): ("done" | "now" | "later")[] {
  return items.map((item) => (item.met ? "done" : item.now ? "now" : "later"));
}

/** Count words up to ten for the giver's toast; past ten, the figure. */
function countWords(count: number): string {
  return hasWords(`chapter.brief.count.${String(count)}`) ? say(`chapter.brief.count.${String(count)}`) : String(count);
}

/** The giver's toast when a thing comes in: how many are left, in their voice; the last says so. */
export function doneToast(left: number): string {
  if (left <= 0) return say("chapter.brief.toast.all");
  if (left === 1) return say("chapter.brief.toast.last");
  return say("chapter.brief.toast.more", { left: countWords(left) });
}

/**
 * The things of the world the road never touches (design page 13 section 4): the joint, the barber, the suya man and
 * the club. No brief, chip, marker or toast stands on them, ever.
 */
export const FUN_ACTS: ReadonlySet<string> = new Set(["activity.beer-joint", "activity.barber", "activity.buy-suya", "activity.night-out"]);

/** True when a thing may carry the marker: none of its acts is the fun's. */
export function markerAllowed(thing: { acts: readonly { stages?: string; more?: readonly string[] }[] }): boolean {
  return !thing.acts.some((act) => [act.stages, ...(act.more ?? [])].some((stages) => stages !== undefined && FUN_ACTS.has(stages)));
}

/** The items that came in between two readings of the same chapter: a done thing's tick and its toast. */
export function itemsDone(before: PlayerView["chapter"] | null, after: PlayerView["chapter"]): string[] {
  if (before === null || before.current !== after.current) return [];
  return after.items.filter((item) => item.met && before.items.some((was) => was.id === item.id && !was.met)).map((item) => item.id);
}
