// The map's words, read from content's ui/ui.map.text.ts, and the ride's working numbers (docs/rules/world.md
// R-WORLD-015 to 017).
import { readerOf } from "../../shared/words/text";
import type { RideChoice } from "../../shared/world/contract";

/** Words for a map key: content's, else a country's late words. */
export const mapWords = readerOf();

/** The ways of Lagos in the order the sheet lists them: cheapest first. */
export const WAYS: readonly Exclude<RideChoice["id"], "drive" | "bus" | "train" | "taxi">[] = ["danfo", "keke", "okada", "walk"];
