// Own work opened with its capital, and the trades' side jobs, where the work is (activity:capital-opens-own-work,
// activity:fish-racks-at-makoko, activity:each-trade-climbs-its-ladder): the kiln at the racks and the canoes' trade and deliveries at
// Makoko, the POS stand at Ojuelegba's stall, the weekend repairs at a bench in Computer Village. Each stands on a model already in the
// scene, opens its act as a sheet that names the cost before the tap (world:costly-acts-confirmed), and has its words in content.
import { content, text } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import computerVillageRaw from "../../../../public/assets/places/computer-village/place.json";
import makokoRaw from "../../../../public/assets/places/makoko/place.json";
import ojuelegbaRaw from "../../../../public/assets/places/ojuelegba-front/place.json";
import { cityWords } from "../city.words";
import { staged } from "./place.testing";

const PLACES: { raw: unknown; id: Id<"place">; things: { thing: string; model: string; stages: string[] }[] }[] = [
  {
    raw: makokoRaw,
    id: "place.makoko",
    things: [
      { thing: "kiln", model: "places/makoko/prop_fish-racks.glb", stages: ["activity.buy-kiln"] },
      { thing: "canoe-trade", model: "places/third-mainland-bridge/prop_canoe.glb", stages: ["activity.canoe-deliveries", "activity.start-fish-trade"] },
    ],
  },
  { raw: ojuelegbaRaw, id: "place.ojuelegba", things: [{ thing: "pos", model: "shared/prop/prop_stall.glb", stages: ["activity.open-pos-stand"] }] },
  { raw: computerVillageRaw, id: "place.computer-village", things: [{ thing: "repairs", model: "places/computer-village/prop_repair-table.glb", stages: ["activity.phone-repairs"] }] },
];

describe.each(PLACES)("own work and side jobs at $id", ({ raw, id, things }) => {
  const { stage, entry } = staged(raw, id);

  test.each(things)(`[activity:capital-opens-own-work] [world:things-are-tappable-models] given ${id}'s $thing, when it is read, then it stands at a model copy already in the scene, beside it, with one sheet for each act it stages and its words in content`, ({ thing: thingId, model, stages }) => {
    const thing = stage.things?.find((each) => each.id === thingId);
    if (thing === undefined) throw new Error(`No ${thingId} at ${id}.`);
    expect(thing.file).toBe(model);
    const copies = stage.models.filter((each) => each.file === model).flatMap((each) => each.at);
    const copy = copies[thing.copy];
    if (copy === undefined) throw new Error(`${thingId} names a copy the scene does not have.`);
    expect(Math.hypot((thing.at?.[0] ?? copy[0]) - copy[0], (thing.at?.[1] ?? copy[1]) - copy[1])).toBeLessThan(3.5);
    expect(thing.acts.length).toBeLessThanOrEqual(2);
    expect(thing.acts.map((act) => [act.kind, act.stages])).toEqual(stages.map((staging) => ["sheet", staging]));
    expect(cityWords(thing.label)).not.toBe(thing.label);
    for (const act of thing.acts) expect(cityWords(act.label)).not.toBe(act.label);
    for (const staging of stages) {
      expect(entry.stages).toContain(staging);
      expect(content.activity[staging as Id<"activity">]).toBeDefined();
      expect(text[`${staging}.name`]?.trim()).toBeTruthy();
    }
  });
});
