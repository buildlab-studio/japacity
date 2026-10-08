// Who stands in a place today (city.md R-CITY-014 to 017). Pure: a hash of the place's id, the real
// date and the slot picks each person, so the same place on the same day shows the same people and a
// screenshot taken twice is the same. Never `Math.random`, never a stream of the simulation.
import type { PlaceEntry } from "@japacity/sim";

import type { CityTuning, Mode } from "./mode";
import { type Person, personOfLook, ROSTER } from "./roster";

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

/** How many people a place shows in a mode: the mode's figure, capped by the place's own. */
export function crowdSize(place: Pick<PlaceEntry, "crowd">, mode: Mode, city: CityTuning): number {
  return mode === "low" ? Math.min(city.crowdLow, place.crowd.low) : Math.min(city.crowdHigh, place.crowd.high);
}

/** The band shown for a sample: full is packed, under half the mode's figure is quiet. */
export function bandOf(size: number, mode: Mode, city: CityTuning): Band {
  const most = mode === "low" ? city.crowdLow : city.crowdHigh;
  if (size >= most) return "packed";
  if (size * 2 < most) return "quiet";
  return "busy";
}

type PlaceFacts = Pick<PlaceEntry, "id" | "crowd" | "traditionalBp" | "occasion">;

/** One computer person for a slot, from the place's dress mix and the day (R-CITY-016). */
export function resident(place: PlaceFacts, pool: readonly Person[], date: string, slot: number, city: CityTuning): Person {
  const people = pool.length === 0 ? ROSTER : pool;
  const dress = chance(place.id, date, slot, "dress") < place.traditionalBp ? "traditional" : "modern";
  const dressed = people.filter((person) => person.dress === dress);
  const chosen = pick(dressed.length === 0 ? people : dressed, place.id, date, slot, "who") ?? ROSTER[0];
  if (chosen === undefined) throw new Error("The roster is empty");
  const day = weekday(date);
  if (day === FRIDAY && chosen.sex === "m" && chance(place.id, date, slot, "friday") < city.fridayBp) {
    return pick(ROSTER.filter((person) => person.wear === "jalamia"), place.id, date, slot, "jalamia") ?? chosen;
  }
  if (day === SATURDAY && place.occasion && chance(place.id, date, slot, "saturday") < city.saturdayBp) {
    const occasion = ROSTER.filter((person) => person.wear === "occasion");
    const same = occasion.filter((person) => person.sex === chosen.sex);
    return pick(same.length === 0 ? occasion : same, place.id, date, slot, "occasion") ?? chosen;
  }
  return chosen;
}

/**
 * The sample: residents from the dress mix, then, when online, up to `playersMax` of the slots at
 * the end taken by other players from the presence sample, each named only as the server named them.
 * Players seen today (R-CITY-036) take the slots after the live ones and stand at their spots like them.
 */
export function sampleCrowd(place: PlaceFacts, pool: readonly Person[], date: string, mode: Mode, city: CityTuning, others: readonly Other[] = [], today: readonly Other[] = []): Sample {
  const size = crowdSize(place, mode, city);
  const people: Shown[] = Array.from({ length: size }, (_, slot) => ({ slot, person: resident(place, pool, date, slot, city), kind: "resident", tag: null }));
  const players = [...others, ...today].slice(0, Math.min(city.playersMax, size));
  players.forEach((other, index) => {
    const slot = size - 1 - index;
    const person = personOfLook(other.look) ?? resident(place, pool, date, slot, city);
    const tag = other.name === null || other.name.trim() === "" ? null : other.name;
    people[slot] = { slot, person, kind: "player", tag };
  });
  return { band: bandOf(size, mode, city), people };
}

/** A place's pool: the people its file lists, as roster rows. */
export function poolOf(sample: readonly string[]): Person[] {
  return sample.map((file) => personOfLook(file)).filter((person): person is Person => person !== null);
}
