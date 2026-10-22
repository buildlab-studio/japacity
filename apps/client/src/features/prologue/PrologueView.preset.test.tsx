// The prologue's preset played by the server in one request (prologue:archetype-presets-answers, server.md
// server:server-plays-prologue-preset, decision 0008): online, Begin sends the tile, the age step and the home once, and the page fills from the
// reply's trail, its chips coming on one after another over about two seconds; offline each answer still goes at once,
// from the same content function.
import type { ClockView, PresetRequest } from "@japacity/api";
import { presetAnswer } from "@japacity/content";
import { worldClockAt } from "@japacity/sim";
import type { Command, Id } from "@japacity/sim";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { App } from "../../app/App";
import { keepPerson } from "../../shared/front-door/person";
import { remoteAuthority } from "../../authority/remote";
import { createGameStore } from "../../authority/store";
import { playPresetOn } from "../../shared/net/preset.testing";
import { gameAuthority, newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { BASE, fakeServer } from "../../shared/testing/server";
import { say } from "../../shared/words/text";
import { PageHandover, REVEAL_MS, TURN_MS } from "./PrologueView";
import { noteSteps, readTrail, yearChips } from "./years";
import { DOOR_KEY, TRAIL_KEY } from "../../shared/kept/storage";

const PROLOGUE = "scenario.prologue" as Id<"scenario">;
const CLOCK: ClockView = { tick: 0, nextTickAt: 3_600_000, nextTurnAt: null, morningAt: 0, world: worldClockAt(0) };

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

/** The door as Begin left it: the developer, a year older than his own, in the hostel room. */
function begun(age = 1, home = "hostel-room"): void {
  keepPerson({ look: "person_ada", name: "Ada", archetype: "developer" });
  localStorage.setItem(DOOR_KEY, JSON.stringify({ stage: "begun", look: "person_ada", archetype: "developer", ready: null, name: "Ada", roll: 0, age, home }));
}

/** A server whose account holds a new life from sixteen on `seed`, playing the preset route as the server does unless `played` is false. */
function onlineLife(seed: string, played = true) {
  const game = newGame(PROLOGUE, seed);
  const server = fakeServer();
  const commands: Command[] = [];
  server.answer("GET /api/view", () => Promise.resolve({ body: { ok: true, view: game.view(), lines: [], clock: CLOCK } }));
  server.answer("POST /api/command", () => {
    const { command } = server.sent.at(-1)?.body as { command: Command };
    commands.push(command);
    const result = game.send(command);
    return Promise.resolve(result.ok ? { body: { ok: true, view: game.view(), lines: result.lines, clock: CLOCK } } : { status: 409, body: result });
  });
  if (played) {
    server.answer("POST /api/prologue/preset", () => {
      const request = server.sent.at(-1)?.body as PresetRequest;
      return Promise.resolve({ body: playPresetOn(game, request, CLOCK, commands) });
    });
  }
  const remote = remoteAuthority({ baseUrl: BASE, fetch: server.fetch, wait: () => Promise.resolve() });
  const store = createGameStore(remote, { life: remote, lifeAgain: false });
  return { game, server, store, commands };
}

const posted = (server: ReturnType<typeof fakeServer>, path: string) => server.sent.filter((request) => request.method === "POST" && request.path === path);

describe("the preset online", () => {
  test("[prologue:archetype-presets-answers] [server:server-plays-prologue-preset] [server:per-account-rate-limits] given a new life online, when Begin starts its years, then the whole preset leaves as one request with the tile, the age step, the home and the version held, no command goes one by one, and the page is the handover filled from the reply's trail", async () => {
    begun();
    const { game, server, store } = onlineLife("preset-online");
    await store.getState().refresh();
    render(<App store={store} />);
    await waitFor(() => expect(document.querySelector("[data-page-handover]")).not.toBeNull(), { timeout: 10_000 });

    expect(posted(server, "/api/prologue/preset").map((request) => request.body)).toEqual([{ archetype: "developer", age: 1, home: "hostel-room", basedOn: 0 }]);
    expect(posted(server, "/api/command")).toEqual([]);
    expect(game.state.prologue.open).toBe(false);
    expect(store.getState().view?.v).toBe(game.state.v);
    expect(store.getState().view?.prologue).toBeNull();
    // The trail the page reads is the server's, a step each, the opening draw first and the home last.
    const trail = readTrail();
    expect(trail.steps).toHaveLength(game.state.v);
    expect(trail.steps[0]).toMatchObject({ step: "draw", answer: "begin" });
    expect(trail.steps.at(-1)).toMatchObject({ step: "home", answer: "hostel-room" });
    expect(trail.draw).toEqual(game.state.prologue.draw);
  });

  test("[server:server-plays-prologue-preset] [engine:stale-commands-rejected] given the preset played, when the next command is sent, then it is based on the version the reply brought", async () => {
    begun(0, "family-house");
    const { game, server, store } = onlineLife("preset-version");
    await store.getState().refresh();
    render(<App store={store} />);
    await waitFor(() => expect(store.getState().view?.prologue).toBeNull(), { timeout: 10_000 });
    const after = game.state.v;
    await act(async () => {
      await store.getState().send({ type: "turn/end", slots: [] });
    });
    expect(posted(server, "/api/command").map((request) => (request.body as { basedOn: number }).basedOn)).toEqual([after]);
  });

  test("[server:server-plays-prologue-preset] [prologue:archetype-presets-answers] given an answer refused after some steps, when the reply comes, then the steps before it stand, the card shows with the refusal, and the preset is not sent again", async () => {
    begun();
    const { store, server } = onlineLife("preset-refused", false);
    // The server stops after three steps, refusing the fourth.
    server.answer("POST /api/prologue/preset", () => {
      const life = newGame(PROLOGUE, "preset-refused");
      for (let step = 0; step < 3; step += 1) {
        const card = life.view().prologue;
        if (card === null) throw new Error("No card.");
        life.send({ type: "prologue/choose", step: card.step, answer: presetAnswer("developer", 1, "hostel-room", card.step, card.answers) ?? "" });
      }
      return Promise.resolve({ body: { ok: true, view: life.view(), lines: [], clock: CLOCK, stepped: 3, trail: [], refusal: { ok: false, code: "not-legal", detail: "The answer is not open." } } });
    });
    await store.getState().refresh();
    render(<App store={store} />);
    expect(await screen.findByText(say("reject.not-legal"))).toBeDefined();
    expect(document.querySelector("[data-prologue-card]")).not.toBeNull();
    expect(store.getState().view?.v).toBe(3);
    expect(posted(server, "/api/prologue/preset")).toHaveLength(1);
    expect(posted(server, "/api/command")).toEqual([]);
  });
});

describe("the preset offline", () => {
  test("[prologue:archetype-presets-answers] given a new life offline, when its years go by, then each answer goes at once as a command, each the one content's presetAnswer gives at its card, and no preset request is made", async () => {
    begun(2, "compound-room");
    const game = newGame(PROLOGUE, "preset-offline");
    const shadow = newGame(PROLOGUE, "preset-offline");
    const authority = gameAuthority(game);
    const store = createGameStore(authority);
    expect(store.getState().preset).toBeNull();
    await store.getState().refresh();
    render(<App store={store} />);
    await waitFor(() => expect(document.querySelector("[data-page-handover]")).not.toBeNull(), { timeout: 10_000 });
    expect(authority.sent.length).toBe(game.state.v);
    for (const command of authority.sent) {
      const card = shadow.view().prologue;
      if (card === null || command.type !== "prologue/choose") throw new Error("A command after the years.");
      expect(command).toMatchObject({ step: card.step, answer: presetAnswer("developer", 2, "compound-room", card.step, card.answers) });
      shadow.send(command);
    }
  });
});

describe("the page while the server plays the years", () => {
  test("[prologue:printed-page-hands-over] [engine:browser-authority-for-dev-only] given Begin online and the preset's reply not yet in, then the page is the splash's wait in its own frame: Drawing your family with the running bar under it and no chips, until the reply lands and the handover fills", async () => {
    begun();
    const { game, server, store, commands } = onlineLife("preset-waiting", false);
    let release: (() => void) | null = null;
    server.answer("POST /api/prologue/preset", () => {
      const request = server.sent.at(-1)?.body as PresetRequest;
      return new Promise((resolve) => {
        release = () => resolve({ body: playPresetOn(game, request, CLOCK, commands) });
      });
    });
    await store.getState().refresh();
    render(<App store={store} />);
    await waitFor(() => expect(posted(server, "/api/prologue/preset")).toHaveLength(1));
    const waiting = document.querySelector("[data-page-running][data-page-waiting]");
    expect(waiting?.querySelector("[data-gate='years']")).not.toBeNull();
    const bar = screen.getByRole("progressbar", { name: say("ui.page.family.drawing") });
    expect(bar.dataset["loader"]).toBe("busy");
    expect(bar.previousElementSibling?.textContent).toBe(say("ui.page.family.drawing"));
    expect(waiting?.querySelector(".splash-words")).not.toBeNull();
    expect(document.querySelector("[data-fact], [data-page], [data-years]")).toBeNull();
    expect(waiting?.textContent).toBe(say("ui.page.family.drawing"));
    act(() => release?.());
    await waitFor(() => expect(document.querySelector("[data-page-handover]")).not.toBeNull(), { timeout: 10_000 });
    expect(document.querySelector("[data-page-waiting]")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

describe("the page filled from the reply", () => {
  test("[prologue:archetype-presets-answers] [prologue:printed-page-hands-over] given the trail the server played in one request, when the handover opens, then its years come on a chip after another over about two seconds, and the family turns over only after the last", async () => {
    keepPerson({ look: "person_ada", name: "Ada", archetype: "developer" });
    const game = newGame(PROLOGUE, "preset-reveal");
    const reply = playPresetOn(game, { archetype: "developer", age: 0, home: "family-house", basedOn: 0 }, CLOCK);
    if (!reply.ok) throw new Error("The preset was refused.");
    noteSteps(reply.trail);
    const final = yearChips(readTrail(), game.view());
    expect(final.length).toBeGreaterThanOrEqual(4);
    vi.useFakeTimers();
    await renderWithView(<PageHandover onDone={() => undefined} />, game.view());
    const lived = () => [...document.querySelectorAll<HTMLElement>("[data-years] [data-fact]")].filter((chip) => chip.dataset["state"] !== "waiting").map((chip) => chip.dataset["fact"]);
    const every = Math.round(REVEAL_MS / final.length);
    expect(lived()).toEqual([]);
    expect(document.querySelector("[data-family]")?.getAttribute("data-family")).toBe("drawing");
    for (let count = 1; count <= final.length; count += 1) {
      act(() => {
        vi.advanceTimersByTime(every);
      });
      expect(lived()).toEqual(final.slice(0, count).map((chip) => chip.id));
    }
    expect(every * final.length).toBeLessThanOrEqual(REVEAL_MS + final.length);
    // Every chip is in, the not-yet ones gone; the family turns over after its own pause, and the trail is plain again.
    expect([...document.querySelectorAll<HTMLElement>("[data-years] [data-fact]")].map((chip) => chip.dataset["fact"])).toEqual(final.map((chip) => chip.id));
    expect(document.querySelector("[data-family]")?.getAttribute("data-family")).toBe("drawing");
    act(() => {
      vi.advanceTimersByTime(TURN_MS);
    });
    expect(document.querySelector("[data-family]")?.getAttribute("data-family")).toBe("turned");
    expect(readTrail().fresh).toBeUndefined();
  });

  test("[prologue:printed-page-hands-over] given a trail with nothing fresh (offline, or the page shown before), when the handover opens, then every chip is there at once and the family turns", async () => {
    keepPerson({ look: "person_ada", name: "Ada", archetype: "developer" });
    const game = newGame(PROLOGUE, "preset-plain");
    const reply = playPresetOn(game, { archetype: "developer", age: 0, home: "family-house", basedOn: 0 }, CLOCK);
    if (!reply.ok) throw new Error("The preset was refused.");
    noteSteps(reply.trail);
    const trail = readTrail();
    localStorage.setItem(TRAIL_KEY, JSON.stringify({ draw: trail.draw, steps: trail.steps }));
    vi.useFakeTimers();
    await renderWithView(<PageHandover onDone={() => undefined} />, game.view());
    expect([...document.querySelectorAll<HTMLElement>("[data-years] [data-fact]")].map((chip) => chip.dataset["fact"])).toEqual(yearChips(readTrail(), game.view()).map((chip) => chip.id));
    act(() => {
      vi.advanceTimersByTime(TURN_MS);
    });
    expect(document.querySelector("[data-family]")?.getAttribute("data-family")).toBe("turned");
  });
});
