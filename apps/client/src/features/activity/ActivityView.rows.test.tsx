// A picker of several acts is rows with one button in the foot (world:one-action-one-sheet, text:show-then-tell): each row the
// act's picture, name, price and facts as chips; a tap picks a row, which alone shows its line; the one button does the act
// picked, with its price on it and the balance before and after under it.
import { fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { found, renderWithView } from "../../shared/testing/render";
import { buttonOf } from "../../shared/words/acts";
import { formatMoney } from "../../shared/words/format";
import { blurbOf, say } from "../../shared/words/text";
import { ActivityPicker } from "./ActivityView";

const STUDY = "activity.study-english";
const CLASS = "activity.learn-tech";
const BUILD = "activity.build-portfolio";

describe("a picker of several acts", () => {
  test("[world:one-action-one-sheet] [text:show-then-tell] given three acts on one sheet, when it opens, then they are rows with their prices as chips, one main button in the foot for the first, and only the picked row shows its line", async () => {
    const view = newGame("scenario.graduate").view();
    await renderWithView(<ActivityPicker only={[STUDY, CLASS, BUILD]} />, view);
    const rows = [...document.querySelectorAll<HTMLElement>("[data-act-row]")];
    expect(rows.map((row) => row.getAttribute("data-act-row"))).toEqual([STUDY, CLASS, BUILD]);
    expect(document.querySelectorAll("[data-act-main]")).toHaveLength(1);
    expect(found("[data-picker-foot] [data-act-main]").getAttribute("data-act-main")).toBe(STUDY);
    expect(rows[0]?.getAttribute("aria-checked")).toBe("true");
    expect(document.querySelectorAll("[data-act-line]")).toHaveLength(1);
    expect(found(`[data-act-row="${STUDY}"] [data-act-line]`).textContent).toBe(blurbOf(STUDY));
    const study = view.activities.find((option) => option.id === STUDY)!;
    expect(found(`[data-act-row="${STUDY}"] [data-cost]`).getAttribute("aria-label")).toBe(say("ui.activity.cost", { amount: formatMoney(study.cost[0]!.amount, "NGN") }));
    // world:one-action-one-sheet: the button says the verb and the price; the balance before and after stands under it.
    expect(found("[data-act-main]").textContent).toContain(say("ui.act.priced", { act: buttonOf(STUDY), price: formatMoney(study.cost[0]!.amount, "NGN") }));
    expect(document.querySelector("[data-picker-foot] [data-balance-before]")).not.toBeNull();
  });

  test("[world:one-action-one-sheet] given a picker of several acts, when another row is tapped, then the one button becomes that act's and its row shows its line", async () => {
    await renderWithView(<ActivityPicker only={[STUDY, CLASS, BUILD]} />, newGame("scenario.graduate").view());
    fireEvent.click(found(`[data-act-row="${BUILD}"]`));
    expect(document.querySelectorAll("[data-act-main]")).toHaveLength(1);
    expect(found("[data-act-main]").getAttribute("data-act-main")).toBe(BUILD);
    expect(found(`[data-act-row="${BUILD}"]`).getAttribute("aria-checked")).toBe("true");
    expect(found(`[data-act-row="${STUDY}"]`).getAttribute("aria-checked")).toBe("false");
    expect(document.querySelector(`[data-act-row="${STUDY}"] [data-act-line]`)).toBeNull();
    expect(found(`[data-act-row="${BUILD}"] [data-act-line]`).textContent).toBe(blurbOf(BUILD));
  });

  test("[world:one-action-one-sheet] given one act alone, when its sheet opens, then it is a card with its own button, never a row", async () => {
    await renderWithView(<ActivityPicker only={[STUDY]} />, newGame("scenario.graduate").view());
    expect(document.querySelector("[data-act-row]")).toBeNull();
    expect(found(`[data-act-card="${STUDY}"] [data-act-main="${STUDY}"]`)).toBeDefined();
  });
});
