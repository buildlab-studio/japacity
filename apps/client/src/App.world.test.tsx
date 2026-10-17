import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { content } from "@japacity/content";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { App } from "./App";
import { bootGame } from "./authority/boot";
import { askReadyLives, startReadyLife } from "./shared/frontdoor/frontDoor.testing";
import { say } from "./shared/words/text";
// Registers Testing Library's cleanup for this file.
import "./shared/testing/render";

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

async function startLife(): Promise<void> {
  // Through the front door to the first ready life, on a run Settings asked for (R-PROLOGUE-013).
  askReadyLives();
  render(<App store={bootGame({ storage: memoryStorage(), fastClock: true })} />);
  await startReadyLife(Object.keys(content.scenario)[0]!);
}

afterEach(() => {
  history.replaceState(null, "", "/");
});

describe("the world is the game", () => {
  test("[R-WORLD-001] given a life picked at the default address, when it starts, then the world opens with the band and the two thumb buttons, and no header, tabs or month page", async () => {
    history.replaceState(null, "", "/");
    await startLife();
    // The first chapter's brief is handed as a mission card by a person at the hub (R-CHAPTER-011 as the hand redraws it).
    await waitFor(() => expect(document.querySelector("[data-brief]")).not.toBeNull());
    expect(screen.getByRole("button", { name: say("ui.brief.go") })).toBeTruthy();
    await waitFor(() => expect(document.querySelector("[data-band] [data-band-month]")).not.toBeNull());
    expect(screen.queryByRole("button", { name: say("ui.world.end-month") })).toBeNull();
    expect(document.querySelector("[data-band]")).not.toBeNull();
    expect(document.querySelector("[data-thumb='map']")).not.toBeNull();
    expect(document.querySelector("[data-thumb='phone']")).not.toBeNull();
    expect(document.querySelector("header, [data-tab], [data-where]")).toBeNull();
    expect(screen.queryByRole("heading", { name: say("ui.month.planning", { month: 1 }) })).toBeNull();
  });

  test("[R-CITY-021] given a life played on this device with no account, when the phone's Settings is opened, then the Credits row stands under its own heading, About the game, below the account and the ready lives, and opens the credits sheet", async () => {
    history.replaceState(null, "", "/");
    await startLife();
    fireEvent.click(await waitFor(() => document.querySelector<HTMLElement>("[data-thumb='phone']")!));
    fireEvent.click(await waitFor(() => document.querySelector<HTMLElement>('[data-app="settings"]')!));
    const row = await waitFor(() => document.querySelector<HTMLElement>("[data-credits-row]")!);
    expect(document.querySelector("[data-about] [data-credits-row]")).toBe(row);
    expect(document.querySelector("[data-about]")?.previousElementSibling?.textContent).toBe("About the game");
    expect(document.querySelector("[data-account] [data-credits-row]")).toBeNull();
    fireEvent.click(row);
    expect(await screen.findByRole("dialog", { name: "Credits" })).toBeTruthy();
  });

  test("[R-WORLD-024] given ?classic, when a life starts, then the world opens as at any address, with no month page", async () => {
    history.replaceState(null, "", "/?classic");
    await startLife();
    await waitFor(() => expect(document.querySelector("[data-band] [data-band-month]")).not.toBeNull(), { timeout: 10_000 });
    expect(document.querySelector("header, [data-tab], [data-where]")).toBeNull();
    expect(screen.queryByRole("heading", { name: say("ui.month.planning", { month: 1 }) })).toBeNull();
  });

  test("[R-WORLD-024] given the shell's code, then nothing asks for a month page, and no month page module, bar or head exists", () => {
    const app = readFileSync(join(import.meta.dirname, "App.tsx"), "utf8");
    expect(app).not.toMatch(/classic/i);
    expect(app).not.toContain("./Classic");
    for (const gone of ["Classic.tsx", "features/turn/TurnBar.tsx", "features/turn/TurnView.tsx", "features/turn/Moment.tsx", "features/city/Phone.tsx"]) {
      expect(existsSync(join(import.meta.dirname, gone))).toBe(false);
    }
  });
});
