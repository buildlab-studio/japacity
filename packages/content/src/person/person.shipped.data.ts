// The shipped people as the crowd sees them (city:dress-mix-by-place): who is a man or a woman, who is in traditional cloth,
// who wears the Friday jalamia or the Saturday occasion dress, the part each plays when a card is opened on them, and how
// they stand. One row per shipped `person_` file; the body tests (`person_body_*`, `person_control`) are not people of the
// city. The passers-by are the looks the front door offers (prologue:front-door-builds-a-person), and the server keeps
// only one of them with a character (account:person-kept-with-character): the client's crowd, the door and the server
// read this one list.

export type Dress = "traditional" | "modern";
/** A special dress: the Friday jalamia and cap, or aso ebi, gele and agbada on a Saturday. */
export type Wear = "jalamia" | "occasion" | null;
export type Role = "passer-by" | "hawker" | "rider" | "corper" | "trader" | "elder";
/** How a person stands while idling: a pose of the models' own. */
export type IdlePose = "stand" | "hip" | "selfie" | "sell" | "tray";

export interface ShippedPerson {
  /** The shipped file's name, `person_ada`. */
  id: string;
  sex: "f" | "m";
  dress: Dress;
  wear: Wear;
  role: Role;
  pose: IdlePose;
}

const person = (id: string, sex: ShippedPerson["sex"], dress: Dress, role: Role, pose: IdlePose, wear: Wear = null): ShippedPerson => ({ id, sex, dress, wear, role, pose });

export const SHIPPED_PEOPLE: readonly ShippedPerson[] = [
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

/** A look the front door offers: a shipped person who is a passer-by, a whole look that carries the sex and never a stat. */
export function doorLookOf(id: string): ShippedPerson | null {
  return SHIPPED_PEOPLE.find((row) => row.id === id && row.role === "passer-by") ?? null;
}
