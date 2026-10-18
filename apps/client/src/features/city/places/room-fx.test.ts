// What the home's acts show where they are done (world:things-are-tappable-models; activity:acts-may-repeat-in-month; clock.md
// clock:game-day-on-real-time): a meal keeps the steam, jollof more of it and longer, the bath's drops off the drum, the television's
// flicker while Nollywood plays, the lantern turned up for study, and the lamps that glow as the light goes. Read from the
// shipped files.
import { Group, InstancedMesh, Mesh, Sprite } from "three";
import { describe, expect, test } from "vitest";

import compoundRaw from "../../../../public/assets/places/home-room-house/place.json";
import hostelRaw from "../../../../public/assets/places/home-hostel-house/place.json";
import makokoRaw from "../../../../public/assets/places/makoko/place.json";
import parlourRaw from "../../../../public/assets/places/home-family-house/place.json";
import roomRaw from "../../../../public/assets/places/the-room/place.json";
import { type PlaceFile, showPlanned, showsFor, type Stage, stageOf } from "../../../shared/scene/placeFile";
import { lampsOf, motionOf } from "../../../shared/scene/world";

// The family house, whose parlour, table and lanterns are where these acts answer.
const parlour = stageOf(parlourRaw as unknown as PlaceFile);
const HOMES = [
  { name: "the parlour", stage: parlour, drum: "prop_water-drum.glb" },
  { name: "the room in a compound", stage: stageOf(compoundRaw as unknown as PlaceFile), drum: "prop_water-drum.glb" },
  { name: "the hostel room", stage: stageOf(hostelRaw as unknown as PlaceFile), drum: "prop_water-drum.glb" },
  { name: "Makoko", stage: stageOf(makokoRaw as unknown as PlaceFile), drum: "prop_water-drum.glb" },
] as const;

function copyOf(stage: Stage, suffix: string): readonly number[] {
  const at = stage.models.find((model) => model.file.endsWith(suffix))?.at[0];
  if (at === undefined) throw new Error(`No ${suffix}`);
  return at;
}

const near = (a: readonly number[], x: number, z: number, within: number): boolean => Math.hypot((a[0] ?? 0) - x, (a[2] ?? 0) - z) < within;

