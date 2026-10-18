// The place check (city.md R-CITY-027, R-CITY-038): every staged place rendered by the client's own
// world code on the cheap phone profile (R-CITY-037: 360 by 640 CSS pixels, device scale 2, the
// processor slowed 6 times), in each mode, once still and once moving, seen from the start's street
// camera. Motion may add at most `budgets.motion` over the place held still; the moving place stays
// inside its row of the per-place budget (assets.md R-ASSET-007), the hub's low mode inside the first
// load's. Frame times are recorded and never gate (R-CITY-038). On the same profile each place's route
// map is built and 300 taps routed on it, and what that costs is printed (R-CITY-030); it gates nothing.
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { content } from "@japacity/content";
import type { Page } from "@playwright/test";

import { type Budgets, defaultPaths, type Paths, type PlaceFile, rowFor } from "./assets-check";
import type { CheckMode as Mode, FrameRecord, PlaceInput, RouteRecord } from "./place-check.types";
import { PHONE_SHOT } from "./shoot";
import { filesUnder, isMain, readJson, REPO_ROOT } from "../repo";
import { openStage, signText } from "./stage-browser";

export const CHEAP_PHONE = { ...PHONE_SHOT, slowdown: 6 } as const;
/** The day the check samples each crowd for, so a run gives the same people every time. */
const CHECK_DATE = "2026-10-08";
/** The player's own figure in the check: the city's fallback look. */
export const CHECK_OWN = "shared/chr/chr_tunde.glb";
/** Frames recorded for each place, mode and state. */
const FRAMES = 20;
/** The script is timed in blocks of this many frames' updates, and the fastest block counts, as other work on the machine only ever slows one. */
const SCRIPT_FRAMES = 150;
const SCRIPT_BLOCKS = 3;
/** Taps routed on each place for the cost of routing (city.md R-CITY-030). */
export const ROUTE_TAPS = 300;
const MODES: readonly Mode[] = ["low", "high"];

/** A place file as the check reads it; the page reads its stage. */
export type StagedFile = Pick<PlaceFile, "place" | "hub" | "scope"> & { stage?: unknown };

/** The page's handle, as apps/client/src/features/city/check/placeCheck.page.ts sets it on the window. */
interface PlacePage {
  placeCheck: { build: (input: PlaceInput) => Promise<void>; frames: (count: number) => FrameRecord[]; script: (count: number) => number; routes: (count: number) => RouteRecord };
}

const PAGE = "/apps/client/src/features/city/check/placeCheck.html";

export interface Measure {
  /** The most of any frame. */
  drawCalls: number;
  triangles: number;
  /** A frame's script, from the fastest of the timed blocks. */
  scriptUs: number;
  frameMs: number;
}

/** What routing cost on a place, in milliseconds on the cheap phone profile. */
export interface RouteCost {
  cells: number;
  mapMs: number;
  /** The middle, the average and the worst of the taps. */
  middleMs: number;
  averageMs: number;
  worstMs: number;
  taps: number;
}

export interface PlaceMeasure {
  place: string;
  mode: Mode;
  still: Measure;
  moving: Measure;
  /** Measured once a place, with its low mode. */
  routes?: RouteCost;
}

/** A place's routing as the summary reads it: the map's build, and the middle, average and worst tap. */
export function routeCost(record: RouteRecord): RouteCost {
  const total = record.tapsMs.reduce((sum, ms) => sum + ms, 0);
  return {
    cells: record.cells,
    mapMs: record.mapMs,
    middleMs: median(record.tapsMs),
    averageMs: record.tapsMs.length === 0 ? 0 : total / record.tapsMs.length,
    worstMs: Math.max(0, ...record.tapsMs),
    taps: record.tapsMs.length,
  };
}

