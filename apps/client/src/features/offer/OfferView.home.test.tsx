// The taken-in offer after the settlement is cleared (home:taken-in-after-eviction): three
// answers, and `friend` shut with its reason when no joined player has a place in Lagos.
import { content } from "@japacity/content";
import { applyOverlay } from "@japacity/sim";
import { setPockets, start } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { renderWithView } from "../../shared/testing/render";
import { words } from "../../shared/words/text";
import { OfferView } from "./OfferView";

function evictedView() {
  const game = start({ content: applyOverlay(content, { version: "test-offer-evicted", tuning: { home: { evictionBp: 10000 } } }), scenario: "scenario.graduate" });
  setPockets(game, { NGN: 500_000_00 });
  game.accept({ type: "home/move", to: "place.makoko" });
  game.endTurn();
  return game.view();
}

describe("somewhere to sleep", () => {
  test("[home:taken-in-after-eviction] given Ada evicted with no friend at home, when the offer shows, then its three answers are there, friend shut with its reason beneath it and the other two open", async () => {
    await renderWithView(<OfferView />, evictedView());
    const buttons = [...document.querySelectorAll<HTMLButtonElement>("button")].filter((button) => ["friend", "someone", "family"].some((id) => button.textContent?.startsWith(words(`offer.taken-in.choice.${id}`, { months: content.tuning.home.guestMonths }).slice(0, 12)) === true));
    expect(buttons.map((button) => button.disabled)).toEqual([true, false, false]);
    const reason = document.querySelector<HTMLElement>('[data-choice-shut="friend"]');
    expect(reason?.textContent).toBe(words("offer.taken-in.choice.friend.shut"));
    expect(document.querySelectorAll("[data-choice-shut]")).toHaveLength(1);
  });
});
