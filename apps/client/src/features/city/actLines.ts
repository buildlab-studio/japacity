// What an act says once it lands (docs/rules/world.md R-WORLD-005; text.md R-TEXT-008; the design's brief,
// section 10a). A person at the thing speaks in their own voice over their head (`<act>.says`, named by `<act>.who`
// or the thing's own name), and what that does to the world may follow in the corner (`<act>.done`). A thing that
// is not a person tells one short line in the corner (`<act>.done`). An act the scene shows (sit, rest, cook,
// fetch water) says nothing: the figure does it, and the thing's label says it is planned. Pure.
import type { Act, Thing } from "../../shared/world/contract";
import { say } from "../../shared/words/text";
import { cityWords, papersLook } from "./city.words";
import { sceneWords } from "./scene.words";

/** What a landed act puts in the world: words over the speaker, a line in the corner, or nothing. */
export type ActLine = { kind: "say"; who: string; name: string; words: string; then: string | null } | { kind: "tell"; words: string } | null;

/** The light bill, whose answer at home Mama speaks to. */
const LIGHT_BILL = "offer.nepa-bill";
/** Mama's thing in the parlour. */
const MAMA = "mama";
/** Rest, whose label says "Resting" while it is planned. */
const REST = "activity.rest";
/** The Look in the box act, whose line is what the box holds (R-WORLD-019). */
const PAPERS = "city.act.papers";

/** A scene key's words, or null when nothing has words for it. */
function wordsFor(key: string): string | null {
  const found = sceneWords(key);
  return found === key ? null : found;
}

/**
 * The line of a plain act (no cost, no story) as it lands: the person's words when someone speaks, else the
 * corner's line, else nothing. `documents` are the view's, for what the papers box holds.
 */
export function plainActLine(thing: Pick<Thing, "id" | "label">, act: Pick<Act, "label">, documents: readonly { id: string; state: string }[]): ActLine {
  if (act.label === PAPERS) return { kind: "tell", words: papersLook(documents) };
  const told = wordsFor(`${act.label}.done`);
  const says = wordsFor(`${act.label}.says`);
  if (says !== null) return { kind: "say", who: thing.id, name: wordsFor(`${act.label}.who`) ?? sceneWords(thing.label), words: says, then: told };
  return told === null ? null : { kind: "tell", words: told };
}

/** The line of a free act that fills a slot (rest, cook, fetch water) as it lands: none, since the scene shows it; only a month already full is told. */
export function doActLine(added: boolean): ActLine {
  return added ? null : { kind: "tell", words: say("ui.world.full") };
}

/**
 * The state a thing's label carries while one of its acts is in this month's plan (R-WORLD-005, R-TEXT-008): an act
 * the scene shows says no line, so the label says "Resting" for rest and "Planned" for any other.
 */
export function plannedMarks(things: readonly Pick<Thing, "id" | "acts">[], planned: ReadonlySet<string>): Record<string, string> {
  const marks: Record<string, string> = {};
  for (const thing of things) {
    const act = thing.acts.find((candidate) => (candidate.kind === "do" || candidate.kind === "sheet") && candidate.stages !== undefined && planned.has(candidate.stages));
    if (act?.stages !== undefined) marks[thing.id] = say(act.stages === REST ? "ui.world.thing.resting" : "ui.world.thing.planned");
  }
  return marks;
}

/**
 * The light bill paid where Mama sits (R-WORLD-005; the design): she says "God bless you. Light
 * is back." over her head, the corner tells the bill paid, and a moment later the next compound is heard. Null when the
 * lines hold no bill paid or Mama is not in the place.
 */
export function lightBack(lines: readonly { key: string; params: Record<string, unknown> }[], things: readonly Pick<Thing, "id" | "label">[]): { who: string; name: string; words: string; told: string; heard: string } | null {
  const paid = lines.some((line) => line.key === "line.offer.taken" && line.params.offer === LIGHT_BILL && line.params.choice === "pay");
  const mama = things.find((thing) => thing.id === MAMA);
  if (!paid || mama === undefined) return null;
  return { who: mama.id, name: sceneWords(mama.label), words: cityWords("city.say.light-back"), told: cityWords("city.told.light-paid"), heard: cityWords("city.heard.up-nepa") };
}
