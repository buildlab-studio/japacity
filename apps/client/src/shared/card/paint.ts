// Draws a card's steps on a canvas. Nothing here decides what goes where: the
// layout did that, and its tests cover it.
import { paletteCss } from "../../../../../packages/assets/src/palette";
import type { Family, Measure, SealStep, Step } from "./layout";

const FAMILIES: Record<Family, string> = {
  display: '"Danfo", system-ui, sans-serif',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif',
};

function fontOf(size: number, family: Family, weight: number): string {
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

/** The seal's colours, from public/brand's small drawing: light is the navy disc, dark the yellow one. */
const SEAL = {
  light: { disc: "#1c2a5e", line: "#eaf3fb", warm: "#f2b705", cool: "#cfe9ff", coolEdge: null },
  dark: { disc: "#f2b705", line: "#1c2a5e", warm: "#1c2a5e", cool: "#ffffff", coolEdge: "#1c2a5e" },
} as const;

/** The seal in the small drawing's plain shapes, on its 512 grid: the disc, one ring, the wire, the two bulbs, the J. */
function seal(context: CanvasRenderingContext2D, step: SealStep): void {
  const colour = SEAL[step.ground];
  context.save();
  context.translate(step.x, step.y);
  context.scale(step.size / 512, step.size / 512);
  context.fillStyle = colour.disc;
  context.beginPath();
  context.arc(256, 256, 256, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = colour.line;
  context.lineWidth = 24;
  context.beginPath();
  context.arc(256, 256, 238, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = 22;
  context.lineCap = "round";
  context.beginPath();
  context.arc(256, 256, 182, Math.atan2(170.6 - 256, 95.3 - 256), Math.atan2(170.6 - 256, 416.7 - 256), false);
  context.stroke();
  for (const [x, fill] of [[182, colour.warm], [330, colour.cool]] as const) {
    context.fillStyle = fill;
    context.beginPath();
    context.arc(x, 127.8, 35, 0, Math.PI * 2);
    context.fill();
    if (colour.coolEdge !== null && x === 330) {
      context.strokeStyle = colour.coolEdge;
      context.lineWidth = 10;
      context.stroke();
    }
  }
  // The J: the stem and the hook, a stroke 42 wide, set as the file sets it.
  context.translate(256, 256);
  context.scale(0.78, 0.78);
  context.translate(18, 2);
  context.strokeStyle = colour.line;
  context.lineWidth = 42.1;
  context.lineCap = "butt";
  context.lineJoin = "miter";
  context.beginPath();
  context.moveTo(-40, -78);
  context.lineTo(34, -78);
  context.lineTo(34, 22);
  context.arc(-18, 22, 52, 0, Math.PI, false);
  context.stroke();
  context.restore();
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
      case "mark":
        context.save();
        context.globalAlpha = step.alpha / 100;
        if (step.band !== null) {
          const [first, ...rest] = step.band.points;
          if (first !== undefined) {
            context.fillStyle = paletteCss(step.band.color);
            context.beginPath();
            context.moveTo(first[0], first[1]);
            for (const [x, y] of rest) context.lineTo(x, y);
            context.closePath();
            context.fill();
          }
        }
        context.translate(step.x, step.y);
        context.rotate((step.angle * Math.PI) / 180);
        context.fillStyle = paletteCss(step.color);
        context.font = fontOf(step.size, "sans", 700);
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(step.text, 0, 0);
        context.restore();
        break;
      case "seal":
        seal(context, step);
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
