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
    expect(agent?.acts.map((act) => [act.kind, sceneWords(act.label)])).toEqual([["plain", "Agent"]]);
    expect(sceneWords(`${agent?.acts[0]?.label ?? ""}.done`)).toMatch(/^The desk is empty today\. /);
    expect(sceneWords(agent?.label ?? "")).toBe(sceneWords(thing("desk").label));
  });

  test("[R-WORLD-005] given the agent's act, when what stands in its place is read, then it names every entry the desk's acts open, so it shows only while none of them can", () => {
    const listed = thing("desk").acts.flatMap((act) => [act.stages, ...(act.more ?? [])]);
    const ask = thing("agent").acts[0] as Act & { unless?: string[] };
    expect([...(ask.unless ?? [])].sort()).toEqual([...listed].sort());
    expect(thingSpot(stage, thing("agent"))).toEqual(thingSpot(stage, thing("desk")));
  });
});

describe("the agent's ask stands in for the desk", () => {
  test("[R-WORLD-005] given an entry the desk lists open, when the office's things are read, then the desk's act shows and the agent's ask is gone; with none open, the ask stays", () => {
    const read = (open: string[]) => thingsNow(things, stagedNow(new Set(), new Set(entry.stages), new Set(open), null));
    const open = read(["offer.held-funds-agent"]);
    expect(open.find((candidate) => candidate.id === "desk")?.acts.map((act) => act.stages)).toEqual(["offer.held-funds-agent"]);
    expect(open.find((candidate) => candidate.id === "agent")).toBeUndefined();
    expect(read([]).find((candidate) => candidate.id === "agent")?.acts.map((act) => act.id)).toEqual(["ask"]);
  });
});

// with nothing on, the agent still says what he does and when to come back,
// and the chip under his name says Agent, not "Ask what is on".
describe("the agent with nothing on", () => {
  test("[R-WORLD-005] given the desk with no offer open, when the agent's act is read, then its chip says Agent and its line keeps the empty desk, then says what he does and when to come back, two short lines more", () => {
    const view = heldFundsOpen();
    const agent = thingsNow(things, stagedNow(offeredFrom(view), new Set(entry.stages), new Set(view.offers.map((offer) => offer.entry)), null)).find((candidate) => candidate.id === "agent");
    expect(agent?.acts.map((act) => [act.kind, sceneWords(act.label)])).toEqual([["plain", "Agent"]]);
    const said = sceneWords(`${agent?.acts[0]?.label ?? ""}.done`).split(/(?<=\.) /);
    expect(said).toEqual(["The desk is empty today.", "He does papers, proof of funds and Dubai jobs.", "Try him again next month."]);
    for (const line of said.slice(1)) expect(line.split(" ").length).toBeLessThanOrEqual(10);
  });
});
