// R-ENGINE-015: what the screens say when the online authority brings no answer: the loading screen's second line and
// its card, the card over the page of the years with the answer kept, and Begin as the one request that begins.
import type { ServerRejection } from "@japacity/api";
import type { Command, Reply } from "@japacity/sim";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { App, SLOW_MS } from "./App";
import { localAuthority } from "../authority/local";
import { remoteAuthority } from "../authority/remote";
import { keepPerson } from "../shared/frontdoor/person";
import { createGameStore } from "../authority/store";
import { readDoor } from "../shared/datapage/door";
import type { AccountApi } from "../shared/net/auth";
import { requestFailure } from "../shared/net/http";
import { BASE, fakeServer } from "../shared/testing/server";
import { passThePage, startArchetype, toTheArchetypes } from "../shared/frontdoor/frontDoor.testing";
import { engineView } from "../shared/testing/fixtures";
import { say } from "../shared/words/text";
// Registers Testing Library's cleanup for this file.
import "../shared/testing/render";

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

const unused = () => Promise.reject(new Error("unused"));
const noPause = { wait: () => Promise.resolve() };

/** No text on screen is the browser's own. */
function noBrowserWords(): void {
  expect(document.body.textContent).not.toContain("Load failed");
  expect(document.body.textContent).not.toContain("Failed to fetch");
  expect(document.body.textContent).not.toContain(say("ui.failed", { why: "" }).trim());
}

