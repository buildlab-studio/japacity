// pnpm tsx tools/assets/faces-explore.ts <out dir> [style,style...]
// The face exploration: four people built in each face
// style, exported and shot into a folder outside the repository, never over the shipped people in
// public/assets. For each style a folder of glb files and pictures (front and three-quarter at the
// shooter's size, a close-up of each head, and each person as small as the world shows them on a
// phone), the figures of every file, and two contact sheets: 01-faces-large.png at 1600 by 1000 and
// 02-faces-phone.png at a 390 pixel phone width.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { buildPerson, FACE_STYLES, type FaceStyle, faceStyleFrom, type PersonSpec } from "@japacity/assets-src/people/people";
import { ALL_PEOPLE } from "@japacity/assets-src/people/people.data";
import { poseRotations } from "@japacity/assets-src/people/poses";
import type { Page } from "@playwright/test";

import { personModel } from "./catalog";
import { measure, readGlb, toDocument, writeGlb } from "./glb";
import { checkPalette } from "./palette-check";
import { openStage, signText, type Stage } from "./stage-browser";

const PEOPLE = ["chr_ada", "chr_femi", "chr_iya", "chr_hawker_a"] as const;
const LABEL: Record<(typeof PEOPLE)[number], string> = { chr_ada: "Ada", chr_femi: "Femi", chr_iya: "Iya (Mama)", chr_hawker_a: "Hawker" };
const STYLE_LABEL: Record<FaceStyle, string> = { today: "Today", a: "A, soft marks", b: "B, low poly", c: "C, big and friendly" };
/** A person's budget (assets.md, the per-asset table, `chr_`). */
const BUDGET = { triangles: 3000, drawCalls: 3, bytes: 150 * 1024 } as const;
const LARGE = { width: 1024, height: 768 } as const;
/** About 60 CSS pixels tall at device scale 3, as a person shows in the world on a 390 pixel phone. */
const PHONE = { front: { width: 46, height: 66 }, threeQuarter: { width: 70, height: 70 }, cellWidth: 46, deviceScaleFactor: 3 } as const;
type View = "front" | "threeQuarter";
const VIEWS: readonly View[] = ["front", "threeQuarter"];

interface Figures {
  triangles: number;
  drawCalls: number;
  materials: number;
  bytes: number;
  height: number;
  palette: string[];
}

interface Camera {
  kind: "orthographic" | "perspective";
  position: number[];
  target: number[];
  fov?: number;
  width?: number;
  height?: number;
}

function specOf(name: string): PersonSpec {
  const spec = ALL_PEOPLE.find((p) => p.name === name);
  if (spec === undefined) throw new Error(`No person ${name}`);
  return spec;
}

async function exportPerson(spec: PersonSpec, style: FaceStyle, dir: string): Promise<{ bytes: Uint8Array; figures: Figures }> {
  const bytes = await writeGlb(toDocument(personModel(buildPerson(spec, style))));
  const doc = await readGlb(bytes);
  const m = measure(doc, bytes.byteLength);
  const palette = checkPalette(doc).map((p) => `${p.where}: ${p.rgb.join(",")}`);
  writeFileSync(join(dir, `${spec.name}.glb`), bytes);
  return { bytes, figures: { triangles: m.triangles, drawCalls: m.drawCalls, materials: m.materials, bytes: m.bytes, height: m.maxY, palette } };
}

function poseFor(spec: PersonSpec): { rotations: Record<string, [number, number, number]>; hipsY?: number } {
  const pose = poseRotations(spec.carry === undefined ? "stand" : "tray");
  const rotations: Record<string, [number, number, number]> = {};
  for (const [bone, rotation] of Object.entries(pose.rotations)) if (rotation !== undefined) rotations[bone] = rotation;
  return pose.hipsY === undefined ? { rotations } : { rotations, hipsY: pose.hipsY };
}

async function loadInto(page: Page, url: string, spec: PersonSpec): Promise<void> {
  const options = { url, text: signText(), pose: poseFor(spec) };
  await page.evaluate(async (o) => {
    const stage = (globalThis as unknown as { stage: { load: (x: unknown) => Promise<unknown> } }).stage;
    await stage.load(JSON.parse(JSON.stringify(o)));
  }, options);
}

async function show(page: Page, view: View): Promise<Camera> {
  const info = (await page.evaluate((v) => (globalThis as unknown as { stage: { show: (x: string) => unknown } }).stage.show(v), view)) as { camera: Camera };
  return info.camera;
}

