// The Month sheet's foot with the room's basics planned (docs/rules/world.md R-WORLD-007; the seventh
// review): cooking and water planned, the foot said "Nothing planned. You rest."
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { MonthSheet } from "./MonthSheet";
import { turnWords } from "./turn.words";

const COOK = "activity.cook-at-home";
const WATER = "activity.fetch-water";

function footer(): string {
  return document.querySelector("[data-month-end]")?.textContent ?? "";
}

describe("the Month sheet's foot with the room's basics", () => {
  test("[R-WORLD-007] given only cooking and fetching water planned, when the sheet shows, then its foot says so and never that nothing is planned", async () => {
    const { store } = await renderWithView(<MonthSheet />, engineView("scenario.ada"));
    act(() => {
      store.getState().addToPlan({ activity: COOK, param: null });
      store.getState().addToPlan({ activity: WATER, param: null });
    });
    expect(footer()).toContain("Cooking and fetching water");
    expect(footer()).not.toContain(turnWords("ui.month.rest"));
  });

  test("[R-WORLD-007] given only cooking planned, when the sheet shows, then the foot says cooking", async () => {
    const { store } = await renderWithView(<MonthSheet />, engineView("scenario.ada"));
    act(() => {
      store.getState().addToPlan({ activity: COOK, param: null });
    });
    expect(footer()).toContain("Cooking this month");
    expect(footer()).not.toContain("Nothing planned");
  });
});
