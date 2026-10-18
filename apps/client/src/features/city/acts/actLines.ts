// What an act says once it lands (docs/rules/world.md R-WORLD-005; text.md R-TEXT-008).
// A person at the thing speaks in their own voice over their head (`<act>.says`, named by `<act>.who`
// or the thing's own name), and what that does to the world may follow in the corner (`<act>.done`). A thing that
// is not a person tells one short line in the corner (`<act>.done`). An act the scene shows (sit, lie down, cook,
// fetch water) says nothing: the figure does it, or the pot steams and the drum fills. Pure.
import { content } from "@japacity/content";
import type { Id, ReportLine } from "@japacity/sim";

import type { Act, Thing } from "../../../shared/world/contract";
import { nowActOf, nowLineWords } from "../../../shared/words/acts";
import { say } from "../../../shared/words/text";
import { cityWords } from "../city.words";

/** What a landed act puts in the world: words over the speaker, a line in the corner, or nothing. */
export type ActLine = { kind: "say"; who: string; name: string; words: string; then: string | null } | { kind: "tell"; words: string } | null;

/** The light bill, whose answer at home Mama speaks to. */
const LIGHT_BILL = "offer.nepa-bill";
/** Mama's thing in the parlour. */
const MAMA = "mama";

/** A scene key's words, or null when nothing has words for it. */
function wordsFor(key: string): string | null {
  const found = cityWords(key);
  return found === key ? null : found;
}

/** A person's own line named by a thing's act: a colleague at the tea point (world.md R-WORLD-039). */
const PERSON_LINE = "city.line.";

/**
 * A line told in turn (R-WORLD-039): a key ending `.1` names the first of a set, `.2`, `.3` and on while they have words,
 * and the `nth` tap tells the next of them, round again after the last. Any other key is itself.
 */
export function inTurn(key: string, nth: number): string {
  const set = /^(.*)\.1$/.exec(key)?.[1];
  if (set === undefined) return key;
  let count = 1;
  while (wordsFor(`${set}.${String(count + 1)}`) !== null) count += 1;
  return `${set}.${String((Math.max(0, nth) % count) + 1)}`;
}

/**
 * The line of a plain act (no cost, no story) as it lands: the person's words when someone speaks, else the
 * corner's line, else nothing. A person's own line (a colleague's) is said over the thing they stand at, in a bubble,
 * a new one at each tap (`nth`, from 0).
 */
export function plainActLine(thing: Pick<Thing, "id" | "label">, act: Pick<Act, "label"> & Partial<Pick<Act, "tells">>, nth = 0): ActLine {
  const tells = act.tells === undefined ? undefined : inTurn(act.tells, nth);
  const own = tells?.startsWith(PERSON_LINE) === true ? wordsFor(tells) : null;
  if (own !== null) return { kind: "say", who: thing.id, name: cityWords(thing.label), words: own, then: null };
  const told = wordsFor(tells ?? `${act.label}.done`);
  const says = wordsFor(`${act.label}.says`);
  if (says !== null) return { kind: "say", who: thing.id, name: wordsFor(`${act.label}.who`) ?? cityWords(thing.label), words: says, then: told };
  return told === null ? null : { kind: "tell", words: told };
}

/** The line of a free act that fills a slot as it lands: none, since the thing's chip says it carries on; only a month already full is told. */
export function doActLine(added: boolean): ActLine {
  return added ? null : { kind: "tell", words: say("ui.world.full") };
}

/**
 * The state a thing's name carries while one of its acts carries on in the plan (R-WORLD-005, R-WORLD-007, R-TEXT-008):
 * "Ongoing", shown beside the name whenever the name shows.
 */
export function plannedMarks(things: readonly Pick<Thing, "id" | "acts">[], planned: ReadonlySet<string>): Record<string, string> {
  const marks: Record<string, string> = {};
  for (const thing of things) {
    const act = thing.acts.find((candidate) => (candidate.kind === "do" || candidate.kind === "sheet") && candidate.stages !== undefined && planned.has(candidate.stages));
    if (act?.stages !== undefined) marks[thing.id] = say("ui.world.thing.planned");
  }
  return marks;
}

/**
 * The light bill paid where Mama sits (R-WORLD-005): she says "God bless you. Light
 * is back." over her head, the corner tells the bill paid, and a moment later the next compound is heard. Null when the
 * lines hold no bill paid or Mama is not in the place.
 */
export function lightBack(lines: readonly { key: string; params: Record<string, unknown> }[], things: readonly Pick<Thing, "id" | "label">[]): { who: string; name: string; words: string; told: string; heard: string } | null {
  const paid = lines.some((line) => line.key === "line.offer.taken" && line.params.offer === LIGHT_BILL && line.params.choice === "pay");
  const mama = things.find((thing) => thing.id === MAMA);
  if (!paid || mama === undefined) return null;
  return { who: mama.id, name: cityWords(mama.label), words: cityWords("city.say.light-back"), told: cityWords("city.told.light-paid"), heard: cityWords("city.heard.up-nepa") };
}

/** The acts the scene shows (the pot steams, the drum fills): the place says no line for them (R-WORLD-005). */
export const SHOWN_BY_SCENE: ReadonlySet<string> = new Set(["activity.cook-at-home", "activity.cook-own", "activity.cook-own-uk", "activity.cook-own-ca", "activity.cook-own-uae", "activity.cook-own-it", "activity.fetch-water", "activity.fill-drum"]);

/** Gist with Mama, and the big pot bought for the house: her own words over her head. */
const MAMA_SAYS: ReadonlySet<string> = new Set(["activity.family-time", "activity.cook-jollof"]);

/** A line written as someone's words, "Mama: you have eaten? Sit small.", as the bubble says it under her name. */
function spoken(words: string): string {
  const said = words.replace(/^[A-Z][a-z]+: /, "");
  return said.charAt(0).toUpperCase() + said.slice(1);
}

/**
 * Where an act done at once lands its line (R-WORLD-005; decision 0012: acts that repeat): Mama's gist over her head, as
 * her words; any other act that repeats in the corner, every time it is done, since a repeat act is never done for the
 * month; null for the rest, which answer in their sheet, and for what the scene shows, which says nothing.
 */
export function nowLands(line: Pick<ReportLine, "key" | "params">, things: readonly Pick<Thing, "id" | "label">[]): ActLine {
  const activity = nowActOf(line);
  if (SHOWN_BY_SCENE.has(activity)) return null;
  const mama = things.find((thing) => thing.id === MAMA);
  if (MAMA_SAYS.has(activity) && mama !== undefined) return { kind: "say", who: mama.id, name: cityWords(mama.label), words: spoken(nowLineWords(line)), then: null };
  if (content.activity[activity as Id<"activity">]?.repeat !== true) return null;
  return { kind: "tell", words: nowLineWords(line) };
}
