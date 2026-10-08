// The whole content of the first milestone, and every word it uses.
import type { Content } from "@japacity/sim";

import { activityAbroadText } from "./activity/activity.abroad.text";
import { activityTable } from "./activity/activity.data";
import { activityText } from "./activity/activity.text";
import { chapterTable } from "./chapter/chapter.data";
import { chapterText } from "./chapter/chapter.text";
import { countryTable } from "./country/country.data";
import { countryText } from "./country/country.text";
import { creditText } from "./credit/credit.text";
import { documentTable } from "./document/document.data";
import { documentText } from "./document/document.text";
import { goalTable } from "./goal/goal.data";
import { goalText } from "./goal/goal.text";
import { lotteryText } from "./lottery/lottery.text";
import { eraTable } from "./era/era.data";
import { interviewTable } from "./interview/interview.data";
import { interviewText } from "./interview/interview.text";
import { peopleSpots, personTable } from "./person/person.data";
import { personText } from "./person/person.text";
import { phraseTable } from "./phrase/phrase.data";
import { phraseText } from "./phrase/phrase.text";
import { placeTable } from "./place/place.data";
import { eraText } from "./era/era.text";
import { newsTable } from "./news/news.data";
import { newsText } from "./news/news.text";
import { obligationTable } from "./obligation/obligation.data";
import { obligationText } from "./obligation/obligation.text";
import { offerAbroadText } from "./offer/offer.abroad.text";
import { offerTable } from "./offer/offer.data";
import { offerText } from "./offer/offer.text";
import { placeText } from "./place/place.text";
import { pointsTable } from "./points/points.data";
import { pointsText } from "./points/points.text";
import { prologueTable } from "./prologue/prologue.data";
import { prologueText } from "./prologue/prologue.text";
import { qualityTable } from "./quality/quality.data";
import { qualityText } from "./quality/quality.text";
import { rejectText } from "./reject/reject.text";
import { routeTable } from "./route/route.data";
import { routeText } from "./route/route.text";
import { prologueScenario } from "./prologue/prologue.data";
import { ngoziScenario, scenarioTable } from "./scenario/scenario.data";
import { scenarioText } from "./scenario/scenario.text";
import { schoolTable } from "./school/school.data";
import { schoolText } from "./school/school.text";
import { setpieceTable } from "./setpiece/setpiece.data";
import { setpieceText } from "./setpiece/setpiece.text";
import { shareText } from "./share/share.text";
import { statusTable } from "./status/status.data";
import { turnText } from "./turn/turn.text";
import { statusLinesText } from "./status/status.lines.text";
import { statusText } from "./status/status.text";
import { tuning } from "./tuning/tuning.data";
import { varTable } from "./var/var.data";
import { varText } from "./var/var.text";
import { walletText } from "./wallet/wallet.text";

export { officialAccounts, shareChapters, shareKinds } from "./share/share.data";
export type { OfficialAccount, OfficialPlatform, ShareKind } from "./share/share.data";

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
  scenario: { ...scenarioTable, [ngoziScenario.id]: ngoziScenario, [prologueScenario.id]: prologueScenario },
  country: countryTable,
  status: statusTable,
  goal: goalTable,
  era: eraTable,
  place: placeTable,
  person: personTable,
  phrase: phraseTable,
  interview: interviewTable,
  people: { spots: peopleSpots },
  // The tables start empty; their builders fill them (adverts.md, guides.md, analytics.md).
  advert: {},
  guide: {},
  analytics: { counters: [] },
  points: pointsTable,
  prologue: prologueTable,
  tuning,
};

/** Every words file, by the name it is merged under. */
export const textTables: Record<string, Record<string, string>> = {
  phrase: phraseText,
  activity: activityText,
  activityAbroad: activityAbroadText,
  chapter: chapterText,
  country: countryText,
  credit: creditText,
  document: documentText,
  goal: goalText,
  interview: interviewText,
  lottery: lotteryText,
  era: eraText,
  news: newsText,
  obligation: obligationText,
  offer: offerText,
  offerAbroad: offerAbroadText,
  person: personText,
  place: placeText,
  points: pointsText,
  prologue: prologueText,
  quality: qualityText,
  reject: rejectText,
  route: routeText,
  scenario: scenarioText,
  school: schoolText,
  setpiece: setpieceText,
  share: shareText,
  turn: turnText,
  status: statusText,
  statusLines: statusLinesText,
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
