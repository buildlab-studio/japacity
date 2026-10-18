// The month's words in the world (docs/rules/world.md R-WORLD-007, 008): the Calendar app and the results, read
// from content's ui/ui.turn.text.ts.
import { readerOf } from "../../shared/words/text";

/** Words for a turn key: content's, else a country's late words. */
export const turnWords = readerOf();
