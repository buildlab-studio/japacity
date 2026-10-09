import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { slot } from "../../../../../packages/sim/src/route/route.journey";
import { engineView, newGame, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nameOf, words } from "../../shared/words/text";
import { MonthSheet } from "./MonthSheet";
import { turnWords } from "./turn.words";

const REST = "activity.rest" as const;
const TEACHER = "activity.job-teacher" as const;

/** Ada after a month's hunt that found the teacher's job, and the job taken. */
function adaTeaching() {
  const game = newGame("scenario.ada");
  game.endTurn([slot("activity.job-hunt", TEACHER), slot(REST)]);
  const offer = game.view().offers.find((candidate) => candidate.entry === "offer.job");
  if (offer === undefined) throw new Error("The hunt found no job on this seed.");
  game.accept({ type: "offer/choose", offer: offer.id, choice: "accept" });
  return game.view();
}

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

  test("[R-WORLD-007] [R-WORLD-028] given the sheet, then it holds the plan, the free slots, Same again as one chip, End month and Until news beside it, and no list of activities", async () => {
    await renderWithView(<MonthSheet />, richView());
    const buttons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttons).toEqual([turnWords("ui.month.same-again"), expect.stringContaining(turnWords("turn.month.end")) as unknown as string, expect.stringContaining(turnWords("ui.month.until-news")) as unknown as string]);
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

  test("[R-WORLD-007] given a job held, when the sheet shows, then the job is its first row and no line says the month is empty or quiet", async () => {
    const view = adaTeaching();
    expect(view.job.id).toBe(TEACHER);
    await renderWithView(<MonthSheet />, view);
    const rows = [...document.querySelectorAll("[data-month-sheet] li")];
    expect(rows[0]?.textContent).toBe(turnWords("turn.month.working", { job: nameOf(TEACHER) }));
    expect(rows[0]?.getAttribute("data-slot")).toBe("job");
    const sheet = document.querySelector("[data-month-sheet]")?.textContent ?? "";
    expect(sheet).not.toContain("Nothing yet");
    expect(sheet).not.toContain("A quiet month");
  });

  test("[R-WORLD-007] given last month's hunt found the job now held, when Same again is tapped, then the hunt is not planned again and the rest of last month is", async () => {
    const view = adaTeaching();
    expect(view.lastSlots).toContainEqual({ activity: "activity.job-hunt", param: TEACHER });
    const { store } = await renderWithView(<MonthSheet />, view);
    fireEvent.click(screen.getByRole("button", { name: turnWords("ui.month.same-again") }));
    const plan = store.getState().plan;
    expect(plan.some((pick) => pick?.activity === "activity.job-hunt" && pick.param === TEACHER)).toBe(false);
    expect(plan).toContainEqual({ activity: REST, param: null });
  });
});

describe("a held slot on the Month sheet", () => {
  test("[R-TURN-009] [R-WORLD-007] given the burial holds a slot this month, when the sheet shows, then the held slot is a row in its own words above the free ones", async () => {
    const view = { ...richView(), setpiece: null, interview: null };
    await renderWithView(<MonthSheet />, { ...view, locks: [{ slots: 1, why: "burial", untilMonth: view.month }] });
    const row = document.querySelector('[data-slot="lock"]');
    expect(row?.textContent).toBe(words("ui.locks.row.burial"));
    expect(row?.textContent).not.toMatch(/\d/);
  });
});
