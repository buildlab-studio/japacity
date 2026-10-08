import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import type { TestServer } from "../authority/testing";
import { call, cardOut, FRIEND, INVITER, linkedPair, pairServer, sayFrom, signUp } from "./pair.testing";
import { newLife } from "../authority/testing";

const ADMIN = "account.owner";

async function act(server: TestServer, account: string, action: "mute" | "suspend", days: number, id: string): Promise<void> {
  const written = await server.deps.stores.moderationLog.append({ id, admin: ADMIN, at: server.deps.now(), item: "report.1", action, params: { account, days }, reason: "harassment" });
  if (!written.ok) throw new Error(written.detail);
}

describe("mutes and suspensions on the people routes", () => {
  test("[R-MODERATION-014] given a player muted for 2 days, when they say a phrase, make a link or take one, then each is refused not-possible until the mute ends to the millisecond, and the other side may still speak", async () => {
    const { server, key } = await linkedPair();
    const ends = server.deps.now() + 2 * time.DAY_MS;
    await act(server, INVITER, "mute", 2, "log.mute");
    await newLife(server, "account-c");
    const code = await cardOut(server, "account-c");

    expect(await sayFrom(server, INVITER, key)).toMatchObject({ ok: false, code: "not-possible" });
    expect((await call(server, "POST", "/api/invite", INVITER, { slot: "partner" })).body).toMatchObject({ ok: false, code: "not-possible" });
    expect((await call(server, "POST", `/api/invite/${code}/accept`, INVITER, { slot: "partner" })).body).toMatchObject({ ok: false, code: "not-possible" });
    expect(await sayFrom(server, FRIEND, key)).toMatchObject({ ok: true });

    server.setNow(ends - 1);
    expect(await sayFrom(server, INVITER, key)).toMatchObject({ ok: false, code: "not-possible" });
    server.setNow(ends);
    expect(await sayFrom(server, INVITER, key)).toMatchObject({ ok: true });
  });

  test("[R-MODERATION-014] [R-MODERATION-016] given a suspension whose appeal was overturned, when the player says a phrase, then it goes", async () => {
    const { server, key } = await linkedPair();
    await act(server, INVITER, "suspend", 30, "log.suspend");
    expect(await sayFrom(server, INVITER, key)).toMatchObject({ ok: false, code: "not-possible" });
    await server.deps.stores.appeals.file({ id: "appeal.1", account: INVITER, entry: "log.suspend", at: server.deps.now() });
    await server.deps.stores.appeals.decide("appeal.1", { outcome: "overturned", by: "account.second", at: server.deps.now() });
    expect(await sayFrom(server, INVITER, key)).toMatchObject({ ok: true });
  });

  test("[R-MODERATION-014] given a mute on another account, when a player with none makes a link, then it is not refused for it", async () => {
    const server = pairServer();
    await signUp(server, "account-z");
    await act(server, "account-z", "mute", 5, "log.other");
    await newLife(server, INVITER);
    expect(await cardOut(server)).toMatch(/.+/);
  });
});
