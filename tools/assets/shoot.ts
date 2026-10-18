// pnpm assets:shoot [--view <view>]... <name...> | examples | all
// Renders the fixed views of assets:contributor-renders-fixed-views from the shipped file: front, back, left and right in
// orthographic projection, the three-quarter view from 30 degrees up with a 32 degree lens, the
// plan for buildings and landmarks, and the phone shot at 360 by 640 CSS pixels, device scale 2,
// 12 m from the asset in the standard street. Every model but a person also gets the tile: the
// three-quarter view framed tight in a 256 pixel square at device scale 2 on a clear ground, which
// the interface cuts as a sticker (design page 09). A look the front door offers also gets its
// portraits on the same clear ground: the face (128 square at scale 2), and the whole figure with
// a hand on the hip and cheering (200 by 400 at scale 2), each from the game's own poses. Writes the pictures and a render manifest
// beside them in the asset's renders folder, and their hashes into models/manifest.json.
// `--view` shoots only the views named, keeping the others' records.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { type PoseName, poseRotations } from "@japacity/models/people/poses";
import type { Page } from "@playwright/test";

import { type CatalogEntry, findEntries, PUBLIC, type ViewName } from "./catalog";
import { isMain, readJson, REPO_ROOT } from "../repo";
import { readManifest, sha256, writeManifest } from "./manifest";
import { openStage, signText, type Stage } from "./stage-browser";

/** The phone shot's numbers (assets.md, Numbers: `phoneShot`). */
export const PHONE_SHOT = { width: 360, height: 640, deviceScaleFactor: 2, distance: 12 } as const;
export const SHEET_VIEWPORT = { width: 1024, height: 768, deviceScaleFactor: 1 } as const;
/** The tile's square: 256 CSS pixels at device scale 2, a 512 pixel picture. */
export const TILE_SHOT = { width: 256, height: 256, deviceScaleFactor: 2 } as const;
/** A look's face: 128 CSS pixels square at device scale 2, a 256 pixel picture, sharp at the strip's and the life card's sizes. */
export const FACE_SHOT = { width: 128, height: 128, deviceScaleFactor: 2 } as const;
/** A look's whole figure: 200 by 400 CSS pixels at device scale 2, a 400 by 800 picture. */
export const FIGURE_SHOT = { width: 200, height: 400, deviceScaleFactor: 2 } as const;
const VIEWS: readonly ViewName[] = ["front", "back", "left", "right", "threeQuarter", "plan", "phone", "phoneFar", "tile", "face", "figure", "cheer"];
/** The pose each portrait is shot in, from the game's own poses. */
export const PORTRAIT_POSES = { face: "stand", figure: "hip", cheer: "cheer" } as const;
type Portrait = keyof typeof PORTRAIT_POSES;
const isPortrait = (view: ViewName): view is Portrait => view in PORTRAIT_POSES;
const SCALE_FIGURE = "shared/person/person_tunde.glb";

interface StagePose {
  rotations: Record<string, [number, number, number]>;
  hipsY?: number;
}

function poseFor(entry: Pick<CatalogEntry, "pose">, name: PoseName | undefined = entry.pose): StagePose | undefined {
  if (name === undefined) return undefined;
  const pose = poseRotations(name);
  const rotations: Record<string, [number, number, number]> = {};
  for (const [bone, rotation] of Object.entries(pose.rotations)) if (rotation !== undefined) rotations[bone] = rotation;
  return pose.hipsY === undefined ? { rotations } : { rotations, hipsY: pose.hipsY };
}

async function load(page: Page, entry: CatalogEntry, withFigure: boolean, pose?: PoseName): Promise<void> {
  const options = {
    url: `/apps/client/public/assets/${entry.file}`,
    text: signText(),
    pose: poseFor(entry, pose ?? entry.pose),
    scaleFigure: withFigure && !entry.name.startsWith("person_") ? { url: `/apps/client/public/assets/${SCALE_FIGURE}`, pose: poseFor({ ...entry, pose: "stand" }) } : undefined,
    ground: entry.ground,
    farView: entry.farView,
  };
  await page.evaluate(async (o) => {
    const stage = (globalThis as unknown as { stage: { load: (x: unknown) => Promise<unknown> } }).stage;
    await stage.load(JSON.parse(JSON.stringify(o)));
  }, options);
}

async function show(page: Page, view: ViewName): Promise<unknown> {
  return page.evaluate((v) => (globalThis as unknown as { stage: { show: (x: string) => unknown } }).stage.show(v), view);
}

