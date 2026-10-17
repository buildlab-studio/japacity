import { content } from "@japacity/content";
import { pairId, time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { characterOf } from "../authority/command";
import { view } from "../authority/testing";
import type { InviteAccepted, InviteMade, InviteShown, InvitesListed } from "./invite";
import type { PairRejection } from "./codes";
import { act, bondIn, call, cardOut, FRIEND, INVITER, linkedPair, must, newLife, pairServer, playPrologue, recordOf, signUp, stateOf, tuned } from "./pair.testing";

type Reply<B> = B | PairRejection;

async function accept(server: ReturnType<typeof pairServer>, account: string, code: string, body: unknown = { slot: "partner" }) {
  return (await call<Reply<InviteAccepted>>(server, "POST", `/api/invite/${code}/accept`, account, body)).body;
}

/** An account in `country` whose age screen is passed or not. */
async function accountIn(server: ReturnType<typeof pairServer>, id: string, country: string, passed = true): Promise<void> {
  const made = await server.deps.stores.account.create({ id, country, age: { passed, at: server.deps.now(), method: "declared" }, createdAt: server.deps.now(), character: null, notifyBankFull: false, sendUsageCounts: true, state: "secured", username: id.replaceAll(/\W/g, "_"), usernameChangedAt: null, lastPlayedAt: server.deps.now() });
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

  test("[R-PAIR-008] given a link taken once, when another account takes it, then it is refused as used with 409 and the record does not move", async () => {
    const { server, key, code } = await linkedPair();
    expect((await call<Reply<InvitesListed>>(server, "GET", "/api/invite", INVITER)).body).toMatchObject({ ok: true, open: [] });
    await newLife(server, "account-c", "scenario.zainab");

    const again = await call<Reply<InviteAccepted>>(server, "POST", `/api/invite/${code}/accept`, "account-c", { slot: "partner" });
    const shown = await call<Reply<InviteShown>>(server, "GET", `/api/invite/${code}`, null);

    // A link taken is a conflict, 409, as a name taken or an action appealed already.
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ ok: false, code: "used" });
    expect(shown.status).toBe(409);
    expect(shown.body).toMatchObject({ ok: false, code: "used" });
    expect((await recordOf(server.deps, key))?.v).toBe(1);
  });

  test("[R-PAIR-008] given a link, when it is taken a millisecond before it runs out, then it works, and at the moment it runs out it is refused as expired with 403", async () => {
    const server = pairServer();
    await newLife(server, INVITER);
    await newLife(server, FRIEND, "scenario.tunde");
    await newLife(server, "account-c", "scenario.zainab");
    const code = await cardOut(server);
    const made = await server.deps.stores.invite.get(code);
    if (made === null) throw new Error("No link.");
    expect(made.expires - made.madeAt).toBe(content.tuning.pair.inviteDays * time.DAY_MS);

    server.setNow(made.expires);
    // A link run out is 403, as the age pass that ran out is on the account routes.
    const late = await call<Reply<InviteAccepted>>(server, "POST", `/api/invite/${code}/accept`, FRIEND, { slot: "partner" });
    expect(late.status).toBe(403);
    expect(late.body).toMatchObject({ ok: false, code: "expired" });
    const lateShown = await call<Reply<InviteShown>>(server, "GET", `/api/invite/${code}`, null);
    expect(lateShown.status).toBe(403);
    expect(lateShown.body).toMatchObject({ ok: false, code: "expired" });

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

  test("[R-PAIR-008] given maxOpenInvites cards out, when one more link is asked for, then it is refused as too-many with 429, and the card already out gets its own link again", async () => {
    const server = pairServer(tuned((copy) => (copy.tuning.pair.maxOpenInvites = 1)));
    await newLife(server, INVITER);
    const code = await cardOut(server);
    await must(server, INVITER, { type: "people/invite", slot: "sibling-1", looking: "sibling", fill: "to-go-first" });

    const more = await call<Reply<InviteMade>>(server, "POST", "/api/invite", INVITER, { slot: "sibling-1" });
    const again = await call<Reply<InviteMade>>(server, "POST", "/api/invite", INVITER, { slot: "partner" });

    // Too many is 429, as the guest sign-up's too-many and the reports' limit are.
    expect(more.status).toBe(429);
    expect(more.body).toMatchObject({ ok: false, code: "too-many" });
    expect(again.body).toMatchObject({ ok: true, code });
  });

  test("[R-PAIR-008] given no card out on a slot, when a link is asked for it, then it is refused with 400 as the routes' other not-legal answers are, and none is made", async () => {
    const server = pairServer();
    await newLife(server, INVITER);

    const made = await call<Reply<InviteMade>>(server, "POST", "/api/invite", INVITER, { slot: "partner" });

    expect(made.status).toBe(400);
    expect(made.body).toMatchObject({ ok: false, code: "not-legal" });
    expect(await server.deps.stores.invite.open(await characterOf(server.deps, INVITER) ?? "", server.deps.now())).toEqual([]);
  });

  test("[R-PAIR-008] given an account that has not passed the date-of-birth screen, when it takes a link, then it is refused and gets no pair", async () => {
    const server = pairServer();
    await newLife(server, INVITER);
    const code = await cardOut(server);
    await accountIn(server, FRIEND, "NG", false);

    expect(await accept(server, FRIEND, code, { slot: "partner", scenario: "scenario.tunde" })).toMatchObject({ ok: false, code: "under-age" });
    expect(await server.deps.stores.invite.get(code)).toMatchObject({ used: false });
  });

  test("[R-PAIR-018] [R-REGION-002] given two players who signed up in France and Germany, when one asks for a link and the other takes it, then the pair is made as anywhere else", async () => {
    const server = pairServer();
    await accountIn(server, "account-fr", "FR");
    await call(server, "POST", "/api/character", "account-fr", { scenario: "scenario.ada" });
    const code = await cardOut(server, "account-fr");
    await accountIn(server, "account-de", "DE");

    expect(await accept(server, "account-de", code, { slot: "partner", scenario: "scenario.tunde" })).toMatchObject({ ok: true, view: { stage: "connected" } });
    expect(await server.deps.stores.invite.pairs()).toHaveLength(1);
  });

  test("[R-PAIR-008] given an inviter whose account is gone, when the link is taken, then it is not possible and no record is made", async () => {
    const server = pairServer();
    await newLife(server, INVITER);
    const code = await cardOut(server);
    await signUp(server, FRIEND);
    await server.deps.stores.account.remove(INVITER);

    expect(await accept(server, FRIEND, code, { slot: "partner", scenario: "scenario.tunde" })).toMatchObject({ ok: false, code: "not-possible" });
    expect(await server.deps.stores.invite.pairs()).toEqual([]);
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

  test("[R-PEOPLE-011] given an inviter whose prologue drew a family, when a sibling link is taken, then the new life holds the same draw from its first state, its first segment starts from that state, and its sibling-1 slot waits as a card until its prologue closes and then holds the inviter", async () => {
    // A family drawn with two children besides the inviter, so the sibling slots exist.
    const server = pairServer(tuned((copy) => {
      copy.tuning.prologue.siblings = [2, 2];
    }));
    const a = await newLife(server, INVITER, "scenario.prologue");
    await playPrologue(server, INVITER);
    // The family's siblings join the slots in the first month after the prologue (R-PEOPLE-007).
    await must(server, INVITER, { type: "turn/end", slots: [] });
    const family = (await stateOf(server, a)).prologue.draw;
    expect(family).not.toBeNull();
    const code = await cardOut(server, INVITER, "sibling-1", "sibling");
    await signUp(server, FRIEND);

    const taken = await accept(server, FRIEND, code, { slot: "sibling-1" });

    expect(taken).toMatchObject({ ok: true });
    const b = (taken as InviteAccepted).character;
    const sibling = await stateOf(server, b);
    expect(sibling.prologue.draw).toEqual(family);
    expect(sibling.people.slots["sibling-1"]).toMatchObject({ state: "invited", invite: { looking: "sibling" } });
    const stored = await server.deps.stores.player.load(b);
    expect(stored?.segments[0]?.start).toMatchObject({ base: { v: 0, prologue: { draw: family } } });
    await playPrologue(server, FRIEND);
    const grown = await stateOf(server, b);
    expect(grown.prologue.draw).toEqual(family);
    expect(grown.people.slots["sibling-1"]).toMatchObject({ state: "player" });
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
