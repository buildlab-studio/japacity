// The first pointer and the nudge (docs/rules/world.md R-WORLD-027, R-WORLD-003):
// pointer 1 sat over the nudge "Find a job on the board", and nothing said how to go on.
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { cardPlace, WALK_KEY, WALK_STEPS } from "../../shared/world/Walkthrough";
import { City } from "./City";
import { cityWords } from "./city.words";

describe("the walkthrough's pointers", () => {
  test("[R-WORLD-027] given the band at the top and its nudge under it, when the first pointer's card is placed, then it stands below the nudge and points up from there", () => {
    // A 390 by 844 phone: the band's row ends at 62, the nudge under it at 104.
    const placed = cardPlace({ x: 195, top: 10, bottom: 62 }, 104, 390, 844);
    expect(placed.below).toBe(true);
    expect("top" in placed.place ? placed.place.top : 0).toBeGreaterThan(104);
    // With no nudge showing, it stands under the band itself.
    const bare = cardPlace({ x: 195, top: 10, bottom: 62 }, null, 390, 844);
    expect("top" in bare.place ? bare.place.top : 0).toBeLessThan(104);
    // A thing at the bottom keeps its card above it, whatever the nudge.
    expect(cardPlace({ x: 340, top: 760, bottom: 830 }, 104, 390, 844).below).toBe(false);
  });

  test("[R-WORLD-027] given the walkthrough on a new device, when each pointer shows, then its card says to tap to go on", async () => {
    localStorage.removeItem(WALK_KEY);
    await renderWithView(<City world month={<p />} results={() => <p />} />, engineView());
    fireEvent.click(screen.getByRole("button", { name: say("ui.opening.go") }));
    const mapClose = screen.queryByRole("button", { name: cityWords("city.close") });
    if (mapClose !== null) fireEvent.click(mapClose);
    for (let step = 0; step < WALK_STEPS.length; step += 1) {
      const shown = document.querySelector<HTMLElement>("[data-walkthrough]");
      expect(shown?.querySelector("[data-walk-on]")?.textContent).toBe("Tap to go on");
      if (shown !== null) fireEvent.click(shown);
    }
  });
});
