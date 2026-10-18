// The world's picker cards and money (world:one-action-one-sheet): each card that costs money
// says on its button what is left after, as the ask card does, and a cost that cannot be paid
// shuts the button with how much is short. Nothing is planned that cannot be paid.
import { content } from "@japacity/content";
import type { ActivityOption, PlayerView } from "@japacity/sim";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, newGame, viewAfter } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { plannable } from "../../shared/words/acts";
import { formatMoney } from "../../shared/words/format";
import { nameOf, say } from "../../shared/words/text";
import { ActivityPicker } from "./ActivityView";

const TB = "activity.tb-test";
// Decision 0012 (activity:acts-may-repeat-in-month): the coding course and the portfolio answer at once and repeat, so the paid things
// a plan holds are month-acts: the nurse's certification and a master's at home.
const CERTIFICATE = "activity.nurse-certification";
const MASTERS = "activity.masters-at-home";

const addButton = (id: string): HTMLButtonElement => screen.getByRole<HTMLButtonElement>("button", { name: `${nameOf(id)}` });

function naira(view: PlayerView): number {
  return view.pockets.NGN.bank + view.pockets.NGN.cash;
}

/** The balance under the card's button, before or after, in kobo (world:one-action-one-sheet). */
function balance(which: "before" | "after"): number | null {
  const value = document.querySelector(`[data-balance-${which}]`)?.getAttribute(`data-balance-${which}`);
  return value === undefined || value === null ? null : Number(value);
}

/** An activity the player may do, at the cost given, as the view would offer it. */
function offered(id: ActivityOption["id"], amount: number, affordable = true): ActivityOption {
  return { id, allowed: true, missing: [], params: null, cost: [{ currency: "NGN", amount }], affordable, when: content.activity[id]?.when ?? "month", done: false };
}

describe("the picker's cards and money", () => {
  test("[world:one-action-one-sheet] given an activity that costs money, when its card shows, then the button says the act and its price, and under it the balance before, struck, and after, counting the bank and the cash", async () => {
    const view = engineView("scenario.ada");
    const cost = content.activity[TB]?.cost[0]?.amount;
    if (typeof cost !== "number") throw new Error("The TB test has no fixed fee.");
    await renderWithView(<ActivityPicker only={[TB]} />, { ...view, activities: [offered(TB, cost)] });
    const button = addButton(TB);
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain(say("ui.act.priced", { act: nameOf(TB), price: formatMoney(cost, "NGN") }));
    expect(button.querySelector("[data-after]")).toBeNull();
    expect(balance("before")).toBe(naira(view));
    expect(balance("after")).toBe(naira(view) - cost);
  });

  test("[world:one-action-one-sheet] given an activity that costs one kobo more than the player has, when its card shows, then the button is shut and says how much is short, and nothing is planned", async () => {
    const view = engineView("scenario.ada");
    const { store } = await renderWithView(<ActivityPicker only={[TB]} />, { ...view, activities: [offered(TB, naira(view) + 1, false)] });
    const button = addButton(TB);
    expect(button.disabled).toBe(true);
    expect(button.querySelector("[data-after]")?.textContent).toBe(say("ui.world.short", { amount: formatMoney(1, "NGN") }));
    fireEvent.click(button);
    expect(store.getState().plan.every((pick) => pick === null)).toBe(true);
  });

  test("[world:one-action-one-sheet] given a plan that already pays for one activity, when another card shows, then the balance after is after both, and one the plan leaves too little for is shut as short", async () => {
    const view = engineView("scenario.ada");
    const first = 2_500_000;
    const second = naira(view) - first;
    // Only month-acts are planned, each once (activity:now-acts-and-month-acts, world:month-acts-carry-on), so the plan
    // that pays is a course and then a second month-act beside it (decision 0012: two that still take the month).
    expect([CERTIFICATE, MASTERS].every((id) => plannable(id))).toBe(true);
    const { store } = await renderWithView(<ActivityPicker only={[TB]} />, { ...view, activities: [offered(CERTIFICATE, first), offered(MASTERS, first), offered(TB, second)] });
    expect([balance("before"), balance("after")]).toEqual([naira(view), first]);
    act(() => {
      store.getState().addToPlan({ activity: CERTIFICATE, param: null });
    });
    // The balance before is what the plan leaves; after the act, nothing.
    expect([balance("before"), balance("after")]).toEqual([naira(view) - first, 0]);
    expect(addButton(TB).disabled).toBe(false);
    act(() => {
      store.getState().addToPlan({ activity: MASTERS, param: null });
    });
    expect(addButton(TB).disabled).toBe(true);
    expect(addButton(TB).querySelector("[data-after]")?.textContent).toBe(say("ui.world.short", { amount: formatMoney(first, "NGN") }));
  });

  test("[world:one-action-one-sheet] given a free activity, when its card shows, then the button carries no money line", async () => {
    const view = engineView("scenario.ada");
    const family: ActivityOption = { id: "activity.family-time", allowed: true, missing: [], params: null, cost: [], affordable: true, when: "month", done: false };
    await renderWithView(<ActivityPicker only={["activity.family-time"]} />, { ...view, activities: [family] });
    expect(addButton("activity.family-time").disabled).toBe(false);
    expect(addButton("activity.family-time").querySelector("[data-after]")).toBeNull();
  });
});

describe("the picker and a pick that fills no slot", () => {
  test("[turn:free-slots-per-month] [advice:someone-who-went-answers-free] given every slot planned, when the picker shows someone who went, then it can still be added", async () => {
    const FRIEND = "activity.ask-someone-who-went";
    const UK = "route.uk-masters";
    const view = viewAfter(newGame("scenario.tunde"), [{ type: "route/hear", route: UK, via: "test" }]);
    const { store, authority } = await renderWithView(<ActivityPicker only={[FRIEND]} />, view);
    // Rest is never planned (turn:free-slots-per-month), so the free time is filled with month-acts.
    const month = view.activities.filter((option) => option.allowed && option.params === null && plannable(option.id)).map((option) => option.id);
    act(() => {
      for (const activity of month.slice(0, view.freeSlots)) store.getState().addToPlan({ activity, param: null });
    });
    expect(store.getState().plan.every((pick) => pick !== null)).toBe(true);
    const button = addButton(FRIEND);
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    // activity:now-acts-and-month-acts: the word of someone who went is asked at once, so a full month never shuts it and it
    // is sent now rather than planned.
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "activity/now", activity: FRIEND, param: UK }));
  });
});
