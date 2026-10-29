// The front door online (prologue:archetype-presets-answers, prologue:tile-path-open-from-start, prologue:printed-page-hands-over; server:commands-only-through-route): the life is the server's,
// faked here as online.spec fakes it, every command played through the real game. A tile and an age picked at the
// door reach the world as they were picked, and the page as the years go by never names another life.
import type { ClockView, PresetRequest } from "@japacity/api";
import { content } from "@japacity/content";
import type { Command, Id, PlayerView } from "@japacity/sim";
import { qualityIn, worldClockAt } from "@japacity/sim";
import { start, type Game } from "@japacity/sim/testing";
import type { AccountApi } from "../../shared/net/auth";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { App } from "../../app/App";
import { remoteAuthority } from "../../authority/remote";
import { createGameStore } from "../../authority/store";
import { archetypeOf } from "../../shared/front-door/archetypes";
import { toTheArchetypes } from "../../shared/front-door/frontDoor.testing";
import { readPerson } from "../../shared/front-door/person";
import { playPresetOn } from "../../shared/net/preset.testing";
import { accountView } from "../../shared/testing/fixtures";
import { BASE, fakeServer } from "../../shared/testing/server";
import { say } from "../../shared/words/text";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

afterEach(() => {
  localStorage.clear();
});

const CLOCK: ClockView = { tick: 0, nextTickAt: 3_600_000, nextTurnAt: null, morningAt: 0, world: worldClockAt(0) };
/** The nurse's own year at the door is 23 (her path with no setback); three steps older is the oldest the door offers. */
const OLDER = 3;
const AGE = "quality.age-months";

/** A server for one account: `POST /api/character` makes the life on `seed`, and every command is stepped on it. */
function onlineServer(seed: string) {
  const server = fakeServer();
  const held: { game: Game | null; sent: Command[] } = { game: null, sent: [] };
  const reply = (game: Game, lines: unknown[] = []) => ({ body: { ok: true, view: game.view(), lines, clock: CLOCK } });
  const game = (): Game => {
    if (held.game === null) throw new Error("No life was made.");
    return held.game;
  };
  server.answer("GET /api/view", () => Promise.resolve(held.game === null ? { status: 404, body: { ok: false, code: "no-character", detail: "No life yet." } } : reply(game())));
  server.answer("POST /api/character", () => {
    const { scenario } = server.sent.at(-1)?.body as { scenario: Id<"scenario"> };
    held.game = start({ scenario, seed, content });
    return Promise.resolve(reply(held.game));
  });
  server.answer("POST /api/command", () => {
    const { command } = server.sent.at(-1)?.body as { command: Command };
    held.sent.push(command);
    const result = game().send(command);
    return Promise.resolve(result.ok ? reply(game(), result.lines) : { status: 409, body: result });
  });
  // server:server-plays-prologue-preset: Begin sends the preset once, and the server plays every year as the commands it logs.
  server.answer("POST /api/prologue/preset", () => Promise.resolve({ body: playPresetOn(game(), server.sent.at(-1)?.body as PresetRequest, CLOCK, held.sent) }));
  return { server, held, game };
}

/** The page's path line as it stands, or null when no page is up. */
function pagePath(): string | null {
  const page = document.querySelector("[data-page-running], [data-page-handover]");
  return page === null ? null : (page.textContent ?? "");
}

