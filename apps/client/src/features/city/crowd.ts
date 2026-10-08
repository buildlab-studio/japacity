// Who stands in a place today (city.md R-CITY-014 to 017). Pure: a hash of the place's id, the real
// date and the slot picks each person, so the same place on the same day shows the same people and a
// screenshot taken twice is the same. Never `Math.random`, never a stream of the simulation.
import type { PoseName } from "@japacity/assets-src/people/poses";
import type { PlaceEntry } from "@japacity/sim";

import type { CityTuning, Mode } from "./mode";
import type { Act } from "./placeFile";
import { type Person, personOfLook, type Role, ROSTER } from "./roster";

export type Band = "quiet" | "busy" | "packed";

/** Another player in the place, as the authority's presence sample gives them. */
export interface Other {
  look: string;
  /** Null or empty for a stranger: shown by look alone (R-CITY-015). */
  name: string | null;
}

export interface Shown {
  slot: number;
  person: Person;
  /** A computer person who lives in the city, or another player. */
  kind: "resident" | "player";
  /** A player's name exactly as the server gave it, or null: residents carry no tag. */
  tag: string | null;
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
 * repeats people only once it is used up.
 */
export function residents(place: PlaceFacts, pool: readonly Person[], date: string, size: number, city: CityTuning): Person[] {
  const people = pool.length === 0 ? ROSTER : pool;
  const slots = Array.from({ length: size }, (_, slot) => slot);
  const ranked = [...slots].sort((one, two) => hash(`${place.id}|${date}|${String(one)}|dress`) - hash(`${place.id}|${date}|${String(two)}|dress`) || one - two);
  const traditional = new Set(ranked.slice(0, traditionalCount(size, place.traditionalBp)));
  const taken = new Set<string>();
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

/** How many other players a sample of `size` may show: playersMax, leaving residentFloor residents (R-CITY-032). */
export function playersRoom(size: number, city: CityTuning): number {
  return Math.max(0, Math.min(city.playersMax, size - city.residentFloor));
}

/**
 * The sample: residents from the dress mix, then, when online, up to `playersRoom` of the slots at
 * the end taken by other players from the presence sample, each named only as the server named them.
 * Players seen today (R-CITY-036) take the slots after the live ones and stand at their spots like them.
 */
export function sampleCrowd(place: PlaceFacts, pool: readonly Person[], date: string, mode: Mode, city: CityTuning, others: readonly Other[] = [], today: readonly Other[] = []): Sample {
  const size = crowdSize(place, mode, city);
  const people: Shown[] = residents(place, pool, date, size, city).map((person, slot) => ({ slot, person, kind: "resident", tag: null }));
  // R-CITY-036: those seen today take the slots after the live players, inside the room left for players.
  const players = [...others, ...today].slice(0, playersRoom(size, city));
  players.forEach((other, index) => {
    const slot = size - 1 - index;
    const person = personOfLook(other.look) ?? resident(place, pool, date, slot, city);
    const tag = other.name === null || other.name.trim() === "" ? null : other.name;
    people[slot] = { slot, person, kind: "player", tag };
  });
  return { band: bandOf(size, place.crowd.target), people };
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
 * Who stands at which of the place's spots. The first `people.length` spots are used, in order; a
 * spot the place names for a role (a hawker among the vehicles, a trader at the stall) goes to
 * someone of that role in the sample when there is one, a spot an act keeps for a man or a woman
 * goes to one in a plain stand, and everyone else fills the rest in slot order.
 */
export function placeCrowd<Spot>(people: readonly Shown[], spots: readonly Spot[], prefer: Partial<Record<Role, readonly number[]>> = {}, acts: readonly Act[] = []): { shown: Shown; spot: Spot; index: number }[] {
  const count = Math.min(people.length, spots.length);
  const at = new Map<number, Shown>();
  const placed = new Set<number>();
  for (const [role, indices] of Object.entries(prefer) as [Role, readonly number[]][]) {
    for (const index of indices) {
      if (index >= count || at.has(index)) continue;
      const shown = people.find((candidate) => !placed.has(candidate.slot) && candidate.person.role === role);
      if (shown === undefined) break;
      at.set(index, shown);
      placed.add(shown.slot);
    }
  }
  for (const act of acts) {
    if (act.sex === undefined || act.spot >= count || at.has(act.spot)) continue;
    const shown = people.find((candidate) => !placed.has(candidate.slot) && candidate.kind === "resident" && candidate.person.sex === act.sex && PLAIN.has(candidate.person.pose));
    if (shown === undefined) continue;
    at.set(act.spot, shown);
    placed.add(shown.slot);
  }
  const rest = people.filter((shown) => !placed.has(shown.slot));
  const out: { shown: Shown; spot: Spot; index: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    const spot = spots[index];
    const shown = at.get(index) ?? rest.shift();
    if (spot !== undefined && shown !== undefined) out.push({ shown, spot, index });
  }
  return out;
}
