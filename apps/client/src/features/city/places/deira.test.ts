// Deira rebuilt as one souk frontage (city.md place.deira, world.md R-WORLD-011): the gold shops' and
// the cafeteria's arcades across the road with the cafe's table under the colonnade, and on the near
// pavement the spice stall, a taxi and the corner where the community meets. It is the hub in Dubai.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/deira/place.json";
import { sceneWords } from "../scene.words";
import { stagedAt } from "../staging";
import { frontageTests } from "./frontageTesting";
import { copiesOf, staged, wordsOf } from "./placeTesting";

const ID = "place.deira";
const { file, stage, entry } = staged(raw, ID);
const thing = (id: string) => {
  const found = (stage.things ?? []).find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`No ${id}`);
  return found;
};

describe("Deira", () => {
  frontageTests(raw, ID);

  test("[R-CITY-013] given the hub in Dubai, when its file is read, then the entry is the country's hub and the file is not the first download", () => {
    expect(entry.hub).toBe(true);
    expect(file.hub).toBe(false);
  });

  test("[R-WORLD-005] given the corner, when its act is read, then the community in Dubai opens as a sheet under its own words", () => {
    const corner = thing("corner");
    expect(corner.acts.map((act) => [act.kind, act.stages, sceneWords(act.label)])).toEqual([["sheet", "activity.community-uae", "Community"]]);
    expect(stagedAt("activity.community-uae", { where: "abroad", country: "country.uae" }, Object.values(content.place))).toBe(ID);
  });

  test("[R-WORLD-005] given the souk's other things, when they are read, then the gold shop and the spice stall are looked at, the cafe's chairs are sat on, and the taxi opens the ride sheet", () => {
    expect(thing("gold-shop").acts.map((act) => act.kind)).toEqual(["plain"]);
    expect(thing("spice-stall").acts.map((act) => act.kind)).toEqual(["plain"]);
    expect(thing("cafe").acts.map((act) => [act.kind, sceneWords(act.label)])).toEqual([["plain", "Sit"]]);
    expect(thing("taxi").acts.map((act) => act.kind)).toEqual(["ride"]);
    expect(thing("taxi").file).toBe("places/deira/veh_taxi-dubai.glb");
  });

  test("[R-CITY-024] given the arcades across the road, when their boards are read, then the gold shops stand under at least two gold boards and the cafe under the cafeteria's", () => {
    const words = stage.models.flatMap((model) => (model.signs ?? []).flat()).map(wordsOf);
    expect(words.filter((said) => said.includes("GOLD")).length).toBeGreaterThanOrEqual(2);
    const lettered = stage.models.find((model) => model.file.endsWith("bld_deira-arcade_b.glb"));
    const [arcade] = copiesOf(stage, "bld_deira-arcade_b.glb");
    const [table] = copiesOf(stage, "prop_dining-table.glb");
    if (lettered === undefined || arcade === undefined || table === undefined) throw new Error("No cafe");
    // The cafeteria's board is the arcade's first, four metres left of its middle (bld/deira-arcade/b).
    expect(wordsOf(lettered.signs?.[0]?.[0] ?? "")).toContain("CAFETERIA");
    expect(Math.abs(table[0] - (arcade[0] - 4))).toBeLessThan(1);
  });
});
