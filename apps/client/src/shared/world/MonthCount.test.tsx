// The months the player may still play (docs/rules/world.md R-WORLD-027): a glyph with the number,
// the words at a tap, and never "turn" or "banked".
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { engineView } from "../testing/fixtures";
import { renderWithView } from "../testing/render";
import { say } from "../words/text";
import { uiText } from "../words/ui";
import { countFacts, FLIP_MS, MonthCount } from "./MonthCount";

const MINUTE = 60_000;

function withBank(banked: number): PlayerView {
  const view = engineView("scenario.tunde");
  return { ...view, turns: { ...view.turns, banked } };
}

/** The facts the tap shows, in order, each its words. */
function facts(): string[] {
  return [...document.querySelectorAll<HTMLElement>("[data-month-count-words] [data-count-fact]")].map((fact) => fact.textContent);
}

function count(): HTMLElement {
  const found = document.querySelector<HTMLElement>("[data-month-count]");
  if (found === null) throw new Error("No count");
  return found;
}

describe("the months to play", () => {
  test("[R-WORLD-027] [R-TURN-001] given a new life, then the count shows the 24 months to play as a glyph with the number, and no sentence", async () => {
    const view = engineView("scenario.tunde");
    expect(view.turns.banked).toBe(content.tuning.turn.start);
    await renderWithView(<MonthCount />, view);
    expect(count().textContent).toBe(String(content.tuning.turn.start));
    expect(count().getAttribute("aria-label")).toBe(say("ui.months.label", { count: content.tuning.turn.start }));
    expect(document.querySelector("[data-month-glyph] svg")).not.toBeNull();
    expect(document.querySelector("[data-month-count-words]")).toBeNull();
  });

  test("[R-WORLD-027] given 3 months to play, then the count still shows, as the number alone", async () => {
    await renderWithView(<MonthCount />, withBank(3));
    expect(count().textContent).toBe("3");
  });

  test("[R-WORLD-027] [R-TURN-002] [R-TEXT-008] given the bank at its most, when the count is tapped, then it says it is full and a new chapter fills it again, as two facts", async () => {
    await renderWithView(<MonthCount />, withBank(content.tuning.turn.cap));
    fireEvent.click(count());
    expect(screen.getByText("Full: 24 pages")).toBeTruthy();
    expect(facts()).toEqual(["Full: 24 pages", "A new chapter fills it again"]);
    fireEvent.click(count());
    expect(document.querySelector("[data-month-count-words]")).toBeNull();
  });

  test("[R-WORLD-027] [R-TURN-003] [R-TEXT-008] given 12 months to play and the server's clock, when the count is tapped, then it says how many and when the next one comes, each a fact with its icon", async () => {
    const { store } = await renderWithView(<MonthCount />, withBank(12));
    // Half a minute over, so the words read the same however long the render takes.
    act(() => store.setState({ clock: { tick: 1, nextTickAt: 0, nextTurnAt: Date.now() + 100 * MINUTE + 30_000, morningAt: 0 } }));
    fireEvent.click(count());
    expect(facts()).toEqual(["12 pages left", "1 page = 1 month of your life", "Next page in 1h 40m"]);
    for (const fact of document.querySelectorAll("[data-count-fact]")) expect(fact.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  test("[R-WORLD-027] [R-TEXT-008] given the local authority, which reports no clock, then the facts say only the count and what a page is", () => {
    expect(countFacts(1, 24, null, 0).map((fact) => fact.words)).toEqual(["1 page left", "1 page = 1 month of your life"]);
    expect(countFacts(0, 24, undefined, 0).map((fact) => fact.words)).toEqual([say("ui.months.fact.none"), say("ui.months.fact.places"), say("ui.months.fact.phone"), say("ui.months.fact.plan")]);
  });

  test("[R-WORLD-027] given the count dropping by one as a page is turned, then the top page flips over on the glyph for a moment, and none flips otherwise", async () => {
    vi.useFakeTimers();
    try {
      const view = withBank(12);
      const { store } = await renderWithView(<MonthCount />, view);
      expect(document.querySelector("[data-month-flip]")).toBeNull();
      act(() => store.setState({ view: { ...view, turns: { ...view.turns, banked: 11 } } }));
      expect(document.querySelector("[data-month-flip]")).not.toBeNull();
      act(() => {
        vi.advanceTimersByTime(FLIP_MS + 1);
      });
      expect(document.querySelector("[data-month-flip]")).toBeNull();
      // A refill is no page turned.
      act(() => store.setState({ view: { ...view, turns: { ...view.turns, banked: 24 } } }));
      expect(document.querySelector("[data-month-flip]")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test("[R-WORLD-027] [R-TEXT-008] given no page left, then the glyph shows its bare backing card and the facts say none is left and what is still free", async () => {
    await renderWithView(<MonthCount />, withBank(0));
    const glyph = document.querySelector<HTMLElement>("[data-month-glyph]");
    expect(glyph?.textContent).toBe("0");
    expect(glyph?.querySelector("rect[opacity='0.3']")).not.toBeNull();
    fireEvent.click(count());
    expect(facts()).toEqual(["No pages left", "Places: free", "The phone: free", "The plan: free"]);
  });

  test("[R-WORLD-027] given the interface's words, then the player never reads turn or banked", () => {
    // The braces are the code's names for what fills them, never read.
    const told = Object.entries(uiText).map(([key, value]) => [key, value.replace(/\{[^}]*\}/g, "")] as const).filter(([, value]) => /\b(turns?|banked)\b/i.test(value));
    // "turn it on", "turns you down" and the like are the verb, not the month; so is turning the calendar's page (R-WORLD-027).
    expect(told.filter(([, value]) => !/\bturn (this|it) (on|off)\b|\bturns? (down|to|on)\b|\bturn (the page|one)\b/i.test(value)).map(([key]) => key)).toEqual([]);
  });
});
