// London's words fetched in their own chunk (engine.md R-ENGINE-020; world.md R-WORLD-038, R-WORLD-039) and added to the
// late table, once the life is in the UK. The import sits with the city's other chunks, so the first visit's shared words
// carry only the table's few lines (shared/words/late.ts).
import { addLateWords } from "../../shared/words/late";

let london: Promise<void> | null = null;

/** London's words, fetched once, then added so every lookup finds them. */
export function loadLondonWords(): Promise<void> {
  london ??= import("../../shared/words/london.words").then((table) => addLateWords(table.londonWords));
  return london;
}
