// Fabric patterns drawn in code from a seed (R-ASSET-013), ported from the asset experiments.
// Drawn straight into pixels, with no canvas, so the export can run in Node and every pixel
// is exactly a palette colour: a shape covers a pixel when the pixel's centre is inside it,
// so there is no antialiasing and no blending. Shapes near an edge are drawn again across
// it, so every pattern tiles.
import { type PaletteName, paletteRgb } from "./palette";
import { seeded } from "./seeded";

export interface PatternSpec {
  kind: "ankara" | "adire" | "asoOke";
  seed: number;
  cols?: PaletteName[];
}

export interface PatternImage {
  width: number;
  height: number;
  /** Four bytes a pixel, rows top to bottom. */
  pixels: Uint8Array;
}

type Rgb = readonly [number, number, number];

interface Raster {
  size: number;
  pixels: Uint8Array;
}

function wrapIndex(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function set(r: Raster, x: number, y: number, colour: Rgb, wrap: boolean): void {
  let px = x;
  let py = y;
  if (wrap) {
    px = wrapIndex(px, r.size);
    py = wrapIndex(py, r.size);
  } else if (px < 0 || py < 0 || px >= r.size || py >= r.size) return;
  const i = (py * r.size + px) * 4;
  r.pixels[i] = colour[0];
  r.pixels[i + 1] = colour[1];
  r.pixels[i + 2] = colour[2];
  r.pixels[i + 3] = 255;
}

/** Fills every pixel whose centre passes `inside`, over a bounding box. */
function fill(r: Raster, x0: number, y0: number, x1: number, y1: number, colour: Rgb, wrap: boolean, inside: (x: number, y: number) => boolean): void {
  for (let py = Math.floor(y0); py <= Math.ceil(y1); py++) {
    for (let px = Math.floor(x0); px <= Math.ceil(x1); px++) {
      if (inside(px + 0.5, py + 0.5)) set(r, px, py, colour, wrap);
    }
  }
}

function ellipse(r: Raster, cx: number, cy: number, rx: number, ry: number, colour: Rgb, wrap = true): void {
  fill(r, cx - rx, cy - ry, cx + rx, cy + ry, colour, wrap, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
}

function disc(r: Raster, cx: number, cy: number, radius: number, colour: Rgb, wrap = true): void {
  ellipse(r, cx, cy, radius, radius, colour, wrap);
}

function rect(r: Raster, x: number, y: number, w: number, h: number, colour: Rgb, wrap = true): void {
  fill(r, x, y, x + w, y + h, colour, wrap, (px, py) => px >= x && px < x + w && py >= y && py < y + h);
}

/** A stroke of `width` along a segment, with round ends so joined pieces leave no gaps. */
function stroke(r: Raster, ax: number, ay: number, bx: number, by: number, width: number, colour: Rgb, wrap = true): void {
  const h = width / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy || 1;
  fill(r, Math.min(ax, bx) - h, Math.min(ay, by) - h, Math.max(ax, bx) + h, Math.max(ay, by) + h, colour, wrap, (x, y) => {
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSq));
    return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 <= h * h;
  });
}

function blank(size: number, colour: Rgb): Raster {
  const r: Raster = { size, pixels: new Uint8Array(size * size * 4) };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(r, x, y, colour, false);
  return r;
}

function colours(cols: readonly PaletteName[] | undefined, fallback: readonly PaletteName[]): Rgb[] {
  const names = cols !== undefined && cols.length >= fallback.length ? cols : fallback;
  return names.map((name) => paletteRgb(name));
}

