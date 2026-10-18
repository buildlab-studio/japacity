import type { WorldReply } from "@japacity/api";
import { content } from "@japacity/content";
import type { Command, FlatSave, Overlay, State, World } from "@japacity/sim";
import { applyOverlay, checkOverlay, hiddenPaths, newState, step, viewFor } from "@japacity/sim";
import { lifeSaves } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { call, held, newLife, send, testServer, view } from "../authority/authority.testing";
import { testConfig } from "../config";

const WORLD_SEED = "world-seed-sentinel-8c1f";
const SENTINEL = 97531;
const sentinelOverlay = { version: "overlay-sentinel-dials", tuning: { director: { surgePerTick: SENTINEL } } } as Overlay;
const overlaid = applyOverlay(content, sentinelOverlay);

/** The local authority's step with its fast clock (apps/client/src/authority/local.ts): the command, then an empty bank refilled at once. */
function localSend(state: State, command: Command, world: World): { state: State; ok: boolean; code: string | null } {
  const result = step(state, { ...command, basedOn: state.v }, world, overlaid, "player");
  if (!result.ok) return { state, ok: false, code: result.code };
  return { state: localEarn(result.state, world), ok: true, code: null };
}

function localEarn(state: State, world: World): State {
  const cap = overlaid.tuning.turn.cap;
  if (state.turn.ended || state.turn.banked >= 1) return state;
  const granted = step(state, { type: "turns/grant", count: cap - state.turn.banked, basedOn: state.v }, world, overlaid, "authority");
  if (!granted.ok) throw new Error(granted.detail);
  return granted.state;
}

/** True when `text` holds `value` as a whole number, not as part of a longer one. */
function holdsNumber(text: string, value: number): boolean {
  return new RegExp(`(?<![0-9])${String(value)}(?![0-9])`).test(text);
}

describe("a recorded life through the route", () => {
  test("[R-SERVER-014] given the sentinel overlay, when it is checked, then it may be applied", () => {
    expect(checkOverlay(content, sentinelOverlay)).toEqual([]);
  });

  test.each(Object.entries(lifeSaves))(
    "[R-SERVER-015] [R-SERVER-019] [R-CLOCK-006] given the recorded life %s played command by command through the route at tick 0, when its view is fetched, then it equals the local authority's for the same commands, and no reply ever carries a seed, the world seed or an overlay value",
    async (_name, save: FlatSave) => {
      const server = testServer({
        config: testConfig({ testing: { testLogin: true, fastClock: true } }),
        contents: { current: overlaid, previous: content },
        secrets: { worldSeed: WORLD_SEED, banSalt: "test-ban-salt", drawTokenKey: "test-draw-token-key" },
      });
      const id = await newLife(server, "acc-1", save.scenario);
      const start = (await held(server, id)).segments[0]?.start;
      if (start === undefined || "base" in start) throw new Error("The life starts from its scenario.");
      const world = (await server.deps.stores.world.tick(0))?.world;
      if (world === undefined) throw new Error("No tick 0.");

      const secrets = (text: string) => {
        expect(text).not.toContain(start.seed);
        expect(text).not.toContain(WORLD_SEED);
        expect(text).not.toContain(sentinelOverlay.version);
        expect(holdsNumber(text, SENTINEL)).toBe(false);
      };

      let local = newState(save.scenario, start.seed, overlaid);
      let v = 0;
      let accepted = 0;
      for (const [at, entry] of save.commands.entries()) {
        if (entry.sender !== "player") continue;
        const expected = localSend(local, entry.command, world);
        local = expected.state;
        const reply = await send(server, "acc-1", entry.command, v);
        expect(reply.body.ok ? null : reply.body.code).toBe(expected.code);
        if (reply.body.ok) {
          v = reply.body.view.v;
          accepted += 1;
        }
        if (at % 25 === 0) {
          secrets(reply.text);
          secrets((await call<WorldReply>(server, "GET", "/api/world", "acc-1")).text);
        }
      }
      expect(accepted).toBeGreaterThanOrEqual(10);

      const last = await view(server, "acc-1");
      secrets(last.text);
      if (!last.body.ok) throw new Error(last.body.detail);
      expect(hiddenPaths(last.body)).toEqual([]);
      expect(last.body.view).toEqual(viewFor({ state: local, world, content: overlaid }));
    },
    60_000,
  );
});
