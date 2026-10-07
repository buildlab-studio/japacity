// The whole content of the first milestone, and every word it uses.
import type { Content } from "@japacity/sim";

import { activityTable } from "./activity/activity.data";
import { activityText } from "./activity/activity.text";
import { chapterTable } from "./chapter/chapter.data";
import { chapterText } from "./chapter/chapter.text";
import { countryTable } from "./country/country.data";
import { documentTable } from "./document/document.data";
import { documentText } from "./document/document.text";
import { newsTable } from "./news/news.data";
import { newsText } from "./news/news.text";
import { obligationTable } from "./obligation/obligation.data";
import { obligationText } from "./obligation/obligation.text";
import { offerTable } from "./offer/offer.data";
import { offerText } from "./offer/offer.text";
import { qualityTable } from "./quality/quality.data";
import { qualityText } from "./quality/quality.text";
import { rejectText } from "./reject/reject.text";
import { routeTable } from "./route/route.data";
import { routeText } from "./route/route.text";
import { scenarioTable } from "./scenario/scenario.data";
import { scenarioText } from "./scenario/scenario.text";
import { schoolTable } from "./school/school.data";
import { schoolText } from "./school/school.text";
import { setpieceTable } from "./setpiece/setpiece.data";
import { setpieceText } from "./setpiece/setpiece.text";
import { statusTable } from "./status/status.data";
import { tuning } from "./tuning/tuning.data";
import { varTable } from "./var/var.data";
import { varText } from "./var/var.text";
import { walletText } from "./wallet/wallet.text";

export const content: Content = {
  version: "m0.1",
  quality: qualityTable,
  activity: activityTable,
  document: documentTable,
  school: schoolTable,
  route: routeTable,
  setpiece: setpieceTable,
  obligation: obligationTable,
  offer: offerTable,
  chapter: chapterTable,
  var: varTable,
  news: newsTable,
  scenario: scenarioTable,
  country: countryTable,
  status: statusTable,
  // Filled by the whole-life content work from docs/rules/goal.md, director.md, route-gates.md and prologue.md.
  goal: {},
  era: {},
  points: {},
  prologue: {},
  tuning,
};

/** Every words file, by the name it is merged under. */
export const textTables: Record<string, Record<string, string>> = {
  activity: activityText,
  chapter: chapterText,
  document: documentText,
  news: newsText,
  obligation: obligationText,
  offer: offerText,
  quality: qualityText,
  reject: rejectText,
  route: routeText,
  scenario: scenarioText,
  school: schoolText,
  setpiece: setpieceText,
  var: varText,
  wallet: walletText,
};

/**
 * Joins words files into one table. Two files giving the same key is a mistake
 * that would let one silently hide the other, so it throws.
 */
export function mergeText(tables: Record<string, Record<string, string>>): Record<string, string> {
  const merged: Record<string, string> = {};
  const from: Record<string, string> = {};
  for (const [file, table] of Object.entries(tables)) {
    for (const [key, words] of Object.entries(table)) {
      const earlier = from[key];
      if (earlier !== undefined) {
        throw new Error(`The words files ${earlier} and ${file} both give the key ${key}`);
      }
      from[key] = file;
      merged[key] = words;
    }
  }
  return merged;
}

export const text: Record<string, string> = mergeText(textTables);
