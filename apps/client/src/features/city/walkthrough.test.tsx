// The first-play walkthrough (docs/rules/world.md R-WORLD-027): after Go on the opening words, four
// pointers one at a time, the band, the phone, the map and the month's count; a tap moves on; once per device.
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { WALK_KEY, WALK_STEPS } from "../../shared/world/Walkthrough";
import { City } from "./City";
import { cityWords } from "./city.words";

const world = () => <City world month={<p>month</p>} results={(place) => <p data-results-for={place} />} />;

function pointer(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-walkthrough]");
}

/** Go on the opening words, and back from the map when Go took the step's way there. */
function go(): void {
  fireEvent.click(screen.getByRole("button", { name: say("ui.opening.go") }));
  const mapClose = screen.queryByRole("button", { name: cityWords("city.close") });
  if (mapClose !== null) fireEvent.click(mapClose);
}

describe("the first-play walkthrough", () => {
  test("[R-WORLD-027] given the first play of a life on a new device, when Go is tapped on the opening words, then four pointers show one at a time, the band, the phone, the map and the count, each with its line, and a tap moves on", async () => {
    localStorage.removeItem(WALK_KEY);
    await renderWithView(world(), engineView());
    // Never before play: the opening words stand alone.
    expect(pointer()).toBeNull();
    go();
    for (const step of WALK_STEPS) {
      const shown = pointer();
      expect(shown?.dataset["walkthrough"]).toBe(step.id);
      expect(document.querySelector(step.target)).not.toBeNull();
      expect(shown?.textContent).toContain(say(step.words));
      if (shown !== null) fireEvent.click(shown);
    }
    expect(pointer()).toBeNull();
    expect(say("ui.walk.band")).toBe("Your age, your money, the months you can play");
  });

  test("[R-WORLD-027] given the walkthrough seen on this device, when another life is played, then it never shows again", async () => {
    localStorage.removeItem(WALK_KEY);
    await renderWithView(world(), engineView());
    go();
    expect(pointer()).not.toBeNull();
    document.body.innerHTML = "";
    await renderWithView(world(), engineView("scenario.tunde"));
    go();
    expect(pointer()).toBeNull();
  });

  test("[R-WORLD-027] given a life with a month behind it, when the world opens, then no walkthrough shows", async () => {
    localStorage.removeItem(WALK_KEY);
    await renderWithView(world(), richView());
    expect(pointer()).toBeNull();
  });
});
