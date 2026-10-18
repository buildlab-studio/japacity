// Who stands in a place today (city.md R-CITY-014 to 017). Pure: a hash of the place's id, the real
// date and the slot picks each person, so the same place on the same day shows the same people and a
// screenshot taken twice is the same. Never `Math.random`, never a stream of the simulation.
import type { PoseName } from "@japacity/assets-src/people/poses";
import { PRIVATE_PLACES } from "@japacity/content/private-places";
import type { PlaceEntry } from "@japacity/sim";

import type { CityTuning, Mode } from "./mode";
import type { Act } from "./placeFile";
import { type Person, personOfLook, type Role, ROSTER } from "./roster";

export type Band = "quiet" | "busy" | "packed";

/** Another player in the place, as the authority's presence sample gives them. */
export interface Other {
  look: string;
  /** The display name the server sent, which every player in a sample carries (R-CITY-015). */
  name: string;
}

export interface Shown {
  slot: number;
  person: Person;
  /** A computer person who lives in the city, or another player. */
  kind: "resident" | "player";
  /** A player's name exactly as the server gave it, or null: residents carry no tag. */
  tag: string | null;
  /**
   * The spot a resident stands at in a part of the place (R-CITY-032): the trader at her stall, the clerk at the
   * counter. Never taken by a player; someone standing at a thing takes it only past the scope's cap, once no one else is left.
   */
  part?: number;
}

/** A place's spots and what keeps some of them for a part: `prefer` names spots for a role, an act a spot's sex or its staff. */
export interface Parts {
  /** How many spots the place has. */
  spots: number;
  prefer?: Partial<Record<Role, readonly number[]>> | undefined;
  acts?: readonly Act[] | undefined;
}

export interface Sample {
  band: Band;
  people: Shown[];
}

