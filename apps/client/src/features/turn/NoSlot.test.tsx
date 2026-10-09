// Someone who went fills no slot (docs/rules/turn.md R-TURN-006, docs/rules/advice.md R-ADVICE-003):
// the plan and the Month sheet count only what fills a slot, and the word of someone who went can
// be planned however full the month is.
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { gameAuthority, newGame, viewAfter } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { workingPlanned } from "../../shared/words/count";
import { nameOf } from "../../shared/words/text";
import { MonthSheet } from "./MonthSheet";
import { turnWords } from "./turn.words";

const FRIEND = "activity.ask-someone-who-went";
const REST = "activity.rest";
const UK = "route.uk-masters";

/** Tunde, whose network is enough to ask someone who went, with the UK route heard of. */
async function tundeHeard() {
  const game = newGame("scenario.tunde");
  const view = viewAfter(game, [{ type: "route/hear", route: UK, via: "test" }]);
  const friend = view.activities.find((option) => option.id === FRIEND);
  if (friend?.allowed !== true) throw new Error("Tunde cannot ask someone who went.");
  const authority = gameAuthority(game);
  const store = createGameStore(authority);
  await store.getState().refresh();
  return { game, view, authority, store };
}

function endButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", { name: new RegExp(turnWords("turn.month.end")) });
}

describe("the word of someone who went", () => {
  test("[R-TURN-006] [R-ADVICE-003] given every slot planned, when someone who went is added, then it is planned, the sheet counts only the slots, marks it as taking none, and End month sends it and is accepted", async () => {
    const { view, authority, store } = await tundeHeard();
    render(
      <GameProvider store={store}>
        <MonthSheet />
      </GameProvider>,
    );
    act(() => {
      for (let slot = 0; slot < view.freeSlots; slot += 1) store.getState().addToPlan({ activity: REST, param: null });
    });
    let added = false;
    act(() => {
      added = store.getState().addToPlan({ activity: FRIEND, param: UK });
    });
    expect(added).toBe(true);
    expect(store.getState().plan).toHaveLength(view.freeSlots + 1);
    // The slots count only what fills one; with a job held the line says it as a person would.
    expect(endButton().textContent).toContain(view.job.id === null ? turnWords("ui.month.slots", { used: view.freeSlots, slots: view.freeSlots }) : workingPlanned(view.freeSlots));
    expect(document.querySelectorAll("[data-slot-none]")).toHaveLength(1);
    expect(document.querySelector("[data-slot-none]")?.textContent).toBe(turnWords("turn.month.no-slot"));
    fireEvent.click(endButton());
    await waitFor(() => expect(authority.sent).toHaveLength(1));
    expect(authority.sent[0]).toMatchObject({ type: "turn/end", slots: [...Array.from({ length: view.freeSlots }, () => ({ activity: REST, param: null })), { activity: FRIEND, param: UK }] });
    await waitFor(() => expect(store.getState().reportOpen).toBe(true));
    expect(store.getState().rejection).toBeNull();
  });

  test("[R-TURN-006] [R-ADVICE-003] given only someone who went planned, when the sheet shows, then every slot is still free and the count says none planned; taking it out leaves the slots as they were", async () => {
    const { view, store } = await tundeHeard();
    render(
      <GameProvider store={store}>
        <MonthSheet />
      </GameProvider>,
    );
    act(() => {
      store.getState().addToPlan({ activity: FRIEND, param: UK });
    });
    expect(document.querySelectorAll('[data-month-plan] [data-slot="free"]')).toHaveLength(view.freeSlots);
    // Planned beside the slots, it is never "nothing".
    expect(endButton().textContent).not.toContain(turnWords("ui.month.rest"));
    expect(endButton().textContent).toContain(nameOf(FRIEND));
    fireEvent.click(screen.getByRole("button", { name: turnWords("turn.month.remove", { activity: `${nameOf(FRIEND)}: ${nameOf(UK)}` }) }));
    expect(store.getState().plan).toEqual(Array.from({ length: view.freeSlots }, () => null));
  });
});
