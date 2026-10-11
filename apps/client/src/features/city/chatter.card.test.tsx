// No street talk over a share card (docs/rules/world.md R-WORLD-026, R-WORLD-001): "Take a screenshot to share it." ran into the chatter's bubble on a chapter's card.
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { City } from "./City";
import { cityWords } from "./city.words";

const CARD = { kind: "chapter" as const, chapter: "chapter.find-your-feet" as const, route: null, percent: 6, months: 5, standing: 50, topActivities: [], name: null };

function chatter(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-chatter]");
}

describe("street talk and a share card", () => {
  test("[R-WORLD-026] given the chatter standing in its corner, when a chapter's card comes up over the world, then the chatter hides until the card is closed", async () => {
    const view = engineView();
    const { store } = await renderWithView(<City world results={() => <p />} />, view);
    const go = document.querySelector<HTMLElement>("[data-opening-go]");
    if (go !== null) fireEvent.click(go);
    const mapClose = screen.queryByRole("button", { name: cityWords("city.close") });
    if (mapClose !== null) fireEvent.click(mapClose);
    expect(chatter()).not.toBeNull();
    act(() => {
      store.setState({ view: { ...view, card: CARD } });
    });
    expect(chatter()).toBeNull();
    act(() => {
      store.getState().closeCard(`${CARD.kind}-${String(CARD.months)}`);
    });
    expect(chatter()).not.toBeNull();
  });
});
