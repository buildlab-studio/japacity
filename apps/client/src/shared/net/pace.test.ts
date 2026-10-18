// The client keeps under the server's command limit (server:per-account-rate-limits): commands sent as fast as the replies
// come would have the eleventh in ten seconds refused 429 in the middle of play.
import { describe, expect, test } from "vitest";

import { remoteAuthority } from "../../authority/remote";
import { engineView } from "../testing/fixtures";
import { BASE, fakeServer } from "../testing/server";
import { busiestWindow, COMMANDS_PER_WINDOW, pacer, waitBefore, WINDOW_MS } from "./pace";

/** The server's limit: ten commands from an account in any ten seconds (apps/server/src/config.ts `commandsPer10s`, wrangler's COMMANDS_10S). */
const SERVER_PER_10S = 10;

describe("the client keeps under the command limit", () => {
  test("[server:per-account-rate-limits] given the pacer, when it is read, then it lets eight leave in any ten seconds, two fewer than the server takes", () => {
    expect(COMMANDS_PER_WINDOW).toBe(8);
    expect(WINDOW_MS).toBe(10_000);
    expect(COMMANDS_PER_WINDOW).toBeLessThan(SERVER_PER_10S);
    expect(waitBefore([0, 1, 2, 3, 4, 5, 6], 7)).toBe(0);
    expect(waitBefore([0, 1, 2, 3, 4, 5, 6, 7], 8)).toBe(WINDOW_MS - 8);
    expect(waitBefore([0, 1, 2, 3, 4, 5, 6, 7], WINDOW_MS - 1)).toBe(1);
    expect(waitBefore([0, 1, 2, 3, 4, 5, 6, 7], WINDOW_MS)).toBe(0);
  });

  test("[server:per-account-rate-limits] given the pacer on its own clock, when twenty commands are taken back to back, then the first eight leave at once and no ten seconds ever hold more than eight", async () => {
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

  test("[server:per-account-rate-limits] given the remote authority, when a life is made and twenty commands are sent as fast as the replies come, then every request on the command limit leaves at most eight in any ten seconds, waiting rather than refused", async () => {
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
});
