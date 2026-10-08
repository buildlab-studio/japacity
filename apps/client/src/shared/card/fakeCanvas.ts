// A canvas for tests: jsdom draws nothing, so this records what would be drawn
// and hands back a file of a size the test chooses.
import { vi } from "vitest";

import { QUALITIES } from "./encode";

const QUALITY_FIRST = QUALITIES[0] / 100;

export interface Drawn {
  texts: { text: string; font: string }[];
  qualities: number[];
  sizes: { width: number; height: number }[];
}

/** The pixel size in a CSS font string such as `700 44px system-ui`. */
function pixels(font: string): number {
  return Number(/(\d+)px/.exec(font)?.[1] ?? "10");
}

/**
 * Stands in for the canvas until the test ends. `bytesAt` gives the file size
 * the encoder returns for a JPEG quality in hundredths.
 */
export function fakeCanvas(bytesAt: (quality: number) => number): Drawn {
  const drawn: Drawn = { texts: [], qualities: [], sizes: [] };
  let font = "10px sans-serif";
  const context: object = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "measureText") return (text: string) => ({ width: Math.round(text.length * pixels(font) * 0.55) });
        if (property === "fillText") return (text: string) => drawn.texts.push({ text, font });
        if (property === "font") return font;
        return () => undefined;
      },
      set(_target, property, value) {
        if (property === "font") font = String(value);
        return true;
      },
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, callback: BlobCallback, _type?: string, quality?: number) {
    if (drawn.qualities.length === 0 || quality === QUALITY_FIRST) drawn.sizes.push({ width: this.width, height: this.height });
    const hundredths = Math.round((quality ?? 1) * 100);
    drawn.qualities.push(hundredths);
    callback(new Blob([new Uint8Array(bytesAt(hundredths))], { type: "image/jpeg" }));
  });
  return drawn;
}
