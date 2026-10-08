// pnpm assets:shoot <name...> | examples | all
// Renders the fixed views of R-ASSET-020 from the shipped file: front, back, left and right in
// orthographic projection, the three-quarter view from 30 degrees up with a 32 degree lens, the
// plan for buildings and landmarks, and the phone shot at 360 by 640 CSS pixels, device scale 2,
// 12 m from the asset in the standard street. Writes the pictures and a render manifest beside
// them in the asset's renders folder, and their hashes into assets-src/manifest.json.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { poseRotations } from "@japacity/assets-src/people/poses";
import type { Page } from "@playwright/test";

import { type CatalogEntry, findEntries, PUBLIC, ROOT, type ViewName } from "./catalog";
import { readManifest, sha256, writeManifest } from "./manifest";
import { openStage, signText, type Stage } from "./stage-browser";

/** The phone shot's numbers (assets.md, Numbers: `phoneShot`). */
export const PHONE_SHOT = { width: 360, height: 640, deviceScaleFactor: 2, distance: 12 } as const;
export const SHEET_VIEWPORT = { width: 1024, height: 768, deviceScaleFactor: 1 } as const;
const SCALE_FIGURE = "shared/chr/chr_tunde.glb";

interface StagePose {
  rotations: Record<string, [number, number, number]>;
  hipsY?: number;
}

function poseFor(entry: CatalogEntry): StagePose | undefined {
  if (entry.pose === undefined) return undefined;
  const pose = poseRotations(entry.pose);
  const rotations: Record<string, [number, number, number]> = {};
  for (const [bone, rotation] of Object.entries(pose.rotations)) if (rotation !== undefined) rotations[bone] = rotation;
  return pose.hipsY === undefined ? { rotations } : { rotations, hipsY: pose.hipsY };
}

async function load(page: Page, entry: CatalogEntry, withFigure: boolean): Promise<void> {
  const options = {
    url: `/apps/client/public/assets/${entry.file}`,
    text: signText(),
    pose: poseFor(entry),
    scaleFigure: withFigure && !entry.name.startsWith("chr_") ? { url: `/apps/client/public/assets/${SCALE_FIGURE}`, pose: poseFor({ ...entry, pose: "stand" }) } : undefined,
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

export async function shootEntry(stage: Stage, entry: CatalogEntry): Promise<RenderRecord[]> {
  const dir = join(ROOT, entry.source, "renders");
  mkdirSync(dir, { recursive: true });
  const records: RenderRecord[] = [];
  const sheetViews = entry.views.filter((view) => view !== "phone" && view !== "phoneFar");
  const phoneViews = entry.views.filter((view) => view === "phone" || view === "phoneFar");
  for (const [viewport, views] of [
    [SHEET_VIEWPORT, sheetViews],
    [PHONE_SHOT, phoneViews],
  ] as const) {
    if (views.length === 0) continue;
    const { context, page } = await stage.open(viewport);
    await load(page, entry, viewport === PHONE_SHOT);
    for (const view of views) {
      const info = (await show(page, view)) as { camera: unknown };
      const file = join(dir, `${view}.png`);
      const bytes = await page.screenshot({ path: file });
      records.push({ view, file: relative(ROOT, file), sha256: sha256(bytes), viewport: { width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.deviceScaleFactor }, camera: info.camera });
    }
    await context.close();
  }
  const glb = readFileSync(join(PUBLIC, entry.file));
  const renderManifest = {
    asset: entry.name,
    file: `public/assets/${entry.file}`,
    fileSha256: sha256(glb),
    renderer: "three 0.186.1, WebGLRenderer on SwiftShader in Playwright 1.63.0's Chromium",
    stage: "assets-src/stage/stage.ts: one sun, one sky, sand ground; the phone shot's street",
    renders: records,
  };
  writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(renderManifest, null, 2)}\n`);
  const manifest = readManifest();
  for (const record of records) manifest.renders[record.file] = record.sha256;
  writeManifest(manifest);
  return records;
}

async function main(): Promise<void> {
  const entries = findEntries(process.argv.slice(2));
  const stage = await openStage();
  try {
    for (const entry of entries) {
      const records = await shootEntry(stage, entry);
      console.log(`${entry.name}: ${records.map((r) => r.view).join(", ")}`);
    }
  } finally {
    await stage.close();
  }
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) await main();
