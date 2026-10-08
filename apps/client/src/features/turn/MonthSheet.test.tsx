import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nameOf, words } from "../../shared/words/text";
import { MonthSheet } from "./MonthSheet";
import { turnWords } from "./turn.words";

const REST = "activity.rest" as const;

function slots(state: "free" | "planned"): Element[] {
  return [...document.querySelectorAll(`[data-month-plan] [data-slot="${state}"]`)];
}

describe("the Month sheet", () => {
  test("[R-WORLD-007] given a pick planned from a thing, when the sheet shows, then it is a row that can be taken out and the slot empties", async () => {
    const view = engineView();
    const { store } = await renderWithView(<MonthSheet />, view);
    expect(slots("free")).toHaveLength(view.freeSlots);
    act(() => {
      store.getState().addToPlan({ activity: REST, param: null });
    });
    expect(slots("planned")).toHaveLength(1);
    expect(slots("free")).toHaveLength(view.freeSlots - 1);
    fireEvent.click(screen.getByRole("button", { name: turnWords("turn.month.remove", { activity: nameOf(REST) }) }));
    expect(slots("planned")).toHaveLength(0);
    expect(store.getState().plan.every((pick) => pick === null)).toBe(true);
  });

  test("[R-WORLD-007] given the sheet, then it holds the plan, the free slots, Same again as one chip and End month, and no list of activities", async () => {
    await renderWithView(<MonthSheet />, richView());
    const buttons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttons).toEqual([turnWords("ui.month.same-again"), expect.stringContaining(turnWords("turn.month.end")) as unknown as string]);
    expect(document.querySelector("[data-activity-picker], [data-activity]")).toBeNull();
  });

  test("[R-WORLD-007] given last month's plan, when Same again is tapped, then the slots fill with it", async () => {
    const view = richView();
    const { store } = await renderWithView(<MonthSheet />, { ...view, setpiece: null, interview: null });
    fireEvent.click(screen.getByRole("button", { name: turnWords("ui.month.same-again") }));
    expect(store.getState().plan[0]).toEqual(view.lastSlots[0]);
    expect(slots("planned").length).toBeGreaterThan(0);
  });

  test("[R-WORLD-007] given the month can end, when End month is tapped, then the store's end month sends the plan", async () => {
    const { authority, store } = await renderWithView(<MonthSheet />, { ...richView(), setpiece: null, interview: null });
    act(() => {
      store.getState().addToPlan({ activity: REST, param: null });
    });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(turnWords("turn.month.end")) }));
    await waitFor(() => expect(authority.sent).toHaveLength(1));
    expect(authority.sent[0]).toMatchObject({ type: "turn/end", slots: [{ activity: REST, param: null }] });
  });

  test("[R-WORLD-007] given a set piece open, when the sheet shows, then End month is held with the reason, as today", async () => {
    await renderWithView(<MonthSheet />, richView());
    const end = screen.getByRole<HTMLButtonElement>("button", { name: new RegExp(turnWords("turn.month.end")) });
    expect(end.disabled).toBe(true);
    expect(document.querySelector("[data-month-blocked]")?.textContent).toBe(words("reject.setpiece-open"));
  });
});
