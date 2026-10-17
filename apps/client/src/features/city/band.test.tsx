// The place's name on the band (docs/rules/world.md R-WORLD-002): the band
// starts the name with a capital, "The clinic", while a sentence keeps content's casing.
import { content } from "@japacity/content";
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { City } from "./City";
import { cityWords } from "./city.words";

const CLINIC = "place.tb-clinic";

async function standingAt(place: string, extra: Partial<Parameters<typeof City>[0]> = {}): Promise<HTMLElement> {
  localStorage.setItem("japacity.city.last", JSON.stringify([place]));
  await renderWithView(<City world results={(at) => <p data-results-for={at} />} {...extra} />, { ...richView(), setpiece: null, interview: null });
  const go = document.querySelector<HTMLElement>("[data-opening-go]");
  if (go !== null) fireEvent.click(go);
  const mapClose = screen.queryByRole("button", { name: cityWords("city.close") });
  if (mapClose !== null) fireEvent.click(mapClose);
  const band = document.querySelector<HTMLElement>("[data-band]");
  if (band === null) throw new Error("No band");
  return band;
}

describe("the place's name on the band", () => {
  test("[R-WORLD-002] given the player at the clinic, whose name content gives as \"the clinic\", when the band shows, then it reads \"The clinic\"", async () => {
    expect(content.place[CLINIC as keyof typeof content.place]).toBeDefined();
    const band = await standingAt(CLINIC);
    expect(band.querySelector("h2")?.textContent).toBe("The clinic");
  });

  test("[R-WORLD-002] [R-WORLD-006] given the player at the clinic and an ask that belongs at the visa centre, when the asks open, then the sentence keeps \"the visa centre\" in content's casing", async () => {
    await standingAt(CLINIC, { asks: [<p key="a">the send-off</p>], asksAt: ["place.visa-centre"] });
    fireEvent.click(screen.getByRole("button", { name: say("ui.nudge.offer") }));
    const sheet = screen.getByRole("dialog");
    // The journey, not the wait (text.md R-TEXT-007): someone asks for you there.
    expect(within(sheet).getByText("Someone is asking for you at the visa centre.")).toBeTruthy();
  });
});
