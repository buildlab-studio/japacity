// The preset phrases: docs/rules/pair.md "Entries".
import type { Id, PhraseEntry } from "@japacity/sim";

const phrases: PhraseEntry[] = [
  { id: "phrase.hello", fill: null, where: "both" },
  { id: "phrase.evening", fill: null, where: "place" },
  { id: "phrase.home", fill: null, where: "conversation" },
  { id: "phrase.miss-you", fill: null, where: "conversation" },
  { id: "phrase.thinking", fill: null, where: "conversation" },
  { id: "phrase.meet-at", fill: "spot", where: "conversation" },
  { id: "phrase.see-you", fill: "spot", where: "both" },
  { id: "phrase.call-later", fill: null, where: "conversation" },
  { id: "phrase.busy", fill: null, where: "conversation" },
  { id: "phrase.looking-at", fill: "route", where: "conversation" },
  { id: "phrase.did-you-hear", fill: "news", where: "both" },
  { id: "phrase.good-news", fill: "event", options: ["got-job", "visa-came", "passed-test", "landed", "got-papers"], where: "conversation" },
  { id: "phrase.proud", fill: null, where: "both" },
  { id: "phrase.good-luck", fill: "thing", options: ["interview", "test", "new-job", "the-move"], where: "both" },
  { id: "phrase.december", fill: null, where: "conversation" },
  { id: "phrase.serious", fill: null, where: "conversation" },
  { id: "phrase.slowly", fill: null, where: "conversation" },
  { id: "phrase.plan", fill: null, where: "conversation" },
  { id: "phrase.yes", fill: null, where: "conversation" },
  { id: "phrase.no", fill: null, where: "conversation" },
  { id: "phrase.thanks", fill: null, where: "both" },
  { id: "phrase.sorry", fill: null, where: "conversation" },
  { id: "phrase.goodnight", fill: null, where: "conversation" },
];

export const phraseTable: Record<Id<"phrase">, PhraseEntry> = Object.fromEntries(phrases.map((phrase) => [phrase.id, phrase]));
