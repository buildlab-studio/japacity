// The rejection sheet (R-SERVER-003): a life the server must check says so in its own words and offers Retry, which
// asks for the life again; every other rejection keeps its Close. Over the remote authority and a stand-in server.
import { worldClockAt } from "@japacity/sim";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "../../App";
import { GameProvider } from "../../authority/GameProvider";
import { remoteAuthority } from "../../authority/remote";
import { createGameStore } from "../../authority/store";
import { engineView } from "../testing/fixtures";
import { BASE, fakeServer } from "../testing/server";
import { say } from "../words/text";
import { Rejection } from "./Rejection";
import "../testing/render";

const DIVERGED = { status: 409, body: { ok: false, code: "diverged", detail: "This character is being checked. Play resumes once it is mended." } };
const CLOCK = { tick: 1, nextTickAt: 10, nextTurnAt: 5, morningAt: 0, world: worldClockAt(0) };
const viewed = (v: number) => ({ body: { ok: true, view: { ...engineView(), v }, lines: [], clock: CLOCK } });
const WORDS = "Your life needs checking on our side. Try again in a while.";

function online() {
  const server = fakeServer();
  const remote = remoteAuthority({ baseUrl: BASE, fetch: server.fetch, wall: { met: () => false, passed: () => undefined } });
  const store = createGameStore(remote, { wait: () => Promise.resolve() });
  remote.listen((event) => store.getState().heard(event));
  return { server, store };
}

describe("the rejection sheet", () => {
  test("[R-SERVER-003] given a command refused as diverged, then the sheet says the life needs checking, offers Retry and no Close, and Retry clears it once the view comes", async () => {
    const { server, store } = online();
    server.answer("GET /api/view", viewed(3));
    await store.getState().refresh();
    server.answer("POST /api/command", DIVERGED);
    server.answer("GET /api/view", DIVERGED);
    await store.getState().endMonth();
    render(
      <GameProvider store={store}>
        <Rejection />
      </GameProvider>,
    );
    const sheet = screen.getByRole("alert");
    expect(sheet.textContent).toContain(WORDS);
    expect(sheet.textContent).not.toContain("mended");
    expect(screen.queryByRole("button", { name: say("ui.dismiss") })).toBeNull();
    server.answer("GET /api/view", viewed(3));
    fireEvent.click(screen.getByRole("button", { name: say("ui.trouble.retry") }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(store.getState().failed).toBeNull();
  });

  test("[R-SERVER-003] given any other rejection, then the sheet keeps its detail and its Close, and offers no Retry", async () => {
    const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.resolve({ ok: false, code: "not-legal", detail: "Not now." }) });
    await store.getState().refresh();
    await store.getState().endMonth();
    render(
      <GameProvider store={store}>
        <Rejection />
      </GameProvider>,
    );
    expect(screen.getByRole("alert").textContent).toContain("Not now.");
    expect(screen.queryByRole("button", { name: say("ui.trouble.retry") })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.dismiss") }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("[R-SERVER-003] given the life refused as diverged as it opens, then the sheet stands in the loading screen's place with no failure line, and Retry opens the life once the server answers", async () => {
    const { server, store } = online();
    server.answer("GET /api/view", DIVERGED, DIVERGED, viewed(4));
    render(<App store={store} />);
    const sheet = await screen.findByRole("alert");
    expect(sheet.textContent).toContain(WORDS);
    expect(document.body.textContent).not.toContain(say("ui.failed", { why: "" }).trim());
    expect(screen.queryByText(say("ui.loading"))).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.trouble.retry") }));
    await waitFor(() => expect(server.sent.filter((request) => request.method === "GET" && request.path === "/api/view")).toHaveLength(2));
    expect(screen.getByRole("alert").textContent).toContain(WORDS);
    fireEvent.click(screen.getByRole("button", { name: say("ui.trouble.retry") }));
    await waitFor(() => expect(store.getState().view?.v).toBe(4));
    expect(document.querySelector('[data-rejection="diverged"]')).toBeNull();
  });
});
