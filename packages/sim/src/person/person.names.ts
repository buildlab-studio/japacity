// The generated names (person:computer-names-generated, city:residents-carry-no-tag):
// a name drawn from content's pool by its mix.
// Pure: one whole number in, one name out, so a resident keeps the same name
// for as long as the caller keeps the number. The role is never an input, so a
// name cannot predict who the landlord, the agent or the trader is (names rule 5).
import { divFloor } from "../engine/int";

/** The share of the mix a draw is out of: basis points. */
export const MIX_TOTAL = 10000;

export interface NameDrawEntry {
  /** The text key is `person.name.<n>`. */
  n: number;
  people: string;
  sex: "f" | "m" | "either";
}

/** True when a name suits a person of this sex. */
function suits(entry: NameDrawEntry, sex: "f" | "m" | null): boolean {
  return sex === null || entry.sex === "either" || entry.sex === sex;
}

/** The people a roll falls on: each people takes as many of the 10000 rolls as its share of the mix. */
export function drawPeople(mix: Readonly<Record<string, number>>, roll: number): string {
  let left = roll % MIX_TOTAL;
  const peoples = Object.keys(mix);
  for (const people of peoples) {
    const share = mix[people] ?? 0;
    if (left < share) return people;
    left -= share;
  }
  // A mix short of 10000 gives the rest to the last people; the content check holds the mix at 10000.
  return peoples[peoples.length - 1] ?? "";
}

/**
 * A name's number, for a whole number `roll` of at least 0: the people from the
 * roll's last four digits by the mix, the name among that people's names for
 * this sex from the rest. Null only for a pool with no name for the sex.
 */
export function drawName(pool: readonly NameDrawEntry[], mix: Readonly<Record<string, number>>, roll: number, sex: "f" | "m" | null = null): number | null {
  const people = drawPeople(mix, roll);
  const ofPeople = pool.filter((entry) => entry.people === people && suits(entry, sex));
  const choices = ofPeople.length > 0 ? ofPeople : pool.filter((entry) => suits(entry, sex));
  if (choices.length === 0) return null;
  return choices[divFloor(roll, MIX_TOTAL) % choices.length]?.n ?? null;
}
