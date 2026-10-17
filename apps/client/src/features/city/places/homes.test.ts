// The homes as wide floors: the family house, the room in a
// compound and the hostel room, each one house of walled rooms seen whole straight down its length, the near walls cut
// low (world.md R-WORLD-029), and turned a quarter at a time with its walls following
// the view. Each is passed through the checks every staged place
// owes: its file measured as the build check measures it, its limits, its floors, its walkable ground with every spot,
// the start and each dressing's spots clear of the footprints, its things and their words, its light by the clock.
import { type Footprint, fullSides, isFootprint, placeFootprint, WALL_SIDES } from "@japacity/assets";
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { afterEach, describe, expect, test, vi } from "vitest";

import { KNEE, kneeHigh, type WallSpec } from "../../../../../../assets-src/bld/home/build";
import { HOMES3 } from "../../../../../../assets-src/bld/home/homes3";
import budgets from "../../../../../../assets-src/budgets.json";
import { checkFaces, type ModelFace } from "../../../../../../tools/assets/faces-check";
import { checkWalkable } from "../../../../../../tools/assets/footprint-check";
import { checkLimits, checkThings, type LimitedFile } from "../../../../../../tools/assets/world-check";
import familyRaw from "../../../../public/assets/places/home-family-house/place.json";
import hostelRaw from "../../../../public/assets/places/home-hostel-house/place.json";
import roomRaw from "../../../../public/assets/places/home-room-house/place.json";
import abroadRaw from "../../../../public/assets/places/the-room/place.json";
import { crowdSize } from "../crowd";
import { CAR_FILE, parkCar, type PlaceFile, stageOf } from "../placeFile";
import { personOfLook } from "../roster";
import { cameraAt, projected, SCREENS } from "../scene.testing";
import { sceneWords } from "../scene.words";
import { aimRoom, easeRoomView, easeZoom, EASE, FULL_TURN, homeTap, ROOM_ACROSS, ROOM_EASE, ROOM_SETTLE, roomAcross, roomAt, roomFirst, roomTarget, SETTLE, SHOT_FOV, shotOf, TOP_PITCH, type ViewEase } from "../shot";
import { thingSpot } from "../things";
import { groundGeometry } from "../world";
import { allPalette, city, instancesOf, measured, rowOf, totalsOf } from "./placeTesting";
import { stubReducedMotion } from "../../../shared/testing/motion";
import { motionReduced } from "../../../shared/ui/motion";

afterEach(() => vi.unstubAllGlobals());

interface Home {
  name: string;
  id: Id<"place">;
  folder: string;
  raw: unknown;
  shell: (typeof HOMES3)[keyof typeof HOMES3];
}

const HOMES: readonly Home[] = [
  { name: "the family house", id: "place.family-house", folder: "home-family-house", raw: familyRaw, shell: HOMES3.family },
  { name: "the room in a compound", id: "place.compound-room", folder: "home-room-house", raw: roomRaw, shell: HOMES3.room },
  { name: "the hostel room", id: "place.hostel-room", folder: "home-hostel-house", raw: hostelRaw, shell: HOMES3.hostel },
];

const fileOf = (home: Home): PlaceFile => home.raw as PlaceFile;

/** Every wall of a shell: the partitions and the wall to the yard, and every outer side as it stands full. */
function wallsOf(home: Home): { from: readonly [number, number]; to: readonly [number, number] }[] {
  return [...home.shell.walls, ...WALL_SIDES.flatMap((side) => home.shell.sides[side])];
}

