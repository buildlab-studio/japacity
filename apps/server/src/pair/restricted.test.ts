import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import type { TestServer } from "../authority/authority.testing";
import { call, cardOut, FRIEND, INVITER, linkedPair, pairServer, sayFrom, signUp } from "./pair.testing";
import { newLife } from "../authority/authority.testing";

const ADMIN = "account.owner";

async function act(server: TestServer, account: string, action: "mute" | "suspend", days: number, id: string): Promise<void> {
  const written = await server.deps.stores.moderationLog.append({ id, admin: ADMIN, at: server.deps.now(), item: "report.1", action, params: { account, days }, reason: "harassment" });
  if (!written.ok) throw new Error(written.detail);
}

describe("mutes and suspensions on the people routes", () => {
  test("[moderation:fixed-admin-actions] given a player muted for 2 days, when they say a phrase, make a link or take one, then each is refused not-possible until the mute ends to the millisecond, and the other side may still speak", async () => {
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

  test("[moderation:fixed-admin-actions] [moderation:actioned-player-told-and-appeals] given a suspension whose appeal was overturned, when the player says a phrase, then it goes", async () => {
    const { server, key } = await linkedPair();
    await act(server, INVITER, "suspend", 30, "log.suspend");
    expect(await sayFrom(server, INVITER, key)).toMatchObject({ ok: false, code: "not-possible" });
    await server.deps.stores.appeals.file({ id: "appeal.1", account: INVITER, entry: "log.suspend", at: server.deps.now() });
    await server.deps.stores.appeals.decide("appeal.1", { outcome: "overturned", by: "account.second", at: server.deps.now() });
    expect(await sayFrom(server, INVITER, key)).toMatchObject({ ok: true });
  });

  test("[moderation:fixed-admin-actions] given a mute on another account, when a player with none makes a link, then it is not refused for it", async () => {
    const server = pairServer();
    await signUp(server, "account-z");
    await act(server, "account-z", "mute", 5, "log.other");
    await newLife(server, INVITER);
    expect(await cardOut(server)).toMatch(/.+/);
  });

  test("[moderation:fixed-admin-actions] given a link a player made before a mute or a suspension, when another opens or takes it while the restriction runs, then it is refused as no such link and no pair is made; once the restriction ends, the link opens and is taken", async () => {
    for (const action of ["mute", "suspend"] as const) {
      const server = pairServer();
      await newLife(server, INVITER, "scenario.graduate");
      await newLife(server, FRIEND, "scenario.banker");
      const code = await cardOut(server);
      const ends = server.deps.now() + 2 * time.DAY_MS;
      await act(server, INVITER, action, 2, `log.${action}`);

      server.setNow(ends - 1);
      const shown = await call<{ ok: boolean; code?: string }>(server, "GET", `/api/invite/${code}`, null);
      const taken = await call<{ ok: boolean; code?: string }>(server, "POST", `/api/invite/${code}/accept`, FRIEND, { slot: "partner" });
      expect({ status: shown.status, body: shown.body }).toMatchObject({ status: 404, body: { ok: false, code: "bad-code" } });
      expect({ status: taken.status, body: taken.body }).toMatchObject({ status: 404, body: { ok: false, code: "bad-code" } });
      expect(shown.text).not.toMatch(/mute|suspend|paused/i);
      expect(await server.deps.stores.invite.get(code)).toMatchObject({ used: false, pair: null });

      server.setNow(ends);
      expect((await call<{ ok: boolean }>(server, "GET", `/api/invite/${code}`, null)).body).toMatchObject({ ok: true });
      expect((await call<{ ok: boolean }>(server, "POST", `/api/invite/${code}/accept`, FRIEND, { slot: "partner" })).body).toMatchObject({ ok: true });
    }
  });
});

