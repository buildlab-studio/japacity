import type { ServerReply } from "@japacity/api";
import type { Id, Loose, World } from "@japacity/sim";
import { hashState, newState, step } from "@japacity/sim";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { call, held, newLife, testServer } from "../authority/authority.testing";
import type { TestServer } from "../authority/authority.testing";
import { productionConfig, testConfig } from "../config";
import { countingPlayerStore, emptyCounts, loadRoutes, warmCommand } from "./load";
import type { LoadRows, LoadView, WriteCounts } from "./load";

/** The load Worker's deps as load.worker.ts builds them: the test sign-in, the fast clock, the counted store. */
function loadServer(config = testConfig({ testing: { testLogin: true, fastClock: true } })): { server: TestServer; counts: WriteCounts } {
  const server = testServer({ config });
  const counts = emptyCounts();
  server.deps.stores.player = countingPlayerStore(server.deps.stores.player, counts);
  server.app.route("/", loadRoutes(server.deps, counts));
  return { server, counts };
}

async function warmed(server: TestServer, account: string, months: number): Promise<{ character: string; played: number; v: number }> {
  await call(server, "POST", "/api/load/account", account);
  await call(server, "POST", "/api/character", account, { scenario: "scenario.banker" });
  const named = await call<{ character: string }>(server, "POST", "/api/load/account", account);
  const warm = await call<{ ok: boolean; played: number; v: number }>(server, "POST", `/api/load/warm/${named.body.character}`, null, { months, seed: 3 });
  return { character: named.body.character, played: warm.body.played, v: warm.body.v };
}

