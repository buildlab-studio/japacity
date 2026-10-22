import type { ServerReply } from "@japacity/api";
import { content } from "@japacity/content";
import type { Command } from "@japacity/sim";
import { hashState, viewFor } from "@japacity/sim";
import type { Nudge } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { productionConfig, testConfig } from "../config";
import { readRequest, sendAuthority } from "./command";
import { DIVERGED_NOTE } from "./commit";
import { accepted, call, held, newLife, restMonth, send, testServer, view } from "./authority.testing";
import { transact } from "./transaction";

const { epoch, worldTickMs } = productionConfig.clock;

/** A command whose JSON is exactly `bytes` long, padded in a field the simulation ignores. */
/** A command of exactly `bytes` of JSON, padded in a key of its own, since a key its type lacks never reaches the log (server:commands-only-through-route). */
function commandOf(bytes: number): Command {
  const padded = (param: string): Command => ({ type: "activity/now", activity: "activity.ask-around", param, basedOn: 0 });
  return padded("x".repeat(bytes - JSON.stringify(padded("")).length));
}

describe("every command through the server", () => {
  test("[server:commands-only-through-route] [engine:simulation-reads-no-clock] given a body that also carries a tick, a state and a sender, when the command is sent at tick 2, then only the command and basedOn are read, and it is stamped with tick 2 and the sender player", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1");
    server.setNow(epoch + 2 * worldTickMs + 1);
    const body = { command: restMonth({ v: 0 }), basedOn: 0, tick: 99, sender: "authority", state: { v: 40 }, world: { tick: 99 } };
    const reply = await call<ServerReply>(server, "POST", "/api/command", "acc-1", body);
    expect(accepted(reply.body).view.v).toBe(1);
    expect((await held(server, character)).tail).toMatchObject([{ v: 1, tick: 2, sender: "player", command: { type: "turn/end", basedOn: 0 } }]);
  });

  test("[server:commands-only-through-route] [engine:browser-authority-for-dev-only] given a player, when it sends an authority command, then the simulation refuses it as not-yours and nothing is written", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1");
    const reply = await send(server, "acc-1", { type: "turns/grant", count: 5, basedOn: 0 });
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ ok: false, code: "not-yours" });
    expect((await held(server, character)).character.v).toBe(0);
  });

  test("[server:one-command-one-transaction] [engine:stale-commands-rejected] given a character at version 1, when commands based on 0, 2 and 1 are sent, then the first two are stale and write nothing, and the third raises the version to 2", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1");
    accepted((await send(server, "acc-1", restMonth({ v: 0 }))).body);
    const before = await held(server, character);
    for (const basedOn of [0, 2]) {
      const reply = await send(server, "acc-1", restMonth({ v: basedOn }));
      expect(reply.body).toMatchObject({ ok: false, code: "stale", clock: { tick: 0 } });
      expect(await held(server, character)).toEqual(before);
    }
    expect(accepted((await send(server, "acc-1", restMonth({ v: 1 }))).body).view.v).toBe(2);
    expect((await held(server, character)).character.v).toBe(2);
  });

  test("[server:one-command-one-transaction] [clock:earned-turns-granted-first] given earned turns, when the player's command is sent at the stored version, then the grant is stepped first and the command is stamped with the version after it", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1");
    accepted((await send(server, "acc-1", restMonth({ v: 0 }))).body);
    accepted((await send(server, "acc-1", restMonth({ v: 1 }))).body);
    server.wait(productionConfig.clock.turnRefillMs);
    const reply = accepted((await send(server, "acc-1", restMonth({ v: 2 }))).body);
    expect(reply.view.v).toBe(4);
    expect((await held(server, character)).tail.slice(-2)).toMatchObject([
      { v: 3, sender: "authority", command: { type: "turns/grant", count: 1, basedOn: 2 } },
      { v: 4, sender: "player", command: { type: "turn/end", basedOn: 3 } },
    ]);
  });

  test("[server:log-rows-hash-state] given accepted commands, when the log is read, then each row holds the command, its tick, its sender, the version after it and the hash of the state after it", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1");
    for (let v = 0; v < 3; v += 1) accepted((await send(server, "acc-1", restMonth({ v }))).body);
    const stored = await held(server, character);
    expect(stored.tail.map((row) => [row.v, row.tick, row.sender, row.command.type, row.at])).toEqual([1, 2, 3].map((v) => [v, 0, "player", "turn/end", epoch]));
    const outcome = await transact(server.deps, [character], (lives) => ({ ok: true, value: lives[0]?.state }));
    if (outcome.kind !== "done" || outcome.value === undefined) throw new Error("No load.");
    expect(outcome.value.v).toBe(3);
    expect(stored.tail.at(-1)?.hash).toBe(hashState(outcome.value));
  });

  test("[server:log-rows-hash-state] [server:rollback-check-finds-divergence] given one account whose log no longer replays to its hash, when it and another account play, then it alone is refused diverged and queued once for the rollback tool", async () => {
    const server = testServer();
    const broken = await newLife(server, "acc-1");
    await newLife(server, "acc-2");
    accepted((await send(server, "acc-1", restMonth({ v: 0 }))).body);
    const [row] = (await held(server, broken)).tail;
    if (row === undefined) throw new Error("No row.");
    const forged = { ...row, v: 2, command: restMonth({ v: 1 }), hash: "0000000000000000" };
    const wrote = await server.deps.stores.player.transact([broken], () => ({ writes: { characters: [{ id: broken, append: [forged] }] }, result: null }));
    expect(wrote.ok).toBe(true);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const reply = await send(server, "acc-1", restMonth({ v: 2 }));
      expect(reply.status).toBe(409);
      expect(reply.body).toMatchObject({ ok: false, code: "diverged" });
      expect((await view(server, "acc-1")).body).toMatchObject({ ok: false, code: "diverged" });
    }
    const queued = await server.deps.stores.audit.list(broken);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.note.startsWith(DIVERGED_NOTE)).toBe(true);
    expect((await held(server, broken)).character.v).toBe(2);
    expect(accepted((await send(server, "acc-2", restMonth({ v: 0 }))).body).view.v).toBe(1);
  });

  test("[server:snapshots-bound-replay] given snapshots every 3 versions, when 8 commands are played, then a snapshot is stored at 3 and 6 and every load replays fewer than 3 rows", async () => {
    const server = testServer({ config: testConfig({ testing: { testLogin: true }, server: { snapshotEvery: 3 } }) });
    const character = await newLife(server, "acc-1");
    for (let v = 0; v < 8; v += 1) {
      accepted((await send(server, "acc-1", restMonth({ v }))).body);
      const stored = await held(server, character);
      expect(stored.snapshot.v).toBe(v + 1 - ((v + 1) % 3));
      expect(stored.tail.length).toBeLessThan(3);
    }
    const stored = await held(server, character);
    expect(stored.snapshot.v).toBe(6);
    expect(stored.tail.map((row) => row.v)).toEqual([7, 8]);
    expect(hashState(stored.snapshot.state)).toBe((await server.deps.stores.player.log(character, 5))[0]?.hash);
  });

  test("[server:snapshots-bound-replay] given the production snapshot interval, when exactly that many commands are played, then the snapshot is at that version and the tail is empty", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1");
    const every = productionConfig.server.snapshotEvery;
    for (let v = 0; v < every; v += 1) accepted((await send(server, "acc-1", restMonth({ v }))).body);
    const stored = await held(server, character);
    expect(stored.snapshot.v).toBe(every);
    expect(stored.tail).toEqual([]);
  });

  test("[server:rejections-write-nothing] given a command the simulation rejects, when it is sent, then the rejection comes back with the clock and nothing is written", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1");
    const before = await held(server, character);
    const bad: Command = { type: "turn/end", slots: [{ activity: "activity.nothing-like-this", param: null }], basedOn: 0 };
    const reply = await send(server, "acc-1", bad);
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ ok: false, clock: { tick: 0, nextTickAt: epoch + worldTickMs, nextTurnAt: null } });
    expect(await held(server, character)).toEqual(before);
  });

  test("[server:authority-commands-same-path] [clock:socket-only-nudges] given an authority command, when it is sent for a character, then it is logged with the sender authority and the player is nudged with the new version after the commit", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1");
    accepted((await send(server, "acc-1", restMonth({ v: 0 }))).body);
    const nudges: Nudge[] = [];
    server.deps.stores.nudges.subscribe("acc-1", (nudge) => nudges.push(nudge));
    const outcome = await sendAuthority(server.deps, character, { type: "turns/grant", count: 1, basedOn: 0 });
    expect(outcome.kind).toBe("done");
    expect((await held(server, character)).tail.at(-1)).toMatchObject({ v: 2, sender: "authority", command: { type: "turns/grant", basedOn: 1 } });
    expect(nudges).toEqual([{ nudge: "view", v: 2 }]);
    accepted((await send(server, "acc-1", restMonth({ v: 2 }))).body);
    expect(nudges).toHaveLength(1);
  });

  test("[server:paired-rows-locked-in-order] given two characters asked for in descending order, when one transaction holds them, then they are loaded in ascending id order", async () => {
    const server = testServer();
    const one = await newLife(server, "acc-1");
    const two = await newLife(server, "acc-2");
    const ids = [one, two].sort().reverse();
    const outcome = await transact(server.deps, ids, (lives) => ({ ok: true, value: lives.map((live) => live.id) }));
    expect(outcome.kind === "done" ? outcome.value : null).toEqual([...ids].reverse());
  });

  test("[server:client-never-predicts] [clock:command-uses-stamped-tick] given a command, when the reply comes, then its view is the stored state after the step against the current tick's stored world", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1");
    server.setNow(epoch + worldTickMs);
    const reply = accepted((await send(server, "acc-1", restMonth({ v: 0 }))).body);
    const stored = await held(server, character);
    const world = (await server.deps.stores.world.tick(1))?.world;
    if (world === undefined) throw new Error("No tick 1.");
    const outcome = await transact(server.deps, [character], (lives) => ({ ok: true, value: lives[0]?.state }));
    if (outcome.kind !== "done" || outcome.value === undefined) throw new Error("No load.");
    expect(outcome.value.v).toBe(stored.character.v);
    expect(reply.view).toEqual(viewFor({ state: outcome.value, world, content }));
  });

  test("[clock:command-uses-stamped-tick] [engine:same-inputs-same-result] given commands at ticks 0 to 2 and a world seed that changes after they were stored, when the character is loaded later, then the replay reads the stored rows and does not diverge", async () => {
    const server = testServer();
    await newLife(server, "acc-1");
    let v = 0;
    for (let tick = 0; tick < 3; tick += 1) {
      server.setNow(epoch + tick * worldTickMs);
      v = accepted((await send(server, "acc-1", restMonth({ v }))).body).view.v;
    }
    server.deps.secrets.worldSeed = "another-seed";
    server.setNow(epoch + 5 * worldTickMs);
    const reply = await view(server, "acc-1");
    expect(reply.body).toMatchObject({ ok: true, clock: { tick: 5 } });
  });

  test("[engine:same-inputs-same-result] given two servers, when the same character plays the same commands at the same times, then the stored hashes are the same", async () => {
    const hashes: string[][] = [];
    for (let run = 0; run < 2; run += 1) {
      const server = testServer();
      const character = await newLife(server, "acc-1");
      let v = 0;
      for (let tick = 0; tick < 4; tick += 1) {
        server.setNow(epoch + tick * worldTickMs);
        v = accepted((await send(server, "acc-1", restMonth({ v }))).body).view.v;
      }
      hashes.push((await server.deps.stores.player.log(character, 0)).map((row) => row.hash));
    }
    expect(hashes[0]).toHaveLength(7);
    expect(hashes[1]).toEqual(hashes[0]);
  });

  test("[server:commands-only-through-route] given no session, a body that is not a command, or an account with no character, when a command is sent, then it is refused signed-out, not-legal or no-character", async () => {
    const server = testServer();
    expect((await call(server, "POST", "/api/command", null, { command: restMonth({ v: 0 }), basedOn: 0 })).status).toBe(401);
    await newLife(server, "acc-1");
    const notCommand = await call(server, "POST", "/api/command", "acc-1", { command: "turn/end", basedOn: 0 });
    expect([notCommand.status, notCommand.body]).toEqual([400, expect.objectContaining({ code: "not-legal" })]);
    const noCharacter = await call(server, "POST", "/api/command", "acc-9", { command: restMonth({ v: 0 }), basedOn: 0 });
    expect([noCharacter.status, noCharacter.body]).toEqual([404, expect.objectContaining({ code: "no-character" })]);
    expect((await view(server, "acc-9")).status).toBe(404);
  });
});

describe("the command's size", () => {
  test("[server:command-size-limit] given commands of exactly the production limit and one byte over, when each request is read, then the first is read and the second is refused before anything reads it", () => {
    const { commandBytes } = productionConfig.limits;
    const at = commandOf(commandBytes);
    expect(JSON.stringify(at).length).toBe(commandBytes);
    expect(readRequest({ command: at, basedOn: 0 }, commandBytes)).toEqual({ command: at, basedOn: 0 });
    expect(readRequest({ command: commandOf(commandBytes + 1), basedOn: 0 }, commandBytes)).toBeNull();
  });

  test("[server:command-size-limit] given a command one byte over the limit, when it is sent, then it is refused not-legal and nothing is logged", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1");
    const before = await held(server, character);
    const reply = await call<ServerReply>(server, "POST", "/api/command", "acc-1", { command: commandOf(productionConfig.limits.commandBytes + 1), basedOn: 0 });
    expect(reply.status).toBe(400);
    expect(reply.body).toMatchObject({ ok: false, code: "not-legal" });
    expect(await held(server, character)).toEqual(before);
  });
});
