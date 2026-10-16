// Draws the page's photo (prologue.md R-PROLOGUE-015): the look standing, in the player's colours, framed from the
// chest up against nothing, once, on the one renderer every still is drawn on. Loaded only when a photo is drawn.
// The door's figure in the player's colours is drawn the same way, whole, as the shooter frames the published figure;
// and the door reads what a look is made of here, for "Make it yours", now that no turntable stands on the door.
import { text } from "@japacity/content";
import type { PoseName } from "@japacity/assets-src/people/poses";
import { Box3, Color, DirectionalLight, HemisphereLight, type Object3D, PerspectiveCamera, Scene, type SkinnedMesh, Vector3, WebGLRenderer } from "three";

import { paletteCss } from "@japacity/assets";
import { loadModel } from "../three/load";
import { loadManifest } from "../three/manifest";
import { figureOf, poseFigure } from "../three/people";
import { readLook, wear } from "../frontdoor/colours";
import type { LookStyle, OwnColours } from "../frontdoor/style";
import { PHOTO_MAX_CHARS, photoHeight } from "./photo.size";

/** How much of the figure the photo holds, from the top of the head down, in metres. */
const SPAN = 0.62;
const FOV = 18;
/** The qualities tried in turn until the photo fits what is kept with the person. */
const QUALITIES = [0.9, 0.8, 0.7] as const;

/**
 * The one renderer every still is drawn on, made on first use and kept for the visit, so the figure's shaders compile
 * once and not on every colour. One context
 * of the few a phone holds, and its buffer at the largest still's size, kept beside the world's own.
 */
let shared: { canvas: HTMLCanvasElement; renderer: WebGLRenderer } | null = null;

function drawer(): { canvas: HTMLCanvasElement; renderer: WebGLRenderer } {
  // A context the phone took back (a GPU reset) draws nothing: a new renderer takes its place.
  if (shared !== null && shared.renderer.getContext().isContextLost()) {
    shared.renderer.dispose();
    shared = null;
  }
  if (shared === null) {
    const canvas = document.createElement("canvas");
    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    shared = { canvas, renderer };
  }
  return shared;
}

/** Draws a figure under the stills' light on the one renderer, `width` by `height`, and leaves the picture on its canvas. */
function drawStill(root: Object3D, camera: PerspectiveCamera, width: number, height: number): HTMLCanvasElement {
  const scene = new Scene();
  scene.add(new HemisphereLight(new Color(paletteCss("sky")), new Color(paletteCss("concrete")), 1.3));
  const sun = new DirectionalLight(0xfff0d0, 2);
  sun.position.set(1.5, 3, 4);
  scene.add(sun, root);
  const { canvas, renderer } = drawer();
  renderer.setSize(width, height, false);
  renderer.render(scene, camera);
  // The figure is a copy made for this still: its skeleton's bones are let go with it, the model's own stay.
  root.traverse((object) => {
    const skinned = object as SkinnedMesh;
    if (skinned.isSkinnedMesh) skinned.skeleton.dispose();
  });
  scene.remove(root);
  return canvas;
}

/**
 * The figure, as made or in a style, drawn to a photo `width` pixels across (`photoWidth`), in the page's photo box's
 * shape, as an image's data address that fits `PHOTO_MAX_CHARS`; null when it cannot be drawn or never fits.
 */
export async function renderPhoto(file: string, style: LookStyle | undefined, width: number): Promise<string | null> {
  const height = photoHeight(width);
  const manifest = await loadManifest();
  const model = await loadModel(manifest, file, (key) => text[key]);
  const figure = figureOf(model, "stand", 0);
  poseFigure(figure, 0, "stand");
  wear(figure.root, style);
  figure.root.updateMatrixWorld(true);
  const top = new Box3().setFromObject(figure.root, true).max.y;
  const middle = top - SPAN / 2 + 0.02;
  const back = SPAN / 2 / Math.tan((FOV * Math.PI) / 360);
  const camera = new PerspectiveCamera(FOV, width / height, 0.1, 20);
  camera.position.set(0, middle, back);
  camera.lookAt(0, middle, 0);
  // The photo is kept with the person, so it stays an image's data address.
  const canvas = drawStill(figure.root, camera, width, height);
  for (const quality of QUALITIES) {
    const photo = canvas.toDataURL("image/webp", quality);
    if (!photo.startsWith("data:image/")) return null;
    if (photo.length <= PHOTO_MAX_CHARS) return photo;
  }
  return null;
}

/** The door's figure: the published figure's size and framing (tools/assets/shoot.ts FIGURE_SHOT, the stage's portrait). */
const FIGURE_PX = { width: 400, height: 800 } as const;
const FIGURE_FOV = 24;
const FIGURE_YAW = (25 * Math.PI) / 180;

/**
 * A figure drawn once as an object address for an image (`blob:`), or null when it cannot be. The picture is read from
 * the canvas at once and encoded off the main thread; the caller revokes the address once nothing shows it.
 */
async function still(root: Object3D, camera: PerspectiveCamera, width: number, height: number): Promise<string | null> {
  const canvas = drawStill(root, camera, width, height);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.85);
  });
  return blob === null ? null : URL.createObjectURL(blob);
}

/**
 * The door's whole figure in the player's colours (R-PROLOGUE-015): posed with a hand on the hip, or cheering, seen
 * from 25 degrees to its left as the shooter shoots the published figure, so the still stands where that picture stood.
 * An object address the caller revokes once nothing shows it.
 */
export async function renderFigure(file: string, style: LookStyle | undefined, view: "figure" | "cheer"): Promise<string | null> {
  const manifest = await loadManifest();
  const model = await loadModel(manifest, file, (key) => text[key]);
  const pose: PoseName = view === "cheer" ? "cheer" : "hip";
  const figure = figureOf(model, pose, 0);
  poseFigure(figure, 0, pose);
  wear(figure.root, style);
  figure.root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(figure.root, true);
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  const distance = (size.y * 1.1) / 2 / Math.tan((FIGURE_FOV * Math.PI) / 360);
  const camera = new PerspectiveCamera(FIGURE_FOV, FIGURE_PX.width / FIGURE_PX.height, 0.05, distance * 4);
  camera.position.set(centre.x + Math.sin(FIGURE_YAW) * distance, centre.y + size.y * 0.12, centre.z + Math.cos(FIGURE_YAW) * distance);
  camera.lookAt(centre);
  return still(figure.root, camera, FIGURE_PX.width, FIGURE_PX.height);
}

/** What a look is made of, read from its figure through the skeleton (R-PROLOGUE-015), for the rows of "Make it yours". */
export async function readOwn(file: string): Promise<OwnColours | null> {
  const manifest = await loadManifest();
  const model = await loadModel(manifest, file, (key) => text[key]);
  return readLook(figureOf(model, "stand", 0).root);
}
