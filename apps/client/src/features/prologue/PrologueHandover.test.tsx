// The page as the handover waits for the player (prologue.md R-PROLOGUE-014): the family turns over, no stamp lands, and the world opens only when Go is tapped, or the page; never on a
// timer, since ten facts are not read in three seconds.
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { keepPerson } from "../../authority/person";
import { engineView, newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { opensChips } from "../../shared/frontdoor/archetypes";
import { say, words } from "../../shared/words/text";
import { PageHandover, PROLOGUE_CLOSED, PrologueView, TURN_MS } from "./PrologueView";

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
  test("[R-PROLOGUE-014] given a tile's life whose years are going by, then the page stands at the top of the door's sky under its heading, with you cheering beside it and nothing over it, the years the tile will pass listed not yet lived, and no money or japacity figure printed before the handover (the door's second design; the docking of 11 Oct 2026 was over the figure, now a sticker beside the page)", async () => {
    keepPerson({ look: "chr_ada", name: "Ada", archetype: "developer" });
    await renderWithView(<PrologueView />, newGame("scenario.prologue").view());
    expect(document.querySelector("[data-page-running]")).not.toBeNull();
    const page = document.querySelector("[data-page]");
    expect(page?.closest("[data-gate='years'] [data-door-body]")).not.toBeNull();
    expect(document.querySelector("[data-gate='years'] h1")?.textContent).toBe(say("prologue.door.page.title"));
    // No scene, no sheet over the page: the figure is a still cheering beside it.
    expect(document.querySelector("canvas, [data-front-scene], [data-page-docked]")).toBeNull();
    expect(document.querySelector("[data-figure]")?.getAttribute("data-figure")).toBe("chr_ada");
    // The developer's years, each not yet lived until the trail says so.
    const chips = [...document.querySelectorAll<HTMLElement>("[data-years] [data-fact]")];
    expect(chips.map((chip) => chip.dataset["fact"])).toEqual(expect.arrayContaining(["waec", "exam", "university", "service"]));
    expect(chips.filter((chip) => chip.dataset["state"] === "waiting").length).toBeGreaterThan(0);
    expect(document.querySelector("[data-stat]")).toBeNull();
  });

  test("[R-PROLOGUE-014] given the handover, then the page stands at the top under its heading as before, with the money and japacity printed", async () => {
    await renderWithView(<PageHandover onDone={() => undefined} />, engineView());
    expect(document.querySelector("[data-gate='handover'] [data-door-body] [data-page]")).not.toBeNull();
    // A fixed life with no name of its own is headed by the prologue's closing line; a named one by "Your page, printed".
    expect(document.querySelector("[data-gate='handover'] h1")?.textContent).toBe(words(PROLOGUE_CLOSED));
    expect(document.querySelector("[data-page-docked]")).toBeNull();
    expect([...document.querySelectorAll("[data-stat]")].map((stat) => stat.getAttribute("data-stat"))).toEqual(["money", "ready"]);
  });

  test("[R-PROLOGUE-014] given a tile's life handed over, then the page is headed \"Your page, printed\" with the name, the life's thing is slapped on it, you cheer beside where you start, and where the life can lead stands as picture chips (the door's second design)", async () => {
    keepPerson({ look: "chr_tunde", name: "Bayo", archetype: "nurse" });
    await renderWithView(<PageHandover onDone={() => undefined} />, engineView());
    expect(document.querySelector("[data-gate='handover'] h1")?.textContent).toBe(say("ui.door.page.printed"));
    expect(screen.getByText(say("ui.door.page.over", { name: "Bayo" }))).not.toBeNull();
    expect(document.querySelector("[data-gate-sheet='handover'] [data-model]")?.getAttribute("data-model")).toBe("prop_xray-stand");
    expect(document.querySelector("[data-figure]")?.getAttribute("data-figure")).toBe("chr_tunde");
    expect([...document.querySelectorAll("[data-page-ways] [data-sticker-chip] [data-way]")].map((chip) => chip.textContent)).toEqual(opensChips("nurse"));
  });
});
