// The shipped people as the crowd sees them (city:dress-mix-by-place), by their files: content's one list of who is a man
// or a woman, who is in traditional cloth, who wears the Friday jalamia or the Saturday occasion dress, the part each plays
// when a card is opened on them and how they stand.
import { SHIPPED_PEOPLE, type Dress, type Role, type Wear } from "@japacity/content/shipped-people";
import type { PoseName } from "@japacity/models/people/poses";

export type { Dress, Role };

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

/** The one list of shipped people, kept in content so the server keeps only a look the door offers (account:person-kept-with-character). */
export const ROSTER: readonly Person[] = SHIPPED_PEOPLE.map(({ id, sex, dress, wear, role, pose }) => ({ file: `shared/person/${id}.glb`, sex, dress, wear, role, pose }));

const BY_FILE = new Map(ROSTER.map((row) => [row.file, row]));

export function personOf(file: string): Person | null {
  return BY_FILE.get(file) ?? null;
}

/** A look the server names (`person_tunde`, or the file itself) as a shipped person, or null. */
export function personOfLook(look: string): Person | null {
  return personOf(look.startsWith("shared/") ? look : `shared/person/${look}.glb`);
}
