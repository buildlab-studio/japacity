// pnpm assets:outline <name...> | all
// Scores each landmark against its reference outlines (R-ASSET-023): renders the shipped model as a
// flat black silhouette in each view on the stage, at the frame and scale the rule gives, and
// compares it with the traced polygon in outline.json. Writes outline-score.json beside the
// outline, an overlay picture per view into renders/, and the scores into the register row.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import type { Page } from "@playwright/test";

import { type CatalogEntry, findEntries } from "./catalog";
import { isMain, REPO_ROOT } from "../repo";
import { readManifest, sha256, writeManifest } from "./manifest";
import { contourDistance, frameFor, type Mask, maskBounds, type OutlineSettings, polygonBounds, rasterise, centre, scoreView, type ViewScore } from "./outline-score";
import { encodeIndexedPng } from "./png";
import { readRegister, writeRegister } from "./register";
import { openStage, signText } from "./stage-browser";

export interface OutlineView {
  view: "front" | "side" | "plan";
  polygon: [number, number][];
  source: string;
  read: string;
  scaleFrom: string;
  exclude?: string[];
  /** The stretch of the model the reference covers, in the view's across coordinate. */
  modelRange?: [number, number];
}

export function readSettings(): OutlineSettings {
  return JSON.parse(readFileSync(join(REPO_ROOT, "assets-src", "review.config.json"), "utf8")) as OutlineSettings;
}

/** The view's picture coordinates from the model's bounds: front [x, y], side [-z, y], plan [x, -z]. */
function extentsOf(view: OutlineView["view"], b: readonly number[]): { across: [number, number]; up: [number, number] } {
  const [x0 = 0, y0 = 0, z0 = 0, x1 = 0, y1 = 0, z1 = 0] = b;
  if (view === "front") return { across: [x0, x1], up: [y0, y1] };
  if (view === "side") return { across: [-z1, -z0], up: [y0, y1] };
  return { across: [x0, x1], up: [-z1, -z0] };
}

async function modelMask(page: Page, view: OutlineView, frame: { width: number; height: number; pxPerMetre: number }, centreAt: [number, number, number]): Promise<Mask> {
  const result = await page.evaluate(
    (request) => (globalThis as unknown as { stage: { mask: (r: unknown) => { pixels: string } } }).stage.mask(request),
    { view: view.view, width: frame.width, height: frame.height, pxPerMetre: frame.pxPerMetre, exclude: view.exclude ?? [], centre: centreAt },
  );
  return { width: frame.width, height: frame.height, data: Uint8Array.from(Buffer.from(result.pixels, "base64")) };
}

function overlay(model: Mask, reference: Mask, shiftBy: [number, number]): Buffer {
  const pixels = new Uint8Array(model.width * model.height * 4);
  for (let y = 0; y < model.height; y++) {
    for (let x = 0; x < model.width; x++) {
      const m = model.data[(y - shiftBy[1]) * model.width + (x - shiftBy[0])] === 1 && x - shiftBy[0] >= 0 && x - shiftBy[0] < model.width;
      const r = reference.data[y * model.width + x] === 1;
      // Model only grey, reference only red, both black, neither white: palette colours, so the picture itself reads plainly.
      const rgb = m && r ? [0x1b, 0x1b, 0x1f] : m ? [0x9a, 0x95, 0x8c] : r ? [0xc8, 0x32, 0x1e] : [0xf2, 0xf2, 0xee];
      pixels.set([rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0, 255], (y * model.width + x) * 4);
    }
  }
  return encodeIndexedPng({ width: model.width, height: model.height, pixels });
}

