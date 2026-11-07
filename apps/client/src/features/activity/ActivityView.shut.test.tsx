// A shut button says the real reason (world:one-action-one-sheet), on the real content: what it
// needs first when it is not allowed, the short figure when it cannot be paid, counted the same way
// on the button and on the line above it, and never a figure left over a button that is shut. A picker of
// several acts is rows with one button in the foot: a row is picked, and the foot's button is that act's.
import type { ActivityOption } from "@japacity/sim";
import { setPockets } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { fireEvent } from "@testing-library/react";

import { found, renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { requirementSentence } from "../../shared/words/requirement";
import { runningName, say } from "../../shared/words/text";
import { ActivityPicker } from "./ActivityView";

const PASSPORT = "activity.get-passport";
const TRANSCRIPT = "activity.get-transcript";
const ENGLISH_TEST = "activity.sit-english-test";
const ADVISER = "activity.see-adviser";
const OFFICIAL = "activity.look-into-route";

/** An act's one main button, by its mark: its words are its verb, which several acts share (world:one-action-one-sheet). */
const addButton = (id: string): HTMLButtonElement => found(`[data-act-main="${id}"]`) as HTMLButtonElement;
const buttonLine = (id: string): string | null => addButton(id).querySelector("[data-after]")?.textContent ?? null;

/** A row of a picker of several acts, picked, so the one button in the foot is its act's; its row with the choice under it. */
function pickRow(id: string): HTMLElement {
  const row = found(`[data-act-row="${id}"]`);
  fireEvent.click(row);
  return row.closest("li")!;
}

function cost(option: ActivityOption | undefined): number {
  const amount = option?.cost[0]?.amount;
  if (amount === undefined) throw new Error(`${option?.id ?? "The activity"} has no cost.`);
  return amount;
}

describe("a shut button's reason", () => {
  test("[world:one-action-one-sheet] given the passport and the transcript on one sheet and the transcript asked for this month, when the passport is picked and short, then the sheet's line and its one button say the same short figure", async () => {
    // activity:now-acts-and-month-acts: the transcript is asked for at once and paid then, so the passport is short by what is left after it.
    const game = newGame("scenario.graduate");
    setPockets(game, { NGN: 8_940_000 });
    const transcript = cost(game.view().activities.find((option) => option.id === TRANSCRIPT));
    game.accept({ type: "activity/now", activity: TRANSCRIPT, param: null });
    const view = game.view();
    const passport = cost(view.activities.find((option) => option.id === PASSPORT));
    await renderWithView(<ActivityPicker only={[PASSPORT, TRANSCRIPT]} />, view);
    const short = formatMoney(passport + transcript - 8_940_000, "NGN");
    pickRow(PASSPORT);
    expect(addButton(PASSPORT).disabled).toBe(true);
    expect(buttonLine(PASSPORT)).toBe(say("ui.world.short", { amount: short }));
    const picker = found("[data-activity-picker]");
    const said = picker.querySelector("p.text-bad")?.textContent ?? "";
    expect(said.startsWith(`Short by ${short}:`)).toBe(true);
    // Only the one figure is short on the sheet.
    expect(picker.textContent?.match(/₦[\d,]+ short|Short by ₦[\d,]+/g)?.every((match) => match.includes(short))).toBe(true);
    // The transcript asked for once this month is not offered again with a figure left.
    pickRow(TRANSCRIPT);
    expect(addButton(TRANSCRIPT).disabled).toBe(true);
    expect(buttonLine(TRANSCRIPT) ?? "").not.toMatch(/left/);
  });

  test("[world:one-action-one-sheet] given no passport, when the English test's card shows, then its button is shut and says it needs the passport first", async () => {
    const view = newGame("scenario.graduate").view();
    const sitting = view.activities.find((option) => option.id === ENGLISH_TEST);
    expect(sitting?.missing).toEqual([{ type: "document/held", document: "document.passport" }]);
    await renderWithView(<ActivityPicker only={[ENGLISH_TEST]} />, view);
    expect(addButton(ENGLISH_TEST).disabled).toBe(true);
    // The card's "Not yet:" list says the passport once; the shut button says only "Not yet".
    expect(buttonLine(ENGLISH_TEST)).toBe(say("ui.needs.not-yet"));
    expect(addButton(ENGLISH_TEST).querySelector("[data-after]")?.getAttribute("data-after")).toBe("needs");
    const card = addButton(ENGLISH_TEST).closest("li")?.textContent ?? "";
    expect(card).toContain(requirementSentence({ type: "document/held", document: "document.passport" }));
    expect(card).not.toContain(say("ui.needs.document", { document: runningName("document.passport") }));
  });

  test("[world:one-action-one-sheet] given no route heard of, when the adviser's and the official page's rows show, then each row picked says once that it needs a route you have heard of and the one button is shut, never what is left", async () => {
    const view = newGame("scenario.graduate").view();
    await renderWithView(<ActivityPicker only={[ADVISER, OFFICIAL]} />, view);
    for (const id of [ADVISER, OFFICIAL]) {
      const row = pickRow(id);
      expect(addButton(id).disabled).toBe(true);
      // The picked row says once that it needs a route; the button says only "Not yet".
      expect(buttonLine(id)).toBe(say("ui.needs.not-yet"));
      const card = row.textContent ?? "";
      const missing = view.activities.find((option) => option.id === id)?.missing ?? [];
      const why = missing.length > 0 ? missing.map((requirement) => requirementSentence(requirement, { routes: view.routes })) : [say("ui.activity.no-route")];
      for (const said of why) expect(card.split(said)).toHaveLength(2);
      expect(card).not.toContain(say("ui.needs.route"));
    }
    expect(document.body.textContent).not.toContain(say("ui.activity.cannot-pay"));
  });

  test("[world:one-action-one-sheet] given the engine says a cost cannot be paid though the pockets cover it, when the card shows, then the button is shut with no figure left over it", async () => {
    const view = newGame("scenario.graduate").view();
    const adviser: ActivityOption = { id: ADVISER, allowed: true, missing: [], params: null, cost: [{ currency: "NGN", amount: 8_000_000 }], affordable: false, when: "now", done: false };
    await renderWithView(<ActivityPicker only={[ADVISER]} />, { ...view, activities: [adviser] });
    expect(addButton(ADVISER).disabled).toBe(true);
    expect(buttonLine(ADVISER)).toBe(say("ui.needs.money"));
    expect(addButton(ADVISER).textContent).not.toMatch(/left/);
  });
});
