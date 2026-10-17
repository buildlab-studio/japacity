import { content } from "@japacity/content";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import type { ReadCtx } from "../engine/types";
import { japacity } from "../japacity/japacity.logic";
import { start } from "../testing/play";
import { INVITE_FILLS, inviteCard, inviteExpires, mayOpenInvite, mayPair, rewardFor, useInvite } from "./pair.invite";
import type { Milestone } from "./pair.invite";

const DAY = 86_400_000;
const pair = content.tuning.pair;

/**
 * Ada with an invite open on her partner slot, set straight to what
 * `people/invite` leaves, so the card is tested on its own.
 */
function adaInviting(looking: string, fill: string | null, slot = "partner"): ReadCtx {
  const game = start({ scenario: "scenario.ada", content });
  const state = {
    ...game.state,
    people: { ...game.state.people, slots: { ...game.state.people.slots, [slot]: { state: "invited" as const, bond: null, person: null, invite: { looking, fill } } } },
  };
  return { state, world: game.world(), content };
}

describe("the invite card", () => {
  test("[R-PAIR-007] given Ada inviting a partner who codes, when the card is made, then it names the character, her japacity and best route, what she is looking for, and that it is a game", () => {
    const read = adaInviting("partner", "who-codes");
    expect(inviteCard(read, "partner")).toEqual({
      name: "scenario.ada.name",
      japacity: japacity(read),
      looking: { key: "card.invite.looking", slot: "partner", fill: "who-codes", slotKey: "card.invite.slot.partner", fillKey: "card.invite.fill.who-codes" },
      game: "card.invite.game",
      controls: ["block", "report"],
    });
  });

  test("[R-PAIR-007] given every fill for each slot, when the card is made, then each is accepted, and a fill from the other slot's list is not", () => {
    for (const fill of INVITE_FILLS.partner) expect(inviteCard(adaInviting("partner", fill), "partner")?.looking.fill).toBe(fill);
    for (const fill of INVITE_FILLS.sibling) expect(inviteCard(adaInviting("sibling", fill, "sibling-1"), "sibling-1")?.looking.fill).toBe(fill);
    expect(inviteCard(adaInviting("partner", "to-go-first"), "partner")).toBeNull();
    expect(inviteCard(adaInviting("partner", "with-money"), "partner")).toBeNull();
    expect(inviteCard(adaInviting("cousin", null), "partner")).toBeNull();
  });

  test("[R-PAIR-007] given no invite open on the slot, when the card is asked for, then there is none", () => {
    const game = start({ scenario: "scenario.ada", content });
    expect(inviteCard({ state: game.state, world: game.world(), content }, "partner")).toBeNull();
  });

  test("[R-PAIR-007] given any card, when read, then it carries no money, no photo, no contact and no link of its own", () => {
    const card = JSON.stringify(inviteCard(adaInviting("partner", "already-in-uk"), "partner"));
    expect(card).not.toMatch(/amount|currency|photo|phone|http|@/);
  });

  test("[R-PAIR-014] given an invite card, when read, then it carries block and report", () => {
    expect(inviteCard(adaInviting("partner", null), "partner")?.controls).toEqual(["block", "report"]);
  });
});

describe("the invite link", () => {
  const made = 1_000 * DAY;
  const expires = inviteExpires(made, pair);

  test("[R-PAIR-008] given a link made now, when used a moment before its days run out and at the moment they do, then only the first works", () => {
    expect(expires).toBe(made + pair.inviteDays * DAY);
    expect(useInvite({ slot: "partner", expires, used: false }, "partner", expires - 1)).toEqual({ ok: true });
    expect(useInvite({ slot: "partner", expires, used: false }, "partner", expires)).toEqual({ ok: false, failed: "expired" });
  });

  test("[R-PAIR-008] given a link already used, or used for another slot, when used, then it is refused", () => {
    expect(useInvite({ slot: "partner", expires, used: true }, "partner", made)).toEqual({ ok: false, failed: "used" });
    expect(useInvite({ slot: "sibling-1", expires, used: false }, "partner", made)).toEqual({ ok: false, failed: "wrong-slot" });
  });

  test("[R-PAIR-008] given one under the open cards allowed, and at it, when another card is made, then only the first may", () => {
    expect(mayOpenInvite(pair.maxOpenInvites - 1, pair)).toBe(true);
    expect(mayOpenInvite(pair.maxOpenInvites, pair)).toBe(false);
  });
});

describe("invite rewards", () => {
  const friends = (count: number): { friend: string; reached: Milestone }[] => Array.from({ length: count }, (_, index) => ({ friend: `friend-${String(index)}`, reached: "prologue" }));

  test("[R-PAIR-009] given a friend finishing the prologue, closing the second chapter and departing, when each is rewarded, then each gives a frame and a line once", () => {
    for (const reached of ["prologue", "chapter-two", "departed"] as const) {
      expect(rewardFor({ friend: "friend-a", reached, given: [] }, pair)).toEqual({ frame: `card.frame.${reached}`, line: `line.pair.reward.${reached}` });
      expect(rewardFor({ friend: "friend-a", reached, given: [{ friend: "friend-a", reached }] }, pair)).toBeNull();
    }
  });

  test("[R-PAIR-009] given one under the friends who can earn rewards, and at it, when a new friend progresses, then only the first earns, and a friend already counted still does", () => {
    expect(rewardFor({ friend: "friend-new", reached: "prologue", given: friends(pair.rewardFriends - 1) }, pair)).not.toBeNull();
    expect(rewardFor({ friend: "friend-new", reached: "prologue", given: friends(pair.rewardFriends) }, pair)).toBeNull();
    expect(rewardFor({ friend: "friend-0", reached: "departed", given: friends(pair.rewardFriends) }, pair)).not.toBeNull();
  });

  test.prop([fc.constantFrom<Milestone>("prologue", "chapter-two", "departed"), fc.nat({ max: 20 })])(
    "[R-PAIR-009] given any progress, when rewarded, then the reward is a frame and a line and never money or turns",
    (reached, count) => {
      const reward = rewardFor({ friend: "friend-x", reached, given: friends(count) }, pair);
      if (reward !== null) expect(Object.keys(reward).sort()).toEqual(["frame", "line"]);
      expect(JSON.stringify(reward)).not.toMatch(/amount|currency|turn|money/);
    },
  );
});

describe("who may be paired", () => {
  test("[R-PAIR-017] [R-REGION-004] given the matchmaker shut, when two who did not invite each other would pair, then no record is made", () => {
    expect(content.tuning.people.matchmaker).toBe(false);
    expect(mayPair("matched", content.tuning)).toBe(false);
    const open = { ...content.tuning, people: { ...content.tuning.people, matchmaker: true } };
    expect(mayPair("matched", open)).toBe(true);
  });

  test("[R-PAIR-018] given two accounts connected by an invite, when the pair would be made, then it is, whatever the matchmaker", () => {
    expect(mayPair("invited", content.tuning)).toBe(true);
    expect(mayPair("invited", { ...content.tuning, people: { ...content.tuning.people, matchmaker: true } })).toBe(true);
  });
});
