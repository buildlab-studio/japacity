// The checks on the story's tables (docs/rules/world.md R-WORLD-003, R-WORLD-019, R-WORLD-020).
// Each returns a list of problems, empty when the content holds; the tests run them on the real
// tables and on copies made to fail.
import type { Content, Id } from "@japacity/sim";

import type { ChatLine } from "./story.chats.data";
import { threadSenders } from "./story.chats.data";
import type { StoryStep } from "./story.data";
import { NUDGE_WORDS } from "./story.data";
import type { StorySignal } from "./story.signal";

const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

/** The words of a line, counted as the screen shows them: split on spaces. */
export function wordCount(words: string): number {
  return words.trim() === "" ? 0 : words.trim().split(/\s+/).length;
}

/** R-WORLD-003: one sentence of at most eight words, never two lines, no dash. */
export function nudgeProblems(key: string, words: string | undefined): string[] {
  if (words === undefined || words.trim() === "") return [`${key} has no words`];
  const problems: string[] = [];
  if (wordCount(words) > NUDGE_WORDS) problems.push(`${key} has ${String(wordCount(words))} words`);
  if (words.includes("\n")) problems.push(`${key} runs to two lines`);
  if (/[.!?]\s+\S/.test(words)) problems.push(`${key} is more than one sentence`);
  if (words.includes(EM_DASH) || words.includes(EN_DASH)) problems.push(`${key} has a dash`);
  return problems;
}

/** True when the id names an entry of the activity, offer or set piece tables. */
function entryExists(id: string, content: Content): boolean {
  return id in content.activity || id in content.offer || id in content.setpiece;
}

/** R-WORLD-003: one row for every chapter item and none for an item that is not there; ids exist; nudges hold. */
export function stepProblems(
  steps: readonly StoryStep[],
  things: Readonly<Record<string, { outside: string[]; inside: string[] }>>,
  content: Content,
  text: Readonly<Record<string, string>>,
): string[] {
  const problems: string[] = [];
  const items = Object.values(content.chapter).flatMap((chapter) => chapter.items.map((item) => `${chapter.id} ${item.id}`));
  const rows = steps.map((row) => `${row.chapter} ${row.item}`);
  for (const item of items) if (!rows.includes(item)) problems.push(`${item} has no row`);
  for (const row of rows) {
    if (!items.includes(row)) problems.push(`${row} is not a chapter item`);
    if (rows.indexOf(row) !== rows.lastIndexOf(row)) problems.push(`${row} has two rows`);
  }
  for (const row of steps) {
    const at = `${row.chapter} ${row.item}`;
    if (!(row.place in content.place)) problems.push(`${at} names the place ${row.place}, which does not exist`);
    if (row.thing === null && row.app === null) problems.push(`${at} has neither a thing nor an app`);
    if (row.thing !== null) {
      const held = things[row.place];
      if (held === undefined || !(row.inside ? held.inside : held.outside).includes(row.thing)) problems.push(`${at} names the thing ${row.thing}, which ${row.place} does not have`);
    }
    if ("entry" in row.act && !entryExists(row.act.entry, content)) problems.push(`${at} opens ${row.act.entry}, which does not exist`);
    if (row.nudge !== `${row.chapter}.item.${row.item}.nudge`) problems.push(`${at} has the nudge key ${row.nudge}`);
    problems.push(...nudgeProblems(row.nudge, text[row.nudge]));
  }
  return problems;
}

/** R-WORLD-019: every signal names something that exists, and a report line is a line with words. */
export function signalProblems(signal: StorySignal, content: Content, text: Readonly<Record<string, string>>): string[] {
  switch (signal.on) {
    case "chapter":
      return signal.chapter in content.chapter ? [] : [`no chapter ${signal.chapter}`];
    case "line":
      return signal.key.startsWith("line.") && text[signal.key] !== undefined ? [] : [`no report line ${signal.key}`];
    case "obligation":
      return Object.values(content.obligation).some((entry) => entry.type === signal.obligationType) ? [] : [`no obligation of type ${signal.obligationType}`];
    case "document":
      return signal.document in content.document ? [] : [`no document ${signal.document}`];
    case "activity":
      return signal.activity in content.activity ? [] : [`no activity ${signal.activity}`];
    case "offer":
      return signal.offer in content.offer ? [] : [`no offer ${signal.offer}`];
    case "visa":
      return signal.route in content.route ? [] : [`no route ${signal.route}`];
    case "setpiece":
      return signal.setpiece in content.setpiece ? [] : [`no set piece ${signal.setpiece}`];
    case "job":
    case "bond":
    case "sibling":
      return [];
    default: {
      const never: never = signal;
      return never;
    }
  }
}

/** R-WORLD-019: words, a sender of the thread, real events, and preset replies only (pair.md R-PAIR-010). */
export function chatProblems(lines: readonly ChatLine[], content: Content, text: Readonly<Record<string, string>>): string[] {
  const problems: string[] = [];
  const ids = lines.map((line) => line.id);
  for (const line of lines) {
    if (ids.indexOf(line.id) !== ids.lastIndexOf(line.id)) problems.push(`${line.id} is given twice`);
    if ((text[`${line.id}.text`] ?? "").trim() === "") problems.push(`${line.id} has no words`);
    if (text[`chats.from.${line.from}`] === undefined) problems.push(`${line.id} comes from ${line.from}, who has no name`);
    if (!threadSenders[line.thread].includes(line.from)) problems.push(`${line.id} comes from ${line.from} in the ${line.thread} thread`);
    if (line.chapter !== null && !(line.chapter in content.chapter)) problems.push(`${line.id} names the chapter ${line.chapter}`);
    if (line.chapter === null && line.when.length === 0) problems.push(`${line.id} would show every month`);
    if (line.thread === "partner" && !line.when.some((signal) => signal.on === "bond")) problems.push(`${line.id} shows with no partner`);
    if (line.from === "sibling" && !line.when.some((signal) => signal.on === "sibling")) problems.push(`${line.id} shows with no sibling`);
    for (const signal of line.when) problems.push(...signalProblems(signal, content, text).map((problem) => `${line.id}: ${problem}`));
    if (line.replies.length === 0) problems.push(`${line.id} has no reply`);
    for (const reply of line.replies) problems.push(...replyProblems(line.id, reply.phrase, reply.fill, content));
  }
  return problems;
}

/** A reply is a phrase said in a conversation, with a fill-in from its fixed list where it takes one. */
function replyProblems(at: string, id: Id<"phrase">, fill: string | undefined, content: Content): string[] {
  const phrase = content.phrase[id];
  if (phrase === undefined) return [`${at} replies with ${id}, which is not a phrase`];
  if (phrase.where === "place") return [`${at} replies with ${id}, which is said only in a place`];
  if (phrase.fill === null) return fill === undefined ? [] : [`${at} fills ${id}, which takes no fill-in`];
  // A route or a news story is the sender's own, so a fixed reply cannot carry one.
  if (phrase.fill === "route" || phrase.fill === "news") return [`${at} replies with ${id}, whose fill-in is the sender's own`];
  const allowed = phrase.fill === "spot" ? content.people.spots : (phrase.options ?? []);
  return fill !== undefined && allowed.includes(fill) ? [] : [`${at} fills ${id} with ${fill ?? "nothing"}`];
}
