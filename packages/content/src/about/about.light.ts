// A dedication light's name and years (account:name-a-light-for-yours): a name of at most four words and forty
// characters, and the years if wanted, each from 1900 to the current year, the last never before the first, either
// alone. One pure function holds the limits, shared by the client, which checks as the player types, and the server
// (server:dedication-routes), which refuses with the same problem whatever reaches it. No clock is read here: the
// current year is handed in.

/** account:name-a-light-for-yours: the most words and characters a light's name may have. */
export const LIGHT_NAME_WORDS = 4;
export const LIGHT_NAME_CHARACTERS = 40;
/** account:name-a-light-for-yours: the earliest year a light may carry; the latest is the current year. */
export const LIGHT_FIRST_YEAR = 1900;

/** A light as it is kept: the name with its spaces tidied, and the years or null. */
export interface Light {
  name: string;
  /** The first year, or null. */
  from: number | null;
  /** The last year, never before the first, or null. */
  to: number | null;
}

/** What is asked while the light is named: the fields as typed. */
export interface LightAsked {
  name: string;
  from: string;
  to: string;
}

/** Why a light cannot be lit yet: the field and the reason. */
export type LightProblem = "name-empty" | "name-words" | "name-characters" | "first-year" | "last-year" | "last-before";

/** Every problem, in the order the check finds them. */
export const LIGHT_PROBLEMS: readonly LightProblem[] = ["name-empty", "name-words", "name-characters", "first-year", "last-year", "last-before"];

export type LightChecked = { ok: true; light: Light } | { ok: false; problems: LightProblem[] };

/** The name with its spaces tidied: no space at either end and one between words. */
function tidy(name: string): string {
  return name
    .trim()
    .split(/\s+/u)
    .filter((word) => word !== "")
    .join(" ");
}

/** Characters as a person counts them: a letter with its accent is one. */
function characters(words: string): number {
  return [...words.normalize("NFC")].length;
}

/** A year field: null when empty, the year when it is one from the first year to this year, else "bad". */
function yearOf(typed: string, thisYear: number): number | null | "bad" {
  const trimmed = typed.trim();
  if (trimmed === "") return null;
  if (!/^\d{4}$/u.test(trimmed)) return "bad";
  const year = Number(trimmed);
  return year >= LIGHT_FIRST_YEAR && year <= thisYear ? year : "bad";
}

/** account:name-a-light-for-yours: the limits, each at its edge. `thisYear` is the current year where the check runs. */
export function checkLight(asked: LightAsked, thisYear: number): LightChecked {
  const problems: LightProblem[] = [];
  const name = tidy(asked.name);
  if (name === "") problems.push("name-empty");
  else {
    if (name.split(" ").length > LIGHT_NAME_WORDS) problems.push("name-words");
    if (characters(name) > LIGHT_NAME_CHARACTERS) problems.push("name-characters");
  }
  const from = yearOf(asked.from, thisYear);
  const to = yearOf(asked.to, thisYear);
  if (from === "bad") problems.push("first-year");
  if (to === "bad") problems.push("last-year");
  if (typeof from === "number" && typeof to === "number" && to < from) problems.push("last-before");
  if (problems.length > 0 || from === "bad" || to === "bad") return { ok: false, problems };
  return { ok: true, light: { name, from, to } };
}

/**
 * server:dedication-routes: a light as a request sends it, `{ name, from?, to? }`, through the same check. A year is a whole number
 * or absent (null counts as absent); anything else is that year's problem, and a name that is not text is an empty one.
 */
export function checkSentLight(sent: unknown, thisYear: number): LightChecked {
  const body = typeof sent === "object" && sent !== null ? (sent as Record<string, unknown>) : {};
  const year = (value: unknown): string => (value === undefined || value === null ? "" : typeof value === "number" && Number.isInteger(value) ? String(value) : "not a year");
  return checkLight({ name: typeof body.name === "string" ? body.name : "", from: year(body.from), to: year(body.to) }, thisYear);
}

/** A light's years as a person says them: "1951 to 2024", or the one year given, or null with none. `between` is the words' own "to". */
export function lightYears(light: Pick<Light, "from" | "to">, between: string): string | null {
  if (light.from !== null && light.to !== null) return `${String(light.from)} ${between} ${String(light.to)}`;
  if (light.from !== null) return String(light.from);
  return light.to !== null ? String(light.to) : null;
}

/** A light's words, as a screen reader hears it: the name, then its years. */
export function lightWords(light: Light, between: string): string {
  const years = lightYears(light, between);
  return years === null ? light.name : `${light.name}, ${years}`;
}
