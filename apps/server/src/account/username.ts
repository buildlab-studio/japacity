// account:username-and-unconfirmed-email: the username. Letters, digits and underscore, 3 to 20 long,
// unique whatever the capitals (the store holds that), not on the reserved
// list and holding no blocked word, in any of their spellings. One free change,
// then a wait of `account.renameDays` between changes. A handle only: never the
// character's name and never a way in.
import { USERNAME, type NameProblem } from "@japacity/api";
import { blockedWords, personNameShape, reservedNames } from "@japacity/content";
import { time } from "@japacity/sim";
import type { AccountRow } from "@japacity/store";

import type { ServerConfig } from "../config";

/** Digits that stand in for letters in a spelling meant to slip past the lists. */
const STAND_INS: Record<string, string> = { "0": "o", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g" };

/** Letters said twice count once, so "aadmin" and "suppport" fold like the words they spell. */
function once(text: string): string {
  return text.replace(/(.)\1+/g, "$1");
}

/** The forms a name is compared in: lower case, no underscores, stand-in digits read as letters; a 1 read as both i and l. */
function foldings(name: string): string[] {
  const plain = [...name.toLowerCase().replaceAll("_", "")].map((each) => STAND_INS[each] ?? each).join("");
  return [...new Set([plain.replaceAll("1", "i"), plain.replaceAll("1", "l")].map(once))];
}

const RESERVED = reservedNames.flatMap(foldings);
const BLOCKED = blockedWords.flatMap(foldings);

/** Whether a name in any of its foldings holds a reserved or a blocked word. */
function wordProblem(folded: readonly string[]): "reserved" | "blocked" | null {
  if (RESERVED.some((word) => folded.some((form) => form.includes(word)))) return "reserved";
  if (BLOCKED.some((word) => folded.some((form) => form.includes(word)))) return "blocked";
  return null;
}

/** The problem with a username's text, or null when it may be held. Uniqueness is the store's to judge. */
export function nameProblem(name: unknown): Exclude<NameProblem, "taken" | "wait"> | null {
  if (typeof name !== "string" || !USERNAME.test(name)) return "format";
  return wordProblem(foldings(name));
}

/**
 * account:person-kept-with-character: the problem with a character's first name, or null when it may be kept. Its shape is
 * the door's (content's `personNameShape`: letters only); its words pass the username's own checks, folded the same way
 * once the marks over and under its letters are taken off, so "Ádmín" is "admin" as a username would be.
 */
export function characterNameProblem(name: string): "format" | "reserved" | "blocked" | null {
  if (personNameShape(name) !== null) return "format";
  return wordProblem(foldings(name.trim().normalize("NFD").replace(/\p{M}/gu, "")));
}

/** When the account may next change its username: at once while the free change is unused, else `renameDays` after the last. */
export function renameFrom(row: Pick<AccountRow, "usernameChangedAt">, config: Pick<ServerConfig, "account">): number {
  return row.usernameChangedAt === null ? 0 : row.usernameChangedAt + config.account.renameDays * time.DAY_MS;
}

/**
 * A name of the shape `player_` and eleven characters, for an account whose
 * name a moderator resets (moderation:fixed-admin-actions `reset-name`). The store refuses
 * one already held, and the caller draws again.
 */
export function generatedUsername(randomBytes: (count: number) => Uint8Array): string {
  const digits = [...randomBytes(6)].map((byte) => byte.toString(36).padStart(2, "0").slice(-2)).join("");
  return `player_${digits.slice(0, 11)}`;
}
