// Draws the page's photo (prologue.md R-PROLOGUE-015): the look standing, in the player's colours, framed from the
// chest up against nothing, once, on a renderer of its own that is let go at once. Loaded only when a photo is drawn.
import { text } from "@japacity/content";
import { Box3, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, WebGLRenderer } from "three";

import { colourOf } from "../../features/city/world";
import { loadModel } from "../three/load";
import { loadManifest } from "../three/manifest";
import { figureOf, poseFigure } from "../three/people";
import { wear } from "../frontdoor/colours";
import type { LookStyle } from "../frontdoor/style";
import { PHOTO_MAX_CHARS, photoHeight } from "./photo.size";

/** How much of the figure the photo holds, from the top of the head down, in metres. */
const SPAN = 0.62;
const FOV = 18;
/** The qualities tried in turn until the photo fits what is kept with the person. */
const QUALITIES = [0.9, 0.8, 0.7] as const;

/**
 * The figure drawn to a photo `width` pixels across (`photoWidth`), in the page's photo box's shape, as an image's
 * data address that fits `PHOTO_MAX_CHARS`; null when it cannot be drawn or never fits.
 */
export async function renderPhoto(file: string, style: LookStyle, width: number): Promise<string | null> {
  const height = photoHeight(width);
  const manifest = await loadManifest();
  const model = await loadModel(manifest, file, (key) => text[key]);
  const figure = figureOf(model, "stand", 0);
  poseFigure(figure, 0, "stand");
  wear(figure.root, style);
  const scene = new Scene();
  scene.add(new HemisphereLight(colourOf("sky"), colourOf("concrete"), 1.3));
  const sun = new DirectionalLight(0xfff0d0, 2);
  sun.position.set(1.5, 3, 4);
  scene.add(sun, figure.root);
  figure.root.updateMatrixWorld(true);
  const top = new Box3().setFromObject(figure.root, true).max.y;
  const middle = top - SPAN / 2 + 0.02;
  const back = SPAN / 2 / Math.tan((FOV * Math.PI) / 360);
  const camera = new PerspectiveCamera(FOV, width / height, 0.1, 20);
  camera.position.set(0, middle, back);
  camera.lookAt(0, middle, 0);
  const canvas = document.createElement("canvas");
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);
    for (const quality of QUALITIES) {
      const photo = canvas.toDataURL("image/webp", quality);
      if (!photo.startsWith("data:image/")) return null;
      if (photo.length <= PHOTO_MAX_CHARS) return photo;
    }
    return null;
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
