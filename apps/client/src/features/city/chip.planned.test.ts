// A thing's chip with its act already in the month's plan (docs/rules/turn.md R-TURN-006, activity.md R-ACTIVITY-013;
// the maintainer's first play): the cooking corner's and the drum's acts fill no slot and are planned once, so
// once planned the chip says Planned and its button is shut until the month ends.
import { describe, expect, test } from "vitest";

import compoundRaw from "../../../public/assets/places/compound-room/place.json";
import { engineView } from "../../shared/testing/fixtures";
import { say } from "../../shared/words/text";
import { withPlanned } from "./acts";
import { chipNode } from "./chip";
import { type PlaceFile, stageOf } from "./placeFile";

const compound = compoundRaw as unknown as PlaceFile;
const COOK = "activity.cook-at-home";

function thingOf(id: string) {
  const thing = (stageOf(compound).things ?? []).find((candidate) => candidate.id === id);
  if (thing === undefined) throw new Error(`No ${id}`);
  return thing;
}

describe("a planned act's chip", () => {
  test("[R-TURN-006] given cooking planned this month, when the cooking corner's chip is built, then its button says Planned and is shut; with nothing planned it says Cook for the week and is open", () => {
    const view = engineView("scenario.ada");
    const cooking = thingOf("cooking");
    let tapped = 0;
    const open = chipNode(withPlanned(cooking, [null, null], view), () => (tapped += 1));
    const openButton = open.querySelector<HTMLButtonElement>("button[data-act]");
    expect(openButton?.textContent).toBe("Cook for the week");
    expect(openButton?.disabled).toBe(false);

    const planned = chipNode(withPlanned(cooking, [null, null, { activity: COOK, param: null }], view), () => (tapped += 1));
    const shut = planned.querySelector<HTMLButtonElement>("button[data-act]");
    expect(shut?.textContent).toBe(say("ui.activity.planned"));
    expect(shut?.textContent).toBe("Planned");
    expect(shut?.disabled).toBe(true);
    shut?.click();
    expect(tapped).toBe(0);
  });

  test("[R-TURN-006] given only cooking planned, when the drum's chip is built, then the water is still open", () => {
    const view = engineView("scenario.ada");
    const drum = chipNode(withPlanned(thingOf("drum"), [null, { activity: COOK, param: null }], view), () => undefined);
    const button = drum.querySelector<HTMLButtonElement>("button[data-act]");
    expect(button?.disabled).toBe(false);
    expect(button?.textContent).toBe("Fetch water");
  });
});