/** The middle value, or the mean of the two middle values. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((one, two) => one - two);
  const half = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2 === 1 ? (sorted[half] ?? 0) : ((sorted[half - 1] ?? 0) + (sorted[half] ?? 0)) / 2;
}

/** A run as the check reads it: the heaviest frame's draw calls and triangles, the median frame's time, and the fastest block's script a frame. */
export function summarise(records: readonly FrameRecord[], scriptBlocks: readonly number[]): Measure {
  return {
    drawCalls: Math.max(0, ...records.map((record) => record.drawCalls)),
    triangles: Math.max(0, ...records.map((record) => record.triangles)),
    scriptUs: Math.min(...scriptBlocks),
    frameMs: median(records.map((record) => record.frameMs)),
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

/** What the page is handed for a place in a mode: the file, its entry and the city's tuning as plain data, on the cheap phone. */
export function inputOf(file: StagedFile, mode: Mode, moving: boolean, text: Record<string, string>): PlaceInput {
  const entry = content.place[file.place as keyof typeof content.place];
  if (entry === undefined) throw new Error(`${file.place} is not a place of the content`);
  return { file, entry, city: content.tuning.city, date: CHECK_DATE, own: CHECK_OWN, mode, device: { finePointer: false, width: CHEAP_PHONE.width, pixelRatio: CHEAP_PHONE.deviceScaleFactor }, text, moving };
}

/** Every staged place under public/assets. */
export function stagedPlaces(paths: Paths): StagedFile[] {
  return filesUnder(paths.public)
    .filter((path) => path.endsWith("/place.json"))
    .map((path) => readJson<StagedFile>(join(paths.public, path)))
    .filter((file) => file.stage !== undefined);
}

/** One run measured on the slowed processor; with `routes`, the place's routing is measured too before the processor is freed. */
async function measureRun(page: Page, input: PlaceInput, throttle: (rate: number) => Promise<void>, routes = false): Promise<{ measure: Measure; routes?: RouteCost }> {
  await page.evaluate(async (data) => (globalThis as unknown as PlacePage).placeCheck.build(data), JSON.parse(JSON.stringify(input)) as PlaceInput);
  await throttle(CHEAP_PHONE.slowdown);
  const records = await page.evaluate((count) => (globalThis as unknown as PlacePage).placeCheck.frames(count), FRAMES);
  const blocks: number[] = [];
  for (let block = 0; block < SCRIPT_BLOCKS; block += 1) blocks.push(await page.evaluate((count) => (globalThis as unknown as PlacePage).placeCheck.script(count), SCRIPT_FRAMES));
  const cost = routes ? routeCost(await page.evaluate((count) => (globalThis as unknown as PlacePage).placeCheck.routes(count), ROUTE_TAPS)) : undefined;
  await throttle(1);
  return cost === undefined ? { measure: summarise(records, blocks) } : { measure: summarise(records, blocks), routes: cost };
}

export interface RenderOptions {
  /** Only these places, by id; every staged place when empty. */
  only?: readonly string[];
  /** Called with the page after each moving run, its last frame still on screen. */
  shoot?: ((page: Page, measure: PlaceMeasure) => Promise<void>) | undefined;
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
    const { context, page } = await stage.open(CHEAP_PHONE, PAGE, "window.placeCheckReady === true");
    const session = await context.newCDPSession(page);
    const throttle = async (rate: number): Promise<void> => {
      await session.send("Emulation.setCPUThrottlingRate", { rate });
    };
    for (const file of places) {
      for (const mode of MODES) {
        const still = (await measureRun(page, inputOf(file, mode, false, text), throttle)).measure;
        const moving = await measureRun(page, inputOf(file, mode, true, text), throttle, mode === "low");
        const measure: PlaceMeasure = moving.routes === undefined ? { place: file.place, mode, still, moving: moving.measure } : { place: file.place, mode, still, moving: moving.measure, routes: moving.routes };
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

/** One line a place and mode for the check's output, and a second for the place's routing where it was measured. */
export function describeMeasure(measure: PlaceMeasure): string {
  const { still, moving, routes } = measure;
  const line =
    `${measure.place} ${measure.mode}: still ${String(still.drawCalls)} draw calls, ${String(still.triangles)} triangles; ` +
    `moving ${String(moving.drawCalls)} draw calls, ${String(moving.triangles)} triangles, script ${still.scriptUs.toFixed(0)} to ${moving.scriptUs.toFixed(0)} us, frame ${still.frameMs.toFixed(1)} to ${moving.frameMs.toFixed(1)} ms`;
  if (routes === undefined) return line;
  return `${line}\n${describeRoutes(measure.place, routes)}`;
}

/** The routing line of the summary (city.md R-CITY-030): the map once, then the taps' middle, average and worst. */
function describeRoutes(place: string, routes: RouteCost): string {
  return `${place} routes: map of ${String(routes.cells)} cells built in ${routes.mapMs.toFixed(2)} ms; ${String(routes.taps)} taps middle ${routes.middleMs.toFixed(2)} ms, average ${routes.averageMs.toFixed(2)} ms, worst ${routes.worstMs.toFixed(2)} ms`;
}

/** tsx tools/assets/place-check.ts [place.id ...] [--shots <folder>]: the place check alone, with a picture of each moving run when a folder is given. */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const at = args.indexOf("--shots");
  const folder = at >= 0 ? args[at + 1] : undefined;
  const only = args.filter((arg, index) => at < 0 || (index !== at && index !== at + 1));
  const paths = defaultPaths(REPO_ROOT);
  const budgets = readJson<Budgets>(join(paths.source, "budgets.json"));
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

if (isMain(import.meta.url)) await main();
