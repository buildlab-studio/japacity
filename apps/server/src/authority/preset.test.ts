// The prologue's preset played by the server in one request (server.md R-SERVER-046, decision 0008; R-SERVER-002,
// R-SERVER-025): Begin sends the tile, the age step and the home, and the server steps `prologue/choose` with content's
// answer at each card in one transaction, a log row a step, until the prologue closes.
import type { PresetReply, ServerReply, ViewReply } from "@japacity/api";
import { presetAnswer } from "@japacity/content";
import { hashState } from "@japacity/sim";
import type { Nudge } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { productionConfig, testConfig } from "../config";
import { memoryLimiters } from "../limits/memory";
import { playPreset } from "./command";
import { call, held, newLife, restMonth, send, signUp, testServer, type TestServer } from "./authority.testing";
import { transact } from "./transaction";

const { epoch } = productionConfig.clock;
const PROLOGUE = "scenario.prologue";
const DEVELOPER = { archetype: "developer", age: 0, home: "family-house" };

function played(reply: PresetReply): Extract<PresetReply, { ok: true }> {
  if (!reply.ok) throw new Error(`Refused with ${reply.code}: ${reply.detail}`);
  return reply;
}

function preset(server: TestServer, account: string | null, body: unknown) {
  return call<PresetReply>(server, "POST", "/api/prologue/preset", account, body);
}

