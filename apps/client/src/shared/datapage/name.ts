// The typed name (prologue:front-door-builds-a-person): a first name the player types, with three
// suggestions from the pool under the box. It passes the username's checks (account:username-and-unconfirmed-email): letters
// only here, since it is a first name, a length, and no reserved or blocked word in any spelling. It is reported and reset
// like a username: the moderation kind's `reset-name` resets both (account:person-kept-with-character).
import { blockedWords, PERSON_NAME_LONGEST, PERSON_NAME_SHORTEST, personNameShape, reservedNames } from "@japacity/content";

import { say } from "../words/text";

/** The name's shape is content's, which the server reads too (account:person-kept-with-character). */
export const NAME_SHORTEST = PERSON_NAME_SHORTEST;
export const NAME_LONGEST = PERSON_NAME_LONGEST;

export type NameProblem = "short" | "long" | "letters" | "reserved" | "blocked";

export interface NameLists {
  reserved: readonly string[];
  blocked: readonly string[];
}

/** The username's own lists, kept by the account feature in content (`account.data.ts`), so the door refuses what it does. */
export const DOOR_LISTS: NameLists = { reserved: reservedNames, blocked: blockedWords };

/** The form a name is compared in: lower case, its marks taken off, letters said twice counted once ("aadmin"). */
function folded(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/(.)\1+/g, "$1");
}

/** The problem with a typed name, or null when it may be the character's. */
export function nameProblem(typed: string, lists: NameLists = DOOR_LISTS): NameProblem | null {
  const shape = personNameShape(typed);
  if (shape !== null) return shape;
  const form = folded(typed.trim());
  if (lists.reserved.some((word) => form.includes(folded(word)))) return "reserved";
  if (lists.blocked.some((word) => form.includes(folded(word)))) return "blocked";
  return null;
}

/** The door's words for a problem. */
export function problemWords(problem: NameProblem): string {
  return say(`prologue.door.name.${problem}`, { shortest: NAME_SHORTEST, longest: NAME_LONGEST });
}
