// The hub's place file against the counts the build check makes (tools/assets/assets-check.ts) and
// against what the hub must show: the junction under the flyover where the danfos load.
import { join } from "node:path";

import { isPaletteName } from "@japacity/model-kit";
import { FLYOVER } from "@japacity/models/buildings/flyover-span/build";
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import budgets from "../../../../../../models/budgets.json";
import { measureFile, placeTotals, type PlaceFile as CheckedPlace } from "../../../../../../tools/assets/assets-check";
import hubFile from "../../../../public/assets/places/ojuelegba/place.json";
import { cameraAim } from "./camera";
import { crowdSize } from "../../../shared/scene/crowd";
import type { PlaceFile } from "../../../shared/scene/placeFile";
import { personOf } from "../../../shared/scene/roster";
import { groundGeometry } from "../../../shared/scene/world";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..", "..", "..");
const PUBLIC = join(ROOT, "apps", "client", "public", "assets");
const file = hubFile as unknown as PlaceFile;
const stage = file.stage;
if (stage === undefined) throw new Error("The hub has no stage");
const hub = content.place["place.ojuelegba"];
if (hub === undefined) throw new Error("The hub is missing from content");
const city = content.tuning.city;
const at = (name: string): [number, number, number][] => stage.models.find((model) => model.file.endsWith(name))?.at ?? [];

describe("the hub's budget", () => {
  test("[assets:assets-and-places-within-budget] given the hub's shipped files measured as the build check measures them, when its place is counted, then the low mode fits the first-load row and the high mode the exterior row", async () => {
    const files = [...new Set([...file.instances.map((instance) => instance.file), ...file.people.sample])];
    const measured = new Map(await Promise.all(files.map(async (path) => [path, await measureFile({ root: ROOT, source: join(ROOT, "models"), public: PUBLIC, dist: "" }, path)] as const)));
    const { totals, missing } = placeTotals(hubFile as unknown as CheckedPlace, measured);
    expect(missing).toEqual([]);
    expect(totals.low.drawCalls).toBeLessThanOrEqual(budgets.place.firstLoad.drawCalls);
    expect(totals.low.triangles).toBeLessThanOrEqual(budgets.place.firstLoad.triangles);
    expect(totals.high.drawCalls).toBeLessThanOrEqual(budgets.place.exterior.drawCalls);
    expect(totals.high.triangles).toBeLessThanOrEqual(budgets.place.exterior.triangles);
  });

  test("[assets:assets-and-places-within-budget] given the hub's file, when its counts are read, then every model's copies are the instances counted, the crowd is the sample the client shows in each mode, and the floor is one draw call", () => {
    expect(file.instances).toEqual(stage.models.map((model) => ({ file: model.file, count: model.at.length })));
    expect(file.people.low).toBe(crowdSize(hub, "low", city));
    expect(file.people.high).toBe(crowdSize(hub, "high", city));
    expect(hubFile.groundRoadSky.drawCalls).toBe(1);
    expect(hubFile.groundRoadSky.triangles).toBe(groundGeometry(stage).getAttribute("position").count / 3);
    expect([stage.ground.colour, ...stage.roads.flatMap((road) => [road.colour, road.dash?.colour ?? road.colour])].every(isPaletteName)).toBe(true);
  });
});

