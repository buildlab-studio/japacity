// A shut button says the real reason (docs/rules/world.md R-WORLD-006), on the real content: what it
// needs first when it is not allowed, the short figure when it cannot be paid, counted the same way
// on the button and on the line above it, and never a figure left over a button that is shut.
import type { ActivityOption } from "@japacity/sim";
import { act, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame, setPockets } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { nameOf, runningName, say } from "../../shared/words/text";
import { ActivityPicker } from "./ActivityView";

const PASSPORT = "activity.get-passport";
const TRANSCRIPT = "activity.get-transcript";
const ENGLISH_TEST = "activity.sit-english-test";
const ADVISER = "activity.see-adviser";
const OFFICIAL = "activity.look-into-route";

const addButton = (id: string): HTMLButtonElement => screen.getByRole<HTMLButtonElement>("button", { name: `${nameOf(id)}` });
const buttonLine = (id: string): string | null => addButton(id).querySelector("[data-after]")?.textContent ?? null;

function cost(option: ActivityOption | undefined): number {
  const amount = option?.cost[0]?.amount;
  if (amount === undefined) throw new Error(`${option?.id ?? "The activity"} has no cost.`);
  return amount;
}

describe("a shut button's reason", () => {
  test("[R-WORLD-006] given the passport and the transcript on one sheet and the transcript planned, when the passport is short, then its line and its button say the same short figure", async () => {
    const game = newGame("scenario.ada");
    setPockets(game, { NGN: 8_940_000 });
    const view = game.view();
    const passport = cost(view.activities.find((option) => option.id === PASSPORT));
    const transcript = cost(view.activities.find((option) => option.id === TRANSCRIPT));
    const { store } = await renderWithView(<ActivityPicker only={[PASSPORT, TRANSCRIPT]} />, view);
    act(() => {
      store.getState().addToPlan({ activity: TRANSCRIPT, param: null });
    });
    const short = formatMoney(passport + transcript - 8_940_000, "NGN");
    expect(addButton(PASSPORT).disabled).toBe(true);
    expect(buttonLine(PASSPORT)).toBe(say("ui.world.short", { amount: short }));
    const card = addButton(PASSPORT).closest("li");
    const said = card?.querySelector("p.text-bad")?.textContent ?? "";
    expect(said.startsWith(`Short by ${short}:`)).toBe(true);
    // Only the one figure is short on the card.
    expect(card?.textContent?.match(/₦[\d,]+ short|Short by ₦[\d,]+/g)?.every((match) => match.includes(short))).toBe(true);
    // The transcript asked for once this month is not offered again with a figure left.
    expect(addButton(TRANSCRIPT).disabled).toBe(true);
    expect(buttonLine(TRANSCRIPT)).toBe(say("ui.needs.planned"));
  });

  test("[R-WORLD-006] given no passport, when the English test's card shows, then its button is shut and says it needs the passport first", async () => {
    const view = newGame("scenario.ada").view();
    const sitting = view.activities.find((option) => option.id === ENGLISH_TEST);
    expect(sitting?.missing).toEqual([{ type: "document/held", document: "document.passport" }]);
    await renderWithView(<ActivityPicker only={[ENGLISH_TEST]} />, view);
    expect(addButton(ENGLISH_TEST).disabled).toBe(true);
    expect(buttonLine(ENGLISH_TEST)).toBe(say("ui.needs.document", { document: runningName("document.passport") }));
    expect(buttonLine(ENGLISH_TEST)).toBe("Needs your passport first");
    expect(addButton(ENGLISH_TEST).querySelector("[data-after]")?.getAttribute("data-after")).toBe("needs");
  });

  test("[R-WORLD-006] given no route heard of, when the adviser's and the official page's cards show, then each button says it needs a route you have heard of, never what is left", async () => {
    const view = newGame("scenario.ada").view();
    await renderWithView(<ActivityPicker only={[ADVISER, OFFICIAL]} />, view);
    for (const id of [ADVISER, OFFICIAL]) {
      expect(addButton(id).disabled).toBe(true);
      expect(buttonLine(id)).toBe(say("ui.needs.route"));
    }
    expect(document.body.textContent).not.toContain(say("ui.activity.cannot-pay"));
  });

  test("[R-WORLD-006] given the engine says a cost cannot be paid though the pockets cover it, when the card shows, then the button is shut with no figure left over it", async () => {
    const view = newGame("scenario.ada").view();
    const adviser: ActivityOption = { id: ADVISER, allowed: true, missing: [], params: null, cost: [{ currency: "NGN", amount: 8_000_000 }], affordable: false, when: "now", done: false };
    await renderWithView(<ActivityPicker only={[ADVISER]} />, { ...view, activities: [adviser] });
    expect(addButton(ADVISER).disabled).toBe(true);
    expect(buttonLine(ADVISER)).toBe(say("ui.needs.money"));
    expect(addButton(ADVISER).textContent).not.toMatch(/left/);
  });
});
