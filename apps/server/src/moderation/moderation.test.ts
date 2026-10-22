import { type QueueView, REPORT_REASONS, type Standing } from "@japacity/api";
import { content, text } from "@japacity/content";
import { newState, time } from "@japacity/sim";
import type { ModerationLogEntry } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { forgettingPresence, testDeps } from "../app.testing";
import { makeApp } from "../app";
import { productionConfig, testConfig } from "../config";
import { testSession } from "../dependencies";
import { characterNameProblem, renameFrom } from "../account/username";
import { identityHash, isBanned } from "./identities";
import { readReport } from "./reports";
import { ADMIN, as, DAY, HOUR, message, moderationHarness, post, report, SECOND_ADMIN } from "./moderation.testing";
import type { ModerationHarness } from "./moderation.testing";

type Body = Record<string, unknown>;

async function json<T = Body>(reply: Response): Promise<T> {
  return reply.json<T>();
}

async function queueOf(app: { request: (path: string, init?: RequestInit) => Response | Promise<Response> }, admin = ADMIN): Promise<QueueView> {
  return (await json<{ queue: QueueView }>(await app.request("/api/admin/moderation/queue", as(admin)))).queue;
}

const close = (action: string, extra: Body = {}) => ({ action, reason: "harassment", ...extra });

describe("the admin view's routes", () => {
  test("[moderation:admin-view-for-admin-list] [server:ledger-alarm-lists-suspects] given a session off the admin list or none, when any moderation admin route is asked, then it answers 404 exactly as a route that does not exist", async () => {
    const config = testConfig({ testing: { testLogin: true }, admin: { accounts: [ADMIN] } });
    const app = makeApp(testDeps({ config, session: testSession(config) }));
    const missing = await app.request("/api/admin/moderation/nothing-here", as(ADMIN));
    const body = await missing.text();
    const asks: [string, RequestInit][] = [
      ["/api/admin/moderation/queue", {}],
      ["/api/admin/moderation/report.1/close", { method: "POST", body: JSON.stringify(close("ban")) }],
      ["/api/admin/moderation/log?item=report.1", {}],
      ["/api/admin/moderation/feedback", {}],
    ];
    expect(missing.status).toBe(404);
    for (const [path, init] of asks) {
      for (const account of [null, "account.player"]) {
        const reply = await app.request(path, as(account, init));
        expect(reply.status).toBe(404);
        expect(await reply.text()).toBe(body);
      }
    }
    expect((await app.request("/api/admin/moderation/queue", as(ADMIN))).status).toBe(200);
  });

  test("[moderation:admin-actions-logged-append-only] given a logged action, when an admin tries to change or delete it through any route, then nothing answers and the entry is unchanged", async () => {
    const h = moderationHarness({ reports: [report("report.1")] });
    const closed = await json<{ entry: ModerationLogEntry }>(await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close("warn"))));
    const id = closed.entry.id;
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      for (const path of [`/api/admin/moderation/log/${id}`, "/api/admin/moderation/log", `/api/admin/moderation/log?item=report.1`]) {
        expect((await h.app.request(path, as(ADMIN, { method, body: JSON.stringify({ action: "dismiss" }) }))).status).toBe(404);
      }
    }
    expect((await h.app.request(`/api/admin/moderation/${id}/close`, post(ADMIN, close("dismiss")))).status).toBe(404);
    expect(await h.deps.stores.moderationLog.list({ item: "report.1" })).toEqual([closed.entry]);
    expect(await json(await h.app.request("/api/admin/moderation/log?item=report.1", as(ADMIN)))).toEqual({ ok: true, entries: [closed.entry] });
  });
});

