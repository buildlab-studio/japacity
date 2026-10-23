// Words a first visit does not carry, fetched each in a chunk of its own (engine:first-download-has-budget) and added to the late table
// before their screen is drawn: the account sheet's (the username's change, the passkeys, signing out and deleting the account,
// content's ui/ui.accountSheet.text.ts), fetched by the account's row with the sheet's code, and the dedication page's
// (content's ui/ui.dedication.text.ts), fetched with the page's own chunk. The first visit carries only the late table's few lines
// (shared/words/late.ts).
import { addLateWords } from "./late";

const loading = new Map<string, Promise<void>>();

/** Each table, fetched by a dynamic import so it rides a chunk of its own. */
const TABLES = {
  sheet: () => import("@japacity/content/ui/account-sheet").then((table) => table.uiAccountSheetText),
  dedication: () => import("@japacity/content/ui/dedication").then((table) => table.uiDedicationText),
} as const satisfies Readonly<Record<string, () => Promise<Readonly<Record<string, string>>>>>;

/** The words of a screen a first visit does not open. */
export type LaterWords = keyof typeof TABLES;

/** The table's words, fetched once, then added so every lookup finds them. A fetch that fails is asked again next time. */
export function loadLaterWords(name: LaterWords): Promise<void> {
  const known = loading.get(name);
  if (known !== undefined) return known;
  const load = TABLES[name]()
    .then((words) => addLateWords(words))
    .catch((error: unknown) => {
      loading.delete(name);
      throw error;
    });
  loading.set(name, load);
  return load;
}
