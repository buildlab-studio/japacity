// The whole content of the first milestone, and every word it uses.
import type { Content } from "@japacity/sim";

import { aboutText } from "./about/about.text";
import { accountText } from "./account/account.text";
import { activityAbroadText } from "./activity/activity.abroad.text";
import { activitySignalsText } from "./activity/activity.signals.text";
import { activityTable } from "./activity/activity.data";
import { advertTable } from "./advert/advert.data";
import { advertText } from "./advert/advert.text";
import { activityText } from "./activity/activity.text";
import { withWhen } from "./activity/activity.when.data";
import { adviceActivityTable, adviceOfferTable } from "./advice/advice.data";
import { adviceText } from "./advice/advice.text";
import { counterTable } from "./analytics/analytics.data";
import { chapterTable } from "./chapter/chapter.data";
import { chapterText } from "./chapter/chapter.text";
import { countryTable } from "./country/country.data";
import { countryText } from "./country/country.text";
import { comedyText } from "./comedy/comedy.text";
import { creditText } from "./credit/credit.text";
import { documentTable } from "./document/document.data";
import { documentText } from "./document/document.text";
import { familyText } from "./family/family.text";
import { goalTable } from "./goal/goal.data";
import { goalText } from "./goal/goal.text";
import { homeText } from "./home/home.text";
import { thingTable } from "./thing/thing.data";
import { thingText } from "./thing/thing.text";
import { guideTable } from "./guide/guide.data";
import { guideText } from "./guide/guide.text";
import { lotteryText } from "./lottery/lottery.text";
import { momentText } from "./moment/moment.text";
import { eraTable } from "./era/era.data";
import { interviewTable } from "./interview/interview.data";
import { interviewText } from "./interview/interview.text";
import { peopleSpots, personTable } from "./person/person.data";
import { personNamesText } from "./person/person.names.text";
import { personRecurringText } from "./person/person.recurring.text";
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
import { hometownText } from "./prologue/prologue.hometown.text";
import { prologueText } from "./prologue/prologue.text";
import { qualityTable } from "./quality/quality.data";
import { qualityText } from "./quality/quality.text";
import { rejectText } from "./reject/reject.text";
import { routeTable } from "./route/route.data";
import { routeText } from "./route/route.text";
import { prologueScenario } from "./prologue/prologue.data";
import { aniekanScenario, ngoziScenario, scenarioTable } from "./scenario/scenario.data";
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
import { storyText } from "./story/story.text";
import { tuning } from "./tuning/tuning.data";
import { varTable } from "./var/var.data";
import { varText } from "./var/var.text";
import { walletText } from "./wallet/wallet.text";

export { DEDICATION, DEDICATION_NICKNAME, DEDICATION_SHORT } from "./about/about.data";
export { checkLight, checkSentLight, LIGHT_FIRST_YEAR, LIGHT_NAME_CHARACTERS, LIGHT_NAME_WORDS, LIGHT_PROBLEMS, lightWords, lightYears } from "./about/light";
export type { Light, LightAsked, LightChecked, LightProblem } from "./about/light";
export { blockedWords, reservedNames } from "./account/account.data";
export { CSP_DIRECTIVES, FUNNEL_STEPS, HELD_BANDS, MONTH_BANDS, ONLINE_MINUTES, SESSION_BANDS, SESSION_GAP_MINUTES } from "./analytics/analytics.data";
export { japaTypes, officialAccounts, shareChapters, shareKinds } from "./share/share.data";
export { OPERATOR, type Operator } from "./legal/legal.operator";
export { LICENCES_PATH, LICENCES_URL, REGISTER_URL, REPOSITORY_URL } from "./legal/legal.repository";
export { lifePeople, nameMix, namedMix, namedPeople, namePool, peopleRegion, takingRoles } from "./person/person.names.data";
export type { NamedPerson, NamedRole, NameFaith, NamePeople, NameSex, PoolName } from "./person/person.names.data";
export { recurringPeople } from "./person/person.recurring.data";
export type { RecurringPerson, RecurringRole } from "./person/person.recurring.data";
export { familyFeed, familyNames, familyPosts, travelKnown } from "./family/family.data";
export { HOMETOWN_FILL, hometownByHome, hometownCities, hometownRegion, hometownTowns } from "./prologue/prologue.hometown.data";
export type { FamilyPost, FamilyPostKind, FamilySender } from "./family/family.data";
/** The story tied to the world (world.md R-WORLD-003, R-WORLD-019, R-WORLD-020). */
export { NUDGE_WORDS, storyStep, storySteps, storyThings } from "./story/story.data";
export type { StoryAct, StoryApp, StoryStep } from "./story/story.data";
export { signalHolds, signalsHold } from "./story/story.signal";
export type { StorySignal, StoryView } from "./story/story.signal";
export { chatLines, chatsDue, siblingNames, threadSenders } from "./story/story.chats.data";
export type { ChatLine, ChatReply, ChatSender, ChatThread } from "./story/story.chats.data";
export { noticeKey, noticesDue, OBLIGATION_TYPES, reminders, remindersDue } from "./story/story.notice.data";
export type { Notice, Reminder } from "./story/story.notice.data";
export { meetingThings, partnerMeetings, placesWanted } from "./person/person.meet.data";
export type { PartnerMeeting } from "./person/person.meet.data";
export { spendingLines, versionedLines } from "./comedy/comedy.data";
export { versionCount, versionKey } from "./comedy/comedy";
export { badNews, reportPlain } from "./comedy/comedy.check";
export type { PlainOnly } from "./comedy/comedy";
export type { JapaType, OfficialAccount, OfficialPlatform, ShareKind } from "./share/share.data";

