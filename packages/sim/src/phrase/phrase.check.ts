// The preset phrases' content checks: pair:preset-phrases-only.
import type { Content, PhraseEntry } from "../engine/types";

const PHRASE_ID = /^phrase\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OPTION = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PLACEHOLDER = /\{([a-z]+)\}/g;

/**
 * Words no phrase may carry, because each would ask for or offer money, a
 * document, a contact detail, a meeting outside the game or a photo.
 */
const FORBIDDEN = [
  "money",
  "cash",
  "naira",
  "pound",
  "dollar",
  "pay",
  "payment",
  "send me",
  "transfer",
  "bank",
  "account",
  "loan",
  "fee",
  "document",
  "passport",
  "phone",
  "number",
  "call me on",
  "whatsapp",
  "email",
  "address",
  "link",
  "in person",
  "real life",
  "outside the game",
  "photo",
  "picture",
  "pic",
  "selfie",
];

function forbiddenIn(words: string): string | null {
  const lower = words.toLowerCase();
  return FORBIDDEN.find((word) => new RegExp(`\\b${word}s?\\b`).test(lower)) ?? null;
}

function sourceProblems(content: Content, phrase: PhraseEntry): string[] {
  const options = phrase.options;
  switch (phrase.fill) {
    case null:
      return options === undefined ? [] : [`${phrase.id}: has options but no fill-in.`];
    case "spot":
      if (options !== undefined) return [`${phrase.id}: a spot comes from the shared spots, not options.`];
      return content.people.spots.length === 0 ? [`${phrase.id}: fills a spot, and there are no spots.`] : [];
    case "route":
      if (options !== undefined) return [`${phrase.id}: a route comes from the routes heard of, not options.`];
      return Object.keys(content.route).length === 0 ? [`${phrase.id}: fills a route, and there are no routes.`] : [];
    case "news":
      if (options !== undefined) return [`${phrase.id}: a story comes from the news delivered, not options.`];
      return Object.keys(content.news).length === 0 ? [`${phrase.id}: fills a story, and there is no news.`] : [];
    case "event":
    case "thing": {
      if (options === undefined || options.length === 0) return [`${phrase.id}: fills ${phrase.fill} from an empty list.`];
      const problems = options.filter((option) => !OPTION.test(option)).map((option) => `${phrase.id}: the option "${option}" is not a well-formed key.`);
      if (new Set(options).size !== options.length) problems.push(`${phrase.id}: lists an option twice.`);
      return problems;
    }
    default: {
      const never: never = phrase.fill;
      throw new Error(`Unknown fill ${String(never)}.`);
    }
  }
}

function wordProblems(phrase: PhraseEntry, words: Readonly<Record<string, string>>): string[] {
  const said = words[`${phrase.id}.name`] ?? "";
  if (said.trim() === "") return [`${phrase.id}: has no words.`];
  const problems: string[] = [];
  const holes = [...said.matchAll(PLACEHOLDER)].map((match) => match[1]);
  const wanted = phrase.fill === null ? [] : [phrase.fill];
  if (holes.length !== wanted.length || holes.some((hole, index) => hole !== wanted[index])) {
    problems.push(`${phrase.id}: its words hold {${holes.join("}, {")}} where the entry fills ${phrase.fill ?? "nothing"}.`);
  }
  const texts = [said, ...(phrase.options ?? []).map((option) => words[`${phrase.id}.fill.${option}`] ?? "")];
  for (const option of phrase.options ?? []) {
    if ((words[`${phrase.id}.fill.${option}`] ?? "").trim() === "") problems.push(`${phrase.id}: the option ${option} has no words.`);
  }
  for (const text of texts) {
    const found = forbiddenIn(text);
    if (found !== null) problems.push(`${phrase.id}: "${text}" says "${found}", which a phrase may not ask for or offer.`);
  }
  return problems;
}

/**
 * Sentences describing what is wrong with the phrases: each well formed, its
 * fill-in with a source, its options not empty (pair:preset-phrases-only). Pass the words to
 * check what each phrase says as well.
 */
export function phraseChecks(content: Content, words?: Readonly<Record<string, string>>): string[] {
  const problems: string[] = [];
  for (const [key, phrase] of Object.entries(content.phrase)) {
    if (!PHRASE_ID.test(key)) problems.push(`phrase: the key ${key} is not a well-formed phrase id.`);
    if (phrase.id !== key) problems.push(`phrase: the entry under ${key} has the id ${phrase.id}.`);
    problems.push(...sourceProblems(content, phrase));
    if (words !== undefined) problems.push(...wordProblems(phrase, words));
  }
  return problems;
}
