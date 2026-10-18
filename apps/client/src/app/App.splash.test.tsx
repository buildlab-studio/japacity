// engine:browser-authority-for-dev-only (the splash and the fault card): the opening screen is the splash
// with "Opening your life..." under the game's name, and a fault takes the game's card dress, never red text: the line
// by its kind, a plain detail under it, Retry as the yellow pressed button and Reload as the quiet one.
import { act, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { App, SLOW_MS } from "./App";
import { keepPerson } from "../shared/frontdoor/person";
import { createGameStore } from "../authority/store";
import type { AccountApi } from "../shared/net/auth";
import { requestFailure } from "../shared/net/http";
import { Splash } from "../shared/ui/Splash";
import { say } from "../shared/words/text";
// Registers Testing Library's cleanup for this file.
import "../shared/testing/render";

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

const unused = () => Promise.reject(new Error("unused"));
const noPause = { wait: () => Promise.resolve() };

/** The words a player reads, with no status, code or stack in them. */
function plain(words: string | null | undefined): void {
  expect(words ?? "").not.toBe("");
  expect(words).not.toMatch(/\d{3}|error|exception|stack|undefined|null|failed to fetch|load failed/i);
}

/** Nothing on the screen is drawn in the refusal's red. */
function noRedText(): void {
  expect(document.querySelector(".text-bad")).toBeNull();
}

describe("the opening screen as the splash (engine:browser-authority-for-dev-only)", () => {
  test("[engine:browser-authority-for-dev-only] given a view that takes long, then the opening is the splash (the mark and the game's name, as index.html paints them) with Opening your life pulsing under the name, and Still opening as a second line after 5 seconds", async () => {
    vi.useFakeTimers();
    const store = createGameStore({ view: () => new Promise(() => undefined), send: unused });
    render(<App store={store} />);
    const splash = document.querySelector("[data-splash][data-opening]");
    expect(splash).not.toBeNull();
    // The page's own splash is this one's beginning: the same mark and name, then the words.
    const painted = renderToStaticMarkup(<Splash />).replace(/<\/div>$/, "");
    expect(splash?.outerHTML.replace(" data-opening=\"\"", "").startsWith(painted)).toBe(true);
    expect(splash?.querySelector(".splash-name")?.textContent).toBe(say("ui.game"));
    expect(splash?.querySelector(".splash-words")?.textContent).toBe(say("ui.loading"));
    await act(() => vi.advanceTimersByTimeAsync(SLOW_MS));
    expect(splash?.querySelector(".splash-more")?.textContent).toBe(say("ui.loading.slow"));
  });
});

describe("the opening's bar (engine:browser-authority-for-dev-only)", () => {
  test("[engine:browser-authority-for-dev-only] given a view that takes long, then a thin running bar stands right under Opening your life, with no known share, and Still opening comes under the bar so the bar never moves", async () => {
    vi.useFakeTimers();
    const store = createGameStore({ view: () => new Promise(() => undefined), send: unused });
    render(<App store={store} />);
    const bar = screen.getByRole("progressbar", { name: say("ui.loading") });
    expect(bar.closest("[data-splash][data-opening]")).not.toBeNull();
    expect(bar.dataset["loader"]).toBe("busy");
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(bar.previousElementSibling?.textContent).toBe(say("ui.loading"));
    expect(bar.nextElementSibling).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(SLOW_MS));
    expect(bar.nextElementSibling?.textContent).toBe(say("ui.loading.slow"));
    expect(document.querySelectorAll("[role='progressbar']")).toHaveLength(1);
  });
});

describe("the fault card (engine:browser-authority-for-dev-only)", () => {
  test("[engine:browser-authority-for-dev-only] given a kept life and a view the server never answers, then the card stands on the splash under the mark in the game's card dress: the line, a plain detail, Retry as the yellow pressed button, and no red text", async () => {
    keepPerson({ look: "person_ada", name: "Bayo", archetype: "developer" });
    const store = createGameStore({ view: () => Promise.reject(requestFailure("network", "no answer in 8000 ms")), send: unused }, { ...noPause, account: {} as AccountApi });
    render(<App store={store} />);
    const card = await screen.findByRole("alertdialog", { name: say("ui.trouble.network") });
    expect(card.closest("[data-splash]")?.querySelector(".splash-mark")).not.toBeNull();
    expect(card.querySelector(".lively-card")).not.toBeNull();
    const detail = card.querySelector("[data-trouble-detail]")?.textContent;
    plain(detail);
    expect(detail).toBe(say("ui.trouble.network.detail"));
    const retry = screen.getByRole("button", { name: say("ui.trouble.retry") });
    expect(retry.classList.contains("press-button")).toBe(true);
    expect(screen.queryByRole("button", { name: say("ui.trouble.reload") })).toBeNull();
    noRedText();
  });

  test("[engine:browser-authority-for-dev-only] [account:session-is-secure-cookie] given a login wall, then the card's two buttons are Retry, the yellow pressed one, first, and Reload, the quiet one, under it", async () => {
    const store = createGameStore({ view: () => Promise.reject(requestFailure("wall", "redirected (0)")), send: unused }, noPause);
    render(<App store={store} />);
    const card = await screen.findByRole("alertdialog", { name: say("ui.trouble.wall") });
    const buttons = [...card.querySelectorAll("button")];
    expect(buttons.map((button) => button.textContent)).toEqual([say("ui.trouble.retry"), say("ui.trouble.reload")]);
    expect(buttons[0]?.classList.contains("press-button")).toBe(true);
    expect(buttons[1]?.classList.contains("pill-button")).toBe(true);
    expect(buttons[1]?.classList.contains("press-button")).toBe(false);
    plain(card.querySelector("[data-trouble-detail]")?.textContent);
    noRedText();
  });

  test("[engine:browser-authority-for-dev-only] given each kind of trouble, then its detail is plain words of its own, never a status or a code", () => {
    const details = [...(["network", "wall", "server"] as const).map((kind) => say(`ui.trouble.${kind}.detail`)), say("ui.failed.detail")];
    for (const detail of details) plain(detail);
    expect(new Set(details).size).toBe(details.length);
  });

  test("[engine:browser-authority-for-dev-only] given a fault in the game itself, then The game could not start stands as the same card on the splash, with Reload as the yellow pressed button, never as red text", async () => {
    const store = createGameStore({ view: () => Promise.reject(new Error("boom")), send: unused }, noPause);
    render(<App store={store} />);
    const card = await screen.findByRole("alert");
    expect(card.closest("[data-splash]")).not.toBeNull();
    expect(card.classList.contains("lively-card")).toBe(true);
    expect(card.textContent).toContain(say("ui.failed", { why: say("ui.failed.why.server") }));
    expect(card.textContent).not.toContain("boom");
    const reload = screen.getByRole("button", { name: say("ui.trouble.reload") });
    expect(reload.classList.contains("press-button")).toBe(true);
    noRedText();
  });
});
