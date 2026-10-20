// The month the settlement is cleared (home:makoko-eviction-draw), in the News app: the line
// leads the month's lines as money unpaid does, and the story of the clearing is carried with it.
import { content } from "@japacity/content";
import { applyOverlay } from "@japacity/sim";
import { setPockets, start } from "@japacity/sim/testing";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { newGame } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { words } from "../../../shared/words/text";
import { PhoneApps } from "../PhoneApps";
import { reloadSeen } from "../seen";

beforeEach(() => {
  localStorage.clear();
  reloadSeen();
});

async function openNews(view: Parameters<typeof renderWithView>[1]): Promise<void> {
  await renderWithView(<PhoneApps onClose={() => undefined} area="Makoko" now={() => new Date(2026, 9, 9, 12, 5)} talk={null} />, view);
  fireEvent.click(document.querySelector<HTMLElement>('[data-app="news"]')!);
}

describe("News the month of the clearing", () => {
  test("[home:makoko-eviction-draw] given Ada evicted from Makoko this month, when News opens, then the eviction leads the month's lines and the story of the clearing is there", async () => {
    const game = start({ content: applyOverlay(content, { version: "test-news-evicted", tuning: { home: { evictionBp: 10000 } } }), scenario: "scenario.graduate" });
    setPockets(game, { NGN: 500_000_00 });
    game.accept({ type: "home/move", to: "place.makoko" });
    game.endTurn();
    await openNews(game.view());
    const first = document.querySelector<HTMLElement>("[data-report] li");
    // Her cash is all in the bank, so none went with the room and none is named.
    expect(first?.textContent).toBe(words("line.home.evicted-no-cash"));
    const story = document.querySelector<HTMLElement>('[data-story="news.makoko-cleared"]');
    expect(story?.textContent).toContain(words("news.makoko-cleared.in-force.head"));
  });

  test("[home:makoko-eviction-draw] given a month with no clearing, when News opens, then no story of one is told", async () => {
    const game = newGame();
    game.endTurn();
    await openNews(game.view());
    expect(document.querySelector('[data-story="news.makoko-cleared"]')).toBeNull();
  });
});
