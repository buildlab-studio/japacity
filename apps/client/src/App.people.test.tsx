import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "./App";
import { createGameStore } from "./authority/store";
import { optionWords } from "./shared/sim/people";
import { gameAuthority } from "./shared/testing/fixtures";
import { courted, interviewGame, peopleGame, playMonth, SEE, TOBI } from "./shared/testing/people";
import { nameOf, say, words } from "./shared/words/text";
// Registers Testing Library's cleanup for this file.
import "./shared/testing/render";
import { onTheClassicPage } from "./shared/testing/classic";

async function playing(game: ReturnType<typeof peopleGame>) {
  if (game.state.turn.banked === 0) game.grant(1);
  const authority = gameAuthority(game);
  const store = createGameStore(authority);
  await store.getState().refresh();
  render(<App store={store} />);
  return { store, authority };
}

function endMonth(): HTMLElement {
  return screen.getByRole("button", { name: say("ui.month.end") });
}

// The old month page these tests drive opens only with ?classic (R-WORLD-024).
onTheClassicPage();

describe("people in the shell", () => {
  test("[R-PEOPLE-051] given a life at home, when the people tab is chosen, then the people panel shows", async () => {
    const game = peopleGame();
    playMonth(game);
    await playing(game);
    const nav = await screen.findByRole("navigation", { name: say("ui.tabs") });
    fireEvent.click(within(nav).getByRole("button", { name: say("ui.tab.people") }));
    const group = document.querySelector<HTMLElement>('[data-tab="people"]')!;
    expect(group.className).toContain("flex");
    expect(within(group).getByRole("heading", { name: say("ui.people.title") })).toBeDefined();
  });

  test("[R-INTERVIEW-004] given an interview open, then the month cannot end and the month tab is marked, until the last answer is in", async () => {
    const game = interviewGame();
    await playing(game);
    await screen.findByRole("region", { name: nameOf("interview.genuineness") });
    expect(endMonth().hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(words("reject.setpiece-open"))).toBeDefined();
    const nav = screen.getByRole("navigation", { name: say("ui.tabs") });
    expect(within(nav).getByRole("button", { name: say("ui.tab.month") }).querySelector(".bg-accent")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: optionWords("times-met", "four-to-eight") }));
    fireEvent.click(await screen.findByRole("button", { name: optionWords("partner-home", "city") }));
    await screen.findByText(say("ui.interview.waiting"));
    await waitFor(() => expect(endMonth().hasAttribute("disabled")).toBe(false));
  });

  test("[R-PEOPLE-014] given someone courted, when time with someone is chosen, then it is sent at once, nothing is planned, and the moment is told in words", async () => {
    const game = peopleGame();
    courted(game, TOBI);
    const { store } = await playing(game);
    // seeing someone is an act done at once, so the tap sends it and the moment is made now,
    // in the month in hand, with nothing planned; the moment is told in words among the act's own lines, which the
    // world's results show with the month's (the old page shows only the month's report).
    fireEvent.click(await screen.findByRole("button", { name: `${say("ui.activity.add")}: ${nameOf(SEE.activity)}` }));
    await waitFor(() => expect(Object.values(game.state.people.bonds).find((held) => held.role === "partner")?.moments).toHaveLength(1));
    expect(store.getState().plan.some((pick) => pick?.activity === SEE.activity)).toBe(false);
    const moment = Object.values(game.state.people.bonds).find((held) => held.role === "partner")!.moments[0]!;
    const line = words("line.people.met", { who: TOBI, spot: moment.spot ?? "", what: moment.what });
    const told = store.getState().lines.filter((said) => said.key === "line.people.met").map((said) => words(said.key, said.params));
    expect(told).toEqual([line]);
    expect(line).not.toMatch(/person\.tobi|suya-spot|friends-wedding|bus-stop/);
  });
});
