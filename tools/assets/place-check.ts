// The place check (city.md R-CITY-027, R-CITY-038): every staged place rendered by the client's own
// world code on the cheap phone profile (R-CITY-037: 360 by 640 CSS pixels, device scale 2, the
// processor slowed 6 times), in each mode, once still and once moving, seen from the start's street
// camera. Motion may add at most `budgets.motion` over the place held still; the moving place stays
// inside its row of the per-place budget (assets.md R-ASSET-007), the hub's low mode inside the first
// load's. Frame times are recorded and never gate (R-CITY-038).
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { content } from "@japacity/content";
import type { FrameRecord, PlaceRun } from "@japacity/assets-src/stage/place.types";
import type { Page } from "@playwright/test";

import { poolOf, sampleCrowd } from "../../apps/client/src/features/city/crowd";
import { type Mode, modeSettings } from "../../apps/client/src/features/city/mode";
import type { PlaceFile as StagedFile } from "../../apps/client/src/features/city/placeFile";
import { type Budgets, defaultPaths, listFiles, type Paths, rowFor } from "./check-assets";
import { PHONE_SHOT } from "./shoot";
import { openStage, signText } from "./stage-browser";

export const CHEAP_PHONE = { ...PHONE_SHOT, slowdown: 6 } as const;
/** The day the check samples each crowd for, so a run gives the same people every time. */
export const CHECK_DATE = "2026-10-08";
/** The player's own figure in the check: the city's fallback look. */
export const CHECK_OWN = "shared/chr/chr_tunde.glb";
/** Frames recorded for each place, mode and state. */
export const FRAMES = 40;
const MODES: readonly Mode[] = ["low", "high"];

/** The page's handle, as assets-src/stage/place.ts sets it on the window. */
interface PlacePage {
  placeCheck: { build: (run: PlaceRun) => Promise<void>; frames: (count: number) => FrameRecord[] };
}

export interface Measure {
  /** The most of any frame. */
  drawCalls: number;
  triangles: number;
  /** The mean of the frames. */
  scriptUs: number;
  frameMs: number;
}

export interface PlaceMeasure {
  place: string;
  mode: Mode;
  still: Measure;
  moving: Measure;
}

/** A run's frames as the check reads them: the heaviest frame's draw calls and triangles, the mean script and frame time. */
export function summarise(records: readonly FrameRecord[]): Measure {
  const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  return {
    drawCalls: Math.max(0, ...records.map((record) => record.drawCalls)),
    triangles: Math.max(0, ...records.map((record) => record.triangles)),
    scriptUs: mean(records.map((record) => record.scriptUs)),
    frameMs: mean(records.map((record) => record.frameMs)),
  };
}

/** R-CITY-027: what motion adds to the place held still, in draw calls and in script a frame. */
export function checkMotion(measure: PlaceMeasure, budgets: Pick<Budgets, "motion">): string[] {
  const problems: string[] = [];
  const calls = measure.moving.drawCalls - measure.still.drawCalls;
  const script = measure.moving.scriptUs - measure.still.scriptUs;
  if (calls > budgets.motion.extraDrawCalls) problems.push(`R-CITY-027: ${measure.place} in ${measure.mode} mode: motion adds ${String(calls)} draw calls, over ${String(budgets.motion.extraDrawCalls)}`);
  if (script > budgets.motion.scriptUs) problems.push(`R-CITY-027: ${measure.place} in ${measure.mode} mode: motion adds ${script.toFixed(0)} microseconds of script a frame, over ${String(budgets.motion.scriptUs)}`);
  return problems;
}

/** R-CITY-038: the moving place, as drawn, inside its row of the per-place budget in the mode. */
export function checkDrawn(measure: PlaceMeasure, place: Pick<StagedFile, "hub" | "scope">, budgets: Budgets): string[] {
  const row = rowFor(place, measure.mode, budgets);
  const problems: string[] = [];
  if (measure.moving.drawCalls > row.drawCalls) problems.push(`R-CITY-038: ${measure.place} draws ${String(measure.moving.drawCalls)} draw calls in ${measure.mode} mode on the cheap phone profile, over ${String(row.drawCalls)}`);
  if (measure.moving.triangles > row.triangles) problems.push(`R-CITY-038: ${measure.place} draws ${String(measure.moving.triangles)} triangles in ${measure.mode} mode on the cheap phone profile, over ${String(row.triangles)}`);
  return problems;
}