describe("the queue", () => {
  test("[moderation:one-queue-by-reason-weight] given reports of every weight and an appeal, when the queue is read, then underage, self-harm, sexual and illegal come first, then scam, then the rest with the appeal, each oldest first", async () => {
    const h = moderationHarness({
      now: 10 * DAY,
      reports: [
        report("report.harass-old", { at: 1 * HOUR, reason: "harassment" }),
        report("report.scam-old", { at: 2 * HOUR, reason: "scam" }),
        report("report.illegal-new", { at: 9 * HOUR, reason: "illegal" }),
        report("report.underage", { at: 5 * HOUR, reason: "underage" }),
        report("report.scam-new", { at: 8 * HOUR, reason: "scam" }),
        report("report.self-harm", { at: 6 * HOUR, reason: "self-harm" }),
        report("report.other-new", { at: 7 * HOUR, reason: "other" }),
        report("report.sexual", { at: 4 * HOUR, reason: "sexual" }),
        report("report.done", { at: 0, reason: "underage", status: "decided", outcome: "acted" }),
      ],
    });
    await h.deps.stores.moderationLog.append({ id: "log.0", admin: ADMIN, at: HOUR, item: "report.done", action: "warn", params: { account: "account.reported" }, reason: "hate" });
    await h.deps.stores.appeals.file({ id: "appeal.1", account: "account.reported", entry: "log.0", at: 3 * HOUR });

    const queue = await queueOf(h.app);

    expect(queue.items.map((item) => item.id)).toEqual([
      "report.sexual",
      "report.underage",
      "report.self-harm",
      "report.illegal-new",
      "report.scam-old",
      "report.scam-new",
      "report.harass-old",
      "appeal.1",
      "report.other-new",
    ]);
  });

  test("[moderation:reports-decided-within-target] given open reports, when the queue is read, then it shows the oldest one's age, and one is overdue only past the target to the millisecond", async () => {
    const target = productionConfig.moderation.decideHours * HOUR;
    const h = moderationHarness({ now: 0, reports: [report("report.a", { at: 0 }), report("report.b", { at: 1 })] });
    expect(await queueOf(moderationHarness({ now: 0 }).app)).toEqual({ items: [], oldest: 0, target, overdue: 0 });

    h.at(target);
    expect(await queueOf(h.app)).toMatchObject({ oldest: target, target, overdue: 0 });
    h.at(target + 1);
    expect(await queueOf(h.app)).toMatchObject({ oldest: target + 1, overdue: 1 });
    h.at(target + 2);
    expect(await queueOf(h.app)).toMatchObject({ overdue: 2 });
  });

  test("[moderation:queue-item-shows-context] given a report on a conversation, when its item is read, then it shows the reason, the cited phrases with their words and times, both accounts' region, age, reports and actions, and no email, seed or state", async () => {
    const h = moderationHarness({
      now: 5 * DAY,
      reports: [
        report("report.1", { at: 2 * DAY, cites: { messages: ["m.2", "m.1"] } }),
        report("report.old", { at: DAY, reporter: "account.reported", subject: { account: "account.reporter" }, reason: "scam", status: "decided", outcome: "no-action" }),
      ],
      holds: [{ report: "report.1", messages: ["m.1", "m.2"], until: 92 * DAY }],
      messages: [message("m.2", 2 * DAY - 5), message("m.1", 2 * DAY - 10), message("m.other", 2 * DAY - 1)],
    });
    await h.deps.stores.account.create({ id: "account.reported", country: "GB", age: { passed: true, at: 0, method: "declared" }, createdAt: 3 * DAY, character: "character.secret", notifyBankFull: false, sendUsageCounts: true, state: "secured", username: "account_reported", usernameChangedAt: null, lastPlayedAt: 3 * DAY });
    await h.deps.stores.account.create({ id: "account.reporter", country: "NG", age: { passed: true, at: 0, method: "declared" }, createdAt: DAY, character: null, notifyBankFull: false, sendUsageCounts: true, state: "secured", username: "account_reporter", usernameChangedAt: null, lastPlayedAt: DAY });
    await h.deps.stores.moderationLog.append({ id: "log.earlier", admin: ADMIN, at: DAY, item: "report.older", action: "warn", params: { account: "account.reported" }, reason: "hate" });

    const [item] = (await queueOf(h.app)).items;

    expect(item).toEqual({
      kind: "report",
      id: "report.1",
      reason: "harassment",
      at: 2 * DAY,
      age: 3 * DAY,
      subject: { account: "account.reported" },
      cites: { messages: ["m.2", "m.1"] },
      unverified: false,
      hold: { report: "report.1", messages: ["m.1", "m.2"], until: 92 * DAY },
      messages: [
        { id: "m.1", sender: "account.reported", phrase: "phrase.hello", words: text["phrase.hello.name"], fill: null, sentAt: 2 * DAY - 10 },
        { id: "m.2", sender: "account.reported", phrase: "phrase.hello", words: text["phrase.hello.name"], fill: null, sentAt: 2 * DAY - 5 },
      ],
      reporter: {
        account: "account.reporter",
        region: "NG",
        accountAge: 4 * DAY,
        made: [{ id: "report.1", reason: "harassment", at: 2 * DAY, status: "open" }],
        received: [{ id: "report.old", reason: "scam", at: DAY, status: "decided", outcome: "no-action" }],
        actions: [],
      },
      reported: {
        account: "account.reported",
        region: "GB",
        accountAge: 2 * DAY,
        made: [{ id: "report.old", reason: "scam", at: DAY, status: "decided", outcome: "no-action" }],
        received: [{ id: "report.1", reason: "harassment", at: 2 * DAY, status: "open" }],
        actions: [{ id: "log.earlier", admin: ADMIN, at: DAY, item: "report.older", action: "warn", params: { account: "account.reported" }, reason: "hate" }],
      },
    });
    expect(JSON.stringify(item)).not.toMatch(/email|seed|character/i);
  });
});

