// Each painted city's own words (decision 0026; docs/rules/world.md R-WORLD-038, R-WORLD-039): its districts, its
// cards, its water and any inset, from content's ui/ui.paper.text.ts, read as the map's words are, the city's own table
// beside content's.
import { uiCalgaryMapText, uiCastelMapText, uiDubaiMapText, uiLondonMapText } from "@japacity/content/ui/paper";

import { readerOf } from "../../../shared/words/text";

export const londonMapWords = readerOf(uiLondonMapText);
export const calgaryMapWords = readerOf(uiCalgaryMapText);
export const dubaiMapWords = readerOf(uiDubaiMapText);
export const castelMapWords = readerOf(uiCastelMapText);