describe("the front door online", () => {
  test("[prologue:archetype-presets-answers] [prologue:printed-page-hands-over] [server:commands-only-through-route] given the nurse's tile three years older at the door and a server whose life keeps her path, when Begin is pressed, then every year goes to the server as a command, the page never names a trade while the years go by, and the life reaches the world as a nurse of 26", async () => {
    const { server, held, game } = onlineServer("online-nurse");
    const remote = remoteAuthority({ baseUrl: BASE, fetch: server.fetch, wait: () => Promise.resolve() });
    const store = createGameStore(remote, { life: remote, lifeAgain: false, choosingLife: true });
    render(<App store={store} />);

    await toTheArchetypes("Ifeoma");
    fireEvent.click(await screen.findByRole("radio", { name: say("prologue.archetype.nurse.name") }));
    for (let step = 0; step < OLDER; step += 1) fireEvent.click(screen.getByRole("button", { name: say("prologue.door.age.older") }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.next")}`) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.begin")}`) }));

    const trade = say("ui.page.lived.trade");
    const pathsSeen = new Set<string>();
    await waitFor(
      () => {
        const path = pagePath();
        if (path !== null && path.includes(trade)) pathsSeen.add(`v${String(store.getState().view?.v)}`);
        if (document.querySelector("[data-page-handover]") === null) throw new Error("The years are still going by.");
      },
      { timeout: 15_000, interval: 5 },
    );

    // account:person-kept-with-character: the person the door kept goes with the new life, all but its photo.
    const kept = readPerson();
    expect(kept?.look).toBeDefined();
    expect(server.sent.filter((request) => request.path === "/api/character").map((request) => request.body)).toEqual([{ scenario: "scenario.prologue", person: { name: kept?.name, look: kept?.look, archetype: "nurse" } }]);
    const chosen = held.sent.flatMap((command) => (command.type === "prologue/choose" ? [command] : []));
    expect(chosen.find((command) => command.step === "age-degree")?.answer).toBe("start-26");
    const nurse = archetypeOf("nurse");
    expect(chosen.filter(({ step, answer }) => nurse?.preset[step] !== undefined && !(nurse.preset[step] ?? []).includes(answer))).toEqual([]);
    expect([...pathsSeen]).toEqual([]);

    const view: PlayerView = game().view();
    expect(view.prologue).toBeNull();
    expect(Math.floor(qualityIn(view, AGE) / 12)).toBe(26);
    expect(view.documents.some((paper) => paper.id === "document.nursing-licence" && paper.state === "held")).toBe(true);
    expect(pagePath()).toContain(say("prologue.archetype.nurse.name"));
    expect(store.getState().view?.v).toBe(view.v);
    fireEvent.click(screen.getByRole("button", { name: say("ui.prologue.start", { month: 1 }) }));
    await waitFor(() => expect(document.querySelector("[data-gate]")).toBeNull());
    expect(store.getState().view?.chapter.current).toBe("chapter.find-your-feet");
  }, 30000);
});

/** A signed-in account with no character yet, whose username was chosen before the door; only what the door reads of it. */
function signedInAccount(username: string): AccountApi {
  const view = () => Promise.resolve(accountView({ username, character: null }));
  // Every other call answers nothing: the door reads only the view, and Google's return is none.
  return new Proxy({} as AccountApi, {
    get: (_target, key) => (key === "view" ? view : key === "returnedFromGoogle" ? () => null : () => Promise.resolve(null)),
  });
}

describe("the door on the sign-in path (prologue:front-door-builds-a-person)", () => {
  test("[prologue:front-door-builds-a-person] given a signed-in account with no character whose username is olamide_88, when the door opens, then its name is Olamide, and Begin keeps that name with the life", async () => {
    const { server } = onlineServer("signed-in-name");
    const remote = remoteAuthority({ baseUrl: BASE, fetch: server.fetch, wait: () => Promise.resolve() });
    const store = createGameStore(remote, { life: remote, lifeAgain: false, choosingLife: true, account: signedInAccount("olamide_88") });
    render(<App store={store} />);
    const name = await screen.findByRole<HTMLInputElement>("textbox", { name: say("prologue.door.name.title") }, { timeout: 10_000 });
    await waitFor(() => expect(name.value).toBe("Olamide"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.skip") }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.begin")}`) }));
    await waitFor(() => expect(readPerson()?.name).toBe("Olamide"), { timeout: 10_000 });
  }, 30000);
});
