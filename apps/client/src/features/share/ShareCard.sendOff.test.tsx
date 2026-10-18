import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { playedWords, standingWords } from "../../shared/share/face";
import { recordedGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nameOf, say } from "../../shared/words/text";
import { CardView } from "./ShareCard";

describe("the send-off card from the engine", () => {
  test("[chapter:send-off-card-on-close] [share:send-off-card-kept] given Ada's recorded life just flown, when its tile is opened, then the card carries the route, the figure, the months, the standing and what was done most, and says it is a game", async () => {
    const view = recordedGame("ada-careful").view();
    const card = view.card!;
    expect(card.kind).toBe("send-off");
    await renderWithView(<CardView />, view);
    // share:send-off-card-kept: the send-off is no screen of its own; it opens from the tile where the phone keeps it.
    fireEvent.click(await screen.findByRole("button", { name: say("ui.card.open") }));
    const face = (await screen.findByRole("dialog")).querySelector("[data-share-card='send-off']") as HTMLElement;
    expect(within(face).getByText(nameOf(card.route!))).toBeDefined();
    expect(face.textContent).toContain(`${String(card.percent)}%`);
    expect(within(face).getByText(playedWords(card.months))).toBeDefined();
    expect(within(face).getByText(standingWords(card.standing))).toBeDefined();
    for (const id of card.topActivities.slice(0, 3)) expect(within(face).getByText(nameOf(id))).toBeDefined();
    expect(within(face).getByText(say("ui.card.is-a-game"))).toBeDefined();
  });

  test("[chapter:send-off-card-on-close] [share:send-off-card-kept] given Ada just flown and her card opened from its tile, when a report opens, then the card waits for it to close", async () => {
    const { store } = await renderWithView(<CardView />, recordedGame("ada-careful").view());
    // share:send-off-card-kept: the send-off is no screen of its own; it opens from the tile where the phone keeps it.
    fireEvent.click(await screen.findByRole("button", { name: say("ui.card.open") }));
    await screen.findByRole("dialog");
    store.getState().setReportOpen(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    store.getState().setReportOpen(false);
    expect(await screen.findByRole("dialog")).toBeDefined();
  });

  test("[chapter:send-off-card-on-close] given the card shown from the flight, when the first month abroad ends, then the card and its tile are gone", async () => {
    const game = recordedGame("ada-careful");
    expect(game.view().card?.kind).toBe("send-off");
    game.endTurn();
    const view = game.view();
    expect(view.card).toBeNull();
    await renderWithView(<CardView />, view);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("[data-card-tile]")).toBeNull();
  });
});
