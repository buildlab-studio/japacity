import type { ConversationRead, PairRead } from "@japacity/api";
import { content } from "@japacity/content";
import { pairId, time } from "@japacity/sim";
import type { Nudge } from "@japacity/store";
import { describe, expect, test } from "vitest";

import type { PairRejection } from "./codes";
import { bondIn, call, cardOut, FRIEND, INVITER, linkedPair, must, newLife, pairServer, recordOf, sayFrom, stateOf } from "./pair.testing";

describe("conversations in preset phrases", () => {
  test("[pair:conversation-phrases-stored] [person:talking-adds-moments] given a linked pair, when one side says a phrase, then the row is stored, the record gains a said moment, both lives hold it as me and them, and the other side is nudged to fetch", async () => {
    const { server, a, b, key } = await linkedPair();
    const nudges: Nudge[] = [];
    server.deps.stores.nudges.subscribe(FRIEND, (nudge) => nudges.push(nudge));

    const said = await sayFrom(server, INVITER, key, "phrase.meet-at", "beach");

    expect(said).toMatchObject({ ok: true, message: { conversation: key, sender: a, phrase: "phrase.meet-at", fill: "beach", sentAt: server.deps.now(), readAt: null } });
    const record = (await recordOf(server.deps, key))?.record;
    expect(record?.moments).toEqual([{ n: 1, by: record?.a === a ? "a" : "b", kind: "said", spot: "beach", what: "phrase.meet-at", tick: expect.any(Number) as number }]);
    const mine = await stateOf(server, a);
    const theirs = await stateOf(server, b);
    expect(mine.people.bonds[bondIn(mine, key)]?.moments).toMatchObject([{ n: 1, by: "me", kind: "said", spot: "beach", what: "phrase.meet-at" }]);
    expect(theirs.people.bonds[bondIn(theirs, key)]?.moments).toMatchObject([{ n: 1, by: "them", kind: "said", spot: "beach", what: "phrase.meet-at" }]);
    expect(nudges).toContainEqual({ nudge: "messages" });
  });

  test("[pair:conversation-phrases-stored] given rows from both sides, when one side fetches from where it left off, then it gets only the later rows and the other side's rows are marked read", async () => {
    const { server, key } = await linkedPair();
    const first = await sayFrom(server, INVITER, key, "phrase.hello");
    server.wait(1000);
    await sayFrom(server, FRIEND, key, "phrase.thanks");
    server.wait(1000);
    await sayFrom(server, INVITER, key, "phrase.proud");

    const read = await call<ConversationRead | PairRejection>(server, "GET", `/api/pair/${key}/conversation?after=${first.message?.id ?? ""}`, FRIEND);

    expect((read.body as ConversationRead).messages.map((row) => row.phrase)).toEqual(["phrase.thanks", "phrase.proud"]);
    const all = await server.deps.stores.conversation.list(key, null);
    expect(all.map((row) => [row.phrase, row.readAt === null])).toEqual([
      ["phrase.hello", false],
      ["phrase.thanks", true],
      ["phrase.proud", false],
    ]);
  });

  test("[pair:phrase-checks-before-send] given phrasesPerHour phrases sent, when one more is sent, then it is refused as too-many and nothing is stored, and an hour after the first it goes", async () => {
    const { server, key } = await linkedPair();
    const limit = content.tuning.pair.phrasesPerHour;
    for (let index = 0; index < limit; index += 1) expect((await sayFrom(server, INVITER, key)).ok).toBe(true);

    expect(await sayFrom(server, INVITER, key)).toMatchObject({ ok: false, code: "too-many" });
    expect(await server.deps.stores.conversation.list(key, null)).toHaveLength(limit);
    expect((await sayFrom(server, FRIEND, key)).ok).toBe(true);

    server.wait(time.HOUR_MS - 1);
    expect(await sayFrom(server, INVITER, key)).toMatchObject({ ok: false, code: "too-many" });
    server.wait(1);
    expect((await sayFrom(server, INVITER, key)).ok).toBe(true);
  });

  test("[pair:preset-phrases-only] [pair:phrase-checks-before-send] given a phrase, when its fill is off its list or it is a place phrase, then it is refused and nothing is stored", async () => {
    const { server, key } = await linkedPair();

    expect(await sayFrom(server, INVITER, key, "phrase.meet-at", "my-house")).toMatchObject({ ok: false, code: "bad-fill" });
    expect(await sayFrom(server, INVITER, key, "phrase.hello", "beach")).toMatchObject({ ok: false, code: "bad-fill" });
    expect(await sayFrom(server, INVITER, key, "phrase.evening")).toMatchObject({ ok: false, code: "wrong-place" });
    expect(await server.deps.stores.conversation.list(key, null)).toEqual([]);
  });

  test("[pair:phrase-checks-before-send] given a pair that has ended, when either side says a phrase, then it is refused as not possible and says nothing more", async () => {
    const { server, a, key } = await linkedPair();
    await must(server, INVITER, { type: "people/court", with: key });
    await must(server, INVITER, { type: "people/end", bond: bondIn(await stateOf(server, a), key) });

    expect(await sayFrom(server, FRIEND, key)).toEqual({ ok: false, code: "not-possible", detail: "That is not possible now." });
    expect(await sayFrom(server, INVITER, key)).toMatchObject({ ok: false, code: "not-possible" });
  });

  test("[pair:everyone-meets-by-invite] [region:same-contact-everywhere] given a pair linked by an invite between accounts that signed up in France and Australia, when either says a phrase, then it is stored", async () => {
    const server = pairServer();
    const characters: string[] = [];
    for (const [id, country, scenario] of [[INVITER, "FR", "scenario.ada"], [FRIEND, "AU", "scenario.tunde"]] as const) {
      const made = await server.deps.stores.account.create({ id, country, age: { passed: true, at: server.deps.now(), method: "declared" }, createdAt: server.deps.now(), character: null, notifyBankFull: false, sendUsageCounts: true, state: "secured", username: id.replaceAll(/\W/g, "_"), usernameChangedAt: null, lastPlayedAt: server.deps.now() });
      if (!made.ok) throw new Error(made.detail);
      await call(server, "POST", "/api/character", id, { scenario });
      characters.push((await server.deps.stores.account.get(id))?.character ?? "");
    }
    const code = await cardOut(server);
    expect((await call<{ ok: boolean }>(server, "POST", `/api/invite/${code}/accept`, FRIEND, { slot: "partner" })).body.ok).toBe(true);
    const key = pairId(characters[0] ?? "", characters[1] ?? "");

    expect(await sayFrom(server, INVITER, key)).toMatchObject({ ok: true });
    expect(await sayFrom(server, FRIEND, key, "phrase.thanks")).toMatchObject({ ok: true });
    expect(await server.deps.stores.conversation.list(key, null)).toHaveLength(2);
  });

  test("[pair:phrase-checks-before-send] [region:same-contact-everywhere] given two players never connected by an invite, when one says a phrase to a pair key of the two, then it is refused and nothing is stored", async () => {
    const server = pairServer();
    const a = await newLife(server, INVITER, "scenario.ada");
    const b = await newLife(server, FRIEND, "scenario.tunde");
    const key = pairId(a, b);

    expect(await sayFrom(server, INVITER, key)).toMatchObject({ ok: false, code: "unknown-id" });
    expect(await server.deps.stores.conversation.list(key, null)).toEqual([]);
  });

  test("[pair:who-may-read-a-record] given a record, when each side reads it, then each sees it in its own terms, and a third account finds no such pair", async () => {
    const { server, key } = await linkedPair();
    await newLife(server, "account-c", "scenario.zainab");

    const inviter = await call<PairRead | PairRejection>(server, "GET", `/api/pair/${key}`, INVITER);
    const friend = await call<PairRead | PairRejection>(server, "GET", `/api/pair/${key}`, FRIEND);
    const stranger = await call<PairRead | PairRejection>(server, "GET", `/api/pair/${key}`, "account-c");

    expect(inviter.body).toMatchObject({ ok: true, pair: { id: key, invitedBy: "me", stage: "connected", controls: ["block", "report"] } });
    expect(friend.body).toMatchObject({ ok: true, pair: { id: key, invitedBy: "them" } });
    expect(friend.text).not.toContain("held");
    expect(stranger.status).toBe(404);
    expect((await call(server, "GET", `/api/pair/${key}/conversation`, "account-c")).status).toBe(404);
  });
});
