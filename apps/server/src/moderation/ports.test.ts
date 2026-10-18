import type { QueueView } from "@japacity/api";
import { describe, expect, test } from "vitest";

import { call, FRIEND, INVITER, linkedPair, pairServer, recordOf, sayFrom } from "../pair/pair.testing";

const ADMIN = "account.owner";

describe("the admin queue over the pair side's store", () => {
  test("[R-MODERATION-010] [R-MODERATION-008] [R-MODERATION-014] given a report filed on a pair through the game, when the admin reads the queue and dismisses it, then the report is in the queue with its held message, and the dismissal decides it, lifts the hold and releases the record", async () => {
    const { server, key } = await linkedPair(pairServer(undefined, { admin: { accounts: [ADMIN] } }));
    const said = await sayFrom(server, INVITER, key, "phrase.hello");
    const filed = await call<{ ok: boolean; report: string }>(server, "POST", "/api/moderation/report", FRIEND, { pair: key, messages: [said.message?.id], reason: "harassment" });
    expect((await recordOf(server.deps, key))?.record.held).toBe(true);

    const queue = await call<{ ok: true; queue: QueueView }>(server, "GET", "/api/admin/moderation/queue", ADMIN);
    expect(queue.body.queue.items).toHaveLength(1);
    expect(queue.body.queue.items[0]).toMatchObject({ kind: "report", id: filed.body.report, reason: "harassment" });
    expect(JSON.stringify(queue.body.queue.items[0])).toContain(said.message?.id ?? "none");

    const closed = await call<{ ok: boolean }>(server, "POST", `/api/admin/moderation/${filed.body.report}/close`, ADMIN, { action: "dismiss", reason: "other" });
    expect(closed.body.ok).toBe(true);
    expect(await server.deps.stores.moderation.get(filed.body.report)).toMatchObject({ status: "decided", outcome: "no-action" });
    expect(await server.deps.stores.moderation.holds(server.deps.now())).toEqual([]);
    expect((await recordOf(server.deps, key))?.record.held).toBe(false);
    expect((await call<{ ok: true; queue: QueueView }>(server, "GET", "/api/admin/moderation/queue", ADMIN)).body.queue.items).toEqual([]);
    expect((await call<{ ok: boolean; code?: string }>(server, "POST", `/api/admin/moderation/${filed.body.report}/close`, ADMIN, { action: "dismiss", reason: "other" })).body.ok).toBe(false);
  });
});
