// The page as the handover waits for the player (prologue.md R-PROLOGUE-014): the family turns over, no stamp lands, and the world opens only when Go is tapped, or the page; never on a
// timer, since ten facts are not read in three seconds.
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { keepPerson } from "../../authority/person";
import { engineView, newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { PageHandover, PrologueView, TURN_MS } from "./PrologueView";

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("the page as the handover", () => {
  test("[R-PROLOGUE-014] given the page after Begin, when a minute passes with no tap, then the family has turned, no stamp has landed and the world has not opened; Go opens it once", async () => {
    const done = vi.fn();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderWithView(<PageHandover onDone={done} />, engineView());
    act(() => {
      vi.advanceTimersByTime(TURN_MS + 60_000);
    });
    // The family has turned over and no stamp has landed: the page takes none before a visa (R-PROLOGUE-009, 014, amended).
    expect(document.querySelector("[data-family]")).not.toBeNull();
    expect(document.querySelector("[data-page] [data-stamp]")).toBeNull();
    expect(done).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: say("ui.prologue.start") }));
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe("the page while the years go by", () => {
  test("[R-PROLOGUE-014] given a tile's life whose years are going by, then the page keeps its size and docks at the foot, just above the sheet, never at the top over the figure's face", async () => {
    keepPerson({ look: "chr_ada", name: "Ada", archetype: "developer" });
    await renderWithView(<PrologueView />, newGame("scenario.prologue").view());
    expect(document.querySelector("[data-page-running]")).not.toBeNull();
    const page = document.querySelector("[data-page]");
    const sheet = document.querySelector('[data-gate-sheet="years"]');
    expect(page).not.toBeNull();
    // At the foot of the screen, with the sheet, and nothing over the top of the scene.
    expect(page?.closest("[data-gate-foot]")).not.toBeNull();
    expect(document.querySelector("[data-gate-over]")).toBeNull();
    // Just above the sheet: the docked page is the sheet's elder sibling.
    expect(page?.closest("[data-page-docked]")?.nextElementSibling).toBe(sheet);
    // The sheet under it is held to about a third of the screen, so the page never climbs over the figure's head.
    expect(sheet?.className).toContain("max-h-[34dvh]");
  });

  test("[R-PROLOGUE-014] given the handover, then the page stands at the top under the header as before", async () => {
    await renderWithView(<PageHandover onDone={() => undefined} />, engineView());
    expect(document.querySelector("[data-gate-over] [data-page]")).not.toBeNull();
    expect(document.querySelector("[data-page-docked]")).toBeNull();
  });
});