export interface RenderRecord {
  view: ViewName;
  file: string;
  sha256: string;
  viewport: { width: number; height: number; deviceScaleFactor: number };
  camera: unknown;
}

/** The views a command line asks for with `--view`, null for every view, and the asset names left. */
export function viewsAsked(args: readonly string[]): { views: ViewName[] | null; names: string[] } {
  const views: ViewName[] = [];
  const names: string[] = [];
  for (let at = 0; at < args.length; at++) {
    const arg = args[at] ?? "";
    if (arg !== "--view") {
      names.push(arg);
      continue;
    }
    const view = args[++at] ?? "";
    if (!VIEWS.includes(view as ViewName)) throw new Error(`No view named ${view}. Known: ${VIEWS.join(", ")}`);
    views.push(view as ViewName);
  }
  return { views: views.length === 0 ? null : views, names };
}

/** The records kept and the records shot, one a view, in the order the entry lists its views. */
export function mergeRecords(views: readonly ViewName[], kept: readonly RenderRecord[], shot: readonly RenderRecord[]): RenderRecord[] {
  const byView = new Map<ViewName, RenderRecord>();
  for (const record of [...kept, ...shot]) byView.set(record.view, record);
  return views.flatMap((view) => byView.get(view) ?? []);
}

export async function shootEntry(stage: Stage, entry: CatalogEntry, only: readonly ViewName[] | null = null): Promise<RenderRecord[]> {
  const dir = join(REPO_ROOT, entry.source, "renders");
  mkdirSync(dir, { recursive: true });
  const records: RenderRecord[] = [];
  const asked = entry.views.filter((view) => only === null || only.includes(view));
  const phone = (view: ViewName): boolean => view === "phone" || view === "phoneFar";
  const groups: [{ width: number; height: number; deviceScaleFactor: number }, readonly ViewName[], PoseName | undefined][] = [
    [SHEET_VIEWPORT, asked.filter((view) => !phone(view) && view !== "tile" && !isPortrait(view)), undefined],
    [PHONE_SHOT, asked.filter(phone), undefined],
    [TILE_SHOT, asked.filter((view) => view === "tile"), undefined],
    // Each portrait is a load of its own, in its own pose.
    ...asked.filter(isPortrait).map((view): [{ width: number; height: number; deviceScaleFactor: number }, readonly ViewName[], PoseName] => [view === "face" ? FACE_SHOT : FIGURE_SHOT, [view], PORTRAIT_POSES[view]]),
  ];
  for (const [viewport, views, pose] of groups) {
    if (views.length === 0) continue;
    const { context, page } = await stage.open(viewport);
    await load(page, entry, viewport === PHONE_SHOT, pose);
    for (const view of views) {
      const info = (await show(page, view)) as { camera: unknown };
      const file = join(dir, `${view}.png`);
      // The tile and the portraits keep the page's clear background as their alpha.
      const bytes = await page.screenshot({ path: file, omitBackground: view === "tile" || isPortrait(view) });
      records.push({ view, file: relative(REPO_ROOT, file), sha256: sha256(bytes), viewport: { width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.deviceScaleFactor }, camera: info.camera });
    }
    await context.close();
  }
  const manifestPath = join(dir, "manifest.json");
  const kept = only !== null && existsSync(manifestPath) ? readJson<{ renders: RenderRecord[] }>(manifestPath).renders : [];
  const glb = readFileSync(join(PUBLIC, entry.file));
  const renderManifest = {
    asset: entry.name,
    file: `public/assets/${entry.file}`,
    fileSha256: sha256(glb),
    renderer: "three 0.186.1, WebGLRenderer on SwiftShader in Playwright 1.63.0's Chromium",
    stage: "models/stage/stage.ts: one sun, one sky, sand ground; the phone shot's street; the tile and the portraits on a clear ground",
    renders: mergeRecords(entry.views, kept, records),
  };
  writeFileSync(manifestPath, `${JSON.stringify(renderManifest, null, 2)}\n`);
  const manifest = readManifest();
  for (const record of records) manifest.renders[record.file] = record.sha256;
  writeManifest(manifest);
  return records;
}

async function main(): Promise<void> {
  const { views, names } = viewsAsked(process.argv.slice(2));
  const entries = findEntries(names).filter((entry) => views === null || entry.views.some((view) => views.includes(view)));
  const stage = await openStage();
  try {
    for (const entry of entries) {
      const records = await shootEntry(stage, entry, views);
      console.log(`${entry.name}: ${records.map((r) => r.view).join(", ")}`);
    }
  } finally {
    await stage.close();
  }
}

if (isMain(import.meta.url)) await main();
