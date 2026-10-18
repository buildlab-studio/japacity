import type { ClockView } from "@japacity/api";
import type { PlayerView } from "@japacity/sim";
import { worldClockAt } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { failureOf, isReported } from "../shared/net/http";
import { engineView } from "../shared/testing/fixtures";
import { BASE, fakeServer } from "../shared/testing/server";
import { remoteAuthority, type AuthorityEvent } from "./remote";

const CLOCK: ClockView = { tick: 40, nextTickAt: 1_000_000, nextTurnAt: 500_000, morningAt: 0, world: worldClockAt(0) };

function at(v: number): PlayerView {
  return { ...engineView(), v };
}

const viewReply = (v: number, clock: ClockView = CLOCK) => ({ body: { ok: true, view: at(v), lines: [], clock } });

function setUp() {
  const server = fakeServer();
  const waits: number[] = [];
  let time = 0;
  const events: AuthorityEvent[] = [];
  const remote = remoteAuthority({
    baseUrl: `${BASE}/`,
    fetch: server.fetch,
    // A login wall's reload is the page's; here it is only counted.
    wall: { met: () => false, passed: () => undefined },
    now: () => time,
    wait: (ms) => {
      waits.push(ms);
      time += ms;
      return Promise.resolve();
    },
  });
  remote.listen((event) => events.push(event));
  return { server, remote, waits, events, advance: (ms: number) => (time += ms) };
}

