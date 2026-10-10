// A pick that fills no slot (docs/rules/turn.md R-TURN-006): the plan and the Month sheet count only what fills a
// slot, and such a pick can be planned however full the month is. the word of someone
// who went (R-ADVICE-003) is now asked at once and never planned, so the pick that rides with the month here is
// cooking at home, which still does.
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { gameAuthority, newGame, viewAfter } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { workingPlanned } from "../../shared/words/count";
import { nameOf, say } from "../../shared/words/text";
import { MonthSheet } from "./MonthSheet";
import { turnWords } from "./turn.words";

const COOK = "activity.cook-at-home";
const REST = "activity.rest";
const UK = "route.uk-masters";

/** Tunde, at home, who may cook, with the UK route heard of. */
async function tundeHeard() {
  const game = newGame("scenario.tunde");
  const view = viewAfter(game, [{ type: "route/hear", route: UK, via: "test" }]);
  const cook = view.activities.find((option) => option.id === COOK);
  if (cook?.allowed !== true) throw new Error("Tunde cannot cook.");
  const authority = gameAuthority(game);
  const store = createGameStore(authority);
  await store.getState().refresh();
  return { game, view, authority, store };
}

function endButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", { name: new RegExp(turnWords("turn.month.end")) });
}

describe("a pick that fills no slot", () => {
  test("[R-TURN-006] given every slot planned, when cooking at home is added, then it is planned, the sheet counts only the slots, marks it as taking none, and End month sends it and is accepted", async () => {
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
      added = store.getState().addToPlan({ activity: COOK, param: null });
    });
    expect(added).toBe(true);
    expect(store.getState().plan).toHaveLength(view.freeSlots + 1);
    // The slots count only what fills one; with a job held the line says it as a person would.
    expect(endButton().textContent).toContain(view.job.id === null ? turnWords("ui.month.slots", { used: view.freeSlots, slots: view.freeSlots }) : workingPlanned(view.freeSlots));
    expect(document.querySelectorAll("[data-slot-none]")).toHaveLength(1);
    expect(document.querySelector("[data-slot-none]")?.textContent).toBe(turnWords("turn.month.no-slot"));
    fireEvent.click(endButton());
    await waitFor(() => expect(authority.sent).toHaveLength(1));
    expect(authority.sent[0]).toMatchObject({ type: "turn/end", slots: [...Array.from({ length: view.freeSlots }, () => ({ activity: REST, param: null })), { activity: COOK, param: null }] });
    await waitFor(() => expect(store.getState().reportOpen).toBe(true));
    expect(store.getState().rejection).toBeNull();
  });

  test("[R-TURN-006] given only cooking planned, when the sheet shows, then every slot is still free and the count says none planned; taking it out leaves the slots as they were", async () => {
    const { view, store } = await tundeHeard();
    render(
      <GameProvider store={store}>
        <MonthSheet />
      </GameProvider>,
    );
    act(() => {
      store.getState().addToPlan({ activity: COOK, param: null });
    });
    expect(document.querySelectorAll('[data-month-plan] [data-slot="free"]')).toHaveLength(view.freeSlots);
    // Planned beside the slots, it is never "nothing".
    expect(endButton().textContent).not.toContain(turnWords("ui.month.rest"));
    expect(endButton().textContent).toContain(say(view.job.id === null ? "ui.month.chores.cook" : "ui.month.working-chores.cook"));
    fireEvent.click(screen.getByRole("button", { name: turnWords("turn.month.remove", { activity: nameOf(COOK) }) }));
    expect(store.getState().plan).toEqual(Array.from({ length: view.freeSlots }, () => null));
  });
});
