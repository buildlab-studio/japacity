// A computer person never carries the player's name (prologue.md R-PROLOGUE-009, people.md R-PEOPLE-061, amended
// 11 Oct 2026). The player names the character at the
// door from the same pool the game's people are named from, so a name can meet itself. Where it does, the person in the
// game's words takes another name of their own people and sex from the pool, the first in the pool's order that is
// nobody else's: deterministic, whole numbers only, and nothing of it reaches the simulation.
import { lifePeople, namedPeople, namePool, text } from "@japacity/content";

import { nowPlayer } from "./now";

/** A pool name's words and who it suits. */
interface Pooled {
  name: string;
  people: string;
  sex: "f" | "m" | "either";
}

const POOL: readonly Pooled[] = namePool.flatMap((entry) => {
  const name = text[`person.name.${String(entry.n)}`];
  return name === undefined ? [] : [{ name, people: entry.people, sex: entry.sex }];
});

/** Every name a person in the game's own words carries, and the fixed lives' own: none is given out again. */
const TAKEN: ReadonlySet<string> = new Set([...namedPeople, ...Object.values(lifePeople)].map((person) => same(person.name)));

/** The text keys that carry a computer person's name, and whose name it is (the fixed lives' keys are the player's own). */
const CARRIED: ReadonlyMap<string, readonly string[]> = (() => {
  const carried = new Map<string, string[]>();
  for (const person of namedPeople) for (const key of person.keys) carried.set(key, [...(carried.get(key) ?? []), person.name]);
  return carried;
})();

/** The player's own words for their character: the keys that must keep the player's name. */
const PLAYERS_OWN = ["scenario.", "share.first-name.", "person.name."];

function same(name: string): string {
  return name.trim().toLowerCase();
}

/** The player's first name, as it is compared. */
function firstOf(name: string): string {
  return same(name.split(/\s+/)[0] ?? "");
}

/**
 * The other name a person whose name is the player's goes by: of their own people and sex where the pool has one (a
 * name given to both, another given to both), the first in the pool's order that is neither the player's nor any named
 * person's; else the first that suits of any people.
 */
export function otherName(name: string, player: string): string {
  const own = POOL.find((entry) => same(entry.name) === same(name));
  const free = (entry: Pooled): boolean => same(entry.name) !== firstOf(player) && !TAKEN.has(same(entry.name)) && same(entry.name) !== same(name);
  // A name given to both stays one given to both, since the person's sex is not in the words.
  const suits = (entry: Pooled): boolean => own === undefined || entry.sex === "either" || (own.sex !== "either" && entry.sex === own.sex);
  const found = POOL.find((entry) => entry.people === own?.people && suits(entry) && free(entry)) ?? POOL.find((entry) => suits(entry) && free(entry));
  return found?.name ?? name;
}

function escaped(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A line of content's as it stands for the life on screen: a computer person's name that is the player's own first name
 * is said as their other name, in a line that names them (`namedPeople`'s keys) and in any name of an entry that is the
 * player's name whole. The player's own words keep it.
 */
export function notThePlayers(key: string, line: string, player: string | null = nowPlayer()): string {
  if (player === null || firstOf(player) === "" || PLAYERS_OWN.some((own) => key.startsWith(own))) return line;
  const first = firstOf(player);
  const carried = CARRIED.get(key);
  if (carried !== undefined) {
    return carried.filter((name) => same(name) === first).reduce((said, name) => said.replace(new RegExp(`\\b${escaped(name)}\\b`, "g"), otherName(name, player)), line);
  }
  return key.endsWith(".name") && same(line) === first ? otherName(line.trim(), player) : line;
}
