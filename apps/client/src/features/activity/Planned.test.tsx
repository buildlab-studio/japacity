// A thing started carries on each month until it is stopped (docs/rules/world.md R-WORLD-007; turn.md R-TURN-006; the
// owner's planning agent): its button says Ongoing and is shut, since starting it again would only take
// more of the free time; cooking and the water are done at once and never planned (R-ACTIVITY-015).
import { act, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { plannedShut } from "../../authority/store";
import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nameOf, say } from "../../shared/words/text";
import { ActivityPicker } from "./ActivityView";

const LEARN = "activity.learn-tech";
const FAMILY = "activity.family-time";
const COOK = "activity.cook-at-home";

const addButton = (id: string): HTMLButtonElement => screen.getByRole<HTMLButtonElement>("button", { name: nameOf(id) });

describe("a thing started is ongoing", () => {
  test("[R-WORLD-007] [R-TURN-006] given a course started this month, when the sheet shows it, then its button says Ongoing and is shut while time with family stays open", async () => {
    const { store } = await renderWithView(<ActivityPicker only={[LEARN, FAMILY]} />, engineView("scenario.ada"));
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

  test("[R-WORLD-007] given a plan, when an act is asked about, then what is in the plan is shut and what is not stays open; cooking is never in it", () => {
    const plan = [{ activity: LEARN, param: null }, null, null] as const;
    expect(plannedShut(plan, { activity: LEARN, param: null })).toBe(true);
    expect(plannedShut(plan, { activity: FAMILY, param: null })).toBe(false);
    expect(plannedShut(plan, { activity: COOK, param: null })).toBe(false);
  });
});