/** The house's outer walls: the floor the shell stands round, from its walls' ends. */
function outer(home: Home): { x0: number; x1: number; z0: number; z1: number } {
  const ends = wallsOf(home).flatMap((wall) => [wall.from, wall.to]);
  const xs = ends.map(([x]) => x);
  const zs = ends.map(([, z]) => z);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

async function footprintsOf(files: readonly string[]): Promise<Map<string, Footprint>> {
  const found = new Map<string, Footprint>();
  for (const path of files) {
    const footprint = (await measured(path)).extras.footprint;
    if (isFootprint(footprint)) found.set(path, footprint);
  }
  return found;
}

describe.each(HOMES)("$name as a wide floor", (home) => {
  const file = fileOf(home);
  const stage = stageOf(file);
  const entry = content.place[home.id];
  if (entry === undefined) throw new Error(`${home.id} is missing from content`);

  test(`[R-HOME-006] [R-CITY-004] given ${home.id} in content, when its scene is looked for, then its file is the wide home's, and it is a home of Lagos with no real name`, () => {
    expect(entry.assets).toBe(home.folder);
    expect(file.place).toBe(home.id);
    expect(file.scope).toBe(entry.scope);
    expect(entry).toMatchObject({ where: "home", city: "lagos", nameKind: "stylised", realName: null, sponsor: null });
  });

  test(`[R-ASSET-007] given ${home.id}'s shipped files measured as the build check measures them, when the home is counted with its car at its spot, then both modes fit its row and its download fits the row's bytes`, async () => {
    const totals = await totalsOf(file);
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(rowOf(file).drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(rowOf(file).triangles);
    }
    expect(totals.bytes).toBeLessThanOrEqual(budgets.place[file.scope].bytes);
  });

  test(`[R-ASSET-007] given ${home.id}'s file, when its counts are read, then the instances are the most of every model in view, the car at its spot and every dressing and show included, the floor is one draw call of the triangles drawn, and every colour is a palette name`, () => {
    expect(file.instances).toEqual(instancesOf(stage));
    const floor = (home.raw as { groundRoadSky: { drawCalls: number; triangles: number } }).groundRoadSky;
    expect(floor.drawCalls).toBe(1);
    expect(floor.triangles).toBe(groundGeometry(stage).getAttribute("position").count / 3);
    expect(allPalette(stage)).toBe(true);
  });

  test(`[R-WORLD-011] [R-WORLD-005] given ${home.id}'s file, when the place check reads its limits and its things, then it passes: its crowd, its sheets and its size inside the world's numbers, every thing with one or two acts`, () => {
    expect(checkLimits(file as unknown as LimitedFile)).toEqual([]);
    expect(checkThings(file as unknown as LimitedFile)).toEqual([]);
  });

  test(`[R-WORLD-012] given ${home.id}'s models, when their floors are read, then no two overlap within a centimetre of the same height`, async () => {
    const paths = [...new Set([...stage.models.map((model) => model.file), CAR_FILE])];
    const floors = new Map<string, readonly ModelFace[]>(await Promise.all(paths.map(async (path) => [path, (await measured(path)).floors ?? []] as const)));
    expect(checkFaces(home.id, stageOf(parkCar(file, true)), (path) => floors.get(path) ?? [])).toEqual([]);
  });

  test(`[R-ASSET-030] [R-CITY-014] given ${home.id}'s spots, when the place check stands everyone, then the start, every crowd spot and every dressing's spot stand on walkable ground clear of every footprint, the car's included, a spot for everyone the entry shows, none where the player starts, and everyone in the sample a person of the city`, async () => {
    const files = [...new Set([...stage.models, ...(stage.dressings ?? []).flatMap((dressing) => dressing.models)].map((model) => model.file).concat(CAR_FILE))];
    const footprints = await footprintsOf(files);
    expect(checkWalkable(home.id, stageOf(parkCar(file, true)) as Parameters<typeof checkWalkable>[1], footprints)).toEqual([]);
    expect(stage.people.length).toBeGreaterThanOrEqual(crowdSize(entry, "high", city));
    const [x, z] = stage.start;
    expect(stage.people.filter(([px, pz]) => Math.hypot(px - x, pz - z) < 0.8)).toEqual([]);
    expect(file.people.sample.filter((path) => personOfLook(path) === null)).toEqual([]);
    expect(file.people.sample.length).toBeGreaterThan(crowdSize(entry, "high", city));
  });

  test(`[R-WORLD-011] [R-WORLD-029] given every piece in ${home.id}, when its footprint is placed, then it stands on the floor inside the house's outer walls`, async () => {
    const walls = outer(home);
    const footprints = await footprintsOf([...new Set(stage.models.map((model) => model.file))]);
    for (const model of stage.models.filter((one) => !one.file.includes("/bld_home-"))) {
      const footprint = footprints.get(model.file);
      if (footprint === undefined) throw new Error(`${model.file} has no footprint`);
      for (const at of model.at) {
        for (const box of placeFootprint(footprint, at)) {
          const halfX = Math.abs(box.halfWidth * box.cos) + Math.abs(box.halfDepth * box.sin);
          const halfZ = Math.abs(box.halfWidth * box.sin) + Math.abs(box.halfDepth * box.cos);
          const inside = box.x - halfX >= walls.x0 - 0.02 && box.x + halfX <= walls.x1 + 0.02 && box.z - halfZ >= walls.z0 - 0.02 && box.z + halfZ <= walls.z1 + 0.02;
          expect({ piece: model.file, at, inside }).toEqual({ piece: model.file, at, inside: true });
        }
      }
    }
  });

  test(`[R-WORLD-029] [R-ASSET-007] given ${home.id}'s shell, when its walls are read, then each outer side lies on its own edge of the house and stands twice, full height carrying the home's wall things and knee-high on the same line with none, the pair seen at rest the back and the left, and every partition and the wall to the yard cut low with nothing hung on it`, () => {
    const walls = outer(home);
    const edge = { back: (x: number, z: number) => Math.abs(z - walls.z0) < 0.01, left: (x: number) => Math.abs(x - walls.x0) < 0.01, front: (x: number, z: number) => Math.abs(z - walls.z1) < 0.01, right: (x: number) => Math.abs(x - walls.x1) < 0.01 } as const;
    let hung = 0;
    for (const side of WALL_SIDES) {
      const sideWalls: readonly WallSpec[] = home.shell.sides[side];
      expect({ side, walls: sideWalls.length > 0 }).toEqual({ side, walls: true });
      for (const wall of sideWalls) {
        const onEdge = edge[side](wall.from[0], wall.from[1]) && edge[side](wall.to[0], wall.to[1]);
        expect({ side, from: wall.from, to: wall.to, onEdge, full: wall.height >= 2.1 }).toEqual({ side, from: wall.from, to: wall.to, onEdge: true, full: true });
        const knee = kneeHigh(wall);
        expect({ side, height: knee.height, fittings: knee.fittings ?? [], windows: (knee.openings ?? []).filter((opening) => opening.kind === "window").length, leaves: (knee.openings ?? []).filter((opening) => opening.swing !== undefined).length }).toEqual({ side, height: KNEE, fittings: [], windows: 0, leaves: 0 });
        expect(knee.from).toEqual(wall.from);
        expect(knee.to).toEqual(wall.to);
        hung += (wall.fittings ?? []).length;
      }
    }
    expect(hung).toBeGreaterThan(0);
    // At rest the view looks down the length from +z: the back and the left full.
    expect(fullSides(2)).toEqual(["back", "left"]);
    for (const wall of home.shell.walls) expect({ from: wall.from, to: wall.to, low: wall.height <= 1.2, hung: (wall.fittings ?? []).length }).toEqual({ from: wall.from, to: wall.to, low: true, hung: 0 });
  });

  test(`[R-ASSET-007] [R-ASSET-009] given ${home.id}'s shell as shipped, when it is measured as the build check measures it, then it carries the four pairs, its draw calls the body and one wall of each pair, inside a building's budget with one draw call more a pair, and its triangles, both walls of every pair counted, inside a building's`, async () => {
    const shell = await measured(`places/${home.folder}/bld_${home.folder}.glb`);
    expect(shell.pairs).toBe(4);
    expect(shell.drawCalls).toBe(1 + 4);
    expect(shell.drawCalls).toBeLessThanOrEqual(budgets.asset.bld.drawCalls + (shell.pairs ?? 0));
    expect(shell.triangles).toBeLessThanOrEqual(budgets.asset.bld.triangles);
  });

  test(`[R-WORLD-029] [R-WORLD-009] given ${home.id} on a phone held upright, when it opens whole and unturned, then the camera looks straight down its length on a long lens from a raised view, the view free to turn the full circle in quarters, and every corner of the floor and the tops of the back wall stand on screen, the house spanning most of the screen's width`, () => {
    const shot = shotOf(stage);
    expect(shot.yaw).toBe(180);
    expect(shot.turn).toBe(FULL_TURN);
    expect(shot.farPitch).toBeGreaterThan(0);
    expect(shot.farPitch).toBeLessThan(90);
    expect(shot.fov ?? SHOT_FOV).toBeLessThan(SHOT_FOV);
    const aspect = SCREENS.phone;
    const room = stage.rooms?.[0];
    if (room === undefined) throw new Error(`${home.id} has no rooms`);
    const camera = cameraAt(aimRoom(shot, room, 1, aspect), aspect);
    const walls = outer(home);
    const corners: [number, number, number][] = [
      [walls.x0, 0, walls.z0],
      [walls.x1, 0, walls.z0],
      [walls.x1, 0, walls.z1],
      [walls.x0, 0, walls.z1],
      [walls.x0, 3, walls.z0],
      [walls.x1, 3, walls.z0],
    ];
    const seen = corners.map(([x, y, z]) => projected(camera, x, y, z));
    for (const [index, at] of seen.entries()) expect({ corner: corners[index], shown: at.inFront && Math.abs(at.x) <= 1 && Math.abs(at.y) <= 1 }).toEqual({ corner: corners[index], shown: true });
    const near = [seen[2], seen[3]].map((at) => at?.x ?? 0);
    expect(Math.max(...near) - Math.min(...near)).toBeGreaterThan(1.6);
  });

  test(`[R-CLOCK-033] [R-WORLD-005] given ${home.id}'s light, when it is read, then it takes the rooms' light, a bulb glows as the light goes with a real light at it, every lamp inside the house and every lamp's light reaching a room or two, never the whole street`, () => {
    expect(stage.light.room).toBe(true);
    const lamps = stage.light.lamps ?? [];
    expect(lamps.some((lamp) => lamp.bulb === true && lamp.light !== undefined)).toBe(true);
    for (const lamp of lamps) {
      expect(lamp.light?.strength ?? 0).toBeGreaterThan(0);
      expect(lamp.light?.reach ?? 0).toBeGreaterThan(0);
      expect(lamp.light?.reach ?? 99).toBeLessThanOrEqual(10);
    }
    // A handful of real lights at most, so a phone keeps its frame (assets.md R-ASSET-007's interiors).
    expect(lamps.length).toBeLessThanOrEqual(5);
    const walls = outer(home);
    for (const lamp of lamps) {
      expect(lamp.at[0]).toBeGreaterThanOrEqual(walls.x0);
      expect(lamp.at[0]).toBeLessThanOrEqual(walls.x1);
      expect(lamp.at[2]).toBeGreaterThanOrEqual(walls.z0);
      expect(lamp.at[2]).toBeLessThanOrEqual(walls.z1);
    }
  });

  test(`[R-WORLD-005] given ${home.id}'s things, when their names and acts are read, then each stands at a copy of a staged model, its name and every act's label resolve through the scene's words, and the way out opens the map`, () => {
    const things = stage.things ?? [];
    expect(new Set(things.map((thing) => thing.id)).size).toBe(things.length);
    for (const thing of things) {
      const copies = stage.models.find((model) => model.file === thing.file)?.at.length ?? 0;
      expect({ thing: thing.id, staged: thing.copy < copies, spot: thingSpot(stage, thing) !== null, named: sceneWords(thing.label) !== thing.label }).toEqual({ thing: thing.id, staged: true, spot: true, named: true });
      for (const act of thing.acts) expect({ thing: thing.id, act: act.id, named: sceneWords(act.label) !== act.label }).toEqual({ thing: thing.id, act: act.id, named: true });
    }
    const out = things.filter((thing) => thing.acts.some((act) => act.kind === "out"));
    expect(out.map((thing) => thing.id)).toEqual(["out"]);
  });
});

describe.each(HOMES)("$name's camera", (home) => {
  const stage = stageOf(fileOf(home));
  const rooms = stage.rooms ?? [];
  const shot = shotOf(stage);
  const aspect = SCREENS.phone;

  test(`[R-WORLD-029] given ${home.id}'s rooms, when their floors are read, then they lie inside the house without overlapping and hold every walkable point of it, and every thing and every person's spot stands in one`, () => {
    expect(rooms.length).toBeGreaterThanOrEqual(3);
    expect(new Set(rooms.map((room) => room.id)).size).toBe(rooms.length);
    const walls = outer(home);
    for (const { id, floor: [x0, z0, x1, z1] } of rooms) expect({ id, inside: x0 >= walls.x0 - 0.01 && x1 <= walls.x1 + 0.01 && z0 >= walls.z0 - 0.01 && z1 <= walls.z1 + 0.01 }).toEqual({ id, inside: true });
    const [[a, b], [c, d]] = [stage.walkable?.[0]?.[0] ?? [0, 0], stage.walkable?.[0]?.[2] ?? [0, 0]];
    for (let x = Math.min(a, c) + 0.05; x < Math.max(a, c); x += 0.5) {
      for (let z = Math.min(b, d) + 0.05; z < Math.max(b, d); z += 0.5) {
        // A point on a wall's line may fall in either room; inside a room's floor it falls in that one alone.
        const holding = rooms.filter(({ floor: [x0, z0, x1, z1] }) => x > x0 && x < x1 && z > z0 && z < z1);
        expect({ x, z, rooms: holding.length <= 1, found: roomAt(rooms, x, z) !== null }).toEqual({ x, z, rooms: true, found: true });
      }
    }
    for (const thing of stage.things ?? []) {
      const spot = stage.models.find((model) => model.file === thing.file)?.at[thing.copy];
      expect({ thing: thing.id, room: spot === undefined ? null : (roomAt(rooms, spot[0], spot[1])?.id ?? null) === null }).toEqual({ thing: thing.id, room: false });
    }
    for (const spot of stage.people) expect(roomAt(rooms, spot[0], spot[1])).not.toBeNull();
  });

  test(`[R-WORLD-029] [R-WORLD-009] given ${home.id} eased in on each room on a phone held upright, when the camera stands there, then it looks at the room's middle straight down the house's length on the scene's own lens, the room whole across the screen and over half its width, and the character standing in it reads at a phone's size: over 7 in a hundred of the screen's height`, () => {
    for (const room of rooms) {
      const aim = aimRoom(shot, room, 0, aspect);
      expect(aim.fov).toBe(SHOT_FOV);
      expect(aim.target).toEqual(room.centre);
      // Straight down the length: the camera stands at +z of what it looks at, never to one side.
      expect(aim.position[0]).toBeCloseTo(aim.target[0], 6);
      expect(aim.position[2]).toBeGreaterThan(aim.target[2]);
      const camera = cameraAt(aim, aspect);
      const [x0, z0, x1, z1] = room.floor;
      const middle = (z0 + z1) / 2;
      const across = [projected(camera, x0, 0, middle), projected(camera, x1, 0, middle)];
      // The room stands whole across the screen, its side walls inside the edges, over half its width.
      const [left = 0, right = 0] = across.map((at) => at?.x ?? 0);
      expect({ room: room.id, whole: Math.abs(left) <= 1 && Math.abs(right) <= 1, wide: Math.abs(right - left) > 1 }).toEqual({ room: room.id, whole: true, wide: true });
      const [cx, , cz] = room.centre;
      const foot = projected(camera, cx, 0, cz);
      const head = projected(camera, cx, 1.7, cz);
      expect({ room: room.id, tall: (head.y - foot.y) / 2 > 0.07 }).toEqual({ room: room.id, tall: true });
    }
  });

  const QUARTERS = [0, 90, 180, 270] as const;
  const ground = stage.ground.size;
  const pitchOf = (aim: { position: [number, number, number]; target: [number, number, number] }): number => {
    const [dx, dy, dz] = [aim.position[0] - aim.target[0], aim.position[1] - aim.target[1], aim.position[2] - aim.target[2]];
    return (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
  };
  /** The camera stands on the side the turned view looks from: back along the view's facing from what it looks at. */
  const standsBehind = (aim: { position: [number, number, number]; target: [number, number, number] }, turn: number): boolean => {
    const yaw = (((shot.yaw ?? 0) + turn) * Math.PI) / 180;
    const [dx, dz] = [aim.target[0] - aim.position[0], aim.target[2] - aim.position[2]];
    const length = Math.hypot(dx, dz);
    return Math.abs(dx / length - Math.sin(yaw)) < 1e-6 && Math.abs(dz / length - Math.cos(yaw)) < 1e-6;
  };

  test(`[R-WORLD-029] [R-WORLD-009] given ${home.id} seen whole at each quarter turn and on the way between, on a phone held upright and a small phone, when the camera stands there, then it looks from the turned side and every corner of the floor stands on screen, and at rest the top of the far wall it faces too; on a laptop every corner stands inside the screen's width`, () => {
    const room = rooms[0];
    if (room === undefined) throw new Error("No room");
    const walls = outer(home);
    const corners: [number, number, number][] = [
      [walls.x0, 0, walls.z0],
      [walls.x1, 0, walls.z0],
      [walls.x1, 0, walls.z1],
      [walls.x0, 0, walls.z1],
    ];
    for (const screen of [SCREENS.phone, SCREENS.small, SCREENS.desktop]) {
      for (const turn of [0, 45, 90, 135, 180, 225, 270, 315, -90]) {
        const aim = aimRoom(shot, room, 1, screen, { turn, ground });
        expect({ turn, behind: standsBehind(aim, turn) }).toEqual({ turn, behind: true });
        const camera = cameraAt(aim, screen);
        const tops: [number, number, number][] = [];
        if (turn % 90 === 0) {
          const quarter = (((((shot.yaw ?? 0) + turn) / 90) % 4) + 4) % 4;
          const [facing] = fullSides(quarter);
          for (const wall of home.shell.sides[facing]) tops.push([wall.from[0], wall.height, wall.from[1]], [wall.to[0], wall.height, wall.to[1]]);
        }
        const laptop = screen === SCREENS.desktop;
        for (const point of laptop ? corners : [...corners, ...tops]) {
          const at = projected(camera, ...point);
          expect({ screen, turn, point, shown: at.inFront && Math.abs(at.x) <= 1 && (laptop || Math.abs(at.y) <= 1) }).toEqual({ screen, turn, point, shown: true });
        }
      }
    }
  });

  test(`[R-WORLD-029] [R-WORLD-009] given ${home.id} eased in on each room at each quarter turn on a phone held upright, when the camera stands there, then it looks at the room's middle from the turned side on the scene's own lens, the room whole across the screen and over half its width, or, a room longer across than the most a turned view fits, its middle with the rest running off the sides, and the character standing in it reads at a phone's size: over 7 in a hundred of the screen's height`, () => {
    for (const turn of QUARTERS) {
      for (const room of rooms) {
        const aim = aimRoom(shot, room, 0, aspect, { turn, ground });
        expect(aim.fov).toBe(SHOT_FOV);
        expect(aim.target).toEqual(roomTarget(room, turn));
        expect({ turn, target: turn === 0 ? aim.target : room.centre }).toEqual({ turn, target: room.centre });
        // The point looked at stands on the room's own floor, whichever way it is turned.
        expect({ room: room.id, turn, inside: roomAt([room], aim.target[0], aim.target[2]) !== null || room.id === "bathroom" }).toEqual({ room: room.id, turn, inside: true });
        expect({ room: room.id, turn, behind: standsBehind(aim, turn) }).toEqual({ room: room.id, turn, behind: true });
        const camera = cameraAt(aim, aspect);
        const [x0, z0, x1, z1] = room.floor;
        const [mx, mz] = [(x0 + x1) / 2, (z0 + z1) / 2];
        // Across the turned view: the floor's sides along x seen straight on, or along z a quarter round.
        const across = turn % 180 === 0 ? [projected(camera, x0, 0, mz), projected(camera, x1, 0, mz)] : [projected(camera, mx, 0, z0), projected(camera, mx, 0, z1)];
        const [left = 0, right = 0] = across.map((at) => at.x);
        const long = roomAcross(room, turn) >= ROOM_ACROSS.most;
        expect({ room: room.id, turn, whole: long ? Math.abs(right - left) > 2 : Math.abs(left) <= 1 && Math.abs(right) <= 1, wide: Math.abs(right - left) > 1 }).toEqual({ room: room.id, turn, whole: true, wide: true });
        const [cx, , cz] = aim.target;
        const foot = projected(camera, cx, 0, cz);
        const head = projected(camera, cx, 1.7, cz);
        expect({ room: room.id, turn, tall: (head.y - foot.y) / 2 > 0.07 }).toEqual({ room: room.id, turn, tall: true });
      }
    }
  });

  test(`[R-WORLD-009] [R-WORLD-029] given ${home.id} tilted to the view from above, whole and eased in, at each quarter turn, when the camera stands there, then it looks down from the top view's pitch, raised and never straight down, the whole house's floor still on screen on a phone held upright`, () => {
    const room = rooms[0];
    if (room === undefined) throw new Error("No room");
    const walls = outer(home);
    for (const turn of QUARTERS) {
      const whole = aimRoom(shot, room, 1, aspect, { turn, ground, tilt: 1 });
      const near = aimRoom(shot, room, 0, aspect, { turn, ground, tilt: 1 });
      for (const aim of [whole, near]) {
        expect(pitchOf(aim)).toBeCloseTo(TOP_PITCH, 6);
        expect(pitchOf(aim)).toBeLessThan(90);
        expect(standsBehind(aim, turn)).toBe(true);
      }
      expect(pitchOf(aimRoom(shot, room, 1, aspect, { turn, ground }))).toBeCloseTo(shot.farPitch, 6);
      const camera = cameraAt(whole, aspect);
      for (const point of [[walls.x0, 0, walls.z0], [walls.x1, 0, walls.z0], [walls.x1, 0, walls.z1], [walls.x0, 0, walls.z1]] as const) {
        const at = projected(camera, ...point);
        expect({ turn, point, shown: at.inFront && Math.abs(at.x) <= 1 && Math.abs(at.y) <= 1 }).toEqual({ turn, point, shown: true });
      }
    }
  });

  test(`[R-WORLD-029] [R-WORLD-009] given ${home.id} on a phone, when the camera eases between the whole house and a room, then it moves from one state to the other, closer and lower on its way in`, () => {
    const room = rooms[0];
    if (room === undefined) throw new Error("No room");
    const whole = aimRoom(shot, room, 1, aspect);
    const half = aimRoom(shot, room, 0.5, aspect);
    const near = aimRoom(shot, room, 0, aspect);
    const far = (aim: typeof whole): number => Math.hypot(aim.position[0] - aim.target[0], aim.position[1] - aim.target[1], aim.position[2] - aim.target[2]);
    expect(far(near)).toBeLessThan(far(half));
    expect(far(half)).toBeLessThan(far(whole));
    expect(whole.fov).toBe(shot.fov);
    expect(half.fov).toBeGreaterThan(whole.fov);
    expect(half.fov).toBeLessThan(near.fov);
  });

  test(`[R-WORLD-029] given ${home.id}, when it is tapped, then from the whole house a tap on a room eases in on it and a thing chosen eases in on its room first; eased in, a tap inside the room walks, and a tap outside it, in another room or past the walls, eases back out`, () => {
    const [first, second] = rooms;
    if (first === undefined || second === undefined) throw new Error("Two rooms wanted");
    const inside = (room: typeof first): [number, number] => [(room.floor[0] + room.floor[2]) / 2, (room.floor[1] + room.floor[3]) / 2];
    expect(homeTap(rooms, true, undefined, ...inside(first))).toEqual({ kind: "in", room: first });
    expect(homeTap(rooms, false, first, ...inside(first))).toEqual({ kind: "walk" });
    expect(homeTap(rooms, false, first, ...inside(second))).toEqual({ kind: "out" });
    expect(homeTap(rooms, false, first, 99, 99)).toEqual({ kind: "out" });
    expect(roomFirst(rooms, true, undefined, inside(second))).toEqual(second);
    expect(roomFirst(rooms, false, second, inside(second))).toBeNull();
    expect(roomFirst(rooms, false, first, inside(second))).toEqual(second);
    expect(roomFirst(rooms, true, undefined, null)).toBeNull();
  });
});

describe("the camera's easing", () => {
  /** Frames at 60 a second until the zoom stands at its end. */
  function settleTime(rate: number, settle: number): number {
    let zoom = 1;
    let time = 0;
    while (zoom !== 0 && time < 5) {
      zoom = easeZoom(zoom, 0, 1 / 60, rate, settle);
      time += 1 / 60;
    }
    return time;
  }

  test("[R-WORLD-029] [R-WORLD-009] given a wide home's room tapped or pinched, when the camera eases in, then it stands there in under 400 ms with the scene's own easing, where any other place's slower close view takes longer", () => {
    expect(settleTime(ROOM_EASE, ROOM_SETTLE)).toBeLessThan(0.4);
    expect(settleTime(EASE, SETTLE)).toBeGreaterThan(0.4);
    // The same easing both ways: back out to the whole house as quickly.
    let zoom = 0;
    let time = 0;
    while (zoom !== 1 && time < 5) {
      zoom = easeZoom(zoom, 1, 1 / 60, ROOM_EASE, ROOM_SETTLE);
      time += 1 / 60;
    }
    expect(time).toBeLessThan(0.4);
  });

  /** A wide home's view at rest on the whole house, unturned and level, with where it is asked to go. */
  const resting = (to: Partial<ViewEase> = {}): ViewEase => ({ zoom: 1, zoomTo: 1, turn: 0, turnTo: 0, tilt: 0, tiltTo: 0, pinching: false, turning: false, ...to });

  /** Frames at 60 a second, with the setting as the scene reads it, until the view stands where it was asked to go. */
  function framesToRest(view: ViewEase, still: boolean): { frames: number; view: ViewEase } {
    let now = view;
    let frames = 0;
    while ((now.zoom !== now.zoomTo || now.turn !== now.turnTo || now.tilt !== now.tiltTo) && frames < 300) {
      now = { ...now, ...easeRoomView(now, 1 / 60, still) };
      frames += 1;
    }
    return { frames, view: now };
  }

  test("[R-WORLD-023] [R-WORLD-029] given the phone asks for no reduced motion, when a room is tapped, the round button turns a quarter or the view tilts from above, then the camera eases there over several frames, in under 400 ms, its first frame part of the way", () => {
    stubReducedMotion(false);
    expect(motionReduced()).toBe(false);
    const asked = resting({ zoomTo: 0, turnTo: 90, tiltTo: 1 });
    const first = easeRoomView(asked, 1 / 60, motionReduced());
    for (const [value, end] of [[first.zoom, 0], [first.turn, 90], [first.tilt, 1]] as const) {
      expect(value).not.toBe(end);
      expect(Math.abs(value - end)).toBeLessThan(Math.abs(end === 0 ? 1 : end));
    }
    const { frames, view } = framesToRest(asked, motionReduced());
    expect(frames).toBeGreaterThan(5);
    expect(frames / 60).toBeLessThan(0.4);
    expect([view.zoom, view.turn, view.tilt]).toEqual([0, 90, 1]);
  });

  test("[R-WORLD-023] [R-WORLD-029] given the phone asks for reduced motion, when a room is tapped, the round button turns a quarter, the view tilts or eases back out, then the camera stands there on the first frame, with no ease", () => {
    stubReducedMotion(true);
    expect(motionReduced()).toBe(true);
    const asked = resting({ zoomTo: 0, turnTo: 90, tiltTo: 1 });
    expect(easeRoomView(asked, 1 / 60, motionReduced())).toEqual({ zoom: 0, turn: 90, tilt: 1 });
    expect(framesToRest(asked, motionReduced()).frames).toBe(1);
    // Back out to the whole house, the other way round and level again, as at once.
    expect(easeRoomView(resting({ zoom: 0, turn: 90, tilt: 1, turnTo: 0 }), 1 / 60, motionReduced())).toEqual({ zoom: 1, turn: 0, tilt: 0 });
    // Every place's own close view is cut the same way.
    expect(easeZoom(1, 0, 1 / 60, EASE, SETTLE, motionReduced())).toBe(0);
  });

  test("[R-WORLD-023] [R-WORLD-009] given reduced motion, when a finger turns or tilts the view or a pinch holds it, then the view stays under the finger, eased nowhere until it lifts, and the snap on release lands at once", () => {
    stubReducedMotion(true);
    const held = resting({ zoom: 0.4, zoomTo: 0, turn: 37, turnTo: 90, tilt: 0.3, tiltTo: 1, pinching: true, turning: true });
    expect(easeRoomView(held, 1 / 60, motionReduced())).toEqual({ zoom: 0.4, turn: 37, tilt: 0.3 });
    expect(easeRoomView({ ...held, pinching: false, turning: false, turnTo: 0 }, 1 / 60, motionReduced())).toEqual({ zoom: 0, turn: 0, tilt: 1 });
  });
});

describe("each home's cooking corner", () => {
  test("[R-HOME-012] [R-HOME-006] given the homes, when their cooking corners are read, then the family house's offers the pot that is the house's and the big pot for the house, and a home of your own, the room in a compound, the hostel and the room abroad, a meal and a pot of your own at their prices", () => {
    const corner = (raw: unknown): [string | undefined, readonly string[] | undefined] => {
      const act = (stageOf(raw as PlaceFile).things ?? []).find((thing) => thing.id === "cooking")?.acts[0];
      return [act?.stages, act?.more];
    };
    expect(corner(familyRaw)).toEqual(["activity.cook-at-home", ["activity.cook-jollof"]]);
    for (const raw of [roomRaw, hostelRaw]) expect(corner(raw)).toEqual(["activity.cook-own", ["activity.cook-own-pot"]]);
    // The room abroad cooks in the country's money (streets.md R-STREET-012, R-HOME-012): in the UK a meal in pounds; in
    // Canada, the UAE and Italy a meal in dollars, dirhams or euros, listed on the same sheet, each open only in its country.
    expect(corner(abroadRaw)).toEqual(["activity.cook-own-uk", ["activity.cook-own-ca", "activity.cook-own-uae", "activity.cook-own-it"]]);
    expect(content.activity["activity.cook-at-home"]?.cost).toEqual([]);
    expect(content.activity["activity.cook-jollof"]?.cost).toEqual([{ currency: "NGN", amount: 7_500_00, reason: "foodstuff" }]);
    expect(content.activity["activity.cook-own"]?.cost).toEqual([{ currency: "NGN", amount: 1_500_00, reason: "food" }]);
    expect(content.activity["activity.cook-own-pot"]?.cost).toEqual([{ currency: "NGN", amount: 7_500_00, reason: "food" }]);
    expect(content.activity["activity.cook-own-uk"]?.cost).toEqual([{ currency: "GBP", amount: 6_00, reason: "food" }]);
    expect(content.place["place.the-room"]?.stages).toContain("activity.cook-own-uk");
    expect(content.place["place.the-room"]?.stages).not.toContain("activity.cook-own");
  });
});

describe("the car at a home's spot", () => {
  test("[R-HOME-006] given each home, when the life has no car, then its car spot is empty and the file is shown as shipped; with a car it stands at the spot, in the parents' yard or by the gate", () => {
    for (const home of HOMES.slice(0, 2)) {
      const file = fileOf(home);
      const spot = stageOf(file).car;
      if (spot === undefined) throw new Error(`${home.name} has no car spot`);
      expect(parkCar(file, false)).toBe(file);
      expect(stageOf(file).models.some((model) => model.file === CAR_FILE)).toBe(false);
      expect(stageOf(parkCar(file, true)).models.filter((model) => model.file === CAR_FILE)).toEqual([{ file: CAR_FILE, at: [spot] }]);
    }
    // The hostel has no yard and no spot: a car changes nothing there.
    const hostel = fileOf(HOMES[2] as Home);
    expect(stageOf(hostel).car).toBeUndefined();
    expect(parkCar(hostel, true)).toBe(hostel);
  });
});
