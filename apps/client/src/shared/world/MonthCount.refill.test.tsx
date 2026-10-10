// The calendar full again between months, said on the band (docs/rules/world.md R-WORLD-027):
// the count's own words open by themselves when the pages come back to the most in the same month, and a chapter's
// refill, which comes with a new month and its card, opens nothing.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../testing/fixtures";
import { renderWithView } from "../testing/render";
import { MonthCount } from "./MonthCount";

const CAP = content.tuning.turn.cap;

function withBank(banked: number, month = 5): PlayerView {
  const view = engineView("scenario.tunde");
  return { ...view, month, turns: { ...view.turns, banked } };
}

function words(): string | null {
  return document.querySelector("[data-month-count-words]")?.textContent ?? null;
}

describe("the pages full again on the band", () => {
  test("[R-WORLD-027] given one page left, when the pages come back to the most in the same month, then the band says the pages are full again", async () => {
    const { store } = await renderWithView(<MonthCount />, withBank(1));
    expect(words()).toBeNull();
    act(() => store.setState({ view: withBank(CAP) }));
    expect(words()).toBe("Your pages are full again: 24 to play.");
  });

  test("[R-WORLD-027] given one page left, when a month ends and a chapter fills the calendar, then the band opens no words of its own", async () => {
    const { store } = await renderWithView(<MonthCount />, withBank(1));
    act(() => store.setState({ view: withBank(CAP, 6) }));
    expect(words()).toBeNull();
  });
});
