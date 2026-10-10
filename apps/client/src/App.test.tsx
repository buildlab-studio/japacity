import { content } from "@japacity/content";
import { fireEvent, screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "./App";
import { bootGame } from "./authority/boot";
import { SAVE_KEY } from "./authority/local";
import { askReadyLives, startReadyLife } from "./shared/frontdoor/frontDoor.testing";
import { say } from "./shared/words/text";
// Registers Testing Library's cleanup for this file.
import "./shared/testing/render";
import { onTheClassicPage } from "./shared/testing/classic";

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

// The old month page these tests drive opens only with ?classic (R-WORLD-024).
onTheClassicPage();

describe("the app", () => {
  test("given no save, when a life is picked and a month ended, then the report shows month 1", async () => {
    // Through the front door to the first ready life, on a run Settings asked for (R-PROLOGUE-013).
    askReadyLives();
    const store = bootGame({ storage: memoryStorage(), fastClock: true });
    render(<App store={store} />);
    expect(screen.getByRole("heading", { name: say("ui.life.title") })).toBeDefined();

    await startReadyLife(Object.keys(content.scenario)[0]!);
    expect(await screen.findByRole("heading", { name: say("ui.month.planning", { month: 1 }) }, { timeout: 10_000 })).toBeDefined();
    // With no route yet the header shows no japacity label and no placeholder beside it.
    const header = document.querySelector("header")!;
    expect(header.textContent).not.toContain("--");
    expect(header.querySelector("[data-japacity-figure]")).toBeNull();
    expect([...header.querySelectorAll("span")].filter((span) => span.textContent.includes(say("ui.japacity.title")))).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: say("ui.month.end") }));
    expect(await screen.findByRole("dialog", { name: say("ui.report.title", { month: 1 }) })).toBeDefined();
  });

  test("given a save for older content, then the life chooser says the save could not come along", () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ save: { schema: 1, content: "m0.0", scenario: "scenario.ada", seed: "a", worldSeed: "b", commands: [] }, clock: { anchor: 0 } }));
    const store = bootGame({ storage, fastClock: true });
    render(<App store={store} />);
    // The sound notice at the app root is a status region too; the chooser's is the one without the notice mark.
    const notices = screen.getAllByRole("status").filter((element) => element.dataset["soundNotice"] === undefined);
    expect(notices).toHaveLength(1);
    expect(notices[0]?.textContent).toBe(say("ui.life.notice.other-content"));
  });
});