/** What the page builds for a place in a mode: its stage, the crowd the city would sample on the check's day, and the mode's settings on the cheap phone. */
export function runOf(file: StagedFile, mode: Mode, moving: boolean, text: Record<string, string>): PlaceRun {
  if (file.stage === undefined) throw new Error(`${file.place} has no stage`);
  const entry = content.place[file.place as keyof typeof content.place];
  if (entry === undefined) throw new Error(`${file.place} is not a place of the content`);
  const city = content.tuning.city;
  const pool = poolOf(file.people.sample).filter((person) => person.file !== CHECK_OWN);
  const people = sampleCrowd(entry, pool, CHECK_DATE, mode, city).people;
  const settings = modeSettings(mode, { finePointer: false, width: CHEAP_PHONE.width, pixelRatio: CHEAP_PHONE.deviceScaleFactor }, city);
  return { stage: file.stage, people, own: CHECK_OWN, settings, text, moving };
}

/** Every staged place under public/assets. */
export function stagedPlaces(paths: Paths): StagedFile[] {
  return listFiles(paths.public)
    .filter((path) => path.endsWith("/place.json"))
    .map((path) => JSON.parse(readFileSync(join(paths.public, path), "utf8")) as StagedFile)
    .filter((file) => file.stage !== undefined);
}

async function measureRun(page: Page, run: PlaceRun, throttle: (rate: number) => Promise<void>): Promise<Measure> {
  await page.evaluate(async (data) => (globalThis as unknown as PlacePage).placeCheck.build(data), JSON.parse(JSON.stringify(run)) as PlaceRun);
  await throttle(CHEAP_PHONE.slowdown);
  const records = await page.evaluate((count) => (globalThis as unknown as PlacePage).placeCheck.frames(count), FRAMES);
  await throttle(1);
  return summarise(records);
}

export interface RenderOptions {
  /** Only these places, by id; every staged place when empty. */
  only?: readonly string[];
  /** Called with the page after each moving run, its last frame still on screen. */
  shoot?: (page: Page, measure: PlaceMeasure) => Promise<void>;
}

/** Renders every staged place still and moving in both modes and checks each. */
export async function renderPlaces(paths: Paths, budgets: Budgets, options: RenderOptions = {}): Promise<{ problems: string[]; measures: PlaceMeasure[] }> {
  const only = options.only ?? [];
  const places = stagedPlaces(paths).filter((file) => only.length === 0 || only.includes(file.place));
  const shoot = options.shoot;
  const text = signText();
  const stage = await openStage();
  const problems: string[] = [];
  const measures: PlaceMeasure[] = [];
  try {
    const { context, page } = await stage.open(CHEAP_PHONE, "/assets-src/stage/place.html", "window.placeCheckReady === true");
    const session = await context.newCDPSession(page);
    const throttle = async (rate: number): Promise<void> => {
      await session.send("Emulation.setCPUThrottlingRate", { rate });
    };
    for (const file of places) {
      for (const mode of MODES) {
        const still = await measureRun(page, runOf(file, mode, false, text), throttle);
        const moving = await measureRun(page, runOf(file, mode, true, text), throttle);
        const measure: PlaceMeasure = { place: file.place, mode, still, moving };
        measures.push(measure);
        problems.push(...checkMotion(measure, budgets), ...checkDrawn(measure, file, budgets));
        if (shoot !== undefined) await shoot(page, measure);
      }
    }
    await context.close();
  } finally {
    await stage.close();
  }
  return { problems, measures };
}

/** One line a place and mode for the check's output. */
export function describeMeasure(measure: PlaceMeasure): string {
  const { still, moving } = measure;
  return (
    `${measure.place} ${measure.mode}: still ${String(still.drawCalls)} draw calls, ${String(still.triangles)} triangles; ` +
    `moving ${String(moving.drawCalls)} draw calls, ${String(moving.triangles)} triangles, script ${still.scriptUs.toFixed(0)} to ${moving.scriptUs.toFixed(0)} us, frame ${still.frameMs.toFixed(1)} to ${moving.frameMs.toFixed(1)} ms`
  );
}

/** tsx tools/assets/place-check.ts [place.id ...] [--shots <folder>]: the place check alone, with a picture of each moving run when a folder is given. */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const at = args.indexOf("--shots");
  const folder = at >= 0 ? args[at + 1] : undefined;
  const only = args.filter((arg, index) => at < 0 || (index !== at && index !== at + 1));
  const paths = defaultPaths(join(import.meta.dirname, "..", ".."));
  const budgets = JSON.parse(readFileSync(join(paths.source, "budgets.json"), "utf8")) as Budgets;
  const shoot =
    folder === undefined
      ? undefined
      : async (page: Page, measure: PlaceMeasure): Promise<void> => {
          mkdirSync(folder, { recursive: true });
          await page.screenshot({ path: join(folder, `${measure.place.replace(/^place\./, "")}-${measure.mode}.png`) });
        };
  const { problems, measures } = await renderPlaces(paths, budgets, { only, shoot });
  for (const measure of measures) console.log(describeMeasure(measure));
  for (const problem of problems) console.log(problem);
  if (problems.length > 0) process.exit(1);
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) await main();
