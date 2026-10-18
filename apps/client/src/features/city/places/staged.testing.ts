// The checks every staged place passes (the hub's own are in scene/hub.test.ts): its file measured as
// the build check measures it against the exterior row, its counts, its crowd's spots, its boards and
// its staged entries. Each place's own test calls these and adds what that place must show.
import { isPaletteName } from "@japacity/assets";
import { content, text } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { expect, test } from "vitest";

import budgets from "../../../../../../models/budgets.json";
import register from "../../../../../../models/register.json";
import { placeTotals, type PlaceFile as CheckedPlace } from "../../../../../../tools/assets/assets-check";
import { crowdSize } from "../../../shared/scene/crowd";
import type { Spot } from "../../../shared/scene/placeFile";
import { personOfLook } from "../../../shared/scene/roster";
import { stagedAt } from "../../../shared/scene/staging";
import { city, measuredFiles, staged } from "./place.testing";

const PLACES = Object.values(content.place);

/** The tests every staged place shares; `raw` is the place's file as imported. */
export function stagedPlaceTests(raw: unknown, id: Id<"place">): void {
  const { file, stage, entry } = staged(raw, id);

  test(`[assets:assets-and-places-within-budget] given ${id}'s shipped files measured as the build check measures them, when its place is counted, then both modes fit the exterior row`, async () => {
    const { totals, missing } = placeTotals(raw as CheckedPlace, await measuredFiles(file));
    expect(missing).toEqual([]);
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(budgets.place.exterior.drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(budgets.place.exterior.triangles);
    }
    expect(totals.bytes).toBeLessThanOrEqual(budgets.place.exterior.bytes);
  });

  test(`[assets:assets-and-places-within-budget] given ${id}'s file, when its counts are read, then every model's copies are the instances counted, the crowd is the sample each mode shows, the floor is one draw call and every colour is a palette name`, () => {
    expect(file.scope).toBe(entry.scope);
    expect(file.instances).toEqual(stage.models.map((model) => ({ file: model.file, count: model.at.length })));
    expect(file.people.low).toBe(crowdSize(entry, "low", city));
    expect(file.people.high).toBe(crowdSize(entry, "high", city));
    expect((raw as { groundRoadSky: { drawCalls: number } }).groundRoadSky.drawCalls).toBe(1);
    const colours = [stage.ground.colour, stage.light.sky, stage.light.ground, ...stage.roads.flatMap((road) => [road.colour, road.dash?.colour ?? road.colour]), ...stage.motion.flatMap((motion) => motion.colours)];
    expect(colours.filter((colour) => !isPaletteName(colour))).toEqual([]);
    const rows = new Set(register.rows.map((row) => row.file));
    expect([...file.instances.map((instance) => instance.file), ...file.people.sample].filter((path) => !rows.has(path))).toEqual([]);
  });

  test(`[city:crowd-sample-capped] given ${id}'s crowd spots, when the high mode's sample stands, then there is a spot for everyone, no spot is kept past it, no one stands where the player starts, and every person in the pool is a person of the city`, () => {
    const high = crowdSize(entry, "high", city);
    expect(stage.people.length).toBeGreaterThanOrEqual(high);
    for (const indices of Object.values(stage.prefer ?? {})) for (const index of indices) expect(index).toBeLessThan(high);
    const [x, z] = stage.start;
    expect(stage.people.filter(([px, pz]) => Math.hypot(px - x, pz - z) < 0.8)).toEqual([]);
    expect(file.people.sample.filter((path) => personOfLook(path) === null)).toEqual([]);
    expect(file.people.sample.length).toBeGreaterThan(high);
  });

  test(`[city:place-words-are-text-keys] given ${id}'s buildings standing more than once, when their copies are lettered, then every copy has a key for each of its boards, no key shows twice, and every key has words of the place`, async () => {
    const sizes = await measuredFiles(file);
    const keys: string[] = [];
    for (const model of stage.models.filter((candidate) => candidate.signs !== undefined)) {
      expect(model.signs).toHaveLength(model.at.length);
      for (const copy of model.signs ?? []) {
        expect(copy).toHaveLength(sizes.get(model.file)?.signs ?? -1);
        keys.push(...copy);
      }
    }
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((key) => !key.startsWith(`${id}.sign.`) || (text[key] ?? "").trim() === "")).toEqual([]);
  });

  test(`[city:set-piece-shown-where-staged] given what ${id} stages, when the city looks for where each id is shown at home, then it is shown here`, () => {
    for (const staged of entry.stages) expect(stagedAt(staged, { where: "home", country: null }, PLACES)).toBe(id);
  });
}

/** The nearest distance from a spot to any of `others`. */
export function nearest(spot: Spot | readonly [number, number], others: readonly (Spot | readonly [number, number])[]): number {
  return Math.min(...others.map(([x, z]) => Math.hypot(x - spot[0], z - spot[1])));
}
