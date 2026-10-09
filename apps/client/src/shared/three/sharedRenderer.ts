// One renderer and canvas for each use that draws outside the main scene (the map, the ride), kept
// across mounts: a browser allows only a handful of WebGL contexts, and a new one for every ride
// soon costs the oldest, which may be the place itself. The caller mounts the canvas into its box
// and takes it out again on unmount; nothing is disposed, so a remount (which React does twice in
// development) finds the context whole.
import { WebGLRenderer } from "three";

const held = new Map<string, { canvas: HTMLCanvasElement; renderer: WebGLRenderer }>();

export function sharedRenderer(key: string): { canvas: HTMLCanvasElement; renderer: WebGLRenderer } {
  const found = held.get(key);
  if (found !== undefined) return found;
  const canvas = document.createElement("canvas");
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const made = { canvas, renderer };
  held.set(key, made);
  return made;
}

/** Puts the shared canvas into a box with the classes given, and gives back the way to take it out. */
export function mountCanvas(key: string, box: HTMLElement, className: string, mark?: string): { canvas: HTMLCanvasElement; renderer: WebGLRenderer; unmount: () => void } {
  const { canvas, renderer } = sharedRenderer(key);
  canvas.className = className;
  canvas.setAttribute("aria-hidden", "true");
  if (mark !== undefined) canvas.setAttribute(mark, "true");
  box.append(canvas);
  return { canvas, renderer, unmount: () => canvas.remove() };
}
