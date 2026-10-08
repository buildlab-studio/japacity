// R-PAIR-001: one record for any two characters. Ids compare by UTF-16 code
// unit, the same order the transaction locks in, never by a locale's collation.

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