/**
 * The content version before this one (docs/rules/server.md R-SERVER-023): the server bundles it beside the current,
 * so a life saved under it replays and is upgraded on its first load. m0.2 followed m0.1 when the lived
 * month, the arrivals, the body and the street's money landed; m0.3 follows m0.2 when London was built on
 * the Lagos mold: rides abroad and the bus pass, London's places, food bought in pounds and the UK's upkeep the phone
 * alone (decision 0042).
 */
export const PREVIOUS_CONTENT_VERSION = "m0.2";

export const content: Content = {
  version: "m0.3",
  quality: qualityTable,
  // advice.md: the friend, the adviser and the agents.
  activity: withWhen({ ...activityTable, ...adviceActivityTable }),
  document: documentTable,
  school: schoolTable,
  route: routeTable,
  setpiece: setpieceTable,
  obligation: obligationTable,
  offer: { ...offerTable, ...adviceOfferTable },
  chapter: chapterTable,
  var: varTable,
  news: newsTable,
  scenario: { ...scenarioTable, [ngoziScenario.id]: ngoziScenario, [aniekanScenario.id]: aniekanScenario, [prologueScenario.id]: prologueScenario },
  country: countryTable,
  status: statusTable,
  goal: goalTable,
  era: eraTable,
  place: placeTable,
  person: personTable,
  phrase: phraseTable,
  interview: interviewTable,
  // The market's things for the home.
  thing: thingTable,
  people: { spots: peopleSpots },
  // The tables (adverts.md, guides.md, analytics.md).
  advert: advertTable,
  guide: guideTable,
  analytics: { counters: counterTable },
  points: pointsTable,
  prologue: prologueTable,
  tuning,
};

/** Every words file, by the name it is merged under. */
export const textTables: Record<string, Record<string, string>> = {
  about: aboutText,
  account: accountText,
  phrase: phraseText,
  activity: activityText,
  activityAbroad: activityAbroadText,
  activitySignals: activitySignalsText,
  advert: advertText,
  advice: adviceText,
  chapter: chapterText,
  country: countryText,
  credit: creditText,
  document: documentText,
  goal: goalText,
  guide: guideText,
  home: homeText,
  thing: thingText,
  interview: interviewText,
  lottery: lotteryText,
  moment: momentText,
  era: eraText,
  news: newsText,
  obligation: obligationText,
  offer: offerText,
  offerAbroad: offerAbroadText,
  person: personText,
  personNames: personNamesText,
  personRecurring: personRecurringText,
  comedy: comedyText,
  family: familyText,
  place: placeText,
  points: pointsText,
  prologue: prologueText,
  hometown: hometownText,
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
  story: storyText,
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

export { guideChecks, guideForRoute, guideKeys, staleGuides } from "./guide/guide.check";
export { GUIDE_SECTIONS } from "./guide/guide.data";
export { sourcesList, type ListedSource, type RulePageSources, type SourcesList } from "./guide/guide.sources";
export { inline, isoDay, readRulePage, type Inline, type RulePage, type RuleSource } from "./guide/guide.rules";
/** R-ADVERT-001, R-ADVERT-002: the slots check, which the engine's content check does not reach. */
export { advertChecks } from "./advert/advert.check";
export { realNameChecks } from "./place/place.check";
/** R-WORLD-030: the lines each month-act says of itself as the month passes, with the week each comes in. */
export { activitySignals, type ActivitySignal } from "./activity/activity.signals.text";
/** The officer's spoken lines and their clips. */
export { OFFICER_REACTIONS, setpieceVoice, type VoiceClip } from "./setpiece/setpiece.voice";