describe("closing a report", () => {
  test("[moderation:reports-hold-cited-records] given a held report, when the queue is read, another report is closed, an appeal is filed and a rollback is opened on it, then it stays held; only its own close lifts it", async () => {
    const h = moderationHarness({
      reports: [report("report.1"), report("report.2", { at: 1 })],
      holds: [
        { report: "report.1", messages: ["report.1.m1"], until: 91 * DAY },
        { report: "report.2", messages: ["report.2.m1"], until: 91 * DAY },
      ],
    });
    const held = structuredClone(h.queue.holds[0]);
    await queueOf(h.app);
    expect((await h.app.request("/api/admin/moderation/report.2/close", post(ADMIN, close("warn")))).status).toBe(200);
    const warned = (await h.deps.stores.moderationLog.list({ item: "report.2" }))[0];
    expect((await h.app.request("/api/moderation/appeal", post("account.reported", { action: warned?.id }))).status).toBe(200);
    expect((await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close("rollback")))).status).toBe(200);
    expect((await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close("mute", { days: 0 })))).status).toBe(400);
    h.at(90 * DAY);

    expect(h.queue.holds).toEqual([held]);
    expect((await h.queue.get("report.1"))?.status).toBe("open");

    expect((await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close("dismiss")))).status).toBe(200);
    expect(h.queue.holds).toEqual([]);
    expect(await h.queue.get("report.1")).toMatchObject({ status: "decided", outcome: "no-action" });
  });

  test("[moderation:fixed-admin-actions] given open reports, when each action is taken, then a dismiss closes with no action, every other with acted, and the advert actions and unknown ones are refused here", async () => {
    const reports = ["dismiss", "warn", "mute", "suspend", "reset-name", "refer"].map((action, at) => report(`report.${action}`, { at }));
    const h = moderationHarness({ reports: [...reports, report("report.left", { at: 99 })] });
    const extra: Record<string, Body> = { mute: { days: 7 }, suspend: { days: 30 }, refer: { body: "the police" } };
    for (const { id } of reports) {
      const action = id.slice("report.".length);
      const reply = await json<{ report: { outcome: string } }>(await h.app.request(`/api/admin/moderation/${id}/close`, post(ADMIN, close(action, extra[action]))));
      expect(reply.report.outcome).toBe(action === "dismiss" ? "no-action" : "acted");
    }
    for (const action of ["pull-advert", "approve-advert", "refuse-advert", "freeze", "edit-balance", ""]) {
      const reply = await h.app.request("/api/admin/moderation/report.left/close", post(ADMIN, close(action)));
      expect(reply.status).toBe(400);
      expect(await json(reply)).toMatchObject({ ok: false, code: "not-legal" });
    }
    expect((await h.queue.get("report.left"))?.status).toBe("open");
    expect(h.identities.ended).toEqual(["account.reported"]);
  });

  test("[moderation:fixed-admin-actions] given a mute or a suspension, when its days are 0, 1, 3650 and 3651, then 1 and 3650 are taken and the others refused", async () => {
    for (const action of ["mute", "suspend"]) {
      const h = moderationHarness({ reports: [report("report.a"), report("report.b"), report("report.c"), report("report.d")] });
      const statuses: number[] = [];
      for (const [id, days] of [["report.a", 0], ["report.b", 1], ["report.c", 3650], ["report.d", 3651]] as const) {
        statuses.push((await h.app.request(`/api/admin/moderation/${id}/close`, post(ADMIN, close(action, { days })))).status);
      }
      expect(statuses).toEqual([400, 200, 200, 400]);
    }
  });

  test("[moderation:fixed-admin-actions] given a report about an advert, when an action on an account is taken on it, then it is refused; dismiss and refer are taken", async () => {
    const advert = { subject: { campaign: "campaign.1" }, reason: "advert" as const, cites: { campaign: "campaign.1", slot: "advert.slot-1" } };
    const h = moderationHarness({ reports: [report("report.a", advert), report("report.b", advert)] });
    for (const action of ["warn", "mute", "suspend", "ban", "reset-name", "rollback"]) {
      expect((await h.app.request("/api/admin/moderation/report.a/close", post(ADMIN, close(action, { days: 1 })))).status).toBe(400);
    }
    expect((await h.app.request("/api/admin/moderation/report.a/close", post(ADMIN, close("refer", { body: "the advertising standards body" })))).status).toBe(200);
    expect((await h.app.request("/api/admin/moderation/report.b/close", post(ADMIN, close("dismiss")))).status).toBe(200);
    expect((await h.deps.stores.moderationLog.list({ item: "report.a" }))[0]?.params).toEqual({ body: "the advertising standards body" });
  });

  test("[moderation:admin-actions-logged-append-only] given an action, when it is taken, then the log holds the admin, the time, the item, the action, its parameters, the reason and the note; a decided report closed again writes nothing", async () => {
    const h = moderationHarness({ now: 3 * DAY, reports: [report("report.1")] });
    const reply = await json<{ entry: ModerationLogEntry }>(await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close("mute", { days: 7, reason: "hate", note: "third time" }))));

    expect(reply.entry).toEqual({ id: reply.entry.id, admin: ADMIN, at: 3 * DAY, item: "report.1", action: "mute", params: { account: "account.reported", days: 7 }, reason: "hate", note: "third time" });
    expect(reply.entry.id).toMatch(/^log\.[0-9a-f]{16}$/);
    const again = await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close("ban")));
    expect(again.status).toBe(409);
    expect((await h.app.request("/api/admin/moderation/report.9/close", post(ADMIN, close("ban")))).status).toBe(404);
    expect((await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, { action: "warn", reason: "rude" }))).status).toBe(409);
    expect(await h.deps.stores.moderationLog.list({ account: "account.reported" })).toEqual([reply.entry]);
    for (const reason of REPORT_REASONS) expect(typeof reason).toBe("string");
  });

  test("[moderation:fixed-admin-actions] [moderation:ban-survives-as-hash] given a ban, when it is taken, then every sign-in identity is kept only as a salted hash, every session ends and the account's deletion is requested", async () => {
    const identities = { "account.reported": ["email:bad@example.test", "google:1234"] };
    const h = moderationHarness({ reports: [report("report.1")], identities });

    const reply = await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close("ban")));

    expect(reply.status).toBe(200);
    expect(h.identities.ended).toEqual(["account.reported"]);
    expect(await isBanned(h.deps, ["email:bad@example.test"])).toBe(true);
    expect(await isBanned(h.deps, ["google:1234"])).toBe(true);
    expect(await isBanned(h.deps, ["email:good@example.test"])).toBe(false);
    expect(await h.deps.stores.banned.has("email:bad@example.test")).toBe(false);
    expect(await h.deps.stores.banned.has(await identityHash(h.deps, "google:1234"))).toBe(true);
    expect(await identityHash(h.deps, "google:1234")).not.toBe(await identityHash({ secrets: { banSalt: "another-deployment", drawTokenKey: "test-draw-token-key", worldSeed: "test-world-seed" } }, "google:1234"));
    expect(await h.deps.stores.deletion.due(h.deps.now() + h.deps.config.account.deleteWithinDays * time.DAY_MS)).toMatchObject([{ account: "account.reported" }]);
  });

  test("[moderation:fixed-admin-actions] given a report on a player's name, when the name is reset, then the account's username is a generated one in place of the reported name, and the player may choose their own at once", async () => {
    const h = moderationHarness({ reports: [report("report.1")] });
    await h.deps.stores.account.create({ id: "account.reported", country: "GB", age: { passed: true, at: 0, method: "declared" }, createdAt: 0, character: null, notifyBankFull: false, sendUsageCounts: true, state: "secured", username: "rude_name", usernameChangedAt: 0, lastPlayedAt: 0 });
    // Renamed at the start of the clock, so without the reset the next change would wait `renameDays`.
    expect(renameFrom({ usernameChangedAt: 0 }, h.deps.config)).toBeGreaterThan(h.deps.now());

    const reply = await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close("reset-name")));

    expect(reply.status).toBe(200);
    const row = await h.deps.stores.account.get("account.reported");
    expect(row?.username).toMatch(/^player_[0-9a-z]{11}$/);
    expect(row?.usernameChangedAt).toBeNull();
    expect(row === null ? null : renameFrom(row, h.deps.config)).toBeLessThanOrEqual(h.deps.now());
  });

  test("[moderation:fixed-admin-actions] [account:person-kept-with-character] given a report on a player's name whose life keeps the person built at the door, when the name is reset, then the character's first name is a generated one from the pool too, its look and colours as they were; a life with no person kept keeps none", async () => {
    const h = moderationHarness({ reports: [report("report.1"), report("report.2", { subject: { account: "account.plain" } })] });
    const made = (id: string) => ({ id, account: `account.${id}`, refilledAt: 0, content: content.version, start: { scenario: "scenario.graduate" as const, seed: id, worldSeed: "w" }, state: newState("scenario.graduate", id, content) });
    const kept = { name: "Rudename", look: "person_ada", archetype: "developer", style: { skin: "skin3" } };
    await h.deps.stores.player.create({ ...made("character.reported"), person: kept });
    await h.deps.stores.player.create(made("character.plain"));
    for (const [account, character] of [["account.reported", "character.reported"], ["account.plain", "character.plain"]] as const) {
      await h.deps.stores.account.create({ id: account, country: "GB", age: { passed: true, at: 0, method: "declared" }, createdAt: 0, character, notifyBankFull: false, sendUsageCounts: true, state: "secured", username: `${account.slice(8)}_name`, usernameChangedAt: 0, lastPlayedAt: 0 });
    }

    expect((await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close("reset-name")))).status).toBe(200);
    expect((await h.app.request("/api/admin/moderation/report.2/close", post(ADMIN, close("reset-name")))).status).toBe(200);

    const reset = await h.deps.stores.player.person("character.reported");
    expect(reset).toMatchObject({ look: "person_ada", archetype: "developer", style: { skin: "skin3" } });
    expect(reset?.name).not.toBe("Rudename");
    expect(characterNameProblem(reset?.name ?? "")).toBeNull();
    expect(Object.values(text)).toContain(reset?.name);
    expect(await h.deps.stores.player.person("character.plain")).toBeNull();
    expect((await h.deps.stores.account.get("account.plain"))?.username).toMatch(/^player_[0-9a-z]{11}$/);
  });

  test("[moderation:upheld-underage-closes-account] given an underage report, when an admin upholds it with less than a ban, then it is refused; a ban closes the account and bars the same identity from a new date of birth", async () => {
    const h = moderationHarness({ reports: [report("report.1", { reason: "underage" })], identities: { "account.reported": ["email:kid@example.test"] } });
    for (const action of ["warn", "mute", "suspend", "reset-name"]) {
      expect((await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close(action, { days: 1, reason: "underage" })))).status).toBe(400);
    }
    expect(await h.deps.stores.moderationLog.list({ item: "report.1" })).toEqual([]);

    expect((await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close("ban", { reason: "underage" })))).status).toBe(200);

    expect(await isBanned(h.deps, ["email:kid@example.test"])).toBe(true);
    expect(await h.deps.stores.deletion.find(await (await import("../account/deletion")).accountHash("account.reported"))).toMatchObject({ completedAt: null });
  });

  test("[moderation:rollback-through-admin-view] given a report on an account, when the rollback is opened from it, then its use is logged, the comparison comes back, and the report stays open and held", async () => {
    const h = moderationHarness({ reports: [report("report.1")], holds: [{ report: "report.1", messages: ["report.1.m1"], until: 91 * DAY }] });
    await h.deps.stores.account.create({ id: "account.reported", country: "NG", age: { passed: true, at: 0, method: "declared" }, createdAt: 0, character: "character.nobody", notifyBankFull: false, sendUsageCounts: true, state: "secured", username: "account_reported", usernameChangedAt: null, lastPlayedAt: 0 });

    const reply = await json<{ entry: ModerationLogEntry; rollback: unknown }>(await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close("rollback"))));

    expect(reply.entry).toMatchObject({ action: "rollback", item: "report.1", params: { account: "account.reported" } });
    expect(reply.rollback).toEqual({ ok: false, code: "missing", detail: "No character character.nobody." });
    expect((await h.queue.get("report.1"))?.status).toBe("open");
    expect(h.queue.holds).toHaveLength(1);
  });
});

