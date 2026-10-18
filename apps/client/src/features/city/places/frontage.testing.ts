// The checks every rebuilt frontage passes (docs/rules/world.md R-WORLD-005, 009, 011, 012): its
// file measured as the build check measures it against the exterior row, its counts, its crowd under
// the world's caps, its floors a centimetre apart, its boards, and its things' words resolving
// through the scene's own. Each place's test calls these and adds what that place must show.
import { type Footprint, isFootprint } from "@japacity/assets";
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { expect, test } from "vitest";

import budgets from "../../../../../../assets-src/budgets.json";
import { checkFaces, type ModelFace } from "../../../../../../tools/assets/faces-check";
import { checkWalkable } from "../../../../../../tools/assets/footprint-check";
import { checkLimits, SHEET_KINDS, WORLD_LIMITS } from "../../../../../../tools/assets/world-check";
import { plainActLine } from "../actLines";
import { crowdSize } from "../../../shared/scene/crowd";
import { crowdTuning } from "../../../shared/scene/limits";
import { personOfLook } from "../../../shared/scene/roster";
import { sceneWords } from "../scene.words";
import { thingSpot, withMoreAt } from "../things";
import { groundGeometry } from "../../../shared/scene/world";
import { allPalette, city, instancesOf, measured, rowOf, signKeys, staged, totalsOf, wordsOf } from "./place.testing";

/** The crowd a frontage shows in each mode: the entry's figures under the world's outdoor caps. */
function cappedCrowd(id: Id<"place">, mode: "low" | "high"): number {
  const entry = content.place[id];
  if (entry === undefined) throw new Error(`${id} is missing from content`);
  return crowdSize(entry, mode, crowdTuning(city, "exterior", false));
}

/** Every entry a place's things open, as their acts list them. */
export function actEntries(raw: unknown, id: Id<"place">): string[] {
  const { stage } = staged(raw, id);
  // The things as the game reads them: the file's own, with the entries the client's table adds to the desks' sheets (R-CHAPTER-009).
  return withMoreAt(stage.things ?? [], id).flatMap((thing) => thing.acts.flatMap((act) => [...(act.stages === undefined ? [] : [act.stages]), ...(act.more ?? [])]));
}

/**
 * The tests every rebuilt frontage shares; `raw` is the place's file as imported. `boards: false` is for a frontage whose
 * models carry no sign at all (the site in Dubai, behind its hoarding): it is held to that instead, no model lettered.
 */
