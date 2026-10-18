// What every staged place's test reads: its place.json as the client sees it, measured as the build
// check measures it (tools/assets/assets-check.ts), and the checks every stage owes the city.
import { join } from "node:path";

import { isPaletteName } from "@japacity/assets";
import { content, text } from "@japacity/content";
import type { Id, PlaceEntry } from "@japacity/sim";
import { expect } from "vitest";

import budgets from "../../../../../../assets-src/budgets.json";
import { type Measured, measureFile, placeTotals, type PlaceFile as CheckedPlace, type PlaceTotals } from "../../../../../../tools/assets/assets-check";
import { crowdSize } from "../../../shared/scene/crowd";
import { CAR_FILE, type PlaceFile, type Spot, type Stage } from "../../../shared/scene/placeFile";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..", "..", "..");
const PUBLIC = join(ROOT, "apps", "client", "public", "assets");
export const city = content.tuning.city;

export interface Staged {
  file: PlaceFile;
  stage: Stage;
  entry: PlaceEntry;
}

export function staged(raw: unknown, id: Id<"place">): Staged {
  const file = raw as PlaceFile;
  const stage = file.stage;
  if (stage === undefined) throw new Error(`${id} has no stage`);
  const entry = content.place[id];
  if (entry === undefined) throw new Error(`${id} is missing from content`);
  return { file, stage, entry };
}

const PATHS = { root: ROOT, source: join(ROOT, "assets-src"), public: PUBLIC, dist: "" };

/** One shipped file measured as the build check measures it. */
export async function measured(path: string): Promise<Measured> {
  return measureFile(PATHS, path);
}

/** Every file the place shows, its instances and its crowd's sample, each measured once, by path. */
export async function measuredFiles(file: PlaceFile): Promise<Map<string, Measured>> {
  const files = [...new Set([...file.instances.map((instance) => instance.file), ...file.people.sample])];
  return new Map(await Promise.all(files.map(async (path) => [path, await measureFile(PATHS, path)] as const)));
}

/** The place counted as the build check counts it: the instances, the floor and the heaviest of the sample times each mode's crowd. */
export async function totalsOf(file: PlaceFile): Promise<PlaceTotals> {
  const { totals, missing } = placeTotals(file as unknown as CheckedPlace, await measuredFiles(file));
  expect(missing).toEqual([]);
  return totals;
}

/** The row of the budget page a place answers to: its scope's, in both modes. */
export function rowOf(file: PlaceFile): { drawCalls: number; triangles: number } {
  return budgets.place[file.scope];
}

/** Every model's copies counted once, the most of any dressing's, with what the room shows of the month's plan, as the file's instances. */
export function instancesOf(stage: Stage): { file: string; count: number }[] {
  const counts = new Map<string, number>();
  // A home's car at its spot is counted too, so the most in view holds once the life has a car.
  const car = stage.car === undefined ? [] : [{ file: CAR_FILE, at: [stage.car] }];
  // The market's things a home may hold are counted at their set spots, so the most in view holds with all of them owned.
  const owned = (stage.owned ?? []).map((spot) => ({ file: spot.file, at: [spot.at] }));
  const extra = [...(stage.dressings ?? []).flatMap((dressing) => dressing.models), ...(stage.shows ?? []).flatMap((show) => show.models), ...car, ...owned];
  for (const model of [...stage.models, ...extra]) counts.set(model.file, Math.max(counts.get(model.file) ?? 0, model.at.length));
  return [...counts].map(([file, count]) => ({ file, count }));
}

/** The high mode's crowd for the place's own entry figures. */
export function highCrowd(entry: PlaceEntry): number {
  return crowdSize(entry, "high", city);
}

export function lowCrowd(entry: PlaceEntry): number {
  return crowdSize(entry, "low", city);
}

/** Every colour on the floor and in the motion is a palette name (assets:colours-from-named-palette). */
function coloursOf(stage: Stage): string[] {
  return [
    stage.ground.colour,
    stage.light.sky,
    stage.light.ground,
    ...stage.roads.flatMap((road) => [road.colour, road.dash?.colour ?? road.colour]),
    ...[...stage.motion, ...(stage.dressings ?? []).flatMap((dressing) => dressing.motion), ...(stage.shows ?? []).flatMap((show) => show.motion)].flatMap((motion) => [...motion.colours, ...(motion.hoist === undefined ? [] : [motion.hoist])]),
  ];
}

export function allPalette(stage: Stage): boolean {
  return coloursOf(stage).every(isPaletteName);
}

/** A spot stands on the place's ground. */
export function onGround(stage: Stage, [x, z]: Spot): boolean {
  const [width, depth] = stage.ground.size;
  return Math.abs(x) <= width / 2 && Math.abs(z) <= depth / 2;
}

/** The copies of one model, by the end of its file name. */
export function copiesOf(stage: Stage, name: string): Spot[] {
  return stage.models.filter((model) => model.file.endsWith(name)).flatMap((model) => model.at);
}

/** Every sign key a stage names, with no key on two copies, each with its words. */
export function signKeys(stage: Stage): string[] {
  return [...stage.models, ...(stage.dressings ?? []).flatMap((dressing) => dressing.models)].flatMap((model) => (model.signs ?? []).flat());
}

export function wordsOf(key: string): string {
  return text[key] ?? "";
}
