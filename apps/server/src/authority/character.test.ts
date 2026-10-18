import { content } from "@japacity/content";
import type { Overlay } from "@japacity/sim";
import { applyOverlay, newState, nextGameMorning, worldClockAt, viewFor } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { productionConfig } from "../config";
import type { ViewReply } from "../types";
import { contentsFor } from "./overlay";
import { call, held, signUp, testServer } from "./authority.testing";

const { epoch } = productionConfig.clock;

describe("a new character", () => {
  test("[R-SERVER-016] [R-ACCOUNT-015] given a signed-in account with no character, when it makes one, then the seed is 128 bits of the secure bytes as hex, the character is stored at version 0 under the current content, and the reply is the first view with the clock", async () => {
    const asked: number[] = [];
    let next = 0;
    const server = testServer({
      randomBytes: (count) => {
        asked.push(count);
        return Uint8Array.from({ length: count }, () => (next += 17) & 255);
      },
    });
    server.setNow(epoch + 5);
    await signUp(server, "acc-1");
    const reply = await call<ViewReply>(server, "POST", "/api/character", "acc-1", { scenario: "scenario.tunde" });
    expect(reply.status).toBe(200);
    expect(asked[0] === undefined ? 0 : asked[0] * 8).toBe(productionConfig.server.seedBits);
    const id = (await server.deps.stores.account.get("acc-1"))?.character;
    if (id === undefined || id === null) throw new Error("No character.");
    const stored = await held(server, id);
    const start = stored.segments[0]?.start;
    if (start === undefined || "base" in start) throw new Error("The first segment starts from a scenario.");
    expect(start.seed).toMatch(/^[0-9a-f]{32}$/);
    expect(start).toEqual({ scenario: "scenario.tunde", seed: start.seed, worldSeed: "test-world-seed" });
    expect(stored.character).toMatchObject({ id, account: "acc-1", v: 0, segment: 0, refilledAt: epoch + 5 });
    expect(stored.snapshot.state).toEqual(newState("scenario.tunde", start.seed, content));
    expect(stored.segments[0]?.content).toBe(content.version);
    const world = (await server.deps.stores.world.tick(0))?.world;
    if (world === undefined) throw new Error("No tick 0.");
    expect(reply.body).toEqual({ ok: true, view: viewFor({ state: stored.snapshot.state, world, content }), lines: [], clock: { tick: 0, nextTickAt: epoch + productionConfig.clock.worldTickMs, nextTurnAt: null, morningAt: nextGameMorning(epoch), world: worldClockAt(epoch) } });
    expect(reply.text).not.toContain(start.seed);
  });

  test("[R-ACCOUNT-015] given an account that has a character, when it asks for another, then it is refused one-character and nothing is made", async () => {
    const server = testServer();
    await signUp(server, "acc-1");
    await call(server, "POST", "/api/character", "acc-1", { scenario: "scenario.ada" });
    const first = (await server.deps.stores.account.get("acc-1"))?.character;
    const again = await call(server, "POST", "/api/character", "acc-1", { scenario: "scenario.ada" });
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ ok: false, code: "one-character" });
    expect((await server.deps.stores.account.get("acc-1"))?.character).toBe(first);
  });

  test("[R-SERVER-016] given a scenario the content lacks, no scenario, or no session, when a character is asked for, then it is refused unknown-id or signed-out", async () => {
    const server = testServer();
    await signUp(server, "acc-1");
    expect((await call(server, "POST", "/api/character", "acc-1", { scenario: "scenario.nobody" })).body).toMatchObject({ code: "unknown-id" });
    expect((await call(server, "POST", "/api/character", "acc-1", {})).status).toBe(400);
    expect((await call(server, "POST", "/api/character", null, { scenario: "scenario.ada" })).status).toBe(401);
    expect((await server.deps.stores.account.get("acc-1"))?.character).toBeNull();
  });
});

describe("the deployment's content", () => {
  const dials = { version: "dials-1", tuning: { director: { surgePerTick: 4 } } } as Overlay;

  test("[R-SERVER-018] [R-ENGINE-017] given no overlay, when the server starts, then it runs on the public content alone", () => {
    expect(contentsFor(content, undefined)).toEqual({ current: content, previous: null });
    expect(contentsFor(content, "")).toEqual({ current: content, previous: null });
  });

  test("[R-SERVER-016] [R-SERVER-024] given an overlay the check accepts, when the server starts, then it is applied once and the public content is the one before", () => {
    const contents = contentsFor(content, JSON.stringify(dials));
    expect(contents.current).toEqual(applyOverlay(content, dials));
    expect(contents.current.overlay).toBe("dials-1");
    expect(contents.previous).toBe(content);
  });

  test("[R-SERVER-018] [R-SERVER-014] given an overlay with a factor field the content lacks, when the server starts, then checkOverlay refuses it and the server does not start", () => {
    const factor = JSON.stringify({ version: "bad-1", tuning: { turn: { factor: 2 } } });
    expect(() => contentsFor(content, factor)).toThrow(/The overlay is refused/);
  });
});
