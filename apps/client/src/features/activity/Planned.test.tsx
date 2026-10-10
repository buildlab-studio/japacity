// An act already in the month's plan that planning again does nothing for (docs/rules/turn.md R-TURN-006,
// activity.md R-ACTIVITY-013): its button says Planned and is shut until the month ends.
import { act, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { plannedShut } from "../../authority/store";
import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nameOf, say } from "../../shared/words/text";
import { ActivityPicker } from "./ActivityView";

const COOK = "activity.cook-at-home";
const WATER = "activity.fetch-water";
const REST = "activity.rest";

const addButton = (id: string): HTMLButtonElement => screen.getByRole<HTMLButtonElement>("button", { name: nameOf(id) });

describe("an act planned once is shut", () => {
  test("[R-TURN-006] given cooking planned this month, when the sheet shows it, then its button says Planned and is shut while the water's stays open", async () => {
    const { store } = await renderWithView(<ActivityPicker only={[COOK, WATER]} />, engineView("scenario.ada"));
    expect(addButton(COOK).disabled).toBe(false);
    act(() => {
      store.getState().addToPlan({ activity: COOK, param: null });
    });
    expect(addButton(COOK).disabled).toBe(true);
    expect(addButton(COOK).textContent).toContain(say("ui.activity.planned"));
    expect(addButton(WATER).disabled).toBe(false);
    expect(addButton(WATER).textContent).not.toContain(say("ui.activity.planned"));
  });

  test("[R-TURN-006] given a plan, when an act is asked about, then only an act that fills no slot and is planned is shut; rest fills a slot each time and stays open", () => {
    const plan = [{ activity: REST, param: null }, null, { activity: COOK, param: null }] as const;
    expect(plannedShut(plan, { activity: COOK, param: null })).toBe(true);
    expect(plannedShut(plan, { activity: WATER, param: null })).toBe(false);
    expect(plannedShut(plan, { activity: REST, param: null })).toBe(false);
  });
});