describe("what the player is told, and the appeal", () => {
  test("[moderation:actioned-player-told-and-appeals] given a mute on a player, when they read their standing, then they see the action, the reason and that it can be appealed; they appeal it once, and the appeal enters the queue", async () => {
    const h = moderationHarness({ now: 2 * DAY, reports: [report("report.1")] });
    const { entry } = await json<{ entry: ModerationLogEntry }>(await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close("mute", { days: 7, reason: "hate", note: "private note" }))));

    const standing = (await json<{ standing: Standing }>(await h.app.request("/api/moderation/standing", as("account.reported")))).standing;
    expect(standing).toEqual({ actions: [{ entry: entry.id, action: "mute", reason: "hate", at: 2 * DAY, until: 9 * DAY, appeal: null }], mutedUntil: 9 * DAY, suspendedUntil: null, banned: false, reports: [] });
    expect(JSON.stringify(standing)).not.toContain("private note");
    expect(JSON.stringify(standing)).not.toContain(ADMIN);

    const filed = await h.app.request("/api/moderation/appeal", post("account.reported", { action: entry.id }));
    expect(await json(filed)).toEqual({ ok: true, appeal: { id: expect.stringMatching(/^appeal\./) as string, entry: entry.id, status: "open" } });
    expect((await h.app.request("/api/moderation/appeal", post("account.reported", { action: entry.id }))).status).toBe(409);
    expect((await h.app.request("/api/moderation/appeal", post("account.reporter", { action: entry.id }))).status).toBe(404);
    expect((await h.app.request("/api/moderation/appeal", post(null, { action: entry.id }))).status).toBe(401);
    expect((await queueOf(h.app)).items.map((item) => item.kind)).toEqual(["appeal"]);
    h.at(9 * DAY);
    expect((await json<{ standing: Standing }>(await h.app.request("/api/moderation/standing", as("account.reported")))).standing.mutedUntil).toBeNull();
  });

  test("[moderation:actioned-player-told-and-appeals] given two admins, when the one who acted decides the appeal, then it is refused; the other decides it, and an overturned mute is no longer in force", async () => {
    const h = moderationHarness({ admins: [ADMIN, SECOND_ADMIN], reports: [report("report.1")] });
    const { entry } = await json<{ entry: ModerationLogEntry }>(await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close("mute", { days: 7 }))));
    await h.app.request("/api/moderation/appeal", post("account.reported", { action: entry.id }));
    const [appeal] = (await queueOf(h.app)).items;
    if (appeal?.kind !== "appeal") throw new Error("The appeal is not in the queue.");
    expect(appeal.actedBy).toBe(ADMIN);

    const own = await h.app.request(`/api/admin/moderation/${appeal.id}/close`, post(ADMIN, { outcome: "overturned", reason: "other" }));
    expect(own.status).toBe(403);
    expect(await json(own)).toMatchObject({ code: "not-yours" });
    expect((await h.app.request(`/api/admin/moderation/${appeal.id}/close`, post(SECOND_ADMIN, { outcome: "sideways", reason: "other" }))).status).toBe(400);
    const decided = await json<{ entry: ModerationLogEntry }>(await h.app.request(`/api/admin/moderation/${appeal.id}/close`, post(SECOND_ADMIN, { outcome: "overturned", reason: "other" })));

    expect(decided.entry).toMatchObject({ admin: SECOND_ADMIN, item: appeal.id, params: { account: "account.reported", entry: entry.id, outcome: "overturned" } });
    const standing = (await json<{ standing: Standing }>(await h.app.request("/api/moderation/standing", as("account.reported")))).standing;
    expect(standing.mutedUntil).toBeNull();
    expect(standing.actions[0]?.appeal).toEqual({ status: "decided", outcome: "overturned" });
    expect((await queueOf(h.app)).items).toEqual([]);
    expect((await h.app.request(`/api/admin/moderation/${appeal.id}/close`, post(SECOND_ADMIN, { outcome: "upheld", reason: "other" }))).status).toBe(409);
  });

  test("[moderation:actioned-player-told-and-appeals] given one admin, when they decide the appeal against their own action, then it is taken", async () => {
    const h = moderationHarness({ reports: [report("report.1")] });
    const { entry } = await json<{ entry: ModerationLogEntry }>(await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close("warn"))));
    const filed = await json<{ appeal: { id: string } }>(await h.app.request("/api/moderation/appeal", post("account.reported", { action: entry.id })));

    expect((await h.app.request(`/api/admin/moderation/${filed.appeal.id}/close`, post(ADMIN, { outcome: "upheld", reason: "harassment" }))).status).toBe(200);
    expect((await h.deps.stores.appeals.get(filed.appeal.id))?.outcome).toBe("upheld");
  });

  test("[moderation:reporter-told-outcome-only] given a player's report, when they read their standing, then they see it received and then its outcome, and never what was done to whom", async () => {
    const h = moderationHarness({ reports: [report("report.1", { at: 5 })] });
    const read = async () => (await json<{ standing: Standing }>(await h.app.request("/api/moderation/standing", as("account.reporter")))).standing;
    expect((await read()).reports).toEqual([{ id: "report.1", at: 5, status: "open" }]);

    await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close("suspend", { days: 3 })));

    const after = await read();
    expect(after).toEqual({ actions: [], mutedUntil: null, suspendedUntil: null, banned: false, reports: [{ id: "report.1", at: 5, status: "decided", outcome: "acted" }] });
    expect(JSON.stringify(after)).not.toMatch(/"suspend"|"days"|account\.reported/);
  });
});

