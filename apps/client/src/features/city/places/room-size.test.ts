// The room abroad at its length (world:place-is-one-screen): the room abroad is about 16 by 9 metres, so seen down its length it fills a phone held upright. The homes at
// home are wide floors (homes.test.ts). Nothing floats: every piece stands on the floor between the walls, the
// bed, the window and the side table against the back wall, and both modes stay inside the indoor row's budget. Read from the shipped files, measured as the build check measures them, and passed through
// the place check itself.
import { type Footprint, placeFootprint } from "@japacity/model-kit";
import { describe, expect, test } from "vitest";

import { ROOMS } from "../../../../../../models/buildings/room/rooms";
import { checkLimits, type LimitedFile, walkableSize } from "../../../../../../tools/assets/world-check";
import roomRaw from "../../../../public/assets/places/the-room/place.json";
import { type PlaceFile, stageOf } from "../../../shared/scene/placeFile";
import { measured, rowOf, totalsOf } from "./place.testing";

const room = roomRaw as unknown as PlaceFile;
const LONG: readonly [number, number] = [16, 9];
// The homes at home are wide floors, their sizes and pieces tested in homes.test.ts; the room
// abroad keeps its length.
const ROOMS_HERE = [{ name: "the room abroad", file: room, shell: ROOMS.abroad, size: LONG, side: 1, against: ["prop_bed.glb", "prop_window-frame.glb", "prop_side-table.glb"] }] as const;

/** Each copy of each model but the room's own shell, with its footprint boxes' extents in the place's frame. */
async function extents(file: PlaceFile): Promise<{ file: string; x0: number; x1: number; z0: number; z1: number }[]> {
  const stage = stageOf(file);
  const pieces = stage.models.filter((model) => !model.file.includes("/bld_room_"));
  const shows = (stage.shows ?? []).flatMap((show) => show.models);
  const out: { file: string; x0: number; x1: number; z0: number; z1: number }[] = [];
  for (const model of [...pieces, ...shows]) {
    const footprint = (await measured(model.file)).extras.footprint as Footprint;
    for (const at of model.at) {
      for (const box of placeFootprint(footprint, at)) {
        const halfX = Math.abs(box.halfWidth * box.cos) + Math.abs(box.halfDepth * box.sin);
        const halfZ = Math.abs(box.halfWidth * box.sin) + Math.abs(box.halfDepth * box.cos);
        out.push({ file: model.file.split("/").pop() ?? model.file, x0: box.x - halfX, x1: box.x + halfX, z0: box.z - halfZ, z1: box.z + halfZ });
      }
    }
  }
  return out;
}

describe("the room at its length", () => {
  test("[world:place-is-one-screen] [world:room-seen-down-its-length] given the room abroad, when its shell is read and measured, then it is 16 by 9 metres inside, its long side along x, the way the camera looks down it", async () => {
    for (const { name, file, shell, size } of ROOMS_HERE) {
      const [LENGTH, WIDTH] = size;
      expect({ name, size: shell.size }).toEqual({ name, size: [LENGTH, WIDTH] });
      const shipped = await measured(stageOf(file).models[0]!.file);
      // The walls stand 0.2 m thick outside the floor, their heads a little more.
      expect(shipped.size[0]).toBeGreaterThan(LENGTH);
      expect(shipped.size[0]).toBeLessThan(LENGTH + 0.5);
      expect(shipped.size[2]).toBeGreaterThan(WIDTH);
      expect(shipped.size[2]).toBeLessThan(WIDTH + 0.5);
    }
  });

  test("[world:place-is-one-screen] given each room's ground and walkable floor, when the place check reads them, then the floor runs as its shell does, about 16 by 9 metres, and the check passes, as it does a bare 16 by 9 room; a hall of 20 by 20 still fails", () => {
    for (const { name, file, size } of ROOMS_HERE) {
      const [LENGTH, WIDTH] = size;
      const stage = stageOf(file);
      expect({ name, ground: stage.ground.size }).toEqual({ name, ground: [LENGTH + 0.6, WIDTH + 0.6] });
      const [long, short] = walkableSize(stage);
      expect(long).toBeGreaterThan(LENGTH - 1);
      expect(short).toBeGreaterThan(WIDTH - 1);
      expect(checkLimits(file as unknown as LimitedFile)).toEqual([]);
    }
    const bare = (walkable: [number, number][]): LimitedFile => ({ place: "place.room", scope: "interior", people: { low: 4, high: 6 }, stage: { ground: { size: [20, 20] }, motion: [], walkable: [walkable], shot: { width: 10 } } });
    expect(checkLimits(bare([[-8, -4.5], [8, -4.5], [8, 4.5], [-8, 4.5]]))).toEqual([]);
    expect(checkLimits(bare([[-10, -10], [10, -10], [10, 10], [-10, 10]]))[0]).toMatch(/is a room of 20.0 by 20.0 m/);
  });

  test("[world:place-is-one-screen] [world:room-seen-down-its-length] given every piece in each room, when its footprint is placed, then it stands on the floor between the walls, the bed, the window and the side table against the back wall, and the door is on the side wall", async () => {
    for (const { name, file, side, against, size } of ROOMS_HERE) {
      const [LENGTH, WIDTH] = size;
      const pieces = await extents(file);
      for (const piece of pieces) {
        const inside = piece.x0 >= -LENGTH / 2 - 0.02 && piece.x1 <= LENGTH / 2 + 0.02 && piece.z0 >= -WIDTH / 2 - 0.02 && piece.z1 <= WIDTH / 2;
        expect({ name, piece: piece.file, inside }).toEqual({ name, piece: piece.file, inside: true });
      }
      for (const wanted of against) {
        const nearest = Math.min(...pieces.filter((piece) => piece.file === wanted).map((piece) => piece.z0 + WIDTH / 2));
        expect({ name, wanted, against: nearest < 0.3 }).toEqual({ name, wanted, against: true });
      }
      const door = pieces.find((piece) => piece.file === "prop_room-door.glb");
      if (door === undefined) throw new Error(`${name} has no door`);
      expect(Math.abs((side < 0 ? door.x0 : door.x1) - (side * LENGTH) / 2)).toBeLessThan(0.1);
    }
  });

  test("[world:place-is-one-screen] given each room at its length, when it is counted as the build check counts it, then both modes stay inside the indoor row's budget", async () => {
    for (const { file } of ROOMS_HERE) {
      const totals = await totalsOf(file);
      for (const mode of ["low", "high"] as const) {
        expect(totals[mode].drawCalls).toBeLessThanOrEqual(rowOf(file).drawCalls);
        expect(totals[mode].triangles).toBeLessThanOrEqual(rowOf(file).triangles);
      }
    }
  });
});
