// `POST /api/character/end` (account:start-a-new-life): the life ends for good, a real
// partner or sibling joined to it is told, and the account stays to start another. `POST /api/character` with the person
// built at the door (account:person-kept-with-character): kept with the character and read back with the view.
import type { ViewReply } from "@japacity/api";
import { describe, expect, test } from "vitest";

import { harness } from "../auth/auth.testing";
import { call, held, newLife, view } from "../authority/authority.testing";
import { cardOut, FRIEND, INVITER, lastBondIn, linkedPair, pairServer, sayFrom, signUp, stateOf } from "../pair/pair.testing";

const STANDING = "quality.standing";

describe("ending a life", () => {
  test("[account:start-a-new-life] [account:one-character-per-account] given an account with a life, when it ends the life, then the account names no character, the life's rows are gone, the account keeps its age pass and username, and a new life starts on a seed of its own", async () => {
    const server = pairServer();
    const first = await newLife(server, INVITER, "scenario.graduate");
    const firstSeed = (await held(server, first)).segments[0]?.start;
    const before = await server.deps.stores.account.get(INVITER);

    const again = await call(server, "POST", "/api/character", INVITER, { scenario: "scenario.graduate" });
    expect(again.body).toMatchObject({ ok: false, code: "one-character" });

    const ended = await call(server, "POST", "/api/character/end", INVITER);
    expect(ended.status).toBe(200);
    expect(ended.body).toEqual({ ok: true });

    const after = await server.deps.stores.account.get(INVITER);
    expect(after).toMatchObject({ id: INVITER, character: null, username: before?.username, state: before?.state, age: before?.age });
    expect(await server.deps.stores.player.load(first)).toBeNull();
    expect((await view(server, INVITER)).body).toMatchObject({ ok: false, code: "no-character" });

    const made = await call<ViewReply>(server, "POST", "/api/character", INVITER, { scenario: "scenario.graduate" });
    expect(made.body.ok).toBe(true);
    const second = (await server.deps.stores.account.get(INVITER))?.character ?? null;
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
    const secondSeed = (await held(server, second ?? "")).segments[0]?.start;
    // The family draw is the new life's own roll, never the old one's.
    expect(secondSeed).not.toEqual(firstSeed);
  });

  test("[account:start-a-new-life] [person:leaving-player-ends-bonds] given a real partner joined to the life, when the life ends, then the partner's bond ends at no cost to them, their record keeps the moments, and the pair is gone from the ended side", async () => {
    const { server, a, b, key } = await linkedPair();
    await sayFrom(server, INVITER, key, "phrase.hello");
    const before = await stateOf(server, b);

    const ended = await call(server, "POST", "/api/character/end", INVITER);
    expect(ended.body).toEqual({ ok: true });

    const after = await stateOf(server, b);
    const bond = after.people.bonds[lastBondIn(after, key)];
    expect(bond?.stage).toBe("ended");
    // Decision 0020: a restart end, told as such, at no cost to the one who stays.
    expect(bond?.ended?.by).toBe("restart");
    expect(bond?.moments).toMatchObject([{ by: "them", kind: "said", what: "phrase.hello" }]);
    expect(after.quality[STANDING]).toBe(before.quality[STANDING]);
    expect(await server.deps.stores.invite.pairsOf(a)).toEqual([]);
    expect((await server.deps.stores.account.get(FRIEND))?.character).toBe(b);
  });

  test("[account:start-a-new-life] given a real sibling joined to the life, when the life ends, then the bond ends in the other life", async () => {
    const server = pairServer();
    const a = await newLife(server, INVITER, "scenario.graduate");
    const code = await cardOut(server, INVITER, "sibling-1", "sibling");
    await signUp(server, FRIEND);
    const taken = await call<{ ok: boolean }>(server, "POST", `/api/invite/${code}/accept`, FRIEND, { slot: "sibling-1" });
    expect(taken.body.ok).toBe(true);
    const key = (await stateOf(server, a)).people.slots["sibling-1"]?.bond ?? null;
    expect(key).not.toBeNull();

    const ended = await call(server, "POST", "/api/character/end", FRIEND);
    expect(ended.body).toEqual({ ok: true });

    const after = await stateOf(server, a);
    expect(after.people.bonds[key ?? ""]?.stage).toBe("ended");
  });

  test("[account:start-a-new-life] given no session, or an account with no life, when the end is asked for, then it is refused signed-out or no-character", async () => {
    const server = pairServer();
    expect((await call(server, "POST", "/api/character/end", null)).status).toBe(401);
    await newLife(server, INVITER, "scenario.graduate");
    await call(server, "POST", "/api/character/end", INVITER);
    const twice = await call(server, "POST", "/api/character/end", INVITER);
    expect(twice.status).toBe(404);
    expect(twice.body).toMatchObject({ ok: false, code: "no-character" });
  });

  test("[account:start-a-new-life] [account:bot-check-on-guest-creation] given a guest with a life, when the life ends and a new one starts, then it is the same guest account with the same username, and the new life asks for no bot check", async () => {
    const h = harness();
    const { jar, account } = await h.guest(undefined, { username: "ada_lagos" });
    const first = await h.call("/api/character", { method: "POST", jar, json: { scenario: "scenario.graduate" } });
    expect(first.status).toBe(200);
    const firstCharacter = (await h.deps.stores.account.get(account))?.character ?? null;

    const ended = await h.call("/api/character/end", { method: "POST", jar });
    expect(ended.status).toBe(200);

    // No `x-captcha-response` header: the bot check ran once, when the guest was made.
    const again = await h.call("/api/character", { method: "POST", jar, json: { scenario: "scenario.graduate" } });
    expect(again.status).toBe(200);
    const row = await h.deps.stores.account.get(account);
    expect(row).toMatchObject({ id: account, state: "guest", username: "ada_lagos" });
    expect(row?.character).not.toBeNull();
    expect(row?.character).not.toBe(firstCharacter);
  });
});