export async function scoreEntry(page: Page, entry: CatalogEntry, settings: OutlineSettings): Promise<Record<string, ViewScore & { contourDistance?: number }>> {
  const file = join(REPO_ROOT, entry.source, "outline.json");
  const outline = JSON.parse(readFileSync(file, "utf8")) as { views: OutlineView[] };
  await page.evaluate(async (o) => {
    await (globalThis as unknown as { stage: { load: (x: unknown) => Promise<unknown> } }).stage.load(o);
  }, { url: `/apps/client/public/assets/${entry.file}`, text: signText() });
  const scores: Record<string, ViewScore & { contourDistance?: number }> = {};
  const manifest = readManifest();
  for (const view of outline.views) {
    const bounds = await page.evaluate((exclude) => (globalThis as unknown as { stage: { bounds: (e: string[]) => number[] } }).stage.bounds(exclude), view.exclude ?? []);
    const { across, up } = extentsOf(view.view, bounds);
    const range = view.modelRange ?? across;
    const ref = polygonBounds(view.polygon);
    const frame = frameFor([[range[1] - range[0], up[1] - up[0]], [ref.maxX - ref.minX, ref.maxY - ref.minY]], settings);
    // The camera's centre in the model's frame: the middle of the range across, the middle of the bounds up.
    const [x0 = 0, y0 = 0, z0 = 0, x1 = 0, y1 = 0, z1 = 0] = bounds;
    const midAcross = (range[0] + range[1]) / 2;
    const centreAt: [number, number, number] =
      view.view === "front" ? [midAcross, (y0 + y1) / 2, (z0 + z1) / 2] : view.view === "side" ? [(x0 + x1) / 2, (y0 + y1) / 2, -midAcross] : [midAcross, (y0 + y1) / 2, (z0 + z1) / 2];
    let model = await modelMask(page, view, frame, centreAt);
    if (view.modelRange !== undefined) {
      // Only the stretch the reference covers is scored: the rest of a long landmark is cleared.
      const half = ((range[1] - range[0]) / 2) * frame.pxPerMetre;
      const data = Uint8Array.from(model.data);
      for (let y = 0; y < model.height; y++) for (let x = 0; x < model.width; x++) if (Math.abs(x + 0.5 - model.width / 2) > half) data[y * model.width + x] = 0;
      model = { ...model, data };
    }
    const mb = maskBounds(model);
    const size = { width: (mb.maxX - mb.minX + 1) / frame.pxPerMetre, height: (mb.maxY - mb.minY + 1) / frame.pxPerMetre };
    const score: ViewScore & { contourDistance?: number } = scoreView(model, view.polygon, frame, settings, size);
    const reference = centre(rasterise(view.polygon, frame));
    if (view.view === "plan") score.contourDistance = Math.round(contourDistance(centre(model), reference, frame.pxPerMetre) * 100) / 100;
    scores[view.view] = score;
    const picture = join(REPO_ROOT, entry.source, "renders", `outline-${view.view}.png`);
    const bytes = overlay(centre(model), reference, score.shift);
    writeFileSync(picture, bytes);
    manifest.renders[relative(REPO_ROOT, picture)] = sha256(bytes);
  }
  writeManifest(manifest);
  writeFileSync(join(REPO_ROOT, entry.source, "outline-score.json"), `${JSON.stringify({ asset: entry.name, settings, scores }, null, 2)}\n`);
  const register = readRegister();
  const row = register.rows.find((candidate) => candidate.file === entry.file);
  if (row !== undefined) {
    row.outline = { file: relative(REPO_ROOT, file), scores: Object.fromEntries(Object.entries(scores).map(([view, s]) => [view, s.score])) };
    writeRegister(register);
  }
  return scores;
}

async function main(): Promise<void> {
  const settings = readSettings();
  const entries = findEntries(process.argv.slice(2)).filter((entry) => existsSync(join(REPO_ROOT, entry.source, "outline.json")));
  const stage = await openStage();
  try {
    const { page } = await stage.open({ width: 512, height: 512, deviceScaleFactor: 1 });
    for (const entry of entries) {
      const scores = await scoreEntry(page, entry, settings);
      for (const [view, s] of Object.entries(scores)) {
        console.log(
          `${entry.name} ${view}: score ${String(s.score)}, shift ${s.shift.join(",")}, thin ${String(s.thin)}, model ${s.model.width.toFixed(1)} x ${s.model.height.toFixed(1)} m, ` +
            `reference ${s.reference.width.toFixed(1)} x ${s.reference.height.toFixed(1)} m, off ${s.widthOffPct.toFixed(1)}% and ${s.heightOffPct.toFixed(1)}%` +
            `${s.contourDistance === undefined ? "" : `, contour ${String(s.contourDistance)} m`} -> ${s.passes ? "passes" : "FAILS"}`,
        );
      }
    }
  } finally {
    await stage.close();
  }
}

if (isMain(import.meta.url)) await main();
