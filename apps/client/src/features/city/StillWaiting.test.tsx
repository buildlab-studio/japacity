// An ask answered at its place lists what still waits (docs/rules/world.md R-WORLD-006): once the send-off is answered at the house, the sheet names the ask still open
// and one button opens it, so it never says nobody is asking while the nudge says someone is.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { newGame, openOffer } from "../../shared/testing/fixtures";
import { nameOf, say } from "../../shared/words/text";
import { cityWords } from "./city.words";
import { stillWaiting, StillWaiting } from "./StillWaiting";

describe("what still waits", () => {
  test("[R-WORLD-006] given the send-off answered at the house and the NEPA bill still asking, when the sheet shows, then it names the bill and one button opens the asks", () => {
    // The send-off is answered, so it has left the offers; the NEPA bill is still asking.
    const game = newGame("scenario.ada");
    openOffer(game, "offer.nepa-bill");
    const view = game.view();
    const left = stillWaiting(view.offers, ["offer.family-send-off"]);
    expect(left.map((offer) => offer.entry)).toEqual(["offer.nepa-bill"]);
    const open = vi.fn();
    render(<StillWaiting offers={left} onOpen={open} />);
    const shown = document.querySelector<HTMLElement>("[data-still-waiting]");
    expect(shown?.textContent).toContain(nameOf("offer.nepa-bill"));
    expect(shown?.textContent).not.toContain(say("ui.offer.none"));
    fireEvent.click(screen.getByRole("button", { name: cityWords("city.asks.see") }));
    expect(open).toHaveBeenCalledOnce();
  });

  test("[R-WORLD-006] given nothing else asking, when the sheet shows, then no list stands, and the empty line does not claim nobody asks anywhere", () => {
    expect(stillWaiting([], ["offer.family-send-off"])).toEqual([]);
    const { container } = render(<StillWaiting offers={[]} onOpen={() => undefined} />);
    expect(container.textContent).toBe("");
    expect(say("ui.offer.none")).not.toMatch(/nobody/i);
  });
});
