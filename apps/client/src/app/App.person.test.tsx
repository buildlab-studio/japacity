import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "./App";
import { createGameStore } from "../authority/store";
import { ActivityPicker } from "../features/activity/ActivityView";
import { gameAuthority } from "../shared/testing/fixtures";
import { courted, peopleGame, playMonth, renderWithGame, SEE, DELE } from "../shared/testing/person";
import { nameOf, words } from "../shared/words/text";
// Registers Testing Library's cleanup for this file.
import { found } from "../shared/testing/render";

async function playing(game: ReturnType<typeof peopleGame>) {
  if (game.state.turn.banked === 0) game.grant(1);
  const authority = gameAuthority(game);
  const store = createGameStore(authority);
  await store.getState().refresh();
  render(<App store={store} />);
  return { store, authority };
}

// The interview's hold on the month is the world bed's (app/world.interview.test.tsx).

describe("people in the shell", () => {
  test("[person:view-shows-people] given a life at home, when the phone's Chats opens its People row, then the people panel shows", async () => {
    const game = peopleGame();
    playMonth(game);
    await playing(game);
    // The world is the game (world:world-fills-the-screen): the people live in the phone's Chats (world:nobody-picked-from-list).
    fireEvent.click(await waitFor(() => found("[data-thumb='phone']"), { timeout: 10_000 }));
    fireEvent.click(await waitFor(() => found('[data-app="chats"]')));
    fireEvent.click(await waitFor(() => found('[data-chat-row="people"]')));
    const panel = await waitFor(() => found("[data-people-slots]"));
    expect(panel.querySelectorAll("[data-slot]").length).toBe(Object.keys(game.state.people.slots).length);
  });

  test("[person:time-together-is-an-act] given someone courted, when time with someone is chosen, then it is sent at once, nothing is planned, and the moment is told in words", async () => {
    const game = peopleGame();
    courted(game, DELE);
    // The visit is the chair's act in their room; its card is the one the shell hands the world for it (App.tsx `actions`).
    const { store } = await renderWithGame(<ActivityPicker only={[SEE.activity]} />, game);
    // activity:now-acts-and-month-acts: seeing someone is an act done at once, so the tap sends it and the moment is made now,
    // in the month in hand, with nothing planned; the moment is told in words among the act's own lines, which the
    // world's results show with the month's.
    fireEvent.click(await screen.findByRole("button", { name: `${nameOf(SEE.activity)}` }));
    await waitFor(() => expect(Object.values(game.state.people.bonds).find((held) => held.role === "partner")?.moments).toHaveLength(1));
    expect(store.getState().plan.some((pick) => pick?.activity === SEE.activity)).toBe(false);
    const moment = Object.values(game.state.people.bonds).find((held) => held.role === "partner")!.moments[0]!;
    const line = words("line.people.met", { who: DELE, spot: moment.spot ?? "", what: moment.what });
    const told = store.getState().lines.filter((said) => said.key === "line.people.met").map((said) => words(said.key, said.params));
    expect(told).toEqual([line]);
    expect(line).not.toMatch(/person\.dele|suya-spot|friends-wedding|bus-stop/);
  });
});
