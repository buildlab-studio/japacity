// The typed name (prologue.md R-PROLOGUE-009; the review): a first name the player types, with three
// suggestions from the pool under the box. It passes the username's checks (account.md R-ACCOUNT-024): letters
// only here, since it is a first name, a length, and no reserved or blocked word in any spelling. It may be reported
// and reset like a username later, which is the moderation feature's to build.
import { say } from "../words/text";

export const NAME_SHORTEST = 2;
export const NAME_LONGEST = 20;

export type NameProblem = "short" | "long" | "letters" | "reserved" | "blocked";

export interface NameLists {
  reserved: readonly string[];
  blocked: readonly string[];
}

/**
 * the account feature keeps the reserved and blocked lists in content (`account.data.ts`), which is not
 * on main yet. Until it lands the door holds the reserved words the username rule names, and no blocked word; the
 * report asks for the account's lists to be passed here when they do.
 */
export const DOOR_LISTS: NameLists = { reserved: ["japacity", "admin", "support", "staff", "official", "moderator"], blocked: [] };

/** A letter and the marks over and under it (Adébáyọ̀, Ọlá), and nothing else. */
const LETTERS = /^[\p{L}\p{M}]+$/u;

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
  const name = typed.trim();
  const length = [...name.normalize("NFC")].filter((each) => !/\p{M}/u.test(each)).length;
  if (length < NAME_SHORTEST) return "short";
  if (length > NAME_LONGEST) return "long";
  if (!LETTERS.test(name)) return "letters";
  const form = folded(name);
  if (lists.reserved.some((word) => form.includes(folded(word)))) return "reserved";
  if (lists.blocked.some((word) => form.includes(folded(word)))) return "blocked";
  return null;
}

/** The door's words for a problem. */
export function problemWords(problem: NameProblem): string {
  return say(`prologue.door.name.${problem}`, { shortest: NAME_SHORTEST, longest: NAME_LONGEST });
}
