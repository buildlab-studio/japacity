// A device that can draw, for the screens that show the world only where it can
// (City.tsx canDraw). The world's scene itself is each test's own stand-in.
import { vi } from "vitest";

/** WebGL2 is there and every canvas hands back an empty context. */
export function stubWebGL(): void {
  Object.defineProperty(window, "WebGL2RenderingContext", { value: class {}, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({}) as never);
}

/** Takes WebGL2 away again. The canvas's spy goes with vi.restoreAllMocks. */
export function unstubWebGL(): void {
  Reflect.deleteProperty(window, "WebGL2RenderingContext");
}
