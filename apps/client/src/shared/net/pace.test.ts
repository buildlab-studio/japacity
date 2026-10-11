// The client keeps under the server's command limit (docs/rules/server.md R-SERVER-025, prologue.md R-PROLOGUE-010,
// both amended 11 Oct 2026). Found on the local full stack that day: a new life online sent its prologue's presets as
// fast as the replies came, the eleventh in ten seconds was refused 429, and the band never came.
import { describe, expect, test } from "vitest";

import { remoteAuthority } from "../../authority/remote";
import { ARCHETYPES, doorAnswer, homesFor, withAge, withHome } from "../frontdoor/archetypes";
import { engineView, newGame } from "../testing/fixtures";
import { BASE, fakeServer } from "../testing/server";
import { busiestWindow, COMMANDS_PER_WINDOW, pacer, PRESET_STEP_MS, presetWait, waitBefore, WINDOW_MS } from "./pace";

/** The server's limit: ten commands from an account in any ten seconds (apps/server/src/config.ts `commandsPer10s`, wrangler's COMMANDS_10S). */
const SERVER_PER_10S = 10;
const SEEDS = 20;
/** Years past the youngest each tile can start (the door's age), across the range the door offers. */
const AGES = [0, 6, 12];

/** The commands one life's prologue sends with its archetype's preset: one `prologue/choose` a step until it closes. */
function presetLength(archetype: (typeof ARCHETYPES)[number], seed: string): number {
  const game = newGame("scenario.prologue", seed);
  let sent = 0;
  for (let guard = 0; guard < 60 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const answer = doorAnswer(archetype, prologue);
    if (answer === null) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
    sent += 1;
  }
  return sent;
}

/**
 * When the life and each of `count` presets leave online, with replies that take no time at all (the worst case): Begin
 * makes the life (`POST /api/character`), then the page sends a preset a step (`presetWait`), each through the remote
 * authority's pacer, as both run in the client.
 */
async function begunTimes(count: number): Promise<number[]> {
  let now = 0;
  const pace = pacer(
    () => now,
    (ms) => {
      now += ms;
      return Promise.resolve();
    },
  );
  await pace.take();
  const times = [now];
  let last: number | null = null;
  for (let step = 0; step < count; step += 1) {
    now += presetWait(last, now);
    await pace.take();
    times.push(now);
    last = now;
  }
  return times;
}

describe("the client keeps under the command limit", () => {
  test("[R-SERVER-025] given the pacer, when it is read, then it lets eight leave in any ten seconds, two fewer than the server takes, and the preset's step spreads the eight evenly", () => {
    expect(COMMANDS_PER_WINDOW).toBe(8);
    expect(WINDOW_MS).toBe(10_000);
    expect(COMMANDS_PER_WINDOW).toBeLessThan(SERVER_PER_10S);
    expect(PRESET_STEP_MS * COMMANDS_PER_WINDOW).toBe(WINDOW_MS);
    expect(waitBefore([0, 1, 2, 3, 4, 5, 6], 7)).toBe(0);
    expect(waitBefore([0, 1, 2, 3, 4, 5, 6, 7], 8)).toBe(WINDOW_MS - 8);
    expect(waitBefore([0, 1, 2, 3, 4, 5, 6, 7], WINDOW_MS - 1)).toBe(1);
    expect(waitBefore([0, 1, 2, 3, 4, 5, 6, 7], WINDOW_MS)).toBe(0);
  });

  test("[R-SERVER-025] given the pacer on its own clock, when twenty commands are taken back to back, then the first eight leave at once and no ten seconds ever hold more than eight", async () => {
    let time = 0;
    const left: number[] = [];
    const pace = pacer(
      () => time,
      (ms) => {
        time += ms;
        return Promise.resolve();
      },
    );
    for (let each = 0; each < 20; each += 1) {
      await pace.take();
      left.push(time);
    }
    expect(left.slice(0, 8)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(busiestWindow(left)).toBe(COMMANDS_PER_WINDOW);
  });

  test("[R-SERVER-025] given the remote authority, when a life is made and twenty commands are sent as fast as the replies come, then every request on the command limit leaves at most eight in any ten seconds, waiting rather than refused", async () => {
    const server = fakeServer();
    let time = 0;
    const posted: number[] = [];
    const reply = (v: number) => ({ body: { ok: true, view: { ...engineView(), v }, lines: [], clock: { tick: 1, nextTickAt: 1, nextTurnAt: 1 } } });
    server.answer("POST /api/character", () => {
      posted.push(time);
      return Promise.resolve(reply(1));
    });
    server.answer("POST /api/command", () => {
      posted.push(time);
      return Promise.resolve(reply(2));
    });
    const remote = remoteAuthority({
      baseUrl: `${BASE}/`,
      fetch: server.fetch,
      wall: { met: () => false, passed: () => undefined },
      now: () => time,
      wait: (ms) => {
        time += ms;
        return Promise.resolve();
      },
    });
    await remote.newLife("scenario.prologue");
    for (let each = 0; each < 20; each += 1) {
      const sent = await remote.send({ type: "turn/end", slots: [], basedOn: 1 });
      expect(sent.ok).toBe(true);
    }
    expect(posted).toHaveLength(21);
    expect(busiestWindow(posted)).toBeLessThanOrEqual(COMMANDS_PER_WINDOW);
  });

  test("[R-PROLOGUE-010] [R-SERVER-025] given every archetype, home and age over many seeds, when its preset is played online as the page plays it, then the longest preset, with the life's own POST before it, never puts more than eight commands in any ten seconds, under the server's ten", { timeout: 30_000 }, async () => {
    let longest = 0;
    for (const base of ARCHETYPES) {
      for (const home of homesFor(base)) {
        for (const age of AGES) {
          const archetype = withHome(withAge(base, age), home);
          for (let at = 0; at < SEEDS; at += 1) longest = Math.max(longest, presetLength(archetype, `${base.id}-${home}-${String(age)}-${String(at)}`));
        }
      }
    }
    // Counted on 11 Oct 2026: seven for the shop worker and the child of the water, fourteen to seventeen for the tiles through school and university.
    expect(longest).toBeGreaterThanOrEqual(14);
    expect(longest).toBeLessThanOrEqual(20);
    const times = await begunTimes(longest);
    expect(times).toHaveLength(longest + 1);
    expect(busiestWindow(times)).toBeLessThanOrEqual(COMMANDS_PER_WINDOW);
    expect(busiestWindow(times)).toBeLessThan(SERVER_PER_10S);
    // And the page keeps filling: a step every PRESET_STEP_MS, never a pause of more than two.
    const gaps = times.slice(2).map((time, index) => time - (times[index + 1] ?? 0));
    expect(Math.min(...gaps)).toBe(PRESET_STEP_MS);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(2 * PRESET_STEP_MS);
  });
});
