// No line over a face (docs/rules/world.md R-WORLD-026, R-WORLD-005, its three faults): a
// person's words stand clear of every head, every thing's name and every mark in the scene, not placed from the speaker
// alone, with the tail still ending over the speaker; and a thing's dot stays on its thing while only its name is lifted
// clear, never far. Proved over every place the game draws, seen whole as the scene first shows it on a phone.
import { describe, expect, test } from "vitest";

import { bubbleRect, bubbleSpot, overlap, type Rect, TAIL } from "../../shared/world/Lines";
import { HEAD_CHIN, HEAD_TOP, headRect, LABEL_Y, type LabelBox, layNames, MARK_HIT, NAME_LIFT_MAX } from "./labels";
import { isPerson } from "./mark";
import { sceneWords } from "./scene.words";
import { stageOf } from "./placeFile";
import { builtPlaces, cameraAt, projected } from "./scene.testing";
import { aimRoom, aimShot, shotOf } from "./shot";
import { thingSpot, thingsOf } from "./things";
import { standAt } from "./walk";

/** Pixel 7 as the catalog shoots it, and the band with its second row over the world. */
const SIZE = { width: 412, height: 839 };
const BAND = 124;
/** A bubble of two lines of words under its speaker's name, its plain tail under it. */
const BOX = { width: 250, height: 78 };

function onPixels(at: { x: number; y: number }): { x: number; y: number } {
  return { x: ((at.x + 1) / 2) * SIZE.width, y: ((1 - at.y) / 2) * SIZE.height };
}

/** Each place as the scene first shows it: the whole house for a wide home, else the raised whole view. */
const SCENES = builtPlaces().map(({ folder, file }) => {
  const stage = stageOf(file);
  const shot = shotOf(stage);
  const aspect = SIZE.width / SIZE.height;
  const room = stage.rooms?.[0];
  const aim = room === undefined ? aimShot(shot, { zoom: 1, turn: 0 }, standAt(...stage.start), aspect) : aimRoom(shot, room, 1, aspect, { turn: 0, tilt: 0, ground: stage.ground.size });
  const camera = cameraAt(aim, aspect);
  const inView = (x: number, y: number, z: number): { x: number; y: number } | null => {
    const at = projected(camera, x, y, z);
    return at.inFront && Math.abs(at.x) <= 1 && Math.abs(at.y) <= 1 ? onPixels(at) : null;
  };
  const things = thingsOf(stage).flatMap((thing) => {
    const spot = thingSpot(stage, thing);
    return spot === null ? [] : [{ thing, spot }];
  });
  // Everyone who may stand there: the crowd's every spot, the people who stand as things, the player at the start.
  const people: [number, number][] = [...stage.people.map(([x, z]) => [x, z] as [number, number]), ...things.filter(({ thing }) => isPerson(thing)).map(({ spot }) => spot), [stage.start[0], stage.start[1]]];
  return { folder, camera, inView, things, people };
});