describe("the person kept with the character", () => {
  const ADAEZE = { name: "Adaeze", look: "person_ada", archetype: "developer", style: { skin: "skin3", fabric: "adire" } };

  /** Asks for a character with `person` and answers the reply, after the account is signed up. */
  async function begin(person: unknown): Promise<{ server: ReturnType<typeof pairServer>; made: { status: number; body: ViewReply } }> {
    const server = pairServer();
    await signUp(server, INVITER);
    const made = await call<ViewReply>(server, "POST", "/api/character", INVITER, { scenario: "scenario.graduate", person });
    return { server, made };
  }

  test("[account:person-kept-with-character] given the person built at the door, when the character is made, then the person is kept with it and answered with the first view", async () => {
    const { server, made } = await begin(ADAEZE);
    expect(made.status).toBe(200);
    expect(made.body).toMatchObject({ ok: true, person: ADAEZE });
    const character = (await server.deps.stores.account.get(INVITER))?.character ?? "";
    expect(await server.deps.stores.player.person(character)).toEqual(ADAEZE);
  });

  test("[account:person-kept-with-character] given a life made with a person, when it is read on a second session that holds nothing of it, then the view comes with its name, look, archetype and colours, and a life made without one reads none", async () => {
    const { server } = await begin(ADAEZE);
    const read = await view(server, INVITER);
    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({ ok: true, person: ADAEZE });

    await newLife(server, FRIEND, "scenario.graduate");
    const none = await view(server, FRIEND);
    expect(none.body.ok).toBe(true);
    expect(none.body).not.toHaveProperty("person");
  });

  test("[account:person-kept-with-character] [account:username-and-unconfirmed-email] given a name the door refuses or one holding a reserved or blocked word, when the character is asked for, then it is refused and no character is made", async () => {
    for (const name of ["A", "Ada Eze", "Ada9", "Japacity", "Ádmín", "Shìt"]) {
      const { server, made } = await begin({ ...ADAEZE, name });
      expect([name, made.status, made.body]).toMatchObject([name, 400, { ok: false, code: "not-legal" }]);
      expect((await server.deps.stores.account.get(INVITER))?.character).toBeNull();
    }
  });

  test("[account:person-kept-with-character] given a look the game does not ship at the door, when the character is asked for, then it is refused and no character is made", async () => {
    for (const look of ["person_rider", "person_chief", "scenario.graduate", "person_nobody"]) {
      const { server, made } = await begin({ ...ADAEZE, look });
      expect([look, made.status, made.body]).toMatchObject([look, 400, { ok: false, code: "not-legal" }]);
      expect((await server.deps.stores.account.get(INVITER))?.character).toBeNull();
    }
  });

  test("[account:person-kept-with-character] given a person past 1 KB, or carrying the page's photo, when the character is asked for, then it is refused and no character is made", async () => {
    for (const person of [{ ...ADAEZE, name: `Ad${"́".repeat(1100)}` }, { ...ADAEZE, photo: "data:image/webp;base64,AAAA" }]) {
      const { server, made } = await begin(person);
      expect([made.status, made.body]).toMatchObject([400, { ok: false, code: "not-legal" }]);
      expect((await server.deps.stores.account.get(INVITER))?.character).toBeNull();
    }
  });
});
