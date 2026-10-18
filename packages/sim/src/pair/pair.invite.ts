// The invite card, its link and its rewards: docs/rules/pair.md R-PAIR-007 to
// 009, and who may be paired at all, R-PAIR-017 and 018.
import { DAY_MS } from "../engine/time";
import type { Id, ReadCtx, Tuning } from "../engine/types";
import { japacity } from "../japacity/japacity.logic";
import { SAFETY_CONTROLS } from "./pair.logic";

/** What a card may ask for, by the kind of slot (R-PAIR-007). */
export const INVITE_FILLS = {
  partner: ["already-in-uk", "already-in-canada", "abroad-anywhere", "who-is-a-nurse", "who-codes", "to-start-out-with-me"],
  sibling: ["to-start-out-with-me", "to-go-first", "to-follow-me"],
} as const satisfies Record<string, readonly string[]>;

export type InviteSlot = keyof typeof INVITE_FILLS;

/**
 * An invite card as text keys and what it asks for (R-PAIR-007). It carries
 * no photo, no money, no contact and no link but the game's, which the server adds.
 */
export interface InviteCard {
  /** The character's name, never the account's. */
  name: string;
  japacity: { percent: number | null; route: Id<"route"> | null };
  looking: { key: "card.invite.looking"; slot: InviteSlot; fill: string | null; slotKey: string; fillKey: string | null };
  game: "card.invite.game";
  controls: typeof SAFETY_CONTROLS;
}

function isInviteSlot(looking: string): looking is InviteSlot {
  return looking === "partner" || looking === "sibling";
}

/** The card for the invite open on `slot`, or null when there is none or its terms are off the fixed lists. */
export function inviteCard(read: ReadCtx, slot: string): InviteCard | null {
  const invite = read.state.people.slots[slot]?.invite ?? null;
  if (invite === null || !isInviteSlot(invite.looking)) return null;
  const fills: readonly string[] = INVITE_FILLS[invite.looking];
  if (invite.fill !== null && !fills.includes(invite.fill)) return null;
  return {
    // A state holds no name of its own, so the card names the scenario's character.
    name: `${read.state.scenario}.name`,
    japacity: japacity(read),
    looking: {
      key: "card.invite.looking",
      slot: invite.looking,
      fill: invite.fill,
      slotKey: `card.invite.slot.${invite.looking}`,
      fillKey: invite.fill === null ? null : `card.invite.fill.${invite.fill}`,
    },
    game: "card.invite.game",
    controls: SAFETY_CONTROLS,
  };
}

/** When a link made at `madeAt` stops working, on the caller's clock in milliseconds (R-PAIR-008). */
export function inviteExpires(madeAt: number, tuning: Tuning["pair"]): number {
  return madeAt + tuning.inviteDays * DAY_MS;
}

/** Whether a character with `open` cards may make another (R-PAIR-008). */
export function mayOpenInvite(open: number, tuning: Tuning["pair"]): boolean {
  return open < tuning.maxOpenInvites;
}

export type LinkResult = { ok: true } | { ok: false; failed: "used" | "expired" | "wrong-slot" };

/** Whether a link may fill `slot` now: single use, in date, and only the slot it was made for (R-PAIR-008). */
export function useInvite(invite: { slot: string; expires: number; used: boolean }, slot: string, now: number): LinkResult {
  if (invite.used) return { ok: false, failed: "used" };
  if (now >= invite.expires) return { ok: false, failed: "expired" };
  if (invite.slot !== slot) return { ok: false, failed: "wrong-slot" };
  return { ok: true };
}

/** How far an invited friend's character has come. */
export type Milestone = "prologue" | "chapter-two" | "departed";

export interface InviteProgress {
  friend: string;
  reached: Milestone;
  /** The rewards this inviter has had already. */
  given: { friend: string; reached: Milestone }[];
}

/** A reward is a card frame to show and a line: text keys, and nothing that changes play. */
export interface InviteReward {
  frame: string;
  line: string;
}

/**
 * The reward for a friend's progress (R-PAIR-009), or null: once for each
 * milestone and friend, from at most `rewardFriends` friends. Never money or turns.
 */
export function rewardFor(progress: InviteProgress, tuning: Tuning["pair"]): InviteReward | null {
  if (progress.given.some((given) => given.friend === progress.friend && given.reached === progress.reached)) return null;
  const friends = new Set(progress.given.map((given) => given.friend));
  if (!friends.has(progress.friend) && friends.size >= tuning.rewardFriends) return null;
  return { frame: `card.frame.${progress.reached}`, line: `line.pair.reward.${progress.reached}` };
}

/**
 * Whether a record may be made between two accounts (R-PAIR-017, R-PAIR-018):
 * any two connected by an invite, and two who did not invite each other only
 * once the matchmaker is open.
 */
export function mayPair(how: "invited" | "matched", tuning: Tuning): boolean {
  return how === "invited" || tuning.people.matchmaker;
}
