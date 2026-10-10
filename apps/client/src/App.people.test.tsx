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
    const nav = await screen.findByRole("navigation", { name: say("ui.tabs") }, { timeout: 10_000 });
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

  test("[R-PEOPLE-014] given someone courted, when time with someone is planned, then the plan names who it goes to, and the month's report tells the moment in words", async () => {
    const game = peopleGame();
    courted(game, TOBI);
    await playing(game);
    fireEvent.click(await screen.findByRole("button", { name: `${nameOf(SEE.activity)}` }));
    const plan = screen.getByRole("list", { name: say("ui.month.plan") });
    expect(within(plan).getByText(`${nameOf(SEE.activity)} ${say("ui.people.time-with", { name: nameOf(TOBI) })}`)).toBeDefined();
    fireEvent.click(endMonth());
    await waitFor(() => expect(Object.values(game.state.people.bonds).find((held) => held.role === "partner")?.moments).toHaveLength(1));
    const moment = Object.values(game.state.people.bonds).find((held) => held.role === "partner")!.moments[0]!;
    const line = words("line.people.met", { who: TOBI, spot: moment.spot ?? "", what: moment.what });
    // The month's staged wins come first, one moment each, then the report.
    for (let shown = 0; shown < 4 && screen.queryAllByText(line).length === 0; shown += 1) {
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getAllByRole("button")[0]!);
    }
    expect((await screen.findAllByText(line)).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/person\.tobi|suya-spot|friends-wedding|bus-stop/);
  });
});