describe("the preset played by the server", () => {
  test("[R-SERVER-046] [R-SERVER-002] [R-PROLOGUE-010] given a new life from sixteen, when its preset is sent once, then every step is played in one request: the prologue closed, one log row a step as the player's, the version raised by the count, the trail a step each", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1", PROLOGUE);
    const nudges: Nudge[] = [];
    server.deps.stores.nudges.subscribe("acc-1", (nudge) => nudges.push(nudge));
    const reply = await preset(server, "acc-1", { ...DEVELOPER, basedOn: 0 });
    expect(reply.status).toBe(200);
    const body = played(reply.body);
    expect(body.view.prologue).toBeNull();
    expect(body.refusal).toBeUndefined();
    expect(body.stepped).toBeGreaterThanOrEqual(10);
    expect(body.stepped).toBeLessThanOrEqual(productionConfig.limits.presetSteps);
    expect(body.trail).toHaveLength(body.stepped);
    expect(body.view.v).toBe(body.stepped);
    expect(body.clock).toMatchObject({ tick: 0 });
    // The trail: the opening draw first, its family drawn, each step's answer the one content gives, the home last.
    expect(body.trail[0]).toMatchObject({ step: "draw", answer: "begin" });
    expect(body.trail[0]?.draw).not.toBeNull();
    expect(body.trail.at(-1)).toMatchObject({ step: "home", answer: "family-house" });
    expect(body.lines.some((line) => line.key === "line.prologue.closed")).toBe(true);
    const rows = await server.deps.stores.player.log(character, 0);
    expect(rows.map((row) => row.v)).toEqual(body.trail.map((_, at) => at + 1));
    expect(rows.every((row) => row.sender === "player" && row.command.type === "prologue/choose")).toBe(true);
    expect(rows.map((row) => row.command)).toEqual(body.trail.map((step, at) => ({ type: "prologue/choose", step: step.step, answer: step.answer, basedOn: at })));
    expect((await held(server, character)).character.v).toBe(body.stepped);
    // What follows the commit ran once: the player's own steps nudged no one, never once a step.
    expect(nudges).toEqual([]);
  });

  test("[R-SERVER-046] [R-SERVER-003] given a preset played, when the life is loaded again, then the stored log replays to every row's hash, and the next command goes on from the version after it", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1", PROLOGUE);
    const body = played((await preset(server, "acc-1", { archetype: "water", age: 0, home: "makoko", basedOn: 0 })).body);
    const outcome = await transact(server.deps, [character], (lives) => ({ ok: true, value: lives[0]?.state }));
    if (outcome.kind !== "done" || outcome.value === undefined) throw new Error("No load.");
    expect(outcome.value.v).toBe(body.stepped);
    expect((await server.deps.stores.player.log(character, 0)).at(-1)?.hash).toBe(hashState(outcome.value));
    const view = await call<ViewReply>(server, "GET", "/api/view", "acc-1");
    expect(view.body).toMatchObject({ ok: true, view: { v: body.stepped, prologue: null } });
    expect((await send(server, "acc-1", restMonth({ v: body.stepped }))).body).toMatchObject({ ok: true });
  });

  test("[R-SERVER-046] [R-PROLOGUE-013] given the door's age step and home, when the preset is played, then the life starts at the tile's own year and the steps older, in the home picked", async () => {
    const plain = testServer();
    await newLife(plain, "acc-1", PROLOGUE);
    const own = played((await preset(plain, "acc-1", { archetype: "shop-worker", age: 0, home: "family-house", basedOn: 0 })).body);
    const older = testServer();
    await newLife(older, "acc-1", PROLOGUE);
    const stepped = played((await preset(older, "acc-1", { archetype: "shop-worker", age: 2, home: "hostel-room", basedOn: 0 })).body);
    const age = (view: typeof own.view) => view.qualities.find((quality) => quality.id === "quality.age-months")?.value ?? 0;
    expect(Math.floor(age(stepped.view) / 12) - Math.floor(age(own.view) / 12)).toBe(2);
    expect(stepped.trail.at(-1)).toMatchObject({ step: "home", answer: "hostel-room" });
    expect(stepped.view.home.place).toBe("place.hostel-room");
    expect(own.view.home.place).not.toBe("place.hostel-room");
  });

  test("[R-SERVER-046] given an answer refused after some steps, when the preset is played, then the steps before it stand and are committed, and the reply carries the refusal with the view after them", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1", PROLOGUE);
    let asked = 0;
    // The fourth card is answered with an answer it does not have, so the simulation refuses it.
    const answerAt: typeof presetAnswer = (...args) => {
      asked += 1;
      return asked === 4 ? "no-such-answer" : presetAnswer(...args);
    };
    const answer = await playPreset(server.deps, "acc-1", { ...DEVELOPER, basedOn: 0 }, answerAt);
    expect(answer.status).toBe(200);
    const body = played(answer.body);
    expect(body.stepped).toBe(3);
    expect(body.trail).toHaveLength(3);
    expect(body.refusal).toMatchObject({ ok: false, code: "not-legal" });
    expect(body.view.v).toBe(3);
    expect(body.view.prologue).not.toBeNull();
    expect((await server.deps.stores.player.log(character, 0)).map((row) => row.v)).toEqual([1, 2, 3]);
    // The page goes on from there with the next preset sent at the version after them.
    expect(played((await preset(server, "acc-1", { ...DEVELOPER, basedOn: 3 })).body).view.prologue).toBeNull();
  });

  test("[R-SERVER-046] [R-SERVER-002] given the first answer refused, when the preset is played, then nothing is written and the refusal comes back with the clock, as a command's", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1", PROLOGUE);
    const before = await held(server, character);
    const answer = await playPreset(server.deps, "acc-1", { ...DEVELOPER, basedOn: 0 }, () => "no-such-answer");
    expect(answer).toMatchObject({ status: 200, body: { ok: false, code: "not-legal", clock: { tick: 0 } } });
    expect(await held(server, character)).toEqual(before);
  });

  test("[R-SERVER-046] [R-ENGINE-003] given a preset based on a version that is not the stored one, when it is sent, then it is refused stale with the clock and nothing is written", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1", PROLOGUE);
    const before = await held(server, character);
    for (const basedOn of [1, -1]) {
      const reply = await preset(server, "acc-1", { ...DEVELOPER, basedOn });
      expect(reply.status).toBe(200);
      expect(reply.body).toMatchObject({ ok: false, code: "stale", clock: { tick: 0 } });
      expect(await held(server, character)).toEqual(before);
    }
  });

  test("[R-SERVER-046] given no session, or an account with no character, when the preset is sent, then it is refused signed-out or no-character", async () => {
    const server = testServer();
    expect(await preset(server, null, { ...DEVELOPER, basedOn: 0 })).toMatchObject({ status: 401, body: { code: "signed-out" } });
    await signUp(server, "acc-1");
    expect(await preset(server, "acc-1", { ...DEVELOPER, basedOn: 0 })).toMatchObject({ status: 404, body: { ok: false, code: "no-character" } });
  });

  test("[R-SERVER-046] given a character past its prologue, when the preset is sent, then it is refused not-legal and nothing is written", async () => {
    const server = testServer();
    const fixed = await newLife(server, "acc-1", "scenario.ada");
    const before = await held(server, fixed);
    expect(await preset(server, "acc-1", { ...DEVELOPER, basedOn: 0 })).toMatchObject({ status: 200, body: { ok: false, code: "not-legal" } });
    expect(await held(server, fixed)).toEqual(before);
    const done = testServer();
    const character = await newLife(done, "acc-1", PROLOGUE);
    const body = played((await preset(done, "acc-1", { ...DEVELOPER, basedOn: 0 })).body);
    const after = await held(done, character);
    expect(await preset(done, "acc-1", { ...DEVELOPER, basedOn: body.stepped })).toMatchObject({ status: 200, body: { ok: false, code: "not-legal" } });
    expect(await held(done, character)).toEqual(after);
  });

  test("[R-SERVER-046] given a tile no one has, an age step or a home the door does not offer, or a body that is not a preset, when it is sent, then it is refused not-legal before anything is read", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1", PROLOGUE);
    const before = await held(server, character);
    const refused = [
      { ...DEVELOPER, archetype: "pilot", basedOn: 0 },
      { ...DEVELOPER, age: -1, basedOn: 0 },
      { ...DEVELOPER, age: 4, basedOn: 0 },
      { ...DEVELOPER, age: 0.5, basedOn: 0 },
      { ...DEVELOPER, home: "makoko", basedOn: 0 },
      { ...DEVELOPER, home: "self-contain", basedOn: 0 },
      { ...DEVELOPER },
      { archetype: "developer", age: "0", home: "family-house", basedOn: 0 },
      null,
    ];
    for (const body of refused) {
      const reply = await preset(server, "acc-1", body);
      expect(reply).toMatchObject({ status: 400, body: { ok: false, code: "not-legal" } });
    }
    expect(await held(server, character)).toEqual(before);
  });

  test("[R-SERVER-046] [R-SERVER-025] given an account at two commands in ten seconds, when Begin makes the life and the whole preset is played, then the preset counted once: the next command is refused 429", async () => {
    const config = testConfig({ testing: { testLogin: true }, limits: { commandsPer10s: 2 } });
    const server = testServer({ config, now: () => epoch, limits: memoryLimiters(config.limits, () => epoch) });
    await newLife(server, "acc-1", PROLOGUE);
    const body = played((await preset(server, "acc-1", { ...DEVELOPER, basedOn: 0 })).body);
    expect(body.stepped).toBeGreaterThan(2);
    const over = await call<ServerReply>(server, "POST", "/api/command", "acc-1", { command: restMonth({ v: body.stepped }), basedOn: body.stepped });
    expect(over.status).toBe(429);
    expect(over.body).toMatchObject({ ok: false, code: "rate-limited" });
  });

  test("[R-SERVER-046] given limits.presetSteps, then it is twenty, and a preset stops there with the steps played standing", async () => {
    expect(productionConfig.limits.presetSteps).toBe(20);
    const config = testConfig({ testing: { testLogin: true }, limits: { presetSteps: 4 } });
    const server = testServer({ config });
    await newLife(server, "acc-1", PROLOGUE);
    const body = played((await preset(server, "acc-1", { ...DEVELOPER, basedOn: 0 })).body);
    expect(body.stepped).toBe(4);
    expect(body.view.v).toBe(4);
    expect(body.view.prologue).not.toBeNull();
    expect(body.refusal).toBeUndefined();
  });
});
