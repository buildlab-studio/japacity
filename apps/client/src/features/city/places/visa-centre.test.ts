// The visa centre: once the interview is over and its sheet closes, the desk is still there to ask
// (docs/rules/world.md R-WORLD-005).
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/visa-centre/place.json";
import type { Act } from "../../../shared/world/contract";
import { sceneWords } from "../scene.words";
import { stagedNow, thingSpot, thingsNow } from "../things";
import { heldFundsOpen, offeredFrom } from "./offices.testing";
import { staged } from "./placeTesting";

const { stage, entry } = staged(raw, "place.visa-centre");
const things = stage.things ?? [];
const thing = (id: string) => {
  const found = things.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`No ${id}`);
  return found;
};

describe("the visa desk after the interview", () => {
  test("[R-INTERVIEW-005] given the recorded life after its interview, when the visa centre's things are read, then the desk still stands with one act to ask, and its line says nothing waits there", () => {
    const view = heldFundsOpen();
    expect(view.setpiece).toBeNull();
    const shown = thingsNow(things, stagedNow(offeredFrom(view), new Set(entry.stages), new Set(view.offers.map((offer) => offer.entry)), null));
    expect(shown.find((candidate) => candidate.id === "desk")).toBeUndefined();
    const officer = shown.find((candidate) => candidate.id === "officer");
    expect(sceneWords(officer?.label ?? "")).toBe("Visa desk");
    // The officer says it over his own head (R-WORLD-005).
    expect(officer?.acts.map((act) => [act.kind, sceneWords(act.label), sceneWords(`${act.label}.who`), sceneWords(`${act.label}.says`)])).toEqual([["plain", "Ask at the desk", "The officer", "Nothing for you today."]]);
  });

  test("[R-INTERVIEW-005] given the desk's ask, when what stands in its place is read, then it names the application and the interview, the desk's own acts, at the desk's own spot", () => {
    const listed = thing("desk").acts.flatMap((act) => [act.stages, ...(act.more ?? [])]);
    const ask = thing("officer").acts[0] as Act & { unless?: string[] };
    expect([...(ask.unless ?? [])].sort()).toEqual([...listed].sort());
    expect(listed).toContain("setpiece.credibility-interview");
    expect(thingSpot(stage, thing("officer"))).toEqual(thingSpot(stage, thing("desk")));
  });
});