describe("the junction", () => {
  test("[city:ojuelegba-is-the-hub] given the hub's stage, when it is read, then the flyover runs across it in two rows of spans the map data's gap apart, pier to pier, with danfos and a keke at the kerb under it and a stall beneath it", () => {
    const spans = at("building_flyover-span.glb");
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
    expect(at("vehicle_danfo.glb").filter(atKerb).length).toBeGreaterThanOrEqual(2);
    expect(at("vehicle_keke.glb").filter(atKerb).length).toBeGreaterThanOrEqual(1);
    expect(at("prop_stall.glb").some(([, z]) => z < (underside[0] ?? 0) && z > (underside[1] ?? 0))).toBe(true);
    expect(at("building_plaza.glb")).toHaveLength(1);
    expect(stage.roads.some((road) => road.colour === "drain")).toBe(true);
  });

  test("[city:place-words-are-text-keys] given the shop row standing twice, when its copies are lettered, then each copy has its own sign keys and no key shows on two copies", () => {
    const row = stage.models.find((model) => model.file.endsWith("building_shop-row.glb"));
    expect(row?.signs).toHaveLength(row?.at.length ?? 0);
    const keys = (row?.signs ?? []).flat();
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => /^place\.ojuelegba\.sign\.\d+$/.test(key))).toBe(true);
  });

  test("[city:crowd-sample-capped] given the hub's crowd spots, when the high mode's sample stands, then there are spots for all of it, the low mode's first spots are at the loading point and the stall, and two stand on the road edge", () => {
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

  test("[city:crowd-sample-capped] given the hub's acts, when the sample stands, then a man calls at the danfo's door, a man sits on a parked okada, and people cross the bay and Ojuelegba Road", () => {
    const acts = stage.acts ?? [];
    const low = crowdSize(hub, "low", city);
    const conductor = acts.find((act) => act.pose === "cheer" || act.pose === "sell");
    expect(conductor?.sex).toBe("m");
    expect(conductor?.spot).toBeLessThan(low);
    const door = stage.people[conductor?.spot ?? -1];
    expect(at("vehicle_danfo.glb").some(([x, z]) => door !== undefined && Math.abs(door[0] - x) < 2.5 && door[1] > z && door[1] - z < 1.5)).toBe(true);
    const rider = acts.find((act) => act.pose === "ride");
    const seat = stage.people[rider?.spot ?? -1];
    expect(rider?.spot).toBeLessThan(low);
    expect(at("vehicle_okada.glb").some(([x, z]) => seat !== undefined && Math.hypot(seat[0] - x, seat[1] - z) < 0.5)).toBe(true);
    const crossers = acts.filter((act) => act.to !== undefined);
    expect(crossers.length).toBeGreaterThanOrEqual(2);
    expect(crossers.length).toBeLessThanOrEqual(3);
    const kerb = stage.roads.find((road) => road.raise !== undefined)?.at[1] ?? 0;
    const crossesBay = crossers.some((act) => (stage.people[act.spot]?.[1] ?? 0) > kerb && (act.to?.[1] ?? 0) < kerb - 3);
    const crossesRoad = crossers.some((act) => Math.min(stage.people[act.spot]?.[0] ?? 0, act.to?.[0] ?? 0) < 6 && Math.max(stage.people[act.spot]?.[0] ?? 0, act.to?.[0] ?? 0) > 15);
    expect(crossesBay).toBe(true);
    expect(crossesRoad).toBe(true);
    for (const act of acts) expect(act.spot).toBeLessThan(crowdSize(hub, "high", city));
  });

  test("[city:dress-mix-by-place] given the hub's sample, when its outfits are read, then no one at the bus stop wears a crop top and denim shorts", () => {
    expect(file.people.sample).not.toContain("shared/person/person_tolani.glb");
    expect(file.people.sample.every((path) => personOf(path) !== null)).toBe(true);
  });

  test("[city:players-carry-name-tags] given the phone's first view, when the line from the camera through the player's indicator runs on, then it passes clear of every danfo's roof load", () => {
    const [x, z, heading] = stage.start;
    const { position } = cameraAim({ x, z }, heading, 0, 412 / 915);
    const indicator = [x, 1.98, z] as const;
    // The rack and its load run from 1.9 m behind a danfo's middle to 1.1 m ahead of it, from 1.95 m to 2.45 m up.
    for (const [danfoX, danfoZ, turn] of at("vehicle_danfo.glb")) {
      expect(turn).toBeCloseTo(Math.PI / 2, 3);
      for (const side of [danfoZ - 0.875, danfoZ + 0.875]) {
        const share = (side - position[2]) / (indicator[2] - position[2]);
        const crossX = position[0] + (indicator[0] - position[0]) * share;
        const crossY = position[1] + (indicator[1] - position[1]) * share;
        const behindRack = crossX > danfoX - 1.9 - 0.3 && crossX < danfoX + 1.1 + 0.3 && crossY < 2.45 + 0.3;
        expect(behindRack).toBe(false);
      }
    }
  });

  test("[city:ojuelegba-is-the-hub] given the phone's first view, when the near pavement is read, then a parked okada stands between the camera and the player inside the frame, so the lower frame is not bare", () => {
    const [x, z, heading] = stage.start;
    const { position } = cameraAim({ x, z }, heading, 0, 412 / 915);
    const near = at("vehicle_okada.glb").filter(([okadaX, okadaZ]) => {
      const depth = position[2] - okadaZ;
      const halfWidth = depth * Math.tan((16 * Math.PI) / 180) * (412 / 915);
      return okadaZ > z && okadaZ < position[2] && Math.abs(okadaX - position[0]) < halfWidth;
    });
    expect(near.length).toBeGreaterThanOrEqual(1);
  });
});

