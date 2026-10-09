// The agent's office: the agent at his desk is someone to ask even when nothing is on (docs/rules/world.md
// R-WORLD-005).
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/agent-office/place.json";
import type { Act } from "../../../shared/world/contract";
import { sceneWords } from "../scene.words";
import { stagedNow, thingSpot, thingsNow } from "../things";
import { heldFundsOpen, offeredFrom } from "./offices.testing";
import { staged } from "./placeTesting";

const { stage, entry } = staged(raw, "place.agent-office");
const things = stage.things ?? [];
const thing = (id: string) => {
  const found = things.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`No ${id}`);
  return found;
};

describe("the agent's office", () => {
  test("[R-WORLD-005] given the recorded life after the deposit, with nothing on at the desk, when the office's things are read, then the agent still stands at his desk with one act to ask, and its line says nothing is on today", () => {
    const view = heldFundsOpen();
    const shown = thingsNow(things, stagedNow(offeredFrom(view), new Set(entry.stages), new Set(view.offers.map((offer) => offer.entry)), null));
    expect(shown.find((candidate) => candidate.id === "desk")).toBeUndefined();
    const agent = shown.find((candidate) => candidate.id === "agent");
    expect(agent?.acts.map((act) => [act.kind, sceneWords(act.label)])).toEqual([["plain", "Ask what is on"]]);
    expect(sceneWords(`${agent?.acts[0]?.label ?? ""}.done`)).toBe("The desk is empty today. Come back when something is on.");
    expect(sceneWords(agent?.label ?? "")).toBe(sceneWords(thing("desk").label));
  });

  test("[R-WORLD-005] given the agent's act, when what stands in its place is read, then it names every entry the desk's acts open, so it shows only while none of them can", () => {
    const listed = thing("desk").acts.flatMap((act) => [act.stages, ...(act.more ?? [])]);
    const ask = thing("agent").acts[0] as Act & { unless?: string[] };
    expect([...(ask.unless ?? [])].sort()).toEqual([...listed].sort());
    expect(thingSpot(stage, thing("agent"))).toEqual(thingSpot(stage, thing("desk")));
  });
});
