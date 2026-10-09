// The world's picker cards and money (docs/rules/world.md R-WORLD-006): each card that costs money
// says on its button what is left after, as the ask card does, and a cost that cannot be paid
// shuts the button with how much is short. Nothing is planned that cannot be paid.
import { content } from "@japacity/content";
import type { ActivityOption, PlayerView } from "@japacity/sim";
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, newGame, viewAfter } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { nameOf, say } from "../../shared/words/text";
import { ActivityPicker } from "./ActivityView";

const TB = "activity.tb-test";
const TRANSCRIPT = "activity.get-transcript";

const addButton = (id: string): HTMLButtonElement => screen.getByRole<HTMLButtonElement>("button", { name: `${nameOf(id)}` });

function naira(view: PlayerView): number {
  return view.pockets.NGN.bank + view.pockets.NGN.cash;
}

/** An activity the player may do, at the cost given, as the view would offer it. */
function offered(id: ActivityOption["id"], amount: number, affordable = true): ActivityOption {
  return { id, allowed: true, missing: [], params: null, cost: [{ currency: "NGN", amount }], affordable };
}

describe("the picker's cards and money", () => {
  test("[R-WORLD-006] given an activity that costs money, when its card shows, then the button says what is left after, counting the bank and the cash", async () => {
    const view = engineView("scenario.ada");
    const cost = content.activity[TB]?.cost[0]?.amount;
    if (typeof cost !== "number") throw new Error("The TB test has no fixed fee.");
    await renderWithView(<ActivityPicker only={[TB]} />, { ...view, activities: [offered(TB, cost)] });
    const button = addButton(TB);
    expect(button.disabled).toBe(false);
    expect(button.querySelector("[data-after]")?.textContent).toBe(say("ui.world.left", { amount: formatMoney(naira(view) - cost, "NGN") }));
  });

  test("[R-WORLD-006] given an activity that costs one kobo more than the player has, when its card shows, then the button is shut and says how much is short, and nothing is planned", async () => {
    const view = engineView("scenario.ada");
    const { store } = await renderWithView(<ActivityPicker only={[TB]} />, { ...view, activities: [offered(TB, naira(view) + 1, false)] });
    const button = addButton(TB);
    expect(button.disabled).toBe(true);
    expect(button.querySelector("[data-after]")?.textContent).toBe(say("ui.world.short", { amount: formatMoney(1, "NGN") }));
    fireEvent.click(button);
    expect(store.getState().plan.every((pick) => pick === null)).toBe(true);
  });

  test("[R-WORLD-006] given a plan that already pays for one activity, when another card shows, then what is left is after both, and one the plan leaves too little for is shut as short", async () => {
    const view = engineView("scenario.ada");
    const first = 2_500_000;
    const second = naira(view) - first;
    const { store } = await renderWithView(<ActivityPicker only={[TB, TRANSCRIPT]} />, { ...view, activities: [offered(TRANSCRIPT, first), offered(TB, second)] });
    expect(addButton(TB).querySelector("[data-after]")?.textContent).toBe(say("ui.world.left", { amount: formatMoney(first, "NGN") }));
    act(() => {
      store.getState().addToPlan({ activity: TRANSCRIPT, param: null });
    });
    expect(addButton(TB).querySelector("[data-after]")?.textContent).toBe(say("ui.world.left", { amount: formatMoney(0, "NGN") }));
    expect(addButton(TB).disabled).toBe(false);
    act(() => {
      store.getState().addToPlan({ activity: TRANSCRIPT, param: null });
    });
    expect(addButton(TB).disabled).toBe(true);
    expect(addButton(TB).querySelector("[data-after]")?.textContent).toBe(say("ui.world.short", { amount: formatMoney(first, "NGN") }));
  });

  test("[R-WORLD-006] given a free activity, when its card shows, then the button carries no money line", async () => {
    const view = engineView("scenario.ada");
    const rest: ActivityOption = { id: "activity.rest", allowed: true, missing: [], params: null, cost: [], affordable: true };
    await renderWithView(<ActivityPicker only={["activity.rest"]} />, { ...view, activities: [rest] });
    expect(addButton("activity.rest").disabled).toBe(false);
    expect(addButton("activity.rest").querySelector("[data-after]")).toBeNull();
  });
});

describe("the picker and a pick that fills no slot", () => {
  test("[R-TURN-006] [R-ADVICE-003] given every slot planned, when the picker shows someone who went, then it can still be added", async () => {
    const FRIEND = "activity.ask-someone-who-went";
    const UK = "route.uk-masters";
    const view = viewAfter(newGame("scenario.tunde"), [{ type: "route/hear", route: UK, via: "test" }]);
    const { store } = await renderWithView(<ActivityPicker only={[FRIEND]} />, view);
    act(() => {
      for (let slot = 0; slot < view.freeSlots; slot += 1) store.getState().addToPlan({ activity: "activity.rest", param: null });
    });
    const button = addButton(FRIEND);
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(store.getState().plan.at(-1)).toEqual({ activity: FRIEND, param: UK });
  });
});
