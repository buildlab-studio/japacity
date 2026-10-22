import type { State } from "@japacity/sim";
import { time } from "@japacity/sim";
import { afterEach, describe, expect, test, vi } from "vitest";

import { accountHash, deletionStatus } from "../account/deletion";
import { harness, makeJar } from "../auth/auth.testing";
import type { Harness } from "../auth/auth.testing";
import { runDeletions } from "./deletion";

afterEach(() => {
  vi.useRealTimers();
});

const START = Date.parse("2026-10-08T09:00:00Z");

/** An account with a character, a ledger mark, retired audit entries, a day total, a lottery ticket, an admin log entry and a switch log entry, then deleted. */
async function deletedPlayer(h: Harness) {
  const { jar, account } = await h.signUp("ada@example.com");
  const character = "char-ada";
  const state = { character, v: 0 } as unknown as State;
  const created = await h.deps.stores.player.create({ id: character, account, refilledAt: START, content: "content-1", start: { scenario: "scenario.graduate", seed: "seed", worldSeed: "world" }, state });
  expect(created.ok).toBe(true);
  await h.deps.stores.account.setCharacter(account, character);
  await h.deps.stores.ledger.setMark(character, {} as never, 1);
  await h.deps.stores.ledger.addDay(1, { wage: { NGN: 500 } } as never, {});
  await h.deps.stores.audit.retire({ character, why: "rollback", at: START, note: "retired", segments: [], log: [], snapshots: [] });
  await h.deps.stores.audit.retire({ character, why: "upgrade", at: START, note: "retired again", segments: [], log: [], snapshots: [] });
  await h.deps.stores.audit.retire({ character: "char-someone-else", why: "rollback", at: START, note: "not theirs", segments: [], log: [], snapshots: [] });
  await h.deps.stores.moderationLog.append({ id: "log.ada", admin: "account.admin", at: START, item: "report.ada", action: "warn", params: { account }, reason: "scam" });
  await h.deps.stores.switches.set("signups", false, "account.admin", "a flood", START);
  await h.deps.stores.world.putDraw({ draw: 1, secret: "s", fingerprint: "f", beaconRound: 1, odds: h.deps.contents.current.tuning.lottery.odds, jackpot: 1 });
  await h.deps.stores.world.addTickets(1, character, 2);
  await h.deps.stores.dedication.light({ account, id: "light.ada", name: "Mama Nkechi", from: null, to: null, litAt: START });
  h.tables.passkey.push({ id: "passkey-1", userId: account, publicKey: "key", credentialID: "credential-1", counter: 0, deviceType: "singleDevice", backedUp: false, createdAt: new Date() });
  const reply = await h.call("/api/account", { method: "DELETE", jar, ip: "192.0.2.70" });
  expect(reply.status).toBe(200);
  return { account, character };
}

describe("the deletion job", () => {
  test("[account:deleted-data-removed-within-month] given a deletion, when the job runs a millisecond before it is due, then nothing is removed; at its due time everything the account named is gone, its dedication light with it (account:name-a-light-for-yours)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    const h = harness();
    const { account, character } = await deletedPlayer(h);
    const dueAt = START + h.deps.config.account.deleteWithinDays * time.DAY_MS;

    vi.setSystemTime(dueAt - 1);
    expect(await runDeletions(h.deps, h.auth)).toBe(0);
    expect(await h.deps.stores.account.get(account)).not.toBeNull();
    expect(await h.deps.stores.player.load(character)).not.toBeNull();

    vi.setSystemTime(dueAt);
    expect(await runDeletions(h.deps, h.auth)).toBe(1);
    expect(await h.deps.stores.account.get(account)).toBeNull();
    expect(await h.deps.stores.player.load(character)).toBeNull();
    expect(await h.deps.stores.ledger.mark(character)).toBeNull();
    // The audit table's rows for the account's character go with the rest; another character's stay.
    expect(await h.deps.stores.audit.list(character)).toEqual([]);
    expect(await h.deps.stores.audit.list("char-someone-else")).toHaveLength(1);
    expect(await h.deps.stores.dedication.mine(account)).toBeNull();
    expect(h.tables.user).toHaveLength(0);
    expect(h.tables.session).toHaveLength(0);
    expect(h.tables.account).toHaveLength(0);
    expect(h.tables.passkey).toHaveLength(0);
    expect(h.tables.rateLimit).toHaveLength(0);
    expect(await runDeletions(h.deps, h.auth)).toBe(0);
  });

  test("[account:deletion-keeps-anonymous-totals] [account:deleted-data-removed-within-month] given a completed deletion, when the kept records are read, then the day totals, the tickets, the admin log and the switch log survive, the audit entries do not, and only the hash and dates name the account", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    const h = harness();
    const { account, character } = await deletedPlayer(h);
    vi.setSystemTime(START + h.deps.config.account.deleteWithinDays * time.DAY_MS);
    await runDeletions(h.deps, h.auth);
    expect(await h.deps.stores.audit.list(character)).toEqual([]);
    expect(await h.deps.stores.moderationLog.get("log.ada")).toMatchObject({ id: "log.ada", params: { account } });
    expect(await h.deps.stores.switches.log()).toHaveLength(1);
    expect((await h.deps.stores.ledger.day(1)).created).toEqual({ wage: { NGN: 500 } });
    expect(await h.deps.stores.world.tickets(1)).toHaveLength(2);
    const row = await h.deps.stores.deletion.find(await accountHash(account));
    expect(row).toMatchObject({ account: null, accountHash: await accountHash(account), completedAt: START + h.deps.config.account.deleteWithinDays * time.DAY_MS });
    expect(await deletionStatus(h.deps, account)).toEqual({ requestedAt: START, dueAt: START + h.deps.config.account.deleteWithinDays * time.DAY_MS, completedAt: START + h.deps.config.account.deleteWithinDays * time.DAY_MS });
    expect(await deletionStatus(h.deps, "never-an-account")).toBeNull();
    expect((await h.call("/api/account", { jar: makeJar() })).status).toBe(401);
  });
});
