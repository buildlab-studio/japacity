import { readFileSync } from "node:fs";
import { join } from "node:path";

import { content } from "@japacity/content";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { App, classicAsked } from "./App";
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
    // The first chapter opens on its title over the world, never a card to pass (R-CHAPTER-010).
    await waitFor(() => expect(document.querySelector("[data-opening-title]")).not.toBeNull());
    expect(screen.queryByRole("button", { name: say("ui.opening.go") })).toBeNull();
    expect(await screen.findByRole("button", { name: say("ui.world.end-month") })).toBeTruthy();
    expect(document.querySelector("[data-band]")).not.toBeNull();
    expect(document.querySelector("[data-thumb='map']")).not.toBeNull();
    expect(document.querySelector("[data-thumb='phone']")).not.toBeNull();
    expect(document.querySelector("header, [data-tab], [data-where]")).toBeNull();
    expect(screen.queryByRole("heading", { name: say("ui.month.planning", { month: 1 }) })).toBeNull();
  });

  test("[R-WORLD-024] given ?classic, when a life starts, then the old month page opens with its header and tabs", async () => {
    history.replaceState(null, "", "/?classic");
    await startLife();
    expect(await screen.findByRole("heading", { name: say("ui.month.planning", { month: 1 }) }, { timeout: 10_000 })).toBeTruthy();
    expect(document.querySelector("header")).not.toBeNull();
    expect(document.querySelector("[data-tab='month']")).not.toBeNull();
    expect(document.querySelector("[data-band]")).toBeNull();
  });

  test("[R-WORLD-024] given the address, then only ?classic asks for the old page, and the old page is loaded only when asked for", () => {
    expect(classicAsked("?classic")).toBe(true);
    expect(classicAsked("?classic=1&x=2")).toBe(true);
    expect(classicAsked("")).toBe(false);
    expect(classicAsked("?world")).toBe(false);
    const app = readFileSync(join(import.meta.dirname, "App.tsx"), "utf8");
    expect(app).toContain('lazy(() => import("./Classic"))');
    expect(app).not.toMatch(/^import [^;]* from "\.\/Classic";/m);
    expect(app).not.toContain('from "./features/turn/TurnView"');
  });
});
