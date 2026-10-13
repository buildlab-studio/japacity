// The looks and the names the front door offers (prologue.md R-PROLOGUE-009). A look is a shipped person
// of the city's roster who is a passer-by: a whole look, which carries the sex, never a stat; no hawker,
// rider, corper, trader or chief. A name is drawn from the one pool (people.md R-PEOPLE-061) for the
// look's sex, three at a time; nobody types one.
import { nameMix, namePool, text } from "@japacity/content";
import { drawName } from "@japacity/sim";

import { ROSTER } from "../../features/city/roster";

export interface Look {
  /** The shipped person's name, `chr_ada`: what is kept beside the save. */
  id: string;
  /** Its file under the published assets. */
  file: string;
  sex: "f" | "m";
  /** A small picture of the whole look, from the person's own front render. */
  picture: string;
}

const PICTURES = import.meta.glob<string>("./looks/*.webp", { eager: true, query: "?url", import: "default" });

function pictureOf(id: string): string {
  return PICTURES[`./looks/${id}.webp`] ?? "";
}

/** The looks the first plan names come first, so the strip opens on the people the game began with. */
const FIRST = ["chr_ada", "chr_tunde", "chr_zainab", "chr_tobi", "chr_ngozi", "chr_femi", "chr_kemi", "chr_bisi"];

/** A shipped person's name from its file: `shared/chr/chr_ada.glb` is `chr_ada`. */
export const idOf = (file: string): string => file.slice("shared/chr/".length, -".glb".length);

export const LOOKS: readonly Look[] = ROSTER.filter((person) => person.role === "passer-by")
  .map((person) => ({ id: idOf(person.file), file: person.file, sex: person.sex, picture: pictureOf(idOf(person.file)) }))
  .sort((a, b) => rank(a.id) - rank(b.id));

function rank(id: string): number {
  const at = FIRST.indexOf(id);
  return at === -1 ? FIRST.length : at;
}

export function lookOf(id: string | null | undefined): Look | null {
  return LOOKS.find((look) => look.id === id) ?? null;
}

/** How many names show at a time. */
export const NAMES_SHOWN = 3;
/** Rolls a step apart land on different peoples and different names (the draw reads the roll's last four digits for the people). */
const ROLL_STEP = 7919;

/**
 * Three different first names for a look's sex from the pool, by its mix, for a roll. The same roll gives
 * the same three; the next roll (a reroll) gives others.
 */
export function namesFor(sex: "f" | "m", roll: number): string[] {
  const names: string[] = [];
  for (let at = 0; names.length < NAMES_SHOWN && at < 60; at += 1) {
    const n = drawName(namePool, nameMix, Math.abs(roll * NAMES_SHOWN + at) * ROLL_STEP, sex);
    const name = n === null ? undefined : text[`person.name.${String(n)}`];
    if (name !== undefined && !names.includes(name)) names.push(name);
  }
  return names;
}

/** The sex a given name suits in the pool, or null where the pool gives it to both or does not hold it. */
function sexOfName(name: string): "f" | "m" | null {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const found = namePool.find((entry) => text[`person.name.${String(entry.n)}`] === first);
  return found === undefined || found.sex === "either" ? null : found.sex;
}

/**
 * A face for someone the game names but gives no look (a computer partner, a sibling, the player on an invite card with
 * no look kept): one of the door's looks, of the sex the name suits where the pool says, picked from the name so the
 * same name always wears the same face.
 */
export function lookForName(name: string): string {
  const sex = sexOfName(name);
  const looks = sex === null ? LOOKS : LOOKS.filter((look) => look.sex === sex);
  const sum = [...name].reduce((total, letter) => total + (letter.codePointAt(0) ?? 0), 0);
  return (looks[sum % Math.max(1, looks.length)] ?? LOOKS[0])?.id ?? "chr_ada";
}