export function frontageTests(raw: unknown, id: Id<"place">, { boards = true }: { boards?: boolean } = {}): void {
  const { file, stage, entry } = staged(raw, id);
  const models = [...new Set(stage.models.map((model) => model.file))];

  test(`[R-ASSET-007] given ${id}'s shipped files measured as the build check measures them, when the frontage is counted, then both modes fit the exterior row and its download fits the row's bytes`, async () => {
    expect(file.scope).toBe("exterior");
    const totals = await totalsOf(file);
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(rowOf(file).drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(rowOf(file).triangles);
    }
    expect(totals.bytes).toBeLessThanOrEqual(budgets.place.exterior.bytes);
  });

  test(`[R-ASSET-007] given ${id}'s file, when its counts are read, then the instances are the copies staged, the crowd is the world's in each mode, the floor is one draw call of the triangles drawn, and every colour is a palette name`, () => {
    expect(file.scope).toBe(entry.scope);
    expect(file.instances).toEqual(instancesOf(stage));
    expect(file.people.low).toBe(cappedCrowd(id, "low"));
    expect(file.people.high).toBe(cappedCrowd(id, "high"));
    const floor = (raw as { groundRoadSky: { drawCalls: number; triangles: number } }).groundRoadSky;
    expect(floor.drawCalls).toBe(1);
    expect(floor.triangles).toBe(groundGeometry(stage).getAttribute("position").count / 3);
    expect(allPalette(stage)).toBe(true);
  });

  test(`[R-WORLD-011] given ${id}'s file, when its limits are read, then it is one outdoor frontage of about 24 metres with at most 6 people in low mode and 10 in high and at most one moving sheet`, () => {
    expect(checkLimits(file)).toEqual([]);
    expect(stage.shot?.width).toBeGreaterThanOrEqual(WORLD_LIMITS.frontage / WORLD_LIMITS.slack);
    expect(stage.shot?.width).toBeLessThanOrEqual(WORLD_LIMITS.frontage * WORLD_LIMITS.slack);
    expect(file.people.low).toBeLessThanOrEqual(WORLD_LIMITS.people.exterior.low);
    expect(file.people.high).toBeLessThanOrEqual(WORLD_LIMITS.people.exterior.high);
    expect(stage.motion.filter((motion) => SHEET_KINDS.has(motion.kind)).length).toBeLessThanOrEqual(WORLD_LIMITS.sheets.high);
  });

  test(`[R-WORLD-009] given ${id}'s file, when its camera is read, then it declares a whole view and a close view raised between eye level and straight down, a turn limit, its facing and the width the whole view must show`, () => {
    const shot = stage.shot;
    if (shot === undefined) throw new Error(`${id} declares no shot`);
    expect(shot.far).toBeGreaterThan(shot.near);
    for (const pitch of [shot.farPitch, shot.nearPitch]) {
      expect(pitch).toBeGreaterThan(0);
      expect(pitch).toBeLessThan(90);
    }
    expect(shot.farPitch).toBeGreaterThanOrEqual(shot.nearPitch);
    expect(shot.turn).toBeGreaterThan(0);
    expect(shot.yaw).toBeDefined();
    expect(shot.width).toBeDefined();
  });

  test(`[R-WORLD-012] given ${id}'s strips and the floors of its models, when its faces are read, then no two overlap within a centimetre of the same height`, async () => {
    const floors = new Map<string, readonly ModelFace[]>(await Promise.all(models.map(async (path) => [path, (await measured(path)).floors ?? []] as const)));
    expect(checkFaces(id, stage, (path) => floors.get(path) ?? [])).toEqual([]);
  });

  test(`[R-CITY-014] given ${id}'s crowd spots, when the high mode's crowd stands, then there is a spot for everyone on walkable ground clear of every footprint, none where the player starts, every kept spot within the crowd, and everyone in the sample a person of the city`, async () => {
    const high = cappedCrowd(id, "high");
    expect(stage.people.length).toBeGreaterThanOrEqual(high);
    const footprints = new Map<string, Footprint>();
    for (const path of models) {
      const footprint = (await measured(path)).extras.footprint;
      if (isFootprint(footprint)) footprints.set(path, footprint);
    }
    expect(checkWalkable(id, stage, footprints)).toEqual([]);
    const [x, z] = stage.start;
    expect(stage.people.filter(([px, pz]) => Math.hypot(px - x, pz - z) < 0.8)).toEqual([]);
    for (const indices of Object.values(stage.prefer ?? {})) for (const index of indices) expect(index).toBeLessThan(high);
    expect(file.people.sample.filter((path) => personOfLook(path) === null)).toEqual([]);
    expect(file.people.sample.length).toBeGreaterThan(high);
  });

  if (!boards) {
    test(`[R-CITY-024] given ${id}'s models, which carry no sign, when their boards are read, then none is lettered and no key is named`, async () => {
      for (const model of stage.models) expect([model.file, (await measured(model.file)).signs, model.signs]).toEqual([model.file, 0, undefined]);
    });
  }

  if (boards) test(`[R-CITY-024] given ${id}'s lettered models, when their boards are read, then every copy has a key for each of its boards, no key shows twice, and every key has words of the place`, async () => {
    for (const model of stage.models.filter((candidate) => candidate.signs !== undefined)) {
      const boards = (await measured(model.file)).signs;
      expect(model.signs).toHaveLength(model.at.length);
      for (const copy of model.signs ?? []) expect(copy).toHaveLength(boards);
    }
    const keys = signKeys(stage);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((key) => !key.startsWith(`${id}.sign.`) || wordsOf(key).trim() === "")).toEqual([]);
  });

  test(`[R-WORLD-005] given ${id}'s things, when their names and acts are read, then each stands at a copy of a staged model, offers one or two acts, its name and every act's label resolve through the scene's words, and a plain act says what happened unless the scene shows it`, () => {
    const things = stage.things ?? [];
    expect(things.length).toBeGreaterThanOrEqual(3);
    expect(new Set(things.map((thing) => thing.id)).size).toBe(things.length);
    for (const thing of things) {
      const copies = stage.models.find((model) => model.file === thing.file)?.at.length ?? 0;
      expect(thing.copy, `${thing.id}`).toBeLessThan(copies);
      expect(thingSpot(stage, thing), `${thing.id}`).not.toBeNull();
      expect(thing.acts.length, `${thing.id}`).toBeGreaterThanOrEqual(1);
      expect(thing.acts.length, `${thing.id}`).toBeLessThanOrEqual(2);
      expect(sceneWords(thing.label), `${thing.id}`).not.toBe(thing.label);
      for (const act of thing.acts) {
        expect(sceneWords(act.label), `${thing.id} ${act.id}`).not.toBe(act.label);
        if (act.kind === "sheet") expect(act.stages, `${thing.id} ${act.id}`).toBeDefined();
        // A plain act tells its line or a person speaks; one with a pose is seen, and says nothing (R-WORLD-005, R-TEXT-008).
        if (act.kind === "plain") expect(plainActLine(thing, act) === null, `${thing.id} ${act.id}`).toBe(act.pose !== undefined);
      }
    }
  });

  test(`[R-WORLD-005] given what ${id} stages in content, when its things' acts are read, then every staged entry opens from an act of a thing there`, () => {
    const opened = new Set(actEntries(raw, id));
    expect(entry.stages.filter((staged) => !opened.has(staged))).toEqual([]);
  });
}
