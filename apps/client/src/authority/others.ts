// A computer person never carries the player's name (prologue.md R-PROLOGUE-009, people.md R-PEOPLE-061, amended
// 11 Oct 2026). The player names the character at the
// door from the same pool the game's people are named from, so a name can meet itself. Where it does, the person in the
// game's words takes another name of their own people and sex from the pool, the first in the pool's order that is
// nobody else's: deterministic, whole numbers only, and nothing of it reaches the simulation. Worked out here, once for a
// name, and handed to the words as the lines to say otherwise (`shared/words/now.ts`), so the pool is never in the words
// every screen loads.
import { lifePeople, namedPeople, namePool, text } from "@japacity/content";

import type { NameSwaps } from "../shared/words/now";
import { uiText } from "../shared/words/ui";

/** A pool name's words and who it suits. */
interface Pooled {
  name: string;
  people: string;
  sex: "f" | "m" | "either";
}

function same(name: string): string {
  return name.trim().toLowerCase();
}

/** The player's first name, as it is compared. */
function firstOf(name: string): string {
  return same(name.split(/\s+/)[0] ?? "");
}

const POOL: readonly Pooled[] = namePool.flatMap((entry) => {
  const name = text[`person.name.${String(entry.n)}`];
  return name === undefined ? [] : [{ name, people: entry.people, sex: entry.sex }];
});

/** Every name a person in the game's own words carries, and the fixed lives' own: none is given out again. */
const TAKEN: ReadonlySet<string> = new Set([...namedPeople, ...Object.values(lifePeople)].map((person) => same(person.name)));

/** The player's own words for their character: the keys that keep the player's name. */
const PLAYERS_OWN = ["scenario.", "share.first-name.", "person.name."];

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

let kept: { player: string; swaps: NameSwaps } | null = null;

/**
 * The lines that say a computer person otherwise for a player of this name: a line that names a person of the game's
 * words (`namedPeople`'s keys) whose name it is, and any entry's name that is the player's name whole. The player's own
 * words keep it. None for no name.
 */
export function swapsFor(player: string | null): NameSwaps {
  const first = player === null ? "" : firstOf(player);
  if (player === null || first === "") return new Map();
  if (kept?.player === first) return kept.swaps;
  const swaps = new Map<string, (readonly [string, string])[]>();
  const add = (key: string, name: string): void => {
    if (PLAYERS_OWN.some((own) => key.startsWith(own))) return;
    swaps.set(key, [...(swaps.get(key) ?? []), [name, otherName(name, player)]]);
  };
  for (const person of namedPeople) if (same(person.name) === first) for (const key of person.keys) add(key, person.name);
  for (const [key, line] of Object.entries({ ...uiText, ...text })) if (key.endsWith(".name") && same(line) === first && !swaps.has(key)) add(key, line.trim());
  kept = { player: first, swaps };
  return swaps;
}
