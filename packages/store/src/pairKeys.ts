// pair:one-record-per-two: one record for any two characters. Ids compare by UTF-16 code
// unit, the same order the transaction locks in, never by a locale's collation.
import type { ConversationRow } from "./pair.types";

/** The ascending order every store locks and sorts ids in. */
export function compareIds(x: string, y: string): number {
  if (x === y) return 0;
  return x < y ? -1 : 1;
}

/** The pair key: the two ids sorted and joined by `~`. */
export function pairKey(x: string, y: string): string {
  if (x === y) throw new Error(`A pair needs two characters, and got ${x} twice.`);
  return compareIds(x, y) < 0 ? `${x}~${y}` : `${y}~${x}`;
}

/** The two ids of a pair key, lower first, or null for a key that is not one. */
export function pairIds(key: string): { a: string; b: string } | null {
  const parts = key.split("~");
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  if (a === undefined || b === undefined || a === "" || b === "" || compareIds(a, b) >= 0) return null;
  return { a, b };
}

/** The distinct pair keys the rows name, in id order. */
export function distinctPairKeys(rows: readonly { pair: string | null }[]): string[] {
  return [...new Set(rows.flatMap((row) => (row.pair === null ? [] : [row.pair])))].sort(compareIds);
}

/** pair:conversation-phrases-stored: the order a conversation is read in: by time, then by id in UTF-16 code unit order. */
export function byTime(x: ConversationRow, y: ConversationRow): number {
  if (x.sentAt !== y.sentAt) return x.sentAt - y.sentAt;
  return compareIds(x.id, y.id);
}