/** FNV-1a over the text, 32 bits, unsigned. */
export function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let at = 0; at < text.length; at += 1) {
    value ^= text.charCodeAt(at);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

const BP = 10000;

/** A draw in basis points for one decision about one slot. */
function chance(place: string, date: string, slot: number, what: string): number {
  return hash(`${place}|${date}|${String(slot)}|${what}`) % BP;
}

function pick<T>(items: readonly T[], place: string, date: string, slot: number, what: string): T | undefined {
  return items.length === 0 ? undefined : items[hash(`${place}|${date}|${String(slot)}|${what}`) % items.length];
}

/** The real date on the device as `YYYY-MM-DD`. */
export function localDate(now: Date): string {
  const two = (value: number): string => String(value).padStart(2, "0");
  return `${String(now.getFullYear())}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

/** 0 for Sunday to 6 for Saturday, from a `YYYY-MM-DD` date. */
export function weekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay();
}

const FRIDAY = 5;
const SATURDAY = 6;

/** How many people a place shows in a mode: the place's target, capped by the mode's figure and the place's own (R-CITY-014, R-CITY-032). */
export function crowdSize(place: Pick<PlaceEntry, "crowd">, mode: Mode, city: CityTuning): number {
  const cap = mode === "low" ? Math.min(city.crowdLow, place.crowd.low) : Math.min(city.crowdHigh, place.crowd.high);
  return Math.min(place.crowd.target, cap);
}

/** The band shown for a sample, read against the place's `crowd.target`: packed at the target, quiet under half of it. */
export function bandOf(size: number, target: number): Band {
  if (size >= target) return "packed";
  if (size * 2 < target) return "quiet";
  return "busy";
}

type PlaceFacts = Pick<PlaceEntry, "id" | "crowd" | "traditionalBp" | "occasion">;

/** The Friday jalamia or the Saturday occasion dress for a slot, when the day and the draw call for it (R-CITY-016). */
function dayDress(place: PlaceFacts, chosen: Person, date: string, slot: number, city: CityTuning, taken: ReadonlySet<string> = new Set()): Person {
  const day = weekday(date);
  const free = (people: readonly Person[]): Person[] => people.filter((person) => !taken.has(person.file));
  if (day === FRIDAY && chosen.sex === "m" && chance(place.id, date, slot, "friday") < city.fridayBp) {
    return pick(free(ROSTER.filter((person) => person.wear === "jalamia")), place.id, date, slot, "jalamia") ?? chosen;
  }
  if (day === SATURDAY && place.occasion && chance(place.id, date, slot, "saturday") < city.saturdayBp) {
    const occasion = free(ROSTER.filter((person) => person.wear === "occasion"));
    const same = occasion.filter((person) => person.sex === chosen.sex);
    return pick(same.length === 0 ? occasion : same, place.id, date, slot, "occasion") ?? chosen;
  }
  return chosen;
}

/** One computer person for a slot, from the place's dress mix and the day (R-CITY-016). */
export function resident(place: PlaceFacts, pool: readonly Person[], date: string, slot: number, city: CityTuning): Person {
  const people = pool.length === 0 ? ROSTER : pool;
  const dress = chance(place.id, date, slot, "dress") < place.traditionalBp ? "traditional" : "modern";
  const dressed = people.filter((person) => person.dress === dress);
  const chosen = pick(dressed.length === 0 ? people : dressed, place.id, date, slot, "who") ?? ROSTER[0];
  if (chosen === undefined) throw new Error("The roster is empty");
  return dayDress(place, chosen, date, slot, city);
}

/** How many of `size` people wear traditional cloth at a share in basis points, to the nearest person. */
export function traditionalCount(size: number, traditionalBp: number): number {
  return Math.floor((size * traditionalBp + BP / 2) / BP);
}

/**
 * The residents of one sample, each in an outfit no one else in it wears. The dress mix is held
 * exactly: the place's share of the sample, to the nearest person, is in traditional cloth, and the
 * hash of place, date and slot picks which slots and which people. A pool smaller than the sample
 * repeats people only once it is used up. Outfits in `worn` (the player's own, the dancers on the
 * floor) are already shown, so no resident is given one of them.
 */
export function residents(place: PlaceFacts, pool: readonly Person[], date: string, size: number, city: CityTuning, worn: readonly string[] = []): Person[] {
  const shown = new Set(worn);
  const open = (pool.length === 0 ? ROSTER : pool).filter((person) => !shown.has(person.file));
  const people = open.length === 0 ? ROSTER : open;
  const slots = Array.from({ length: size }, (_, slot) => slot);
  const ranked = [...slots].sort((one, two) => hash(`${place.id}|${date}|${String(one)}|dress`) - hash(`${place.id}|${date}|${String(two)}|dress`) || one - two);
  const traditional = new Set(ranked.slice(0, traditionalCount(size, place.traditionalBp)));
  const taken = new Set<string>(worn);
  return slots.map((slot) => {
    const dress = traditional.has(slot) ? "traditional" : "modern";
    const free = people.filter((person) => !taken.has(person.file));
    const left = free.length === 0 ? people : free;
    const dressed = left.filter((person) => person.dress === dress);
    const chosen = pick(dressed.length === 0 ? left : dressed, place.id, date, slot, "who") ?? ROSTER[0];
    if (chosen === undefined) throw new Error("The roster is empty");
    const worn = dayDress(place, chosen, date, slot, city, taken);
    taken.add(worn.file);
    return worn;
  });
}

/**
 * The sample: residents from the dress mix, then, when online and away from a home (`PRIVATE_PLACES`), other players from the
 * presence sample in every slot no part holds, from the last slot back, each tagged with the name the server sent. Given the
 * place's `parts`, the residents who stand at a part spot (`partSpots`) with no one else online are marked
 * with it and keep it.
 * Players seen today (R-CITY-036) take the slots after the live ones and stand at their spots like them.
 * `worn` names outfits already on show outside the sample, which no resident is given.
 */
export function sampleCrowd(
  place: PlaceFacts,
  pool: readonly Person[],
  date: string,
  mode: Mode,
  city: CityTuning,
  others: readonly Other[] = [],
  today: readonly Other[] = [],
  worn: readonly string[] = [],
  parts: Parts | null = null,
): Sample {
  const size = crowdSize(place, mode, city);
  const people: Shown[] = residents(place, pool, date, size, city, worn).map((person, slot) => ({ slot, person, kind: "resident", tag: null }));
  if (parts !== null) {
    // The residents who stand at the parts with no one else online keep those spots whoever comes.
    const kept = partSpots(parts);
    const spots = Array.from({ length: parts.spots }, (_, index) => index);
    for (const { shown, index } of placeCrowd(people, spots, parts.prefer, parts.acts)) if (kept.has(index)) people[shown.slot] = { ...shown, part: index };
  }
  // R-CITY-015, R-CITY-032: players before residents in every slot no part holds; R-CITY-036: those seen today after the live ones.
  // No player is ever shown in someone's home, whatever sample the client holds (R-CITY-015).
  const open = people.filter((shown) => shown.part === undefined).map((shown) => shown.slot).reverse();
  const players = PRIVATE_PLACES.has(place.id) ? [] : [...others, ...today];
  players.slice(0, open.length).forEach((other, index) => {
    const slot = open[index] ?? 0;
    const person = personOfLook(other.look) ?? resident(place, pool, date, slot, city);
    const tag = other.name.trim() === "" ? null : other.name;
    people[slot] = { slot, person, kind: "player", tag };
  });
  return { band: bandOf(size, place.crowd.target), people };
}

/**
 * The spots kept for a part: each spot `prefer` names for a role (a hawker among the vehicles, a trader at the stall),
 * each spot an act keeps for a man or a woman (Mama and Papa at home, the conductor at the danfo's door) and each act
 * marked `staff` (the clerk seated at the counter, the invigilator at her desk). A seat an act only poses is a
 * visitor's (a candidate's desk, a waiting chair, a pew), which players take before residents; a crossing is no part.
 */
export function partSpots(parts: Pick<Parts, "prefer" | "acts">): Set<number> {
  const roles = Object.values(parts.prefer ?? {}).flatMap((indices) => [...(indices ?? [])]);
  const acts = (parts.acts ?? []).filter((act) => act.sex !== undefined || act.staff === true).map((act) => act.spot);
  return new Set([...roles, ...acts]);
}

/** A place's pool: the people its file lists, as roster rows. */
export function poolOf(sample: readonly string[]): Person[] {
  return sample.map((file) => personOfLook(file)).filter((person): person is Person => person !== null);
}

/** Poses that are only a way of standing, so an act may give the person another. */
const PLAIN: ReadonlySet<PoseName> = new Set<PoseName>(["stand", "hip", "selfie"]);

/** The pose a person idles in at a spot: the act's, when it names one and their own is a plain stand. */
export function actPose(person: Pick<Person, "pose">, act: Pick<Act, "pose"> | undefined): PoseName {
  return act?.pose !== undefined && PLAIN.has(person.pose) ? act.pose : person.pose;
}

/** How a person walks: a hawker steadies the tray on her head, everyone else swings both arms. */
export function walkPose(person: Pick<Person, "pose">): PoseName {
  return person.pose === "tray" ? "trayWalk" : "walk";
}

/**
 * Who stands at which of the place's spots. The mode's count of spots is used: every part first (`partSpots`), those a
 * resident already holds before the rest, then the place's other spots in order, so a part past the first few spots
 * (the invigilator's desk, the ward's second nurse) is drawn in the low mode too, and never more spots than the count
 * (R-CITY-032). A resident holding a part keeps its spot (`sampleCrowd`); then a spot the place names for a role goes to
 * a resident of that role, and a spot an act keeps for a man or a woman to a resident in a plain stand, the first in
 * slot order each time; everyone else fills the rest in spot order. A player never takes a part.
 */
export function placeCrowd<Spot>(people: readonly Shown[], spots: readonly Spot[], prefer: Partial<Record<Role, readonly number[]>> = {}, acts: readonly Act[] = []): { shown: Shown; spot: Spot; index: number }[] {
  const count = Math.min(people.length, spots.length);
  const parts = partSpots({ prefer, acts });
  const held = new Set(people.flatMap((shown) => (shown.part === undefined ? [] : [shown.part])));
  const order = (first: (index: number) => boolean): number[] => spots.flatMap((_, index) => (first(index) ? [index] : []));
  const ranked = [...order((index) => parts.has(index) && held.has(index)), ...order((index) => parts.has(index) && !held.has(index)), ...order((index) => !parts.has(index))];
  const used = ranked.slice(0, count).sort((one, two) => one - two);
  const usable = new Set(used);
  const at = new Map<number, Shown>();
  const placed = new Set<number>();
  for (const shown of people) {
    if (shown.part === undefined || !usable.has(shown.part) || at.has(shown.part)) continue;
    at.set(shown.part, shown);
    placed.add(shown.slot);
  }
  for (const [role, indices] of Object.entries(prefer) as [Role, readonly number[]][]) {
    for (const index of indices) {
      if (!usable.has(index) || at.has(index)) continue;
      const shown = people.find((candidate) => !placed.has(candidate.slot) && candidate.kind === "resident" && candidate.person.role === role);
      if (shown === undefined) break;
      at.set(index, shown);
      placed.add(shown.slot);
    }
  }
  for (const act of acts) {
    if (act.sex === undefined || !usable.has(act.spot) || at.has(act.spot)) continue;
    const shown = people.find((candidate) => !placed.has(candidate.slot) && candidate.kind === "resident" && candidate.person.sex === act.sex && PLAIN.has(candidate.person.pose));
    if (shown === undefined) continue;
    at.set(act.spot, shown);
    placed.add(shown.slot);
  }
  const rest = people.filter((shown) => !placed.has(shown.slot));
  const out: { shown: Shown; spot: Spot; index: number }[] = [];
  for (const index of used) {
    const spot = spots[index];
    const shown = at.get(index) ?? rest.shift();
    if (spot !== undefined && shown !== undefined) out.push({ shown, spot, index });
  }
  return out;
}
