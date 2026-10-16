// Words a first visit does not carry (engine.md R-ENGINE-020): a table kept in a chunk of its own and added here once the
// life needs it, London's places and rides once the life is in the UK (world.md R-WORLD-038, R-WORLD-039). The words'
// lookups read it after content's and the interface's tables; a key read before its table arrives shows as itself, as
// any missing key does.
const late: Record<string, string> = {};

/** Adds a table's words, so every lookup finds them from now on. */
export function addLateWords(table: Readonly<Record<string, string>>): void {
  Object.assign(late, table);
}

/** A late table's words for a key, or undefined while none is added. */
export function lateWord(key: string): string | undefined {
  return late[key];
}
