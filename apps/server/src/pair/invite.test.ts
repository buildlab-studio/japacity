import { content } from "@japacity/content";
import { pairId, time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { view } from "../authority/testing";
import type { InviteAccepted, InviteMade, InviteShown, InvitesListed } from "./invite";
import type { PairRejection } from "./codes";
import { act, bondIn, call, cardOut, FRIEND, INVITER, linkedPair, must, newLife, pairServer, recordOf, signUp, stateOf, tuned } from "./pair.testing";

type Reply<B> = B | PairRejection;

async function accept(server: ReturnType<typeof pairServer>, account: string, code: string, body: unknown = { slot: "partner" }) {
  return (await call<Reply<InviteAccepted>>(server, "POST", `/api/invite/${code}/accept`, account, body)).body;
}

/** An account in `country` whose age screen is passed or not. */
async function accountIn(server: ReturnType<typeof pairServer>, id: string, country: string, passed = true): Promise<void> {
  const made = await server.deps.stores.account.create({ id, country, age: { passed, at: server.deps.now(), method: "declared" }, createdAt: server.deps.now(), character: null });
  if (!made.ok) throw new Error(made.detail);
}

describe("invite links", () => {
  test("[R-PAIR-008] [R-PEOPLE-010] given a partner card out, when the friend takes the link, then the record is made at connected, both lives hold a connected bond with the pair, and the inviter's slot is no longer out", async () => {
    const { server, a, b, key } = await linkedPair();

    const stored = await recordOf(server.deps, key);
    expect(stored?.v).toBe(1);
    expect(stored?.record).toMatchObject({ id: key, role: "partner", stage: "connected", ended: null, held: false });
    expect(stored?.record[stored.record.invitedBy]).toBe(a);
    const inviter = await stateOf(server, a);
    const friend = await stateOf(server, b);
    expect(inviter.people.bonds[bondIn(inviter, key)]).toMatchObject({ role: "partner", stage: "connected", with: { kind: "player", pair: key } });
    expect(friend.people.bonds[bondIn(friend, key)]).toMatchObject({ role: "partner", stage: "connected", with: { kind: "player", pair: key } });
    expect(inviter.people.slots.partner?.state).toBe("empty");
    expect(inviter.people.bonds[bondIn(inviter, key)]?.facts?.label).toBe("player");
  });

  test("[R-PAIR-007] given a card out, when anyone opens its link with no session, then it shows the card's keys and ids and nothing that is money, a photo or a contact", async () => {
    const server = pairServer();
    await newLife(server, INVITER);
    const code = await cardOut(server);

    const shown = await call<Reply<InviteShown>>(server, "GET", `/api/invite/${code}`, null);

    expect(shown.status).toBe(200);
    expect(shown.body).toMatchObject({ ok: true, slot: "partner", looking: "partner", card: { looking: { slot: "partner", fill: "who-codes" }, game: "card.invite.game", controls: ["block", "report"] } });
    expect(Object.keys((shown.body as InviteShown).card).sort()).toEqual(["controls", "game", "japacity", "looking", "name"]);
    expect(shown.text).not.toMatch(/kobo|naira|photo|phone|http|@/i);
  });

  test("[R-PAIR-008] given a link taken once, when another account takes it, then it is refused as used and the record does not move", async () => {
    const { server, key, code } = await linkedPair();
    expect((await call<Reply<InvitesListed>>(server, "GET", "/api/invite", INVITER)).body).toMatchObject({ ok: true, open: [] });
    await newLife(server, "account-c", "scenario.zainab");

    const again = await accept(server, "account-c", code);
    const shown = await call<Reply<InviteShown>>(server, "GET", `/api/invite/${code}`, null);

    expect(again).toMatchObject({ ok: false, code: "used" });
    expect(shown.body).toMatchObject({ ok: false, code: "used" });
    expect((await recordOf(server.deps, key))?.v).toBe(1);
  });

  test("[R-PAIR-008] given a link, when it is taken a millisecond before it runs out, then it works, and at the moment it runs out it is refused as expired", async () => {
    const server = pairServer();
    await newLife(server, INVITER);
    await newLife(server, FRIEND, "scenario.tunde");
    await newLife(server, "account-c", "scenario.zainab");
    const code = await cardOut(server);
    const made = await server.deps.stores.invite.get(code);
    if (made === null) throw new Error("No link.");
    expect(made.expires - made.madeAt).toBe(content.tuning.pair.inviteDays * time.DAY_MS);

    server.setNow(made.expires);
    expect(await accept(server, FRIEND, code)).toMatchObject({ ok: false, code: "expired" });
    expect((await call<Reply<InviteShown>>(server, "GET", `/api/invite/${code}`, null)).body).toMatchObject({ ok: false, code: "expired" });

    server.setNow(made.expires - 1);
    expect(await accept(server, "account-c", code)).toMatchObject({ ok: true });
  });

  test("[R-PAIR-008] given a partner link, when it is taken for another slot, then it is refused as wrong-slot and no record is made", async () => {
    const server = pairServer();
    const a = await newLife(server, INVITER);
    const b = await newLife(server, FRIEND, "scenario.tunde");
    const code = await cardOut(server);

    expect(await accept(server, FRIEND, code, { slot: "sibling-1" })).toMatchObject({ ok: false, code: "wrong-slot" });
    expect(await recordOf(server.deps, pairId(a, b))).toBeNull();
  });

  test("[R-PAIR-008] given a card taken back after its link was made, when the link is taken, then it is refused as wrong-slot and the link stays unused", async () => {
    const server = pairServer();
    const a = await newLife(server, INVITER);
    const b = await newLife(server, FRIEND, "scenario.tunde");
    const code = await cardOut(server);
    await must(server, INVITER, { type: "people/invite", slot: "partner" });

    expect(await accept(server, FRIEND, code)).toMatchObject({ ok: false, code: "wrong-slot" });
    expect(await recordOf(server.deps, pairId(a, b))).toBeNull();
    expect(await server.deps.stores.invite.get(code)).toMatchObject({ used: false });
  });

  test("[R-PAIR-008] given maxOpenInvites cards out, when one more link is asked for, then it is refused as too-many, and the card already out gets its own link again", async () => {
    const server = pairServer(tuned((copy) => (copy.tuning.pair.maxOpenInvites = 1)));
    await newLife(server, INVITER);
    const code = await cardOut(server);
    await must(server, INVITER, { type: "people/invite", slot: "sibling-1", looking: "sibling", fill: "to-go-first" });

    const more = await call<Reply<InviteMade>>(server, "POST", "/api/invite", INVITER, { slot: "sibling-1" });
    const again = await call<Reply<InviteMade>>(server, "POST", "/api/invite", INVITER, { slot: "partner" });

    expect(more.body).toMatchObject({ ok: false, code: "too-many" });
    expect(again.body).toMatchObject({ ok: true, code });
  });

  test("[R-PAIR-008] given no card out on a slot, when a link is asked for it, then it is refused and none is made", async () => {
    const server = pairServer();
    await newLife(server, INVITER);

    const made = await call<Reply<InviteMade>>(server, "POST", "/api/invite", INVITER, { slot: "partner" });

    expect(made.body).toMatchObject({ ok: false, code: "not-legal" });
  });

  test("[R-PAIR-008] given an account that has not passed the date-of-birth screen, when it takes a link, then it is refused and gets no pair", async () => {
    const server = pairServer();
    await newLife(server, INVITER);
    const code = await cardOut(server);
    await accountIn(server, FRIEND, "NG", false);

    expect(await accept(server, FRIEND, code, { slot: "partner", scenario: "scenario.tunde" })).toMatchObject({ ok: false, code: "under-age" });
    expect(await server.deps.stores.invite.get(code)).toMatchObject({ used: false });
  });

  test("[R-PAIR-018] [R-REGION-002] given a region at none, when its player asks for a link or takes one, then each is refused with region and no record is made", async () => {
    const server = pairServer();
    await newLife(server, INVITER);
    const code = await cardOut(server);
    await accountIn(server, FRIEND, "FR");
    await accountIn(server, "account-eu", "DE");
    await call(server, "POST", "/api/character", "account-eu", { scenario: "scenario.tunde" });
    await must(server, "account-eu", { type: "people/invite", slot: "partner", looking: "partner" });

    expect(await accept(server, FRIEND, code, { slot: "partner", scenario: "scenario.tunde" })).toMatchObject({ ok: false, code: "region" });
    expect((await call<Reply<InviteMade>>(server, "POST", "/api/invite", "account-eu", { slot: "partner" })).body).toMatchObject({ ok: false, code: "region" });
    expect(await server.deps.stores.invite.pairs()).toEqual([]);
  });

  test("[R-REGION-006] [R-ACCOUNT-009] given an invited region and a matched one, when the link is taken, then the stricter row still allows the pair", async () => {
    const server = pairServer();
    await accountIn(server, INVITER, "GB");
    await call(server, "POST", "/api/character", INVITER, { scenario: "scenario.ada" });
    const code = await cardOut(server);
    await signUp(server, FRIEND);

    expect(await accept(server, FRIEND, code, { slot: "partner", scenario: "scenario.tunde" })).toMatchObject({ ok: true });
  });

  test("[R-ACCOUNT-010] given a row whose age check is verified, when an account there that has only declared its age takes a link, then it counts as none and is refused with region", async () => {
    const server = pairServer(content, { regions: { KE: { open: true, interaction: "matched", ageCheck: "verified" } } });
    await newLife(server, INVITER);
    const code = await cardOut(server);
    await accountIn(server, FRIEND, "KE");

    expect(await accept(server, FRIEND, code, { slot: "partner", scenario: "scenario.tunde" })).toMatchObject({ ok: false, code: "region" });
  });

  test("[R-PAIR-008] given a friend with no character, when a partner link is taken naming a scenario, then a character is made in it and linked", async () => {
    const server = pairServer();
    const a = await newLife(server, INVITER);
    const code = await cardOut(server);
    await signUp(server, FRIEND);

    const taken = await accept(server, FRIEND, code, { slot: "partner", scenario: "scenario.zainab" });

    expect(taken).toMatchObject({ ok: true, view: { stage: "connected", invitedBy: "them", controls: ["block", "report"] } });
    const b = (taken as InviteAccepted).character;
    expect((await view(server, FRIEND)).body).toMatchObject({ ok: true, view: { scenario: "scenario.zainab" } });
    expect((taken as InviteAccepted).pair).toBe(pairId(a, b));
  });

  test("[R-PEOPLE-011] given a friend who already has a character, when a sibling link is taken, then it is refused, because an existing character never becomes anyone's sibling", async () => {
    const server = pairServer();
    await newLife(server, INVITER);
    await newLife(server, FRIEND, "scenario.tunde");
    const code = await cardOut(server, INVITER, "sibling-1", "sibling");

    expect(await accept(server, FRIEND, code, { slot: "sibling-1" })).toMatchObject({ ok: false, code: "one-character" });
  });

  test("[R-PEOPLE-011] given a friend with no character, when a sibling link is taken, then a new life starts in the prologue, the record is a sibling pair, and the inviter's sibling slot holds the player", async () => {
    const server = pairServer();
    const a = await newLife(server, INVITER);
    const code = await cardOut(server, INVITER, "sibling-1", "sibling");
    await signUp(server, FRIEND);

    const taken = await accept(server, FRIEND, code, { slot: "sibling-1" });

    expect(taken).toMatchObject({ ok: true });
    const b = (taken as InviteAccepted).character;
    expect((await stateOf(server, b)).prologue.open).toBe(true);
    expect((await recordOf(server.deps, pairId(a, b)))?.record).toMatchObject({ role: "sibling", stage: "connected" });
    expect((await stateOf(server, a)).people.slots["sibling-1"]?.state).toBe("player");
  });

  test("[R-PAIR-009] given a sibling link taken, when the friend's prologue closes, then the inviter gets the prologue's frame and line once, naming no friend", async () => {
    const server = pairServer();
    await newLife(server, INVITER);
    const code = await cardOut(server, INVITER, "sibling-1", "sibling");
    await signUp(server, FRIEND);
    await accept(server, FRIEND, code, { slot: "sibling-1" });

    for (let guard = 0; guard < 60; guard += 1) {
      const shown = (await view(server, FRIEND)).body;
      if (!shown.ok || shown.view.prologue === null) break;
      const answer = shown.view.prologue.answers.find((each) => each.allowed);
      if (answer === undefined) throw new Error("No allowed answer.");
      await act(server, FRIEND, { type: "prologue/choose", step: shown.view.prologue.step, answer: answer.id });
    }
    await view(server, FRIEND);

    const listed = (await call<Reply<InvitesListed>>(server, "GET", "/api/invite", INVITER)).body;
    expect(listed).toEqual({ ok: true, open: [], rewards: [{ reached: "prologue", frame: "card.frame.prologue", line: "line.pair.reward.prologue", at: expect.any(Number) as number }] });
  });

  test("[R-PAIR-015] [R-MODERATION-001] given the friend's account blocked by the inviter, when the friend takes the card, then it is refused as not possible", async () => {
    const server = pairServer();
    await newLife(server, INVITER);
    await newLife(server, FRIEND, "scenario.tunde");
    const code = await cardOut(server);
    await server.deps.stores.moderation.block({ from: INVITER, to: FRIEND, at: server.deps.now() });

    expect(await accept(server, FRIEND, code)).toMatchObject({ ok: false, code: "not-possible", detail: "That is not possible now." });
  });
});
