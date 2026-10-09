export type * from "./engine/types";

export { newState, upgradeState } from "./engine/state";
export { step } from "./engine/step";
export { check, allMet, unmet } from "./engine/check";
export { checkContent } from "./engine/content";
export { applyOverlay, checkOverlay } from "./engine/overlay";
export type { Overlay } from "./engine/overlay";
export { checkInvariants } from "./engine/invariants";
export { FIRST_MEETUP_FITS } from "./route/route.logic";
export { hashState, stableJson } from "./engine/hash";
export { replay, newSave, recordCommand, loadSave, isFlatSave, lifeStart, savedCommands, lastSegment, openSegment } from "./engine/replay";
export { viewFor, hiddenPaths } from "./engine/view";
export { drawAt, hashString32 } from "./engine/random";
export * as int from "./engine/int";
export { standInWorld } from "./world/standIn";
export { stepWorld, offlineCalendar } from "./world/director";
export type { DirectorBook, WorldCalendar } from "./world/director";
export { japacity, routePercent } from "./japacity/japacity.logic";
export * as time from "./engine/time";
// The Friday draw's public method: the server draws with it and the client's draw page checks with it (docs/rules/lottery.md R-LOTTERY-015).
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
// The raffle and its house top-up, switched off by decision 0010 and kept with their tests.
export { drawWinners, tiersFor, prizesFor, topUpFor, topUpPart, RAFFLE_AT_SWITCH_OFF } from "./lottery/lottery.draw";
export type { Tier, TierSpec, RaffleSettings } from "./lottery/lottery.draw";
// The pair module: pure functions over the record two lives share (docs/rules/pair.md). The server and both clients use them.
export { pairId, flip, side, other, newRecord, mirror, agreed, writeEvent, pairView, SAFETY_CONTROLS } from "./pair/pair.logic";
export type { PairView, PairWrite, Side } from "./pair/pair.logic";
export { canSay, canSayInPlace, heardBy, fillOptions, saidMoment } from "./pair/phrase.logic";
export type { SayPolicy, PlacePolicy, SayResult, SayRefusal } from "./pair/phrase.logic";
export { phraseChecks } from "./pair/phrase.check";
export { inviteCard, inviteExpires, mayOpenInvite, useInvite, rewardFor, mayPair, INVITE_FILLS } from "./pair/pair.invite";
export type { InviteCard, InviteSlot, LinkResult, Milestone, InviteProgress, InviteReward } from "./pair/pair.invite";
// What one life knows of another (docs/rules/people.md R-PEOPLE-003, 005): the server sends it as `people/facts`.
export { factsOf } from "./people/people.facts";
// The generated names drawn from content's pool by its mix (R-PEOPLE-053, R-CITY-033).
export { drawName, drawPeople, MIX_TOTAL } from "./people/people.names";
export type { NameDrawEntry } from "./people/people.names";