describe("the load test's routes", () => {
  test("[load:runs-against-local-stack] given the production config, when any load route is asked, then it answers 404 and writes nothing", async () => {
    const { server, counts } = loadServer(productionConfig);
    for (const [method, path] of [
      ["POST", "/api/load/account"],
      ["POST", "/api/load/warm/character-x"],
      ["GET", "/api/load/view/character-x"],
      ["GET", "/api/load/rows/character-x"],
      ["GET", "/api/load/world/0"],
      ["GET", "/api/load/stats"],
    ] as const) {
      expect((await call(server, method, path, "acc-1", method === "POST" ? {} : undefined)).status).toBe(404);
    }
    expect(await server.deps.stores.account.get("acc-1")).toBeNull();
    expect(counts).toEqual(emptyCounts());
  });

  test("[load:runs-against-local-stack] given the test sign-in on, when a load route is asked on a host that is not this machine, then it answers 404 and writes nothing, while on this machine it answers", async () => {
    const { server, counts } = loadServer();
    for (const site of ["https://japacity.app", "https://staging.japacity.app", "https://load.example.workers.dev"]) {
      for (const [method, path] of [
        ["POST", "/api/load/account"],
        ["POST", "/api/load/warm/character-x"],
        ["GET", "/api/load/view/character-x"],
        ["GET", "/api/load/rows/character-x"],
        ["GET", "/api/load/world/0"],
        ["GET", "/api/load/stats"],
      ] as const) {
        const reply = await server.app.request(`${site}${path}`, { method, headers: { "x-test-account": "acc-1", "content-type": "application/json" }, ...(method === "POST" ? { body: "{}" } : {}) });
        expect({ site, path, status: reply.status }).toEqual({ site, path, status: 404 });
      }
    }
    expect(await server.deps.stores.account.get("acc-1")).toBeNull();
    expect(counts).toEqual(emptyCounts());
    for (const site of ["http://localhost:8787", "http://127.0.0.1:8787", "http://[::1]:8787"]) {
      const reply = await server.app.request(`${site}/api/load/account`, { method: "POST", headers: { "x-test-account": "acc-1" } });
      expect({ site, status: reply.status }).toEqual({ site, status: 200 });
    }
  });

  test("[load:runs-against-local-stack] given the production Worker, when its sources are read, then neither it nor the app mounts the load routes or the load Worker", () => {
    for (const file of ["../index.ts", "../app.ts"]) {
      const text = readFileSync(fileURLToPath(new URL(file, import.meta.url).href), "utf8");
      expect(text).not.toContain("routes/load");
      expect(text).not.toContain("load.worker");
    }
  });

  test("[load:seeded-test-accounts] given an account made through the test sign-in, when its character is played forward 0, 1 and 30 months, then it plays exactly those months and the rows replay from the seed", async () => {
    const { server } = loadServer();
    for (const [account, months] of [
      ["acc-0", 0],
      ["acc-1", 1],
      ["acc-30", 30],
    ] as const) {
      const made = await warmed(server, account, months);
      expect(made.played).toBe(months);
      const stored = await held(server, made.character);
      expect(stored.character.v).toBe(made.v);
      const log = await server.deps.stores.player.log(made.character, 0);
      const turnEnds = log.filter((row) => row.command.type === "turn/end").length;
      expect(turnEnds).toBe(months);
      const start = stored.segments[0]?.start;
      if (start === undefined || "base" in start) throw new Error("The life starts from its scenario.");
      let state = newState(start.scenario, start.seed, content);
      for (const row of log) {
        const world = (await server.deps.stores.world.tick(row.tick))?.world as World;
        const result = step(state, { ...row.command, basedOn: state.v }, world, content, row.sender);
        if (!result.ok) throw new Error(result.detail);
        state = result.state;
        expect(hashState(state)).toBe(row.hash);
      }
      expect(stored.snapshot.v).toBe(made.v - (made.v % server.deps.config.server.snapshotEvery));
    }
  });

  test("[load:seeded-test-accounts] given a warming step, when an answer waits, then it is sent before any month, and with nothing legal there is no step", () => {
    const answer: Loose = { type: "setpiece/answer", question: "setpiece.q" as Id<"setpiece">, answer: "yes" } as unknown as Loose;
    const month: Loose = { type: "turn/end", slots: [] };
    expect(warmCommand([month, answer], 0)).toEqual(answer);
    expect(warmCommand([month], 5)).toEqual(month);
    expect(warmCommand([], 0)).toBeNull();
  });

  test("[load:constant-rate-command-mix] given a warmed character, when its legal commands are read, then nothing is written, and each one read afresh and sent at the stored version is accepted", async () => {
    const { server, counts } = loadServer();
    const made = await warmed(server, "acc-1", 12);
    for (let at = 0; at < 8; at += 1) {
      const before = { ...counts };
      const read = await call<LoadView>(server, "GET", `/api/load/view/${made.character}`, null);
      expect(read.body.ok).toBe(true);
      expect(counts).toEqual(before);
      expect((await held(server, made.character)).character.v).toBe(read.body.basedOn);
      const command = read.body.legal[(at * 7) % read.body.legal.length] as Loose;
      const sent = await call<ServerReply>(server, "POST", "/api/command", "acc-1", { command: { ...command, basedOn: read.body.basedOn }, basedOn: read.body.basedOn });
      expect(sent.body.ok, `${command.type}: ${sent.text}`).toBe(true);
    }
  });

  test("[load:some-commands-sent-stale] given a command based on the version before, when it is sent, then it is rejected stale and nothing is written", async () => {
    const { server, counts } = loadServer();
    const made = await warmed(server, "acc-1", 3);
    const read = await call<LoadView>(server, "GET", `/api/load/view/${made.character}`, null);
    const before = { ...counts };
    const command = read.body.legal[0] as Loose;
    const sent = await call<ServerReply>(server, "POST", "/api/command", "acc-1", { command: { ...command, basedOn: read.body.basedOn - 1 }, basedOn: read.body.basedOn - 1 });
    expect(sent.body.ok).toBe(false);
    expect(sent.body.ok === false && sent.body.code).toBe("stale");
    expect(counts).toEqual(before);
  });

  test("[load:correctness-checked-after-run] [load:run-summary-recorded] given the counted store, when characters are made and played, then the counts match the stored log rows and the snapshots at every multiple of snapshotEvery", async () => {
    const { server, counts } = loadServer();
    const one = await warmed(server, "acc-1", 25);
    const two = await warmed(server, "acc-2", 7);
    const every = server.deps.config.server.snapshotEvery;
    const logs = [...(await server.deps.stores.player.log(one.character, 0)), ...(await server.deps.stores.player.log(two.character, 0))];
    expect(counts.characters).toBe(2);
    expect(counts.rows).toBe(logs.length);
    expect(counts.snapshots).toBe(2 + logs.filter((row) => row.v % every === 0).length);
    expect(counts.rowBytes).toBe(logs.reduce((sum, row) => sum + JSON.stringify(row).length, 0));
    expect(counts.snapshotBytes).toBeGreaterThan(0);
  });

  test("[load:correctness-checked-after-run] given a refused write, when the counted store is asked, then nothing is counted", async () => {
    const { server, counts } = loadServer();
    const made = await warmed(server, "acc-1", 2);
    const before = { ...counts };
    const refused = await server.deps.stores.player.transact([made.character], () => ({ writes: { characters: [{ id: made.character, append: [], snapshots: [{ character: made.character, v: 0, segment: 0, content: content.version, state: newState("scenario.banker", "x", content) }] }] }, result: null }));
    expect(refused.ok).toBe(false);
    expect(counts).toEqual(before);
  });

  test("[load:correctness-checked-after-run] given a played character, when its rows are handed over, then they hold its seed's start, every log row from version 1 and the latest snapshot's hash", async () => {
    const { server } = loadServer();
    const made = await warmed(server, "acc-1", 22);
    const rows = await call<LoadRows>(server, "GET", `/api/load/rows/${made.character}`, null);
    expect(rows.body.character.v).toBe(made.v);
    expect((rows.body.log as { v: number }[]).map((row) => row.v)).toEqual(Array.from({ length: made.v }, (_, at) => at + 1));
    const stored = await held(server, made.character);
    expect(rows.body.snapshot).toEqual({ v: stored.snapshot.v, segment: stored.snapshot.segment, hash: hashState(stored.snapshot.state) });
    const world = await call<{ ok: boolean; tick: number }>(server, "GET", "/api/load/world/0", null);
    expect(world.body).toMatchObject({ ok: true, tick: 0 });
    expect((await call(server, "GET", "/api/load/world/99", null)).status).toBe(404);
  });

  test("[load:seeded-test-accounts] given a character the route does not know, when it is warmed or read, then it answers 404", async () => {
    const { server } = loadServer();
    await newLife(server, "acc-1");
    expect((await call(server, "POST", "/api/load/warm/character-none", null, { months: 1 })).status).toBe(404);
    expect((await call(server, "GET", "/api/load/view/character-none", null)).status).toBe(404);
    expect((await call(server, "GET", "/api/load/rows/character-none", null)).status).toBe(404);
  });
});
