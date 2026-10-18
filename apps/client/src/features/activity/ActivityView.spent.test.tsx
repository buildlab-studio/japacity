// A spent body on a sheet of several (docs/rules/activity.md R-ACTIVITY-020; decision 0011): an act that takes effort
// waits for sleep once the energy is under the line, and its card says so where its button was.
import { describe, expect, test } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { ActivityPicker } from "./ActivityView";

const WATER = "activity.fetch-water";

describe("a spent body on the picker", () => {
  test("[R-ACTIVITY-020] given a spent act on a sheet of several, when the sheet shows, then its card says You are spent. Sleep. in place of its button", async () => {
    const game = newGame("scenario.ada");
    while (game.view().activities.find((option) => option.id === WATER)?.spent !== true) game.accept({ type: "activity/now", activity: WATER, param: null });
    await renderWithView(<ActivityPicker only={[WATER]} />, game.view());
    expect(document.querySelector(`[data-act-spent="${WATER}"]`)?.textContent).toBe("You are spent. Sleep.");
    expect(document.querySelector("[data-activity-picker] button")).toBeNull();
  });
});