describe("what a report carries", () => {
  const subject = { account: "account.b" };

  test("[moderation:report-carries-subject-and-reason] given a report with no cites, empty cites or cites of an unknown kind, when it is read, then it is refused", () => {
    for (const cites of [undefined, null, {}, { messages: [] }, { messages: [""] }, { text: "you are rude" }, { card: "card.1", pair: "pair.1" }, { place: "place.1", phrase: "phrase.hello" }]) {
      expect(readReport({ subject, reason: "harassment", cites })).toMatchObject({ ok: false });
    }
    expect(readReport({ subject, reason: "rude", cites: { card: "card.1" } })).toMatchObject({ ok: false });
    expect(readReport({ subject: { email: "x@example.test" }, reason: "scam", cites: { card: "card.1" } })).toMatchObject({ ok: false });
  });

  test("[moderation:report-carries-subject-and-reason] [moderation:spoken-phrases-not-stored] given each kind of cite, when a report is read, then it is taken whole, and a phrase heard in a place is marked unverified", () => {
    const cites = [{ messages: ["m.1", "m.2"] }, { place: "place.market", phrase: "phrase.hello", at: 1_700 }, { card: "card.1" }, { pair: "pair.a~b" }, { campaign: "campaign.1", slot: "advert.slot-1" }];
    for (const cite of cites) {
      expect(readReport({ subject, reason: "scam", cites: cite })).toEqual({ ok: true, report: { subject, reason: "scam", cites: cite, unverified: "place" in cite } });
    }
    for (const reason of REPORT_REASONS) expect(readReport({ subject: { campaign: "campaign.1" }, reason, cites: { card: "card.1" } }).ok).toBe(true);
    expect(REPORT_REASONS).toEqual(["scam", "harassment", "impersonation", "underage", "sexual", "hate", "self-harm", "illegal", "cheating", "advert", "other"]);
  });
});