/** Ankara-style wax print. cols: [background, a, b, c]. Four motif families chosen by the seed. */
function ankara(seed: number, cols: readonly PaletteName[] | undefined, S: number): Raster {
  const random = seeded(seed);
  const [bg = [0, 0, 0], c1 = bg, c2 = bg, c3 = bg] = colours(cols, ["indigo", "gold", "orange", "cream"]);
  const r = blank(S, bg);
  const motif = seed % 4;
  if (motif === 0) {
    // Targets on a half-drop grid, flowers between.
    for (const [x, y] of [[S / 4, S / 4], [(3 * S) / 4, (3 * S) / 4]] as const) {
      disc(r, x, y, S * 0.23, c1);
      disc(r, x, y, S * 0.17, bg);
      disc(r, x, y, S * 0.12, c2);
      disc(r, x, y, S * 0.05, c3);
    }
    for (const [x, y] of [[(3 * S) / 4, S / 4], [S / 4, (3 * S) / 4]] as const) {
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        disc(r, x + Math.cos(a) * S * 0.09, y + Math.sin(a) * S * 0.09, S * 0.045, c3);
      }
      disc(r, x, y, S * 0.05, c1);
    }
  } else if (motif === 1) {
    // Scales: overlapping rows of discs. Drawn row by row and clipped, as the design did: the rows repeat, so the edges meet.
    const n = 4;
    const step = S / n;
    for (let j = -1; j <= n; j++) {
      for (let i = -1; i <= n; i++) {
        const x = i * step + (j % 2 !== 0 ? step / 2 : 0);
        const y = j * step;
        disc(r, x, y, step * 0.62, bg, false);
        disc(r, x, y, step * 0.55, (i + j) % 2 !== 0 ? c1 : c2, false);
        disc(r, x, y, step * 0.36, bg, false);
        disc(r, x, y, step * 0.2, c3, false);
      }
    }
  } else if (motif === 2) {
    // A diamond lattice with a sunburst in each diamond.
    for (let k = -2; k <= 4; k++) {
      stroke(r, (k * S) / 2, 0, (k * S) / 2 + S, S, S * 0.06, c1);
      stroke(r, (k * S) / 2, 0, (k * S) / 2 - S, S, S * 0.06, c1);
    }
    const centres = [[S / 4, S / 4], [(3 * S) / 4, S / 4], [S / 4, (3 * S) / 4], [(3 * S) / 4, (3 * S) / 4], [0, S / 2], [S / 2, 0], [S / 2, S / 2], [0, 0]] as const;
    for (const [x, y] of centres) {
      const big = (Math.round(x / (S / 4)) + Math.round(y / (S / 4))) % 2 === 0;
      if (big) {
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          stroke(r, x + Math.cos(a) * S * 0.05, y + Math.sin(a) * S * 0.05, x + Math.cos(a) * S * 0.1, y + Math.sin(a) * S * 0.1, S * 0.025, c3);
        }
        disc(r, x, y, S * 0.045, c2);
      } else disc(r, x, y, S * 0.03, c2);
    }
  } else {
    // Waves with eyes. A wave repeats across the width, so it is drawn clipped from just outside each edge.
    for (let b = 0; b < 4; b++) {
      const y0 = (b * S) / 4 + S / 8;
      const at = (x: number): number => y0 + Math.sin((x / S) * Math.PI * 4 + b) * S * 0.035;
      for (let x = -8; x < S + 8; x += 2) stroke(r, x, at(x), x + 2, at(x + 2), S * 0.055, b % 2 !== 0 ? c1 : c2, false);
    }
    for (let i = 0; i < 4; i++) {
      const x = ((i + 0.5) * S) / 4 + (random() - 0.5) * 6;
      const y = (i % 2 !== 0 ? 0.25 : 0.75) * S;
      ellipse(r, x, y, S * 0.05 * 1.5, S * 0.05, c3);
      ellipse(r, x, y, S * 0.025 * 1.5, S * 0.025, bg);
    }
  }
  return r;
}

