// A thing started carries on each month until it is stopped (world:month-acts-carry-on; turn:free-slots-per-month):
// its button says Ongoing and is shut, since starting it again would only take
// more of the free time; cooking and the water are done at once and never planned (activity:now-acts-and-month-acts).
import { content } from "@japacity/content";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, plannedShut } from "../../authority/store";
import { engineView, gameAuthority, newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { nameOf, say } from "../../shared/words/text";
import { ActivityPicker } from "./ActivityView";

// Decision 0012 (activity:acts-may-repeat-in-month): the coding course answers at once and repeats; the course that carries on as a
// commitment is a master's at home.
const LEARN = "activity.masters-at-home";
const CLASS = "activity.learn-tech";
const FAMILY = "activity.family-time";
const COOK = "activity.cook-at-home";

const addButton = (id: string): HTMLButtonElement => screen.getByRole<HTMLButtonElement>("button", { name: nameOf(id) });

describe("a thing started is ongoing", () => {
  test("[world:month-acts-carry-on] [turn:free-slots-per-month] given a course started this month, when the sheet shows it, then its button says Ongoing and is shut while time with family stays open", async () => {
    const { store } = await renderWithView(<ActivityPicker only={[LEARN, FAMILY]} />, engineView("scenario.graduate"));
    expect(addButton(LEARN).disabled).toBe(false);
    act(() => {
      store.getState().addToPlan({ activity: LEARN, param: null });
    });
    expect(addButton(LEARN).disabled).toBe(true);
    expect(addButton(LEARN).textContent).toContain(say("ui.activity.planned"));
    expect(say("ui.activity.planned")).toBe("Ongoing");
    expect(addButton(FAMILY).disabled).toBe(false);
    expect(addButton(FAMILY).textContent).not.toContain(say("ui.activity.planned"));
  });

  test("[world:month-acts-carry-on] given a plan, when an act is asked about, then what is in the plan is shut and what is not stays open; cooking is never in it", () => {
    const plan = [{ activity: LEARN, param: null }, null, null] as const;
    expect(plannedShut(plan, { activity: LEARN, param: null })).toBe(true);
    expect(plannedShut(plan, { activity: FAMILY, param: null })).toBe(false);
    expect(plannedShut(plan, { activity: COOK, param: null })).toBe(false);
  });

  test("[activity:acts-may-repeat-in-month] [activity:now-acts-spend-half-days] given the coding class, an act that repeats, when its card is pressed twice, then each press does it now at its price, the card says the time in words, and it is never Ongoing nor counted at the month's end", async () => {
    const game = newGame("scenario.graduate");
    const authority = gameAuthority(game);
    const store = createGameStore(authority);
    await store.getState().refresh();
    render(
      <GameProvider store={store}>
        <ActivityPicker only={[CLASS]} />
      </GameProvider>,
    );
    // The price as the view gives it, as the card reads it.
    const price = store.getState().view!.activities.find((option) => option.id === CLASS)!.cost[0]!;
    expect(content.activity[CLASS]?.halfDays).toBe(2);
    expect(document.querySelector("[data-time]")?.textContent).toBe("A day");
    expect(document.body.textContent).toContain(formatMoney(price.amount, price.currency));
    for (let time = 1; time <= 2; time += 1) {
      const held = store.getState().view!.pockets.NGN.cash + store.getState().view!.pockets.NGN.bank;
      expect(addButton(CLASS).disabled).toBe(false);
      expect(addButton(CLASS).textContent).not.toContain(say("ui.activity.planned"));
      expect(document.body.textContent).not.toContain(say("ui.world.counts-at-end"));
      // world:one-action-one-sheet: the button says the act and its price; the balance before and after stands under it.
      expect(addButton(CLASS).textContent).toContain(say("ui.act.priced", { act: nameOf(CLASS), price: formatMoney(price.amount, price.currency) }));
      expect(document.querySelector("[data-balance-before]")?.getAttribute("data-balance-before")).toBe(String(held));
      expect(document.querySelector("[data-balance-after]")?.getAttribute("data-balance-after")).toBe(String(held - price.amount));
      await act(async () => {
        fireEvent.click(addButton(CLASS));
        await Promise.resolve();
      });
      await waitFor(() => expect(authority.sent.filter((command) => command.type === "activity/now")).toHaveLength(time));
    }
    expect(authority.sent.every((command) => command.type === "activity/now" && command.activity === CLASS)).toBe(true);
    expect(store.getState().plan.some((pick) => pick !== null)).toBe(false);
  });
});
