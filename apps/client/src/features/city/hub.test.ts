// The hub's place file against the counts the build check makes (tools/assets/check-assets.ts) and
// against what the hub must show: the junction under the flyover where the danfos load.
import { join } from "node:path";

import { isPaletteName } from "@japacity/assets";
import { FLYOVER } from "@japacity/assets-src/bld/flyover-span/build";
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import budgets from "../../../../../assets-src/budgets.json";
import { measureFile, placeTotals, type PlaceFile as CheckedPlace } from "../../../../../tools/assets/check-assets";
import hubFile from "../../../public/assets/places/ojuelegba/place.json";
import { crowdSize } from "./crowd";
import type { PlaceFile } from "./placeFile";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..", "..");
const PUBLIC = join(ROOT, "apps", "client", "public", "assets");
const file = hubFile as unknown as PlaceFile;
const stage = file.stage;
if (stage === undefined) throw new Error("The hub has no stage");
const hub = content.place["place.ojuelegba"];
if (hub === undefined) throw new Error("The hub is missing from content");
const city = content.tuning.city;
const at = (name: string): [number, number, number][] => stage.models.find((model) => model.file.endsWith(name))?.at ?? [];

describe("the hub's budget", () => {
  test("[R-ASSET-007] given the hub's shipped files measured as the build check measures them, when its place is counted, then the low mode fits the first-load row and the high mode the exterior row", async () => {
    const files = [...new Set([...file.instances.map((instance) => instance.file), ...file.people.sample])];
    const measured = new Map(await Promise.all(files.map(async (path) => [path, await measureFile({ root: ROOT, source: join(ROOT, "assets-src"), public: PUBLIC, dist: "" }, path)] as const)));
    const { totals, missing } = placeTotals(hubFile as unknown as CheckedPlace, measured);
    expect(missing).toEqual([]);
    expect(totals.low.drawCalls).toBeLessThanOrEqual(budgets.place.firstLoad.drawCalls);
    expect(totals.low.triangles).toBeLessThanOrEqual(budgets.place.firstLoad.triangles);
    expect(totals.high.drawCalls).toBeLessThanOrEqual(budgets.place.exterior.drawCalls);
    expect(totals.high.triangles).toBeLessThanOrEqual(budgets.place.exterior.triangles);
  });

  test("[R-ASSET-007] given the hub's file, when its counts are read, then every model's copies are the instances counted, the crowd is the sample the client shows in each mode, and the floor is one draw call", () => {
    expect(file.instances).toEqual(stage.models.map((model) => ({ file: model.file, count: model.at.length })));
    expect(file.people.low).toBe(crowdSize(hub, "low", city));
    expect(file.people.high).toBe(crowdSize(hub, "high", city));
    expect(hubFile.groundRoadSky.drawCalls).toBe(1);
    expect([stage.ground.colour, ...stage.roads.flatMap((road) => [road.colour, road.dash?.colour ?? road.colour])].every(isPaletteName)).toBe(true);
  });
});

describe("the junction", () => {
  test("[R-CITY-013] given the hub's stage, when it is read, then the flyover runs across it in two rows of spans the map data's gap apart, pier to pier, with danfos and a keke at the kerb under it and a stall beneath it", () => {
    const spans = at("bld_flyover-span.glb");
    const rows = [...new Set(spans.map(([, z]) => z))].sort((one, two) => one - two);
    expect(rows).toHaveLength(2);
    expect((rows[1] ?? 0) - (rows[0] ?? 0)).toBeCloseTo(FLYOVER.rowGap, 6);
    for (const row of rows) {
      const xs = spans.filter(([, z]) => z === row).map(([x]) => x).sort((one, two) => one - two);
      xs.slice(1).forEach((x, index) => expect(x - (xs[index] ?? 0)).toBe(FLYOVER.span));
      expect((xs[xs.length - 1] ?? 0) - (xs[0] ?? 0) + FLYOVER.span).toBeGreaterThanOrEqual(stage.ground.size[0]);
    }
    const south = Math.max(...rows);
    const underside = [south + FLYOVER.deckWidth / 2, Math.min(...rows) - FLYOVER.deckWidth / 2];
    const kerb = stage.roads.find((road) => road.raise !== undefined && road.dash !== undefined);
    if (kerb === undefined) throw new Error("The hub has no painted kerb");
    expect(kerb.dash?.colour).not.toBe(kerb.colour);
    const atKerb = ([, z]: [number, number, number]): boolean => z < kerb.at[1] && z > kerb.at[1] - 3;
    expect(at("veh_danfo.glb").filter(atKerb).length).toBeGreaterThanOrEqual(2);
    expect(at("veh_keke.glb").filter(atKerb).length).toBeGreaterThanOrEqual(1);
    expect(at("prop_stall.glb").some(([, z]) => z < (underside[0] ?? 0) && z > (underside[1] ?? 0))).toBe(true);
    expect(at("bld_plaza.glb")).toHaveLength(1);
    expect(stage.roads.some((road) => road.colour === "drain")).toBe(true);
  });

  test("[R-CITY-024] given the shop row standing twice, when its copies are lettered, then each copy has its own sign keys and no key shows on two copies", () => {
    const row = stage.models.find((model) => model.file.endsWith("bld_shop-row.glb"));
    expect(row?.signs).toHaveLength(row?.at.length ?? 0);
    const keys = (row?.signs ?? []).flat();
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => /^place\.ojuelegba\.sign\.\d+$/.test(key))).toBe(true);
  });

  test("[R-CITY-014] given the hub's crowd spots, when the high mode's sample stands, then there are spots for all of it, the low mode's first spots are at the loading point and the stall, and two stand on the road edge", () => {
    const high = crowdSize(hub, "high", city);
    const low = crowdSize(hub, "low", city);
    expect(stage.people.length).toBeGreaterThanOrEqual(high);
    const kerb = stage.roads.find((road) => road.raise !== undefined)?.at[1] ?? 0;
    const roadEdge = stage.people.slice(0, high).filter(([, z]) => z < kerb && z > kerb - 2.5);
    expect(roadEdge.length).toBeGreaterThanOrEqual(2);
    const stall = at("prop_stall.glb").find(([, z]) => z < kerb - 3);
    if (stall === undefined) throw new Error("No stall under the bridge");
    const round = stage.people.slice(0, low).filter(([x, z]) => Math.hypot(x - stall[0], z - stall[1]) < 2);
    expect(round.length).toBeGreaterThanOrEqual(2);
    for (const indices of Object.values(stage.prefer ?? {})) for (const index of indices) expect(index).toBeLessThan(high);
  });
});