/** Adire-style resist dye: indigo ground, pale dotted rings and lines inside a grid of squares. */
function adire(seed: number, S: number): Raster {
  const random = seeded(seed);
  const pale = paletteRgb("cream");
  const mid = paletteRgb("blue");
  const r = blank(S, paletteRgb("indigo"));
  // Dye that took unevenly. The design blended faint blots; here a blot is a sparse speckle of solid palette
  // pixels, so the look is kept and every pixel stays a palette colour.
  for (let i = 0; i < 26; i++) {
    const x = random() * S;
    const y = random() * S;
    const radius = 6 + random() * 16;
    const colour = random() < 0.5 ? mid : paletteRgb("black");
    // The design drew each blot nine times and drew a colour each time; the extra draws keep the seed's later numbers.
    for (let k = 0; k < 8; k++) random();
    fill(r, x - radius, y - radius, x + radius, y + radius, colour, true, (px, py) => {
      const cx = Math.floor(px);
      const cy = Math.floor(py);
      return (px - x) ** 2 + (py - y) ** 2 <= radius * radius && wrapIndex(cx * 3 + cy * 5, 6) === 0;
    });
  }
  const n = 2;
  const cell = S / n;
  for (let i = 0; i <= n; i++) {
    for (let k = 0; k < S; k += 6) {
      rect(r, i * cell - 1.5, k, 3, 3, mid);
      rect(r, k, i * cell - 1.5, 3, 3, mid);
    }
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const kind = (i + j + seed) % 2;
      const ox = (i + 0.5) * cell;
      const oy = (j + 0.5) * cell;
      if (kind === 0) {
        for (const radius of [cell * 0.36, cell * 0.22, cell * 0.08]) {
          const dots = Math.max(6, Math.round(radius * 1.1));
          for (let d = 0; d < dots; d++) {
            const a = (d / dots) * Math.PI * 2;
            const q = 2 + random() * 2.2;
            const jx = (random() - 0.5) * 1.6;
            const jy = (random() - 0.5) * 1.6;
            rect(r, ox + Math.cos(a) * radius - q / 2 + jx, oy + Math.sin(a) * radius - q / 2 + jy, q, q, pale);
          }
        }
      } else {
        for (let k = -3; k <= 3; k++) {
          rect(r, ox + k * cell * 0.11 - 1.5, oy + k * cell * 0.11 - 1.5, 3, 3, pale);
          rect(r, ox + k * cell * 0.11 - 1.5, oy - k * cell * 0.11 - 1.5, 3, 3, pale);
        }
        for (let d = 0; d < 4; d++) {
          const a = (d * Math.PI) / 2 + random() * 0.01;
          rect(r, ox + Math.cos(a) * cell * 0.36 - 2, oy + Math.sin(a) * cell * 0.36 - 2, 4, 4, pale);
        }
      }
    }
  }
  return r;
}

/** Aso oke-style strip weave: vertical stripes of seeded widths. cols: [ground, a, b]. */
function asoOke(seed: number, cols: readonly PaletteName[] | undefined, S: number): Raster {
  const random = seeded(seed);
  const [bg = [0, 0, 0], c1 = bg, c2 = bg] = colours(cols, ["wine", "gold", "cream"]);
  const r = blank(S, bg);
  let x = 0;
  while (x < S) {
    const gap = 4 + Math.floor(random() * 7);
    const w = 1 + Math.floor(random() * 4);
    x += gap;
    if (x + w > S - 2) break;
    rect(r, x, 0, w, S, random() < 0.6 ? c1 : c2, false);
    x += w;
  }
  return r;
}

/** The design's sizes: 128 pixels for ankara and adire, 64 for aso oke. Never more than 256 (the tex_ budget). */
export function defaultPatternSize(kind: PatternSpec["kind"]): number {
  return kind === "asoOke" ? 64 : 128;
}

export function drawPattern(spec: PatternSpec, size: number = defaultPatternSize(spec.kind)): PatternImage {
  if (size > 256 || size < 8) throw new Error(`drawPattern: ${String(size)} px is outside 8 to 256`);
  let r: Raster;
  switch (spec.kind) {
    case "ankara":
      r = ankara(spec.seed, spec.cols, size);
      break;
    case "adire":
      r = adire(spec.seed, size);
      break;
    case "asoOke":
      r = asoOke(spec.seed, spec.cols, size);
      break;
    default: {
      const never: never = spec.kind;
      throw new Error(`drawPattern: ${String(never)}`);
    }
  }
  return { width: size, height: size, pixels: r.pixels };
}
