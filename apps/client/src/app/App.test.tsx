import { content } from "@japacity/content";
import { act, screen, waitFor } from "@testing-library/react";
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "./App";
import { bootGame } from "../authority/boot";
import { askReadyLives, startReadyLife } from "../shared/front-door/frontDoor.testing";
import { turnWords } from "../features/turn/turn.words";
import { monthEnding, playerMonth } from "../shared/words/format";
import { say } from "../shared/words/text";
// Registers Testing Library's cleanup for this file.
import "../shared/testing/render";
import { SAVE_KEY } from "../shared/storage/storage";
import { memoryStorage } from "../shared/testing/storage";

describe("the app", () => {
  test("given no save, when a life is picked and a month ended, then the results of month 1 open over the world", async () => {
    // Through the front door to the first ready life, on a run Settings asked for (prologue:front-door-three-screens).
    askReadyLives();
    const store = bootGame({ storage: memoryStorage(), fastClock: true });
    render(<App store={store} />);
    // Settings' run opens on the ready lives themselves.
    expect(screen.getByRole("heading", { name: say("ui.door.ready.title") })).toBeDefined();

    await startReadyLife(Object.keys(content.scenario)[0]!);
    // The world opens on month 1 (world:world-fills-the-screen): the band, and no month number on it (world:top-band-is-a-pill).
    await waitFor(() => expect(document.querySelector("[data-band] [data-band-month]")).not.toBeNull(), { timeout: 10_000 });
    expect(playerMonth(store.getState().view?.month ?? -1)).toBe(1);
    // With no route yet the band shows no japacity label and no placeholder beside it.
    const band = document.querySelector("[data-band]")!;
    expect(band.textContent).not.toContain("--");
    expect(document.querySelector("[data-japacity-figure]")).toBeNull();
    expect([...band.querySelectorAll("span")].filter((span) => span.textContent.includes(say("ui.japacity.title")))).toEqual([]);

    // The month ends as the bed's sleep runs out (world:sleep-ends-the-month), the store's own End month; the results of month 1 open over the world.
    await act(() => store.getState().endMonth());
    expect(await screen.findByRole("dialog", { name: turnWords("turn.results.title") }, { timeout: 10_000 })).toBeDefined();
    expect(document.querySelector("[data-world-sheet='results']")).not.toBeNull();
    // The report is month 1's.
    expect(monthEnding(store.getState().view?.report?.month ?? -1)).toBe(1);
  });

  test("given a save for older content, then the life chooser says the save could not come along", () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ save: { schema: 1, content: "0", scenario: "scenario.graduate", seed: "a", worldSeed: "b", commands: [] }, clock: { anchor: 0 } }));
    const store = bootGame({ storage, fastClock: true });
    render(<App store={store} />);
    // The sound notice at the app root is a status region too; the chooser's is the one without the notice mark.
    const notices = screen.getAllByRole("status").filter((element) => element.dataset["soundNotice"] === undefined);
    expect(notices).toHaveLength(1);
    expect(notices[0]?.textContent).toBe(say("ui.life.notice.other-content"));
  });
});
