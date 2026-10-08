// Draws a card's steps on a canvas. Nothing here decides what goes where: the
// layout did that, and its tests cover it.
import { paletteCss } from "../../../../../packages/assets/src/palette";
import type { Family, Measure, Step } from "./layout";

const FAMILIES: Record<Family, string> = {
  display: '"Danfo", system-ui, sans-serif',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif',
};

export function fontOf(size: number, family: Family, weight: number): string {
  return `${String(weight)} ${String(size)}px ${FAMILIES[family]}`;
}

export function measureWith(context: CanvasRenderingContext2D): Measure {
  return (text, size, family, weight) => {
    context.font = fontOf(size, family, weight);
    return context.measureText(text).width;
  };
}

/** Waits for the display face, so the first card drawn is not in the fallback. */
export async function fontsReady(sizes: readonly number[]): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts === undefined) return;
  try {
    await Promise.all(sizes.map((size) => fonts.load(fontOf(size, "display", 400))));
  } catch {
    // A face that will not load leaves the fallback, which still reads.
  }
}

export function paint(context: CanvasRenderingContext2D, steps: readonly Step[]): void {
  for (const step of steps) {
    switch (step.op) {
      case "rect":
        context.fillStyle = paletteCss(step.color);
        context.fillRect(step.x, step.y, step.w, step.h);
        break;
      case "poly": {
        const [first, ...rest] = step.points;
        if (first === undefined) break;
        context.fillStyle = paletteCss(step.color);
        context.beginPath();
        context.moveTo(first[0], first[1]);
        for (const [x, y] of rest) context.lineTo(x, y);
        context.closePath();
        context.fill();
        break;
      }
      case "circle":
        context.fillStyle = paletteCss(step.color);
        context.beginPath();
        context.arc(step.x, step.y, step.r, 0, Math.PI * 2);
        context.fill();
        break;
      case "line":
        context.strokeStyle = paletteCss(step.color);
        context.lineWidth = step.width;
        context.beginPath();
        context.moveTo(step.x1, step.y1);
        context.lineTo(step.x2, step.y2);
        context.stroke();
        break;
      case "text":
        context.fillStyle = paletteCss(step.color);
        context.font = fontOf(step.size, step.family, step.weight);
        context.textAlign = step.align;
        context.textBaseline = "alphabetic";
        context.fillText(step.text, step.x, step.y);
        break;
      case "clip":
        context.save();
        context.beginPath();
        context.roundRect(step.box.x, step.box.y, step.box.w, step.box.h, step.radius);
        context.clip();
        break;
      case "unclip":
        context.restore();
        break;
      default: {
        const never: never = step;
        throw new Error(`Unknown drawing step: ${JSON.stringify(never)}`);
      }
    }
  }
}