const HUB = "place.ojuelegba";

/** The reported player standing in the hub under `username`, and a presence store that keeps every forget with how many sessions had ended by then. */
async function inThePlace(h: ModerationHarness, username: string): Promise<{ presence: ReturnType<typeof forgettingPresence>; endedAtForget: number[] }> {
  await h.deps.stores.account.create({ id: "account.reported", country: "GB", age: { passed: true, at: 0, method: "declared" }, createdAt: 0, character: null, notifyBankFull: false, sendUsageCounts: true, state: "secured", username, usernameChangedAt: 0, lastPlayedAt: 0 });
  const presence = forgettingPresence();
  const endedAtForget: number[] = [];
  h.deps.stores.presence = {
    ...presence,
    forget: async (places, account, name) => {
      endedAtForget.push(h.identities.ended.length);
      await presence.forget(places, account, name);
    },
  };
  await presence.join(HUB, "socket-1", { account: "account.reported", name: username, look: "person_ada", place: HUB, joinedAt: 0 });
  return { presence, endedAtForget };
}

describe("the actions that reach the places", () => {
  test("[moderation:fixed-admin-actions] [city:players-shown-present-not-tracked] given a player standing in a place under a reported name, when the name is reset, then the player's sockets close at once and the old name leaves the day's list", async () => {
    const h = moderationHarness({ reports: [report("report.1")] });
    const { presence } = await inThePlace(h, "rude_name");

    expect((await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, close("reset-name")))).status).toBe(200);

    expect(presence.forgotten).toEqual([{ account: "account.reported", name: "rude_name", places: expect.arrayContaining([HUB]) as string[] }]);
    expect(await presence.sample(HUB, 20, null, 0)).toEqual([]);
  });

  test("[moderation:fixed-admin-actions] [account:player-deletes-account] given a player standing in a place, when it is suspended or banned, then once every session has ended the player's sockets close and its name leaves the day's list", async () => {
    for (const action of [close("suspend", { days: 3 }), close("ban")]) {
      const h = moderationHarness({ reports: [report("report.1")], identities: { "account.reported": ["email:bad@example.test"] } });
      const { presence, endedAtForget } = await inThePlace(h, "named_player");

      expect((await h.app.request("/api/admin/moderation/report.1/close", post(ADMIN, action))).status).toBe(200);

      expect(h.identities.ended).toEqual(["account.reported"]);
      expect(presence.forgotten.at(-1)).toEqual({ account: "account.reported", name: "named_player", places: expect.arrayContaining([HUB]) as string[] });
      expect(endedAtForget.at(-1)).toBe(1);
      expect(await presence.sample(HUB, 20, null, 0)).toEqual([]);
    }
  });
});
