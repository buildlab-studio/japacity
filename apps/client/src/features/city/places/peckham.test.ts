// Peckham rebuilt as one frontage on Rye Lane (city.md place.peckham, world.md R-WORLD-011): the
// shops across the road with the grocer's produce out front and the hair shop beside it, and on the
// near pavement the bus stop and a bench. It is the hub abroad in London; the community act is staged
// in the room abroad, not here.
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/peckham/place.json";
import room from "../../../../public/assets/places/the-room/place.json";
import { stageOf, type PlaceFile } from "../placeFile";
import { sceneWords } from "../scene.words";
import { frontageTests } from "./frontageTesting";
import { copiesOf, staged, wordsOf } from "./placeTesting";

const ID = "place.peckham";
const { file, stage, entry } = staged(raw, ID);
const thing = (id: string) => {
  const found = (stage.things ?? []).find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`No ${id}`);
  return found;
};

describe("Peckham", () => {
  frontageTests(raw, ID);

  test("[R-CITY-013] given the hub abroad in London, when its file is read, then the entry is the country's hub and the file is not the first download, and the community act waits in the room abroad", () => {
    expect(entry.hub).toBe(true);
    expect(file.hub).toBe(false);
    const window = (stageOf(room as unknown as PlaceFile).things ?? []).flatMap((candidate) => candidate.acts.map((act) => act.stages));
    expect(window).toContain("activity.community-uk");
  });

  test("[R-WORLD-005] given Rye Lane's things, when they are read, then the grocer and the barber are looked at, the bench is sat on and the bus stop opens the ride sheet", () => {
    expect(thing("grocer").acts.map((act) => act.kind)).toEqual(["plain"]);
    expect(thing("barber").acts.map((act) => act.kind)).toEqual(["plain"]);
    expect(thing("bench").acts.map((act) => [act.kind, sceneWords(act.label)])).toEqual([["plain", "Sit"]]);
    expect(thing("stop").acts.map((act) => act.kind)).toEqual(["ride"]);
    expect(thing("bench").file.endsWith("prop_street-bench.glb")).toBe(true);
    expect(thing("stop").file.endsWith("prop_bus-shelter.glb")).toBe(true);
  });

  test("[R-CITY-024] given the terraces across the road, when their boards are read, then the grocer's and the hair shop's boards stand over them, with the Nigerian restaurant along the row", () => {
    const boards = stage.models.flatMap((model) => (model.signs ?? []).flat());
    const words = boards.map(wordsOf);
    expect(words.some((said) => said.includes("AFRO-CARIBBEAN"))).toBe(true);
    expect(words.some((said) => said.includes("HAIR"))).toBe(true);
    expect(words.some((said) => said.includes("NIGERIAN RESTAURANT"))).toBe(true);
    const [grocer] = copiesOf(stage, thing("grocer").file.split("/").pop() ?? "");
    const [terrace] = copiesOf(stage, "bld_rye-lane-terrace_a.glb");
    const lettered = stage.models.find((model) => model.file.endsWith("bld_rye-lane-terrace_a.glb"));
    if (grocer === undefined || terrace === undefined || lettered === undefined) throw new Error("No grocer or terrace");
    expect(wordsOf(lettered.signs?.[0]?.[2] ?? "")).toContain("AFRO-CARIBBEAN");
    // The grocer's board is the row's third, five metres right of its middle (bld/rye-lane-terrace).
    expect(Math.abs(grocer[0] - (terrace[0] + 5))).toBeLessThan(1);
  });

  test("[R-WORLD-011] given the bus stop and the bench, when the near pavement is read, then both stand between the kerb and the player's start", () => {
    const kerb = Math.max(...stage.roads.filter((road) => road.raise !== undefined && road.raise > 0.1).map((road) => road.at[1]));
    for (const id of ["stop", "bench"]) {
      const [, z] = copiesOf(stage, thing(id).file.split("/").pop() ?? "")[0] ?? [0, 0];
      expect(z).toBeGreaterThan(kerb);
      expect(z).toBeLessThan(stage.start[1]);
    }
  });
});
