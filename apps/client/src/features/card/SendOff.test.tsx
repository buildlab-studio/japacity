import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { recordedGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nameOf, say } from "../../shared/words/text";
import { CardView } from "./ShareCard";

describe("the send-off card from the engine", () => {
  test("[R-CHAPTER-006] given the month chapter 4 closes, then the card carries the route, the figure, the months, the standing and what was done most, and says it is a game", async () => {
    const game = recordedGame("ada-careful");
    game.endTurn();
    const view = game.view();
    const card = view.card!;
    expect(card.kind).toBe("send-off");
    await renderWithView(<CardView />, view);
    const face = (await screen.findByRole("dialog")).querySelector("[data-share-card='send-off']") as HTMLElement;
    expect(within(face).getByText(nameOf(card.route!))).toBeDefined();
    expect(face.textContent).toContain(`${String(card.percent)}%`);
    expect(within(face).getByText(String(card.months))).toBeDefined();
    expect(within(face).getByText(String(card.standing))).toBeDefined();
    for (const id of card.topActivities.slice(0, 3)) expect(within(face).getByText(nameOf(id))).toBeDefined();
    expect(within(face).getByText(say("ui.card.is-a-game"))).toBeDefined();
  });

  test("[R-CHAPTER-006] given the month's report still open, then the card waits for it to close", async () => {
    const game = recordedGame("ada-careful");
    game.endTurn();
    const { store } = await renderWithView(<CardView />, game.view());
    await screen.findByRole("dialog");
    store.getState().setReportOpen(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    store.getState().setReportOpen(false);
    expect(await screen.findByRole("dialog")).toBeDefined();
  });
});
