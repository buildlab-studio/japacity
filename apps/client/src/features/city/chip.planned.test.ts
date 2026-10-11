// A thing's chip with its act carrying on in the plan (docs/rules/world.md R-WORLD-005, R-WORLD-007; the maintainer's
// a month-act started at a thing carries on each month until it is stopped, so its chip
// says Ongoing, shut, with a stop beside it that takes it out of the plan.
import { describe, expect, test } from "vitest";

import parlourRaw from "../../../public/assets/places/family-house-parlour/place.json";
import { engineView } from "../../shared/testing/fixtures";
import { say } from "../../shared/words/text";
import type { Act } from "../../shared/world/contract";
import { withPlanned } from "./acts";
import { chipNode } from "./chip";
import { type PlaceFile, stageOf } from "./placeFile";

const parlour = parlourRaw as unknown as PlaceFile;
const FAMILY = "activity.family-time";

function thingOf(id: string) {
  const thing = (stageOf(parlour).things ?? []).find((candidate) => candidate.id === id);
  if (thing === undefined) throw new Error(`No ${id}`);
  return thing;
}

describe("an ongoing act's chip", () => {
  test("[R-WORLD-007] [R-WORLD-005] given time with family started, when Mama's chip is built, then its button says Ongoing and is shut, and its stop takes it out; with nothing started it is open", () => {
    const view = engineView("scenario.ada");
    const mama = thingOf("mama");
    let tapped = 0;
    const open = chipNode(withPlanned(mama, [null, null, null], view), () => (tapped += 1));
    const openButton = open.querySelector<HTMLButtonElement>(`button[data-activity="${FAMILY}"]`);
    expect(openButton?.disabled).toBe(false);
    expect(open.querySelector("[data-act-stop]")).toBeNull();

    const stopped: Act[] = [];
    const ongoing = chipNode(
      withPlanned(mama, [{ activity: FAMILY, param: null }, null, null], view),
      () => (tapped += 1),
      (act) => stopped.push(act),
    );
    const shut = ongoing.querySelector<HTMLButtonElement>("button[data-planned]");
    expect(shut?.textContent).toBe(say("ui.world.thing.planned"));
    expect(shut?.textContent).toBe("Ongoing");
    expect(shut?.disabled).toBe(true);
    shut?.click();
    expect(tapped).toBe(0);
    const stop = ongoing.querySelector<HTMLButtonElement>("button[data-act-stop]");
    expect(stop?.textContent).toBe("Stop");
    stop?.click();
    expect(stopped.map((act) => act.stages)).toEqual([FAMILY]);
  });

  test("[R-WORLD-007] given only time with family started, when Mama's chip is built, then her other act is still open", () => {
    const view = engineView("scenario.ada");
    const chip = chipNode(withPlanned(thingOf("mama"), [{ activity: FAMILY, param: null }, null, null], view), () => undefined);
    const other = [...chip.querySelectorAll<HTMLButtonElement>("button[data-act]")].filter((button) => button.dataset["activity"] !== FAMILY);
    for (const button of other) expect(button.disabled).toBe(false);
  });
});
