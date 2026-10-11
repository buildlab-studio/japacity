// R-ENGINE-015: what the screens say when the online authority brings no answer: the loading screen's second line and
// its card, the card over the page of the years with the answer kept, and Begin as the one request that begins.
import type { Command, Reply } from "@japacity/sim";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { App, SLOW_MS } from "./App";
import { localAuthority } from "./authority/local";
import { remoteAuthority } from "./authority/remote";
import { createGameStore } from "./authority/store";
import { readDoor } from "./shared/datapage/door";
import type { ServerRejection } from "./shared/net/contract";
import { requestFailure } from "./shared/net/http";
import { BASE, fakeServer } from "./shared/testing/server";
import { passThePage, startArchetype, toTheArchetypes } from "./shared/frontdoor/frontDoor.testing";
import { engineView } from "./shared/testing/fixtures";
import { say } from "./shared/words/text";
// Registers Testing Library's cleanup for this file.
import "./shared/testing/render";
import { onTheClassicPage } from "./shared/testing/classic";

// The world's scene needs WebGL; the life once open is checked on the old month page (R-WORLD-024).
onTheClassicPage();

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
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("prologue.door.print")}`) }));
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
