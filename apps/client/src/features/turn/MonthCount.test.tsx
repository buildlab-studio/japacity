// The months the player may still play (docs/rules/world.md R-WORLD-027): a glyph with the number,
// the words at a tap, and never "turn" or "banked".
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { uiText } from "../../shared/words/ui";
import { say } from "../../shared/words/text";
import { countWords, MonthCount } from "./MonthCount";

const MINUTE = 60_000;

function withBank(banked: number): PlayerView {
  const view = engineView("scenario.tunde");
  return { ...view, turns: { ...view.turns, banked } };
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

  test("[R-WORLD-027] [R-TURN-002] given the bank at its most, when the count is tapped, then it says it is full and a new chapter fills it again", async () => {
    await renderWithView(<MonthCount />, withBank(content.tuning.turn.cap));
    fireEvent.click(count());
    expect(screen.getByText("Full: 24 months. A new chapter fills them again.")).toBeTruthy();
    fireEvent.click(count());
    expect(document.querySelector("[data-month-count-words]")).toBeNull();
  });

  test("[R-WORLD-027] [R-TURN-003] given 12 months to play and the server's clock, when the count is tapped, then it says how many and when the next one comes", async () => {
    const { store } = await renderWithView(<MonthCount />, withBank(12));
    // Half a minute over, so the words read the same however long the render takes.
    act(() => store.setState({ clock: { tick: 1, nextTickAt: 0, nextTurnAt: Date.now() + 100 * MINUTE + 30_000 } }));
    fireEvent.click(count());
    expect(document.querySelector("[data-month-count-words]")?.textContent).toBe("You can play 12 more months. Next one in 1h 40m.");
  });

  test("[R-WORLD-027] given the local authority, which reports no clock, then the words say only the count", () => {
    expect(countWords(1, 24, null, 0)).toBe("You can play 1 more month.");
    expect(countWords(0, 24, undefined, 0)).toBe(say("ui.months.more.zero"));
  });

  test("[R-WORLD-027] given the interface's words, then the player never reads turn or banked", () => {
    // The braces are the code's names for what fills them, never read.
    const told = Object.entries(uiText).map(([key, value]) => [key, value.replace(/\{[^}]*\}/g, "")] as const).filter(([, value]) => /\b(turns?|banked)\b/i.test(value));
    // "turn it on", "turns you down" and the like are the verb, not the month.
    expect(told.filter(([, value]) => !/\bturn (this|it) (on|off)\b|\bturns? (down|to|on)\b/i.test(value)).map(([key]) => key)).toEqual([]);
  });
});