describe("no line over a face", () => {
  test("[R-WORLD-026] given every place seen whole with its crowd at its fullest, every resident and person a speaker in turn, every thing's dot shown and no one named or one person named for an ask, when a bubble is placed, then it covers no head and no name, and its tail still ends over the speaker", () => {
    const covering: string[] = [];
    let placed = 0;
    let onDots = 0;
    for (const scene of SCENES) {
      const dots: LabelBox[] = [];
      const persons: { id: string; spot: [number, number]; name: LabelBox }[] = [];
      for (const { thing, spot } of scene.things) {
        const at = scene.inView(spot[0], LABEL_Y, spot[1]);
        if (at === null) continue;
        dots.push({ x: at.x, y: at.y - MARK_HIT / 2 + 6, width: 12, height: 12 });
        // A person's name shows while they hold an ask; every other thing is its dot (R-WORLD-005). Nothing speaks in a
        // place's first seconds, while the first entry names everything (R-WORLD-026).
        if (isPerson(thing)) persons.push({ id: thing.id, spot, name: { x: at.x, y: at.y - MARK_HIT, width: sceneWords(thing.label).length * 8 + 24, height: 26 } });
      }
      const soft: Rect[] = dots.map((dot) => ({ left: dot.x - 6, right: dot.x + 6, top: dot.y - 12, bottom: dot.y }));
      const heads: Rect[] = [];
      for (const [x, z] of scene.people) {
        const top = scene.inView(x, HEAD_TOP, z);
        const chin = scene.inView(x, HEAD_CHIN, z);
        if (top !== null && chin !== null) heads.push(headRect(top, chin));
      }
      for (const named of [null, ...persons]) {
        const laid = named === null ? [] : layNames([named.name], dots);
        const foot = laid[0]?.shown === true ? laid[0].foot : null;
        const clear: Rect[] = [...heads, ...(named === null || foot === null ? [] : [{ left: named.name.x - named.name.width / 2, right: named.name.x + named.name.width / 2, top: foot - named.name.height, bottom: foot }])];
        for (const [x, z] of scene.people) {
          // A named person who speaks gives their name way to their words (R-WORLD-005).
          if (named !== null && x === named.spot[0] && z === named.spot[1]) continue;
          const tip = projected(scene.camera, x, LABEL_Y, z);
          const over = onPixels(tip);
          // A speaker too near the band for any bubble over them is held under it, as before; the street's talk waits for one nearer.
          if (!tip.inFront || over.x < 0 || over.x > SIZE.width || over.y < BAND + BOX.height + 8 || over.y > SIZE.height - 8) continue;
          const spot = bubbleSpot({ x: tip.x, y: tip.y, z: 0.5 }, SIZE, BOX, BAND, { clear, soft });
          placed += 1;
          const rect = bubbleRect(spot, BOX);
          const covered = clear.reduce((sum, other) => sum + overlap(rect, other), 0);
          if (covered > 0) covering.push(`${scene.folder}${named === null ? "" : ` with ${named.id} named`} over [${String(x)}, ${String(z)}]: ${String(Math.round(covered))} px²`);
          if (soft.some((dot) => overlap(rect, dot) > 0)) onDots += 1;
          // The tail ends over the speaker: its point is the speaker's anchor on the screen.
          expect(spot.x + spot.tail.x).toBeCloseTo(over.x, 5);
          expect(spot.y - TAIL + spot.tail.length).toBeCloseTo(over.y, 5);
          expect(rect.top).toBeGreaterThanOrEqual(BAND);
          expect(rect.left).toBeGreaterThanOrEqual(0);
          expect(rect.right).toBeLessThanOrEqual(SIZE.width);
        }
      }
    }
    expect(placed).toBeGreaterThan(100);
    expect(covering).toEqual([]);
    // A dot is covered only where no spot in reach is clear of the dots (a home's back wall seen whole), and the bubble
    // hands a tap on it through (R-WORLD-005): never in more than one placement in ten.
    expect(onDots * 10).toBeLessThanOrEqual(placed);
  });
});

describe("a thing's mark on its thing", () => {
  test("[R-WORLD-005] given every place seen whole and every thing named at once, as a place's first entry names them, when the names are laid out, then none covers another or a dot, and none stands more than two rows over its own dot", () => {
    for (const scene of SCENES) {
      const dots: LabelBox[] = [];
      const names: LabelBox[] = [];
      for (const { thing, spot } of scene.things) {
        const at = scene.inView(spot[0], LABEL_Y, spot[1]);
        if (at === null) continue;
        dots.push({ x: at.x, y: at.y - MARK_HIT / 2 + 6, width: 12, height: 12 });
        names.push({ x: at.x, y: at.y - MARK_HIT, width: sceneWords(thing.label).length * 8 + 24, height: 26 });
      }
      const laid = layNames(names, dots);
      const shown = names.flatMap((name, index) => (laid[index]?.shown === true ? [{ ...name, y: laid[index]?.foot ?? name.y }] : []));
      for (const [index, name] of names.entries()) expect({ place: scene.folder, lift: name.y - (laid[index]?.foot ?? name.y) <= NAME_LIFT_MAX }).toEqual({ place: scene.folder, lift: true });
      for (const [i, a] of shown.entries()) {
        for (const b of [...shown.slice(i + 1), ...dots]) {
          const apart = Math.abs(a.x - b.x) >= (a.width + b.width) / 2 || a.y - a.height >= b.y || b.y - b.height >= a.y;
          expect({ place: scene.folder, apart }).toEqual({ place: scene.folder, apart: true });
        }
      }
    }
  });

  test("[R-WORLD-005] given the family house's names stacked as they once stood, when they are laid out, then the dots never move, no name stands more than two rows over its dot, none covers another or a dot, and a name with no room within two rows waits unshown", () => {
    // Six names bunched in one column, each over its dot, as the parlour's Mama, Tobi, the sofa and the water drum stood.
    const names: LabelBox[] = [330, 324, 318, 312, 306, 300].map((y, index) => ({ x: 160 + index * 6, y, width: 90, height: 24 }));
    const dots: LabelBox[] = names.map((name) => ({ x: name.x, y: name.y + 22, width: 12, height: 12 }));
    const laid = layNames(names, dots);
    for (const [index, one] of laid.entries()) expect((names[index]?.y ?? 0) - one.foot).toBeLessThanOrEqual(NAME_LIFT_MAX);
    const shown = names.flatMap((name, index) => (laid[index]?.shown === true ? [{ ...name, y: laid[index]?.foot ?? name.y }] : []));
    for (const [i, a] of shown.entries()) {
      for (const b of [...shown.slice(i + 1), ...dots]) expect(Math.abs(a.x - b.x) >= (a.width + b.width) / 2 || a.y - a.height >= b.y || b.y - b.height >= a.y).toBe(true);
    }
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(names.length);
  });
});
