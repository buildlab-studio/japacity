import { Hono } from "hono";
import { describe, expect, test } from "vitest";

import { harness, makeJar, SITE } from "../auth/auth.testing";
import { adminModerationRoutes } from "../routes/admin/moderation";
import { authIdentities, emailIdentity, isBanned } from "./identities";
import { memoryReportQueue } from "./reports";
import { report } from "./moderation.testing";

describe("a ban through the sign-in library", () => {
  test("[moderation:fixed-admin-actions] [moderation:ban-survives-as-hash] given a signed-in player, when an admin bans them, then their email is barred by its hash, every session of theirs ends, and the admin's does not", async () => {
    const h = harness();
    const player = await h.signUp("Player@Example.test", makeJar());
    const admin = await h.signUp("owner@example.test", makeJar());
    h.deps.config.admin.accounts.push(admin.account);
    // moderation:admin-view-for-admin-list: the admin routes answer only a session opened with a passkey.
    for (const row of h.tables.session) if (row["userId"] === admin.account) row["signedInWith"] = "passkey";
    const identities = authIdentities(h.auth);
    const queue = memoryReportQueue({ reports: [report("report.1", { subject: { account: player.account } })] });
    const routes = new Hono().route("/", adminModerationRoutes(h.deps, { reports: queue, identities }));
    expect(await identities.of(player.account)).toContain(emailIdentity("player@example.test"));
    expect(await identities.of("account.nobody")).toEqual([]);
    expect((await h.call("/api/account", { jar: player.jar })).status).toBe(200);

    const reply = await routes.request(`${SITE}/api/admin/moderation/report.1/close`, {
      method: "POST",
      headers: { cookie: admin.jar.header(), "content-type": "application/json" },
      body: JSON.stringify({ action: "ban", reason: "scam" }),
    });

    expect(reply.status).toBe(200);
    expect((await h.call("/api/account", { jar: player.jar })).status).toBe(401);
    expect((await h.call("/api/account", { jar: admin.jar })).status).toBe(200);
    expect(await isBanned(h.deps, [emailIdentity(" PLAYER@example.test ")])).toBe(true);
    expect(await isBanned(h.deps, [emailIdentity("owner@example.test")])).toBe(false);
  });
});
