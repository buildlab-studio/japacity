export type * from "./engine/types";

export { newState, upgradeState } from "./engine/state";
export { step } from "./engine/step";
export { check, allMet, unmet } from "./engine/check";
export { checkContent } from "./engine/content";
export { applyOverlay, checkOverlay } from "./engine/overlay";
export type { Overlay } from "./engine/overlay";
export { checkInvariants } from "./engine/invariants";
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
export { drawSeed, drawWinners, tiersFor, prizesFor, fingerprintOf, listHashOf, topUpFor, topUpPart, sha256, toHex, fromHex } from "./lottery/lottery.draw";
export type { Tier, TierSpec } from "./lottery/lottery.draw";
// The pair module: pure functions over the record two lives share (docs/rules/pair.md). The server and both clients use them.
export { pairId, flip, side, other, newRecord, mirror, agreed, writeEvent, pairView, SAFETY_CONTROLS } from "./pair/pair.logic";
export type { PairView, PairWrite, Side } from "./pair/pair.logic";
export { canSay, canSayInPlace, heardBy, fillOptions, saidMoment } from "./pair/phrase.logic";
export type { SayPolicy, PlacePolicy, SayResult, SayRefusal } from "./pair/phrase.logic";
export { phraseChecks } from "./pair/phrase.check";
export { inviteCard, inviteExpires, mayOpenInvite, useInvite, rewardFor, mayPair, INVITE_FILLS } from "./pair/pair.invite";
export type { InviteCard, InviteSlot, LinkResult, Milestone, InviteProgress, InviteReward } from "./pair/pair.invite";