type V3 = [number, number, number];
const v = (a: number[] | undefined): V3 => [a?.[0] ?? 0, a?.[1] ?? 0, a?.[2] ?? 0];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Where a world point lands in CSS pixels, for the stage's camera as it reported itself. */
function project(camera: Camera, viewport: { width: number; height: number }, p: V3): [number, number] {
  const target = v(camera.target);
  if (camera.kind === "orthographic") {
    return [viewport.width / 2 + ((p[0] - target[0]) / (camera.width ?? 1)) * viewport.width, viewport.height / 2 - ((p[1] - target[1]) / (camera.height ?? 1)) * viewport.height];
  }
  const eye = v(camera.position);
  const forward = unit(sub(target, eye));
  const right = unit(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const d = sub(p, eye);
  const z = dot(d, forward);
  const t = Math.tan((((camera.fov ?? 32) / 2) * Math.PI) / 180);
  const aspect = viewport.width / viewport.height;
  return [((dot(d, right) / (z * t * aspect) + 1) / 2) * viewport.width, ((1 - dot(d, up) / (z * t)) / 2) * viewport.height];
}

/** A frame four wide by five high round the head and shoulders, from the shoulders to above the hair. */
function headClip(camera: Camera, spec: PersonSpec): { x: number; y: number; width: number; height: number } {
  const top = (spec.height ?? 1) * 1.7;
  const centre: V3 = [0, top - 0.13, 0.04];
  const [cx, cy] = project(camera, LARGE, centre);
  const [, upY] = project(camera, LARGE, [0, top - 0.13 + 0.25, 0.04]);
  const half = Math.abs(cy - upY);
  const width = 1.6 * half;
  const x = Math.max(0, Math.min(LARGE.width - width, cx - width / 2));
  const y = Math.max(0, Math.min(LARGE.height - 2 * half, cy - half));
  return { x, y, width, height: 2 * half };
}

async function shootPerson(stage: Stage, spec: PersonSpec, style: FaceStyle, bytes: Uint8Array, dir: string): Promise<void> {
  const url = `/faces-explore/${style}/${spec.name}.glb`;
  const route = async (page: Page): Promise<void> => {
    await page.route(`**${url}`, (r) => r.fulfill({ status: 200, contentType: "model/gltf-binary", body: Buffer.from(bytes) }));
  };
  // At the shooter's size, then close on the head at device scale 3.
  for (const [scale, suffix] of [[1, ""], [3, "_face"]] as const) {
    const { context, page } = await stage.open({ ...LARGE, deviceScaleFactor: scale });
    await route(page);
    await loadInto(page, url, spec);
    for (const view of VIEWS) {
      const camera = await show(page, view);
      const path = join(dir, `${spec.name.slice(4)}_${view}${suffix}.png`);
      await page.screenshot(scale === 1 ? { path } : { path, clip: headClip(camera, spec) });
    }
    await context.close();
  }
  // As small as the world shows a person on a phone.
  for (const view of VIEWS) {
    const viewport = PHONE[view];
    const { context, page } = await stage.open({ ...viewport, deviceScaleFactor: PHONE.deviceScaleFactor });
    await route(page);
    await loadInto(page, url, spec);
    await show(page, view);
    const x = (viewport.width - PHONE.cellWidth) / 2;
    const y = (viewport.height - PHONE.front.height) / 2;
    await page.screenshot({ path: join(dir, `${spec.name.slice(4)}_${view}_phone.png`), clip: { x, y, width: PHONE.cellWidth, height: PHONE.front.height } });
    await context.close();
  }
}

const css = `
  :root { --ink: #1b1b1f; --soft: #6e6a63; --paper: #f2f2ee; --line: #c4b79a; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font: 13px/1.3 -apple-system, "Helvetica Neue", Arial, sans-serif; }
  h1 { font-size: 18px; margin: 0; }
  .sub { color: var(--soft); }
  img { display: block; width: 100%; image-rendering: auto; }
`;

function largeSheet(styles: readonly FaceStyle[], figures: Record<FaceStyle, Record<string, Figures>>): string {
  const head = PEOPLE.map((name) => `<div class="who" style="grid-column: span 2">${LABEL[name]}<span class="sub"> front, three-quarter</span></div>`).join("");
  const rows = styles.map((style) => {
    const tris = PEOPLE.map((name) => figures[style][name]?.triangles ?? 0);
    const cells = PEOPLE.flatMap((name) => VIEWS.map((view) => `<div class="cell"><img src="${style}/${name.slice(4)}_${view}_face.png"></div>`)).join("");
    return `<div class="label"><b>${STYLE_LABEL[style]}</b><span class="sub">${String(Math.min(...tris))} to ${String(Math.max(...tris))} triangles</span></div>${cells}`;
  }).join("");
  // With two styles or fewer there is room for the whole figures too, the middle of the shooter's views.
  const whole = styles.length > 2 ? "" : styles.map((style) => {
    const cells = PEOPLE.flatMap((name) => VIEWS.map((view) => `<div class="cell"><img class="whole" src="${style}/${name.slice(4)}_${view}.png"></div>`)).join("");
    return `<div class="label"><b>${STYLE_LABEL[style]}</b><span class="sub">the whole figure</span></div>${cells}`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>People faces</title><style>${css}
    body { width: 1600px; height: 1000px; padding: 14px 16px; }
    header { display: flex; align-items: baseline; gap: 14px; margin-bottom: 6px; }
    header h1 { flex: none; }
    .grid { display: grid; grid-template-columns: 104px repeat(8, 1fr); gap: 4px 6px; align-items: center; }
    .who { font-weight: 600; padding: 0 2px; }
    .label { display: flex; flex-direction: column; gap: 4px; padding-right: 6px; }
    .cell { border-radius: 6px; overflow: hidden; aspect-ratio: 4 / 5; }
    .whole { height: 100%; object-fit: cover; }
  </style></head><body>
    <header><h1>People faces</h1><span class="sub">The same four people from their data; only the face style changes. Head and shoulders, cut from the asset stage's front and three-quarter views. Palette only; every file inside 3,000 triangles, 3 draw calls, 150 KB.</span></header>
    <div class="grid"><div></div>${head}${rows}${whole}</div>
  </body></html>`;
}

function phoneSheet(styles: readonly FaceStyle[]): string {
  const block = (suffix: string): string => styles.map((style) => {
    const cells = PEOPLE.flatMap((name) => VIEWS.map((view) => `<div class="cell"><img src="${style}/${name.slice(4)}_${view}_${suffix}.png"></div>`)).join("");
    return `<div class="row"><div class="label">${STYLE_LABEL[style]}</div><div class="cells">${cells}</div></div>`;
  }).join("");
  const rows = block("phone");
  const heads = block("face");
  return `<!doctype html><html><head><meta charset="utf-8"><title>People faces, phone</title><style>${css}
    body { width: 390px; height: 844px; padding: 16px 0 0; }
    h1, .sub.top { padding: 0 16px; }
    h1 { font-size: 15px; }
    .sub.top { font-size: 11px; margin: 4px 0 10px; }
    .names { display: grid; grid-template-columns: repeat(4, 92px); gap: 0 2px; padding: 0 0 4px 6px; font-size: 11px; font-weight: 600; }
    .row { margin-bottom: 4px; }
    h2 { font-size: 13px; margin: 8px 16px 2px; }
    .heads .cell img { height: ${String(PHONE.cellWidth * 1.25)}px; object-fit: cover; }
    .label { font-size: 11px; font-weight: 600; padding: 0 16px 1px; }
    .cells { display: grid; grid-template-columns: repeat(8, ${String(PHONE.cellWidth)}px); gap: 0; padding: 0 6px; }
    .cell { width: ${String(PHONE.cellWidth)}px; }
  </style></head><body>
    <h1>People faces at phone size</h1>
    <div class="sub top">Each person about 60 px tall on a 390 px screen, rendered at that size at device scale 3. Front, then three-quarter.</div>
    <div class="names">${PEOPLE.map((n) => `<div>${LABEL[n]}</div>`).join("")}</div>
    ${rows}
    <h2>The head and shoulders at 60 px</h2>
    <div class="sub top">As a face would show in the layer, the same crops as the large sheet.</div>
    <div class="heads">${heads}</div>
  </body></html>`;
}

async function main(): Promise<void> {
  const outArg = process.argv[2];
  if (outArg === undefined) throw new Error("usage: tsx tools/assets/faces-explore.ts <out dir>");
  const out = resolve(outArg);
  const styles = process.argv[3] === undefined ? FACE_STYLES : process.argv[3].split(",").map((name) => faceStyleFrom(name));
  const figures = Object.fromEntries(FACE_STYLES.map((s) => [s, {}])) as Record<FaceStyle, Record<string, Figures>>;
  const stage = await openStage();
  try {
    for (const style of styles) {
      const dir = join(out, style);
      mkdirSync(dir, { recursive: true });
      for (const name of PEOPLE) {
        const spec = specOf(name);
        const { bytes, figures: f } = await exportPerson(spec, style, dir);
        figures[style][name] = f;
        const over = f.triangles > BUDGET.triangles || f.drawCalls > BUDGET.drawCalls || f.bytes > BUDGET.bytes;
        console.log(`${style} ${name}: ${String(f.triangles)} triangles, ${String(f.drawCalls)} draw calls, ${String(f.bytes)} bytes, ${f.height.toFixed(2)} m${over ? " OVER BUDGET" : ""}${f.palette.length > 0 ? ` PALETTE ${f.palette.slice(0, 3).join("; ")}` : ""}`);
        await shootPerson(stage, spec, style, bytes, dir);
      }
    }
    writeFileSync(join(out, "figures.json"), `${JSON.stringify(figures, null, 2)}\n`);
    writeFileSync(join(out, "sheet-large.html"), largeSheet(styles, figures));
    writeFileSync(join(out, "sheet-phone.html"), phoneSheet(styles));
    for (const [html, png, viewport, scale] of [
      ["sheet-large.html", "01-faces-large.png", { width: 1600, height: 1000 }, 1],
      ["sheet-phone.html", "02-faces-phone.png", { width: 390, height: 844 }, 3],
    ] as const) {
      const context = await stage.browser.newContext({ viewport, deviceScaleFactor: scale });
      const page = await context.newPage();
      await page.goto(`file://${join(out, html)}`);
      await page.waitForLoadState("load");
      await page.screenshot({ path: join(out, png) });
      await context.close();
    }
  } finally {
    await stage.close();
  }
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) await main();
