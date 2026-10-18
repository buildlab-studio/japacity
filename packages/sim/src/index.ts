export type * from "./engine/types";

export { newState, upgradeState } from "./engine/state";
export { step, stepWith, AUTHORITY_COMMANDS } from "./engine/step";
export { check, allMet, unmet } from "./engine/check";
export { checkContent } from "./engine/content";
export { applyOverlay, checkOverlay } from "./engine/overlay";
export type { Overlay } from "./engine/overlay";
export { checkInvariants } from "./engine/invariants";
export { FIRST_MEETUP_FITS, offerChanceBp } from "./route/route.logic";
export { topActivities } from "./chapter/chapter.card";
export { isEarlyWin, earlyWinIn, picksOf } from "./guide/guide.earlyWin";
export { hashState, stableJson } from "./engine/hash";
// A bounded sample of the commands a view allows: random play and the load test's Worker read it.
export { legalCommands } from "./testing/legal";
export type { Loose } from "./testing/play";
export { replay, newSave, recordCommand, loadSave, isFlatSave, lifeStart, savedCommands, lastSegment, openSegment } from "./engine/replay";
export { viewFor, hiddenPaths } from "./engine/view";
export { nextMorning, sealFrom, sealedAt, withhold, withholdLines, REAL_WAIT_DOCUMENTS } from "./engine/envelope";
export type { Envelope } from "./engine/envelope";
export { worldClockAt, nextGameMorning, partOf } from "./engine/worldClock";
export type { WorldClock, DayPart } from "./engine/worldClock";
export { drawAt, hashString32 } from "./engine/random";
export * as int from "./engine/int";
export { standInWorld, standInWorlds } from "./world/standIn";
export { stepWorld, offlineCalendar } from "./world/director";
export type { DirectorBook, WorldCalendar } from "./world/director";
export { japacity, routePercent } from "./japacity/japacity.logic";
export { remitQuote, REMIT_CHANNELS } from "./wallet/wallet.logic";
export type { RemitChannel } from "./wallet/wallet.events";
export { ledgerReport } from "./wallet/wallet.report";
// Where a naira credit lands by its size (wallet:money-lands-as-in-lagos): content's prologue earnings read it too.
export { pocketFor } from "./wallet/wallet.logic";
export { CURRENCIES, isCurrency, placeCurrency, spendable } from "./wallet/wallet.rates";
export { qualityIn } from "./quality/quality.logic";
export { startYearOf } from "./prologue/prologue.logic";
export { rideFare, metresApart, PASS_ACT, withinMetres } from "./place/place.logic";
export type { RideFare } from "./place/place.logic";
export * as time from "./engine/time";
// The Friday draw's public method: the server draws with it and the client's draw page checks with it (lottery:result-published-in-tick-row).
export {
  drawSeed,
  ticketDraw,
  ticketResult,
  drawResults,
  forcedTicket,
  jackpotHit,
  prizesOwed,
  rollJackpot,
  openingJackpot,
  expectedReturnPerMillion,
  fingerprintOf,
  listHashOf,
  sha256,
  toHex,
  fromHex,
  PER_MILLION,
  TIERS,
} from "./lottery/lottery.draw";
// The raffle and its house top-up, switched off by decision 0016 and kept with their tests.
export { drawWinners, tiersFor, prizesFor, topUpFor, topUpPart, RAFFLE_AT_SWITCH_OFF } from "./lottery/lottery.draw";
export type { Tier, TierSpec, RaffleSettings } from "./lottery/lottery.draw";
// The pair module: pure functions over the record two lives share (docs/rules/pair.md). The server and both clients use them.
export { pairId, flip, side, other, newRecord, mirror, agreed, writeEvent, pairView, SAFETY_CONTROLS } from "./pair/pair.logic";
export type { PairView, PairWrite, Side } from "./pair/pair.logic";
export { canSay, canSayInPlace, heardBy, fillOptions, saidMoment } from "./phrase/phrase.logic";
export type { SayPolicy, PlacePolicy, SayResult, SayRefusal } from "./phrase/phrase.logic";
export { phraseChecks } from "./phrase/phrase.check";
export { inviteCard, inviteExpires, mayOpenInvite, useInvite, rewardFor, mayPair, INVITE_FILLS } from "./pair/pair.invite";
export type { InviteCard, InviteSlot, LinkResult, Milestone, InviteProgress, InviteReward } from "./pair/pair.invite";
// What one life knows of another (person:both-lives-step-together, person:facts-function-is-pure): the server sends it as `people/facts`.
export { factsOf } from "./person/person.facts";
// The generated names drawn from content's pool by its mix (person:computer-names-generated, city:residents-carry-no-tag).
export { drawName, drawPeople, MIX_TOTAL } from "./person/person.names";
export type { NameDrawEntry } from "./person/person.names";
