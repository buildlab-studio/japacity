// Cooking and fetching water said at the tap and counted on the Month sheet (docs/rules/world.md
// R-WORLD-005, R-WORLD-007, R-WORLD-029; obligation.md R-OBLIGATION-014): the
// tap says what comes off this month's living costs, and the sheet's foot never says nothing is planned.
import { content } from "@japacity/content";
import { int } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { formatMoney } from "../../shared/words/format";
import { doneWords } from "./City";

const COOK = "activity.cook-at-home";
const WATER = "activity.fetch-water";

function upkeepDue(view: ReturnType<typeof engineView>): number {
  const owed = view.obligations.find((item) => content.obligation[item.entry]?.type === "upkeep");
  if (owed === undefined) throw new Error("Ada has no living costs.");
  return owed.due;
}

describe("the room's basics at the tap", () => {
  test("[R-WORLD-005] given Ada at home with her living costs, when she cooks for the week, then the tap says what comes off this month's living costs, as a figure", () => {
    const view = engineView("scenario.ada");
    const off = int.bp(upkeepDue(view), content.tuning.room.cookedBp);
    expect(off).toBeGreaterThan(0);
    expect(doneWords("city.act.cook", view, COOK)).toBe(`Cooked for the week: ${formatMoney(off, "NGN")} less on this month's living costs.`);
  });

  test("[R-WORLD-005] given Ada at home, when she fetches water, then the tap says the water's share off the living costs", () => {
    const view = engineView("scenario.ada");
    const off = int.bp(upkeepDue(view), content.tuning.room.waterBp);
    expect(doneWords("city.act.fetch-water", view, WATER)).toBe(`Water fetched: ${formatMoney(off, "NGN")} less.`);
  });

  test("[R-WORLD-005] given no living costs to take a share of, when the pot goes on, then the tap keeps its plain words", () => {
    const view = { ...engineView("scenario.ada"), obligations: [] };
    expect(doneWords("city.act.cook", view, COOK)).toBe("The pot is on. Food for the week, counted when the month ends.");
  });
});