describe("the screens when a request brings no answer (R-ENGINE-015)", () => {
  test("[R-ENGINE-015] given the view takes long, then Opening your life says Still opening after 5 seconds, and not before", async () => {
    vi.useFakeTimers();
    const store = createGameStore({ view: () => new Promise(() => undefined), send: unused });
    render(<App store={store} />);
    expect(screen.getByText(say("ui.loading"))).toBeDefined();
    await act(() => vi.advanceTimersByTimeAsync(SLOW_MS - 1));
    expect(screen.queryByText(say("ui.loading.slow"))).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByText("Still opening...")).toBeDefined();
  });

  test("[R-ENGINE-015] given the view never answers (Load failed, three times), then the card takes the loading screen's place with Retry, and Retry opens the life", async () => {
    let asked = 0;
    const store = createGameStore(
      {
        view: () => {
          asked += 1;
          return asked <= 3 ? Promise.reject(requestFailure("network", "Load failed")) : Promise.resolve(engineView());
        },
        send: unused,
      },
      noPause,
    );
    render(<App store={store} />);
    const card = await screen.findByRole("alertdialog", { name: "The server did not answer." });
    expect(card.getAttribute("data-trouble-during")).toBe("view");
    expect(screen.queryByRole("button", { name: say("ui.trouble.reload") })).toBeNull();
    noBrowserWords();
    fireEvent.click(screen.getByRole("button", { name: say("ui.trouble.retry") }));
    await waitFor(() => expect(store.getState().view).not.toBeNull());
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  test("[R-ENGINE-015] [R-SERVER-043] given the server answers the view with its own 503 unavailable (the database not answering), then the card says something broke on our side, with Retry and no Reload", async () => {
    const server = fakeServer();
    const down = { status: 503, headers: { "Retry-After": "5" }, body: { ok: false, code: "unavailable", detail: "The game's server could not reach its database. Try again shortly.", retryAfter: 5 } };
    server.answer("GET /api/view", down);
    const remote = remoteAuthority({ baseUrl: BASE, fetch: server.fetch, wall: { met: () => false, passed: () => undefined } });
    const store = createGameStore(remote, noPause);
    render(<App store={store} />);
    const card = await screen.findByRole("alertdialog", { name: say("ui.trouble.server") });
    expect(card.getAttribute("data-trouble")).toBe("server");
    expect(screen.getByRole("button", { name: say("ui.trouble.retry") })).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.trouble.reload") })).toBeNull();
    noBrowserWords();
  });

  // A new visitor with the server down sees the start screen's frame, never a blank page, and Retry never says "Opening
  // your life" to someone with no life.
  test("[R-ENGINE-015] [R-SERVER-043] given a new visitor online (no life on this device) and a stand-in server answering 503, then the start screen's frame stands with the hook and the card naming the game; Retry keeps the frame, never Opening your life, and once the server answers the start screen takes its place", async () => {
    const server = fakeServer();
    const down = { status: 503, headers: { "Retry-After": "5" }, body: { ok: false, code: "unavailable", detail: "The game's server could not reach its database. Try again shortly.", retryAfter: 5 } };
    server.answer("GET /api/view", down, down, down, down, down, down, { status: 401, body: { ok: false, code: "signed-out", detail: "Nobody is signed in." } });
    const remote = remoteAuthority({ baseUrl: BASE, fetch: server.fetch, wall: { met: () => false, passed: () => undefined } });
    const account = { ageStatus: () => Promise.resolve("unasked" as const), returnedFromGoogle: () => null } as unknown as AccountApi;
    const store = createGameStore(remote, { ...noPause, account });
    // The online shell hands the server's own refusals to the store (goOnline).
    remote.listen((event) => store.getState().heard(event));
    render(<App store={store} />);
    expect(screen.queryByText(say("ui.loading"))).toBeNull();
    const card = await screen.findByRole("alertdialog", { name: say("ui.trouble.server") });
    const frame = document.querySelector("[data-start-trouble]");
    expect(frame?.getAttribute("data-start-trouble")).toBe("server");
    expect(frame?.querySelector("[data-start-hook]")).not.toBeNull();
    expect(frame?.querySelector("[data-start-steps]")).not.toBeNull();
    expect(card.querySelector("[data-wordmark]")?.getAttribute("alt")).toBe(say("ui.game"));
    noBrowserWords();
    fireEvent.click(screen.getByRole("button", { name: say("ui.trouble.retry") }));
    // Asking again keeps the frame; the server down still, the card comes back in it.
    expect(screen.queryByText(say("ui.loading"))).toBeNull();
    expect(document.querySelector("[data-start-trouble]")).not.toBeNull();
    await screen.findByRole("alertdialog", { name: say("ui.trouble.server") });
    fireEvent.click(screen.getByRole("button", { name: say("ui.trouble.retry") }));
    // The server answers: nobody is signed in, so the start screen itself, with Play.
    expect(await screen.findByRole("button", { name: say("ui.account.start.play") })).toBeDefined();
    expect(document.querySelector("[data-start-screen]")).not.toBeNull();
    expect(screen.queryByText(say("ui.loading"))).toBeNull();
    expect(screen.queryByText(say("ui.loading.slow"))).toBeNull();
  });

  test("[R-ENGINE-015] given a player whose life is kept on this device and the server down, then the card stands where the life is opening", async () => {
    keepPerson({ look: "chr_ada", name: "Bayo", archetype: "developer" });
    const store = createGameStore({ view: () => Promise.reject(requestFailure("server", "502")), send: unused }, { ...noPause, account: {} as AccountApi });
    render(<App store={store} />);
    expect(await screen.findByRole("alertdialog", { name: say("ui.trouble.server") })).toBeDefined();
    expect(document.querySelector("[data-start-trouble]")).toBeNull();
  });

  test("[R-ENGINE-015] [R-ACCOUNT-006] given a login wall or an ended session in front of the view, then the card says so with Retry and Reload", async () => {
    const store = createGameStore({ view: () => Promise.reject(requestFailure("wall", "redirected (0)")), send: unused }, noPause);
    render(<App store={store} />);
    expect(await screen.findByRole("alertdialog", { name: "Your session ended: open the game again." })).toBeDefined();
    expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Reload" })).toBeDefined();
    noBrowserWords();
  });

  test("[R-ENGINE-015] given a server fault, then the card says it is ours", async () => {
    const store = createGameStore({ view: () => Promise.reject(requestFailure("server", "502")), send: unused }, noPause);
    render(<App store={store} />);
    expect(await screen.findByRole("alertdialog", { name: "Something broke on our side." })).toBeDefined();
  });

  test("[R-ENGINE-015] given Begin brings no answer, then the card shows over the door, the run stays the page on the device, and Retry begins the life and marks it begun", async () => {
    const authority = localAuthority({ storage: memoryStorage(), fastClock: true, makeSeed: () => "trouble-door" });
    let tries = 0;
    const store = createGameStore(authority, {
      ...noPause,
      choosingLife: true,
      life: {
        newLife: (scenario) => {
          tries += 1;
          return tries === 1 ? Promise.reject(requestFailure("network", "no answer in 15000 ms")) : authority.newLife(scenario);
        },
      },
    });
    render(<App store={store} />);
    await toTheArchetypes();
    fireEvent.click(await screen.findByRole("radio", { name: say("prologue.archetype.developer.name") }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.next")}`) }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${say("ui.door.begin")}`) }));
    const card = await screen.findByRole("alertdialog", { name: "The server did not answer." });
    expect(card.getAttribute("data-trouble-during")).toBe("life");
    // Nothing is begun until the authority holds the life: a reload now comes back to the page, filled in.
    expect(readDoor()?.stage).toBe("page");
    expect(screen.getByRole("button", { name: /^Begin/ })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(store.getState().view).not.toBeNull());
    await waitFor(() => expect(readDoor()?.stage).toBe("begun"));
    expect(tries).toBe(2);
  });

  test("[R-ENGINE-015] given an answer of the years brings no answer, then the card shows over the page of the years, and Retry sends the same answer and the years go on to the handover", async () => {
    const authority = localAuthority({ storage: memoryStorage(), fastClock: true, makeSeed: () => "trouble-years" });
    const sent: Command[] = [];
    let failOnce = true;
    const flaky = {
      ...authority,
      view: () => authority.view(),
      clock: () => authority.clock(),
      vars: () => authority.vars(),
      send: (command: Command): Promise<Reply | ServerRejection> => {
        sent.push(command);
        if (command.type === "prologue/choose" && failOnce) {
          failOnce = false;
          return Promise.reject(requestFailure("network", "Load failed"));
        }
        return authority.send(command);
      },
    };
    const store = createGameStore(flaky, { ...noPause, choosingLife: true, life: authority });
    render(<App store={store} />);
    await startArchetype("developer");
    const card = await screen.findByRole("alertdialog", { name: "The server did not answer." });
    expect(card.getAttribute("data-trouble-during")).toBe("command");
    expect(document.querySelector("[data-page-running]")).not.toBeNull();
    noBrowserWords();
    const first = sent[0];
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await passThePage();
    expect(sent[1]).toEqual(first);
    expect(store.getState().view?.prologue).toBeNull();
  });
});