describe("what the home's acts show", () => {
  test("[world:things-are-tappable-models] [activity:acts-may-repeat-in-month] given jollof cooked at each home, when its answer is read, then it is steam off the same pot as the meal's, more puffs, for a while each time it lands, never standing for the month", () => {
    for (const { name, stage } of HOMES) {
      // Each home's corner names its own meal and pot: the family house's pot, or one of your own.
      const cook = (stage.things ?? []).flatMap((thing) => thing.acts).find((act) => act.id === "cook");
      const [mealId, potId] = [cook?.stages ?? "", cook?.more?.[0] ?? ""];
      const meal = (stage.shows ?? []).find((show) => show.activity === mealId)?.motion[0];
      const [jollof] = showsFor(stage, potId);
      const steam = jollof?.motion[0];
      if (meal === undefined || jollof === undefined || steam === undefined) throw new Error(`${name}: no steam`);
      expect({ name, kind: steam.kind }).toEqual({ name, kind: "smoke" });
      expect(steam.at).toEqual(meal.at);
      expect(steam.count ?? 0).toBeGreaterThan(meal.count ?? 0);
      expect(jollof.seconds ?? 0).toBeGreaterThanOrEqual(12);
      expect(showPlanned({ place: "x", scope: "interior", hub: false, instances: [], people: { low: 0, high: 0, sample: [] }, stage }, [potId]).stage).toBe(stage);
    }
  });

  test("[world:things-are-tappable-models] [activity:acts-may-repeat-in-month] given a bucket bath at each home with a drum, when its answer is read, then drops fall off the drum's rim to the floor for a few seconds", () => {
    for (const { name, stage, drum } of HOMES) {
      const [bath] = showsFor(stage, "activity.bucket-bath");
      const drops = bath?.motion[0];
      if (bath === undefined || drops === undefined) throw new Error(`${name}: no bath`);
      const [x, z] = copyOf(stage, drum);
      expect({ name, kind: drops.kind, atDrum: near(drops.at, x ?? 0, z ?? 0, 0.05) }).toEqual({ name, kind: "drops", atDrum: true });
      // The drum is 0.9 m high: the drops start at its rim.
      expect(drops.at[1]).toBeGreaterThan(0.85);
      expect(drops.size?.[0] ?? 0).toBeGreaterThan(0.6);
      expect(bath.seconds ?? 0).toBeGreaterThanOrEqual(3);
      expect(bath.seconds ?? 99).toBeLessThanOrEqual(6);
    }
  });

  test("[world:things-are-tappable-models] [activity:acts-may-repeat-in-month] given Nollywood with Papa, when its answer is read, then the television's screen flickers while it plays and its light spills into the room; only the parlour has a television", () => {
    const [tv] = showsFor(parlour, "activity.watch-tv");
    if (tv === undefined) throw new Error("No television's answer");
    const [x = 0, z = 0, turn = 0] = copyOf(parlour, "prop_tv-stand.glb");
    const screen = tv.motion.find((motion) => motion.kind === "flicker");
    if (screen === undefined) throw new Error("No flicker");
    // The stand's screen is 1.1 by 0.6 m, its bottom edge 0.71 m up, its face at the stand's front, turned as the stand is.
    expect(screen.size).toEqual([1.1, 0.6]);
    expect(screen.at[1]).toBeCloseTo(0.71, 6);
    expect(near(screen.at, x + Math.sin(turn) * 0.015, z + Math.cos(turn) * 0.015, 0.01)).toBe(true);
    expect(screen.ry ?? 0).toBeCloseTo(turn, 3);
    expect(tv.motion.some((motion) => motion.kind === "glow")).toBe(true);
    expect(tv.seconds ?? 0).toBeGreaterThanOrEqual(6);
    for (const { stage } of HOMES.slice(1)) expect(showsFor(stage, "activity.watch-tv")).toEqual([]);
    expect(stageOf(makokoRaw as unknown as PlaceFile).things?.some((thing) => thing.acts.some((act) => act.stages === "activity.watch-tv"))).toBe(false);
  });

  test("[world:things-are-tappable-models] [activity:acts-may-repeat-in-month] given study at the parlour's table, when its answer is read, then the lantern beside it is turned up for a while, for the English, the course and the portfolio alike", () => {
    const [x, z] = copyOf(parlour, "prop_lantern.glb");
    for (const study of ["activity.study-english", "activity.learn-tech", "activity.build-portfolio"]) {
      const [show] = showsFor(parlour, study);
      const lantern = show?.motion[0];
      if (show === undefined || lantern === undefined) throw new Error(`No answer for ${study}`);
      expect(lantern.kind).toBe("glow");
      expect(Math.hypot(lantern.at[0] - (x ?? 0), lantern.at[2] - (z ?? 0))).toBeLessThan(0.05);
      expect(show.seconds ?? 0).toBeGreaterThanOrEqual(6);
    }
  });

  test("[clock:game-day-on-real-time] given the homes, when their lamps are read, then the parlour has its bulb and its lantern, the room in a compound and the room abroad their bulbs, each a warm point that adds no light", () => {
    const parlourLamps = parlour.light.lamps ?? [];
    expect(parlourLamps.filter((lamp) => lamp.bulb === true)).toHaveLength(1);
    const [lx, lz] = copyOf(parlour, "prop_lantern.glb");
    expect(parlourLamps.some((lamp) => lamp.bulb !== true && Math.hypot(lamp.at[0] - (lx ?? 0), lamp.at[2] - (lz ?? 0)) < 0.05)).toBe(true);
    for (const raw of [compoundRaw, roomRaw]) expect((stageOf(raw as unknown as PlaceFile).light.lamps ?? []).filter((lamp) => lamp.bulb === true)).toHaveLength(1);
    const built = lampsOf(parlourLamps);
    expect(built).toHaveLength(parlourLamps.length);
    for (const lamp of built) {
      let lights = 0;
      lamp.traverse((object) => {
        if ((object as { isLight?: boolean }).isLight === true) lights += 1;
      });
      expect(lights).toBe(0);
      expect(lamp.children.some((child) => child instanceof Sprite)).toBe(true);
    }
  });

  test("[world:things-are-tappable-models] given each new kind of answer, when it is built at the mode's mesh level, then it is one cheap piece: the drops one instanced draw, the flicker one plane, the glow a halo", () => {
    const [bath] = showsFor(parlour, "activity.bucket-bath");
    const [tv] = showsFor(parlour, "activity.watch-tv");
    const drops = bath?.motion[0];
    const screen = tv?.motion.find((motion) => motion.kind === "flicker");
    const spill = tv?.motion.find((motion) => motion.kind === "glow");
    if (drops === undefined || screen === undefined || spill === undefined) throw new Error("No answers");
    expect(motionOf(drops, "coarse")).toBeInstanceOf(InstancedMesh);
    const plane = motionOf(screen, "fine");
    expect(plane).toBeInstanceOf(Mesh);
    expect(plane.position.toArray()).toEqual(screen.at);
    const halo = motionOf(spill, "coarse");
    expect(halo).toBeInstanceOf(Group);
    expect(halo.children.every((child) => child instanceof Sprite)).toBe(true);
  });
});