describe("the remote authority", () => {
  test("[R-SERVER-001] given a view held at version 5, when a command is sent, then it posts the command and basedOn 5 to /api/command and nothing else", async () => {
    const { server, remote } = setUp();
    server.answer("GET /api/view", viewReply(5));
    server.answer("POST /api/command", viewReply(6));
    await remote.view();
    await remote.send({ type: "turn/end", slots: [], basedOn: 2 });
    const post = server.sent.find((request) => request.method === "POST");
    expect(post?.path).toBe("/api/command");
    expect(post?.body).toEqual({ command: { type: "turn/end", slots: [], basedOn: 5 }, basedOn: 5 });
    // R-ENGINE-015: the page and the API are one origin, so the cookie goes same-origin only.
    expect(post?.credentials).toBe("same-origin");
    expect(remote.held()).toBe(6);
  });

  test("[R-SERVER-001] given no view fetched yet, when a command is sent, then basedOn is the command's own", async () => {
    const { server, remote } = setUp();
    server.answer("POST /api/command", viewReply(4));
    await remote.send({ type: "turn/end", slots: [], basedOn: 3 });
    expect(server.sent[0]?.body).toMatchObject({ basedOn: 3 });
  });

  test("[R-ENGINE-003] given the state moved on, when the server answers stale, then the view is fetched once and the rejection returned, and the next view costs no request", async () => {
    const { server, remote } = setUp();
    server.answer("GET /api/view", viewReply(5), viewReply(9));
    server.answer("POST /api/command", { status: 409, body: { ok: false, code: "stale", detail: "moved on" } });
    await remote.view();
    const reply = await remote.send({ type: "turn/end", slots: [], basedOn: 5 });
    expect(reply).toEqual({ ok: false, code: "stale", detail: "moved on" });
    expect(server.sent.map((request) => `${request.method} ${request.path}`)).toEqual(["GET /api/view", "POST /api/command", "GET /api/view"]);
    expect(remote.held()).toBe(9);
    expect((await remote.view()).v).toBe(9);
    expect(server.sent).toHaveLength(3);
  });

  test("[R-SERVER-025] given too many commands, when the server answers rate-limited with retryAfter 3, then the store hears it, the authority waits 3 seconds, and the rejection comes back", async () => {
    const { server, remote, waits, events } = setUp();
    server.answer("POST /api/command", { status: 429, body: { ok: false, code: "rate-limited", detail: "slow", retryAfter: 3 } });
    const reply = await remote.send({ type: "turn/end", slots: [], basedOn: 1 });
    expect(reply).toMatchObject({ ok: false, code: "rate-limited", retryAfter: 3 });
    expect(events).toContainEqual({ kind: "rate-limited", retryAfter: 3 });
    expect(waits).toEqual([3000]);
  });

  test("[R-SERVER-025] given a wait still running, when another request goes, then it first waits out what is left", async () => {
    const server = fakeServer();
    const waits: number[] = [];
    let time = 0;
    const remote = remoteAuthority({ baseUrl: BASE, fetch: server.fetch, now: () => time, wait: (ms) => (waits.push(ms), Promise.resolve()) });
    server.answer("POST /api/command", { status: 429, body: { ok: false, code: "rate-limited", detail: "slow", retryAfter: 2 } });
    server.answer("GET /api/view", viewReply(1));
    await remote.send({ type: "turn/end", slots: [], basedOn: 1 });
    time = 500;
    await remote.view();
    expect(waits).toEqual([2000, 1500]);
  });

  test("[R-SERVER-025] given a 429 with no body, then the Retry-After header gives the wait", async () => {
    const { server, remote, waits } = setUp();
    server.answer("POST /api/command", { status: 429, body: undefined, headers: { "Retry-After": "7" } });
    const reply = await remote.send({ type: "turn/end", slots: [], basedOn: 1 });
    expect(reply).toMatchObject({ code: "rate-limited", retryAfter: 7 });
    expect(waits).toEqual([7000]);
  });

  test("[R-CLOCK-003] given each reply carries a clock, then the authority keeps the last and tells the store", async () => {
    const { server, remote, events } = setUp();
    const later: ClockView = { tick: 41, nextTickAt: 2_000_000, nextTurnAt: null, morningAt: 0, world: worldClockAt(0) };
    server.answer("GET /api/view", viewReply(1));
    server.answer("POST /api/command", viewReply(2, later));
    await remote.view();
    expect(remote.clock()).toEqual(CLOCK);
    await remote.send({ type: "turn/end", slots: [], basedOn: 1 });
    expect(remote.clock()).toEqual(later);
    expect(events).toEqual([
      { kind: "clock", clock: CLOCK },
      { kind: "clock", clock: later },
    ]);
  });

  test("[R-SERVER-001] given no session, when the view is fetched, then the store hears signed-out and the error is one it was told about", async () => {
    const { server, remote, events } = setUp();
    server.answer("GET /api/view", { status: 401, body: { ok: false, code: "signed-out", detail: "no session" } });
    const error: unknown = await remote.view().catch((caught: unknown) => caught);
    expect(isReported(error)).toBe(true);
    expect(events).toEqual([{ kind: "signed-out" }]);
  });

  test("[R-SERVER-003] given a life the server must check, when the view is fetched or a command sent, then the store hears diverged and the view's error is one it was told about", async () => {
    const { server, remote, events } = setUp();
    const diverged = { status: 409, body: { ok: false, code: "diverged", detail: "This character is being checked. Play resumes once it is mended." } };
    server.answer("GET /api/view", diverged);
    server.answer("POST /api/command", diverged);
    const error: unknown = await remote.view().catch((caught: unknown) => caught);
    expect(isReported(error)).toBe(true);
    expect(failureOf(error)).toBeNull();
    expect(await remote.send({ type: "turn/end", slots: [], basedOn: 0 })).toMatchObject({ ok: false, code: "diverged" });
    expect(events).toEqual([{ kind: "diverged" }, { kind: "diverged" }]);
  });

  test("[R-SERVER-001] [R-ACCOUNT-006] given a 401 with no body, then it is no refusal of the game's but a wall (the game's own 401 always says signed-out in its body)", async () => {
    const { server, remote, events } = setUp();
    server.answer("POST /api/command", { status: 401, body: undefined });
    const error: unknown = await remote.send({ type: "turn/end", slots: [], basedOn: 1 }).catch((caught: unknown) => caught);
    expect(failureOf(error)).toBe("wall");
    expect(events).toEqual([]);
  });

  test("[R-ACCOUNT-015] given an account with no character, when the view is fetched, then the store hears no-character", async () => {
    const { server, remote, events } = setUp();
    server.answer("GET /api/view", { status: 404, body: { ok: false, code: "no-character", detail: "none" } });
    await expect(remote.view()).rejects.toThrow();
    expect(events).toEqual([{ kind: "no-character" }]);
  });

  test("[R-ACCOUNT-015] given a life chosen, then it posts the scenario to /api/character and takes the view it answers", async () => {
    const { server, remote } = setUp();
    server.answer("POST /api/character", viewReply(0));
    const view = await remote.newLife("scenario.ada");
    expect(server.sent[0]).toMatchObject({ method: "POST", path: "/api/character", body: { scenario: "scenario.ada" } });
    expect(view.v).toBe(0);
    expect(remote.held()).toBe(0);
  });

  test("[R-ACCOUNT-015] given the account already has its character, when a life is chosen, then the view of that one is fetched", async () => {
    const { server, remote } = setUp();
    server.answer("POST /api/character", { status: 409, body: { ok: false, code: "one-character", detail: "has one" } });
    server.answer("GET /api/view", viewReply(12));
    expect((await remote.newLife("scenario.ada")).v).toBe(12);
  });

  test("given the world asked for, then it comes from GET /api/world and holds only what the server sent", async () => {
    const { server, remote } = setUp();
    const world = { tick: 40, world: { tick: 40 }, nextTickAt: 1_000_000 };
    server.answer("GET /api/world", { body: world });
    expect(await remote.world()).toEqual(world);
  });

  test("[R-CLOCK-028] given presence asked for a place, then it comes from GET /api/place/:place with the others and those seen today", async () => {
    const { server, remote } = setUp();
    server.answer("GET /api/place/place.peckham", { body: { place: "place.peckham", others: [{ name: "Ada", look: "a" }], today: [{ name: "Bisi", look: "b" }] } });
    const presence = await remote.presence("place.peckham");
    expect(presence.others).toHaveLength(1);
    expect(presence.today).toEqual([{ name: "Bisi", look: "b" }]);
  });

  test("[R-LOTTERY-013] given a view held at version 5, when the view is fetched again, then it asks for the lines since 5 and tells the store of them", async () => {
    const { server, remote, events } = setUp();
    const letter = { key: "line.lottery.letter", params: {}, tone: "good" as const, big: true, attention: true, counts: [] };
    server.answer("GET /api/view", viewReply(5), { body: { ok: true, view: at(7), lines: [letter], clock: CLOCK } });
    await remote.view();
    await remote.view();
    expect(server.sent.map((request) => request.search)).toEqual(["", "?since=5"]);
    expect(events.filter((event) => event.kind === "lines")).toEqual([{ kind: "lines", lines: [letter] }]);
  });

  test("[R-LOTTERY-013] given no view held yet, when the first view comes with lines, then none are told: nothing old is staged on load", async () => {
    const { server, remote, events } = setUp();
    server.answer("GET /api/view", { body: { ok: true, view: at(5), lines: [{ key: "line.lottery.letter", params: {}, tone: "good", big: true, attention: true, counts: [] }], clock: CLOCK } });
    await remote.view();
    expect(events.some((event) => event.kind === "lines")).toBe(false);
  });
});
