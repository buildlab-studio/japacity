// The shipped people as the crowd sees them: who is a man or a woman, who is in traditional cloth,
// who wears the Friday jalamia or the Saturday occasion dress (city:dress-mix-by-place), and the part
// each plays when a card is opened on them. One row per shipped `person_` file; the body tests
// (`person_body_*`, `person_control`) are not people of the city.
import type { PoseName } from "@japacity/models/people/poses";

export type Dress = "traditional" | "modern";
/** A special dress: the Friday jalamia and cap, or aso ebi, gele and agbada on a Saturday. */
type Wear = "jalamia" | "occasion" | null;
export type Role = "passer-by" | "hawker" | "rider" | "corper" | "trader" | "elder";

export interface Person {
  /** The file under public/assets. */
  file: string;
  sex: "f" | "m";
  dress: Dress;
  wear: Wear;
  role: Role;
  /** How they stand while idling. */
  pose: PoseName;
}

const person = (name: string, sex: Person["sex"], dress: Dress, role: Role, pose: PoseName, wear: Wear = null): Person => ({
  file: `shared/person/${name}.glb`,
  sex,
  dress,
  wear,
  role,
  pose,
});

export const ROSTER: readonly Person[] = [
  person("person_amaka", "f", "traditional", "passer-by", "stand", "occasion"),
  person("person_chief", "m", "traditional", "elder", "stand", "occasion"),
  person("person_tunde", "m", "modern", "passer-by", "stand"),
  person("person_zainab", "f", "traditional", "passer-by", "hip"),
  person("person_emeka", "m", "traditional", "passer-by", "stand"),
  person("person_ngozi", "f", "modern", "passer-by", "stand"),
  person("person_corper", "m", "modern", "corper", "stand"),
  person("person_kemi", "f", "modern", "passer-by", "selfie"),
  person("person_tolani", "f", "modern", "passer-by", "hip"),
  person("person_bisi", "f", "modern", "passer-by", "selfie"),
  person("person_ada", "f", "modern", "passer-by", "stand"),
  person("person_sade", "f", "modern", "passer-by", "hip"),
  person("person_femi", "m", "traditional", "passer-by", "stand"),
  person("person_obi", "m", "traditional", "trader", "stand"),
  person("person_musa", "m", "traditional", "trader", "stand", "jalamia"),
  person("person_kunle", "m", "modern", "passer-by", "stand"),
  person("person_dayo", "m", "modern", "passer-by", "stand"),
  person("person_tobi", "m", "modern", "passer-by", "hip"),
  person("person_segun", "m", "modern", "passer-by", "stand"),
  person("person_nonso", "m", "modern", "trader", "stand"),
  person("person_bayo", "m", "modern", "passer-by", "stand"),
  person("person_iya", "f", "traditional", "trader", "sell"),
  person("person_hawker_a", "f", "traditional", "hawker", "tray"),
  person("person_hawker_b", "m", "modern", "hawker", "tray"),
  person("person_hawker_c", "f", "traditional", "hawker", "tray"),
  person("person_rider", "m", "modern", "rider", "stand"),
];

const BY_FILE = new Map(ROSTER.map((row) => [row.file, row]));

export function personOf(file: string): Person | null {
  return BY_FILE.get(file) ?? null;
}

/** A look the server names (`person_tunde`, or the file itself) as a shipped person, or null. */
export function personOfLook(look: string): Person | null {
  return personOf(look.startsWith("shared/") ? look : `shared/person/${look}.glb`);
}
