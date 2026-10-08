import { pairView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { requestDeletion } from "../account/deletion";
import type { PairRejection } from "./codes";
import { forgetPairs } from "./leave";
import type { Reported } from "./moderation";
import { closeReport } from "./moderation";
import { call, cardOut, FRIEND, INVITER, lastBondIn, linkedPair, married, pairServer, quickWeddings, recordOf, sayFrom, stateOf } from "./pair.testing";

const STANDING = "quality.standing";

function post<B>(server: Parameters<typeof call>[0], path: string, account: string, body: unknown) {
  return call<B | PairRejection>(server, "POST", path, account, body);
}

describe("block", () => {
  test("[R-PAIR-015] [R-MODERATION-002] [R-PEOPLE-037] given a married pair, when one blocks the other, then the bond ends as a block in both lives with no standing cost to either, and the blocked side learns only that it ended", async () => {
    const linked = await linkedPair(pairServer(quickWeddings()));
    const { server, a, b, key } = linked;
    await married(linked);
    const before = { a: await stateOf(server, a), b: await stateOf(server, b) };

    const blocked = await post(server, "/api/moderation/block", INVITER, { pair: key });

    expect(blocked.body).toEqual({ ok: true });
    const after = { a: await stateOf(server, a), b: await stateOf(server, b) };
    for (const [was, now] of [[before.a, after.a], [before.b, after.b]] as const) {
      expect(now.quality[STANDING]).toBe(was.quality[STANDING]);
      expect(now.people.bonds[lastBondIn(now, key)]?.ended?.by).toBe("block");
      expect(now.people.slots.partner?.state).toBe("empty");
    }
    const record = (await recordOf(server.deps, key))?.record;
    if (record === undefined) throw new Error("No record.");
    expect(record).toMatchObject({ stage: "ended", ended: { by: "block" } });
    expect(pairView(record, a)?.ended?.by).toBe("block");
    expect(pairView(record, b)?.ended?.by).toBeNull();
    expect(pairView(record, b)?.blocked).toBe(false);
    expect(await server.deps.stores.moderation.blocked(FRIEND, INVITER)).toBe(true);
  });

  test("[R-MODERATION-001] given a block, when the blocked side says a phrase, then it is refused with the same answer as a lapsed connection", async () => {
    const { server, key } = await linkedPair();
    await post(server, "/api/moderation/block", INVITER, { pair: key });

    expect(await sayFrom(server, FRIEND, key)).toEqual({ ok: false, code: "not-possible", detail: "That is not possible now." });
  });

  test("[R-MODERATION-002] [R-PAIR-015] given a block lifted, when nothing else happens the record stays ended, and only a new invite links the two again, keeping their moments", async () => {
    const { server, key } = await linkedPair();
    await sayFrom(server, INVITER, key, "phrase.hello");
    await post(server, "/api/moderation/block", INVITER, { pair: key });

    expect((await post(server, "/api/moderation/unblock", INVITER, { pair: key })).body).toEqual({ ok: true });
    expect((await recordOf(server.deps, key))?.record).toMatchObject({ stage: "ended", blocked: { a: false, b: false } });
    expect(await server.deps.stores.moderation.blocked(INVITER, FRIEND)).toBe(false);

    const code = await cardOut(server);
    const taken = await post(server, `/api/invite/${code}/accept`, FRIEND, { slot: "partner" });

    expect(taken.body).toMatchObject({ ok: true });
    expect((await recordOf(server.deps, key))?.record).toMatchObject({ stage: "connected", ended: null, moments: [{ kind: "said", what: "phrase.hello" }] });
  });

  test("[R-MODERATION-001] given an unknown player, when a block names them, then it is refused and nothing is stored", async () => {
    const { server } = await linkedPair();

    expect((await post(server, "/api/moderation/block", INVITER, { pair: "nobody~somebody" })).status).toBe(404);
    expect(await server.deps.stores.moderation.blocksBy(INVITER)).toEqual([]);
  });
});

describe("report and hold", () => {
  test("[R-PAIR-016] [R-MODERATION-004] [R-MODERATION-007] given a conversation, when a message is reported, then the report cites the pair and the message, the record is held, and neither life changes", async () => {
    const { server, a, b, key } = await linkedPair();
    const said = await sayFrom(server, INVITER, key, "phrase.hello");
    const versions = { a: (await server.deps.stores.player.load(a))?.character.v, b: (await server.deps.stores.player.load(b))?.character.v };

    const reported = await post<Reported>(server, "/api/moderation/report", FRIEND, { pair: key, messages: [said.message?.id], reason: "harassment" });

    expect(reported.body).toMatchObject({ ok: true, report: expect.stringMatching(/^report-/) as string });
    const row = await server.deps.stores.moderation.get((reported.body as Reported).report);
    expect(row).toMatchObject({ reporter: FRIEND, subject: { account: INVITER }, reason: "harassment", cites: { messages: [said.message?.id] }, pair: key, status: "open" });
    expect((await recordOf(server.deps, key))?.record.held).toBe(true);
    expect({ a: (await server.deps.stores.player.load(a))?.character.v, b: (await server.deps.stores.player.load(b))?.character.v }).toEqual(versions);
  });

  test("[R-MODERATION-009] given an open report on a conversation, when the reported side says a phrase, then nothing reaches the reporter, while the reporter may still send", async () => {
    const { server, key } = await linkedPair();
    const said = await sayFrom(server, INVITER, key);
    await post(server, "/api/moderation/report", FRIEND, { pair: key, messages: [said.message?.id], reason: "scam" });

    expect(await sayFrom(server, INVITER, key)).toMatchObject({ ok: false, code: "not-possible" });
    expect((await sayFrom(server, FRIEND, key)).ok).toBe(true);
  });

  test("[R-MODERATION-008] [R-ACCOUNT-017] given a reported message, when the reported account is deleted and its rows removed, then the held message stays and the rest of its conversation goes", async () => {
    const { server, a, key } = await linkedPair();
    const kept = await sayFrom(server, INVITER, key, "phrase.hello");
    await sayFrom(server, INVITER, key, "phrase.thanks");
    await post(server, "/api/moderation/report", FRIEND, { pair: key, messages: [kept.message?.id], reason: "harassment" });

    await requestDeletion(server.deps, INVITER);
    await forgetPairs(server.deps, INVITER, a);

    expect((await server.deps.stores.conversation.list(key, null)).map((row) => row.id)).toEqual([kept.message?.id]);
    expect(await server.deps.stores.invite.pairsOf(a)).toEqual([]);
  });

  test("[R-MODERATION-007] [R-MODERATION-008] given a held record, when the moderator closes its one report, then the record is released and the hold lifted", async () => {
    const { server, key } = await linkedPair();
    const reported = await post<Reported>(server, "/api/moderation/report", FRIEND, { pair: key, reason: "other" });

    const closed = await closeReport(server.deps, (reported.body as Reported).report, "no-action");

    expect(closed).toMatchObject({ status: "decided", outcome: "no-action" });
    expect((await recordOf(server.deps, key))?.record.held).toBe(false);
    expect(await server.deps.stores.moderation.holds(server.deps.now())).toEqual([]);
  });

  test("[R-MODERATION-006] given a report with the block ticked, when it is sent, then the reporter has also blocked and the bond has ended as a block", async () => {
    const { server, b, key } = await linkedPair();

    await post(server, "/api/moderation/report", FRIEND, { pair: key, reason: "scam", block: true });

    expect(await server.deps.stores.moderation.blocked(FRIEND, INVITER)).toBe(true);
    const friend = await stateOf(server, b);
    expect(friend.people.bonds[lastBondIn(friend, key)]?.ended?.by).toBe("block");
  });

  test("[R-MODERATION-006] given reportsPerDay reports filed in a day, when one more is sent, then it is refused with rate-limited, and a day after the first it goes", async () => {
    const { server, key } = await linkedPair();
    for (let index = 0; index < server.deps.config.moderation.reportsPerDay; index += 1) {
      expect((await post(server, "/api/moderation/report", FRIEND, { pair: key, reason: "other" })).body).toMatchObject({ ok: true });
    }

    const over = await post(server, "/api/moderation/report", FRIEND, { pair: key, reason: "other" });

    expect(over.status).toBe(429);
    expect(over.body).toMatchObject({ ok: false, code: "rate-limited" });
    server.wait(86_400_000);
    expect((await post(server, "/api/moderation/report", FRIEND, { pair: key, reason: "other" })).body).toMatchObject({ ok: true });
  });

  test("[R-MODERATION-004] given a report, when its reason is off the list or it cites a message of another conversation, then it is refused and nothing is held", async () => {
    const { server, key } = await linkedPair();

    expect((await post(server, "/api/moderation/report", FRIEND, { pair: key, reason: "rude" })).status).toBe(400);
    expect((await post(server, "/api/moderation/report", FRIEND, { pair: key, reason: "scam", messages: ["message-elsewhere"] })).status).toBe(400);
    expect(await server.deps.stores.moderation.list("open")).toEqual([]);
    expect((await recordOf(server.deps, key))?.record.held).toBe(false);
  });

  test("[R-PEOPLE-040] given a linked pair, when one account asks to be deleted, then the other life's bond ends as an absence with no cost, its moments stay as them, and the record blanks the leaving side", async () => {
    const { server, a, b, key } = await linkedPair();
    await sayFrom(server, INVITER, key, "phrase.hello");
    const before = await stateOf(server, b);

    await requestDeletion(server.deps, INVITER);

    const after = await stateOf(server, b);
    const bond = after.people.bonds[lastBondIn(after, key)];
    expect(bond?.ended?.by).toBe("absence");
    expect(bond?.moments).toMatchObject([{ by: "them", kind: "said", what: "phrase.hello" }]);
    expect(after.quality[STANDING]).toBe(before.quality[STANDING]);
    const record = (await recordOf(server.deps, key))?.record;
    expect(record).toMatchObject({ ended: { by: "deleted" } });
    expect([record?.a, record?.b]).toContain("");
    expect([record?.a, record?.b]).not.toContain(a);
    expect(record?.moments).toHaveLength(1);
    if (record === undefined) throw new Error("No record.");
    expect(pairView(record, b)?.ended?.by).toBe("absence");
  });
});
