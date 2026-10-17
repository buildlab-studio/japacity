// The outline score of R-ASSET-023, as pure functions over masks, so it is tested without a browser.
// A mask is one byte a pixel, 1 inside, rows top to bottom.

export interface Mask {
  width: number;
  height: number;
  data: Uint8Array;
}

/** The numbers on assets.md's page (Numbers), held in assets-src/review.config.json. */
export interface OutlineSettings {
  outlineMin: number;
  dimTolerancePct: number;
  outlineFramePx: number;
  outlineMarginPct: number;
  outlineShiftPct: number;
  thinFillPct: number;
  thinGrowPct: number;
}

export interface Frame {
  width: number;
  height: number;
  pxPerMetre: number;
}

/**
 * The frame both outlines are drawn in, at one scale: the longer side is `outlineFramePx`, and a
 * margin of `outlineMarginPct` of it is left on every side.
 */
export function frameFor(extents: readonly (readonly [number, number])[], settings: OutlineSettings): Frame {
  const w = Math.max(...extents.map(([x]) => x));
  const h = Math.max(...extents.map(([, y]) => y));
  const margin = (settings.outlineFramePx * settings.outlineMarginPct) / 100;
  const pxPerMetre = (settings.outlineFramePx - 2 * margin) / Math.max(w, h);
  return { width: Math.round(w * pxPerMetre + 2 * margin), height: Math.round(h * pxPerMetre + 2 * margin), pxPerMetre };
}

export function polygonBounds(polygon: readonly (readonly [number, number])[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export function polygonArea(polygon: readonly (readonly [number, number])[]): number {
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x0, y0] = polygon[i] ?? [0, 0];
    const [x1, y1] = polygon[(i + 1) % polygon.length] ?? [0, 0];
    area += x0 * y1 - x1 * y0;
  }
  return Math.abs(area) / 2;
}

/** Draws a polygon in metres (y up) into a mask at the frame's scale, centred on its bounding box. Even-odd fill at pixel centres. */
export function rasterise(polygon: readonly (readonly [number, number])[], frame: Frame): Mask {
  const { width, height, pxPerMetre } = frame;
  const b = polygonBounds(polygon);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const px = polygon.map(([x, y]) => [width / 2 + (x - cx) * pxPerMetre, height / 2 - (y - cy) * pxPerMetre] as const);
  const data = new Uint8Array(width * height);
  for (let row = 0; row < height; row++) {
    const y = row + 0.5;
    const crossings: number[] = [];
    for (let i = 0; i < px.length; i++) {
      const [x0, y0] = px[i] ?? [0, 0];
      const [x1, y1] = px[(i + 1) % px.length] ?? [0, 0];
      if (y0 <= y !== y1 <= y) crossings.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
    }
    crossings.sort((a, b2) => a - b2);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = Math.max(0, Math.ceil((crossings[k] ?? 0) - 0.5));
      const to = Math.min(width - 1, Math.floor((crossings[k + 1] ?? 0) - 0.5));
      for (let col = from; col <= to; col++) data[row * width + col] = 1;
    }
  }
  return { width, height, data };
}

export function maskBounds(mask: Mask): { minX: number; minY: number; maxX: number; maxY: number; count: number } {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[y * mask.width + x] !== 1) continue;
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY, count };
}

/** Moves a mask by whole pixels; what leaves the frame is lost. */
export function shift(mask: Mask, dx: number, dy: number): Mask {
  const data = new Uint8Array(mask.width * mask.height);
  for (let y = 0; y < mask.height; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= mask.height) continue;
    for (let x = 0; x < mask.width; x++) {
      const sx = x - dx;
      if (sx >= 0 && sx < mask.width) data[y * mask.width + x] = mask.data[sy * mask.width + sx] ?? 0;
    }
  }
  return { width: mask.width, height: mask.height, data };
}

/** Centres a mask on its bounding box. */
export function centre(mask: Mask): Mask {
  const b = maskBounds(mask);
  if (b.count === 0) return mask;
  const dx = Math.round(mask.width / 2 - (b.minX + b.maxX + 1) / 2);
  const dy = Math.round(mask.height / 2 - (b.minY + b.maxY + 1) / 2);
  return shift(mask, dx, dy);
}

/** Grows a mask by a disc of radius r pixels. */
function grow(mask: Mask, r: number): Mask {
  const data = new Uint8Array(mask.width * mask.height);
  const offsets: [number, number][] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) offsets.push([dx, dy]);
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[y * mask.width + x] !== 1) continue;
      for (const [dx, dy] of offsets) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < mask.width && yy >= 0 && yy < mask.height) data[yy * mask.width + xx] = 1;
      }
    }
  }
  return { width: mask.width, height: mask.height, data };
}

/** Overlap over union of two masks of one size. */
function iou(a: Mask, b: Mask): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.data.length; i++) {
    const x = a.data[i] === 1;
    const y = b.data[i] === 1;
    if (x && y) inter += 1;
    if (x || y) union += 1;
  }
  return union === 0 ? 0 : inter / union;
}

export interface ViewScore {
  score: number;
  overlap: number;
  shift: [number, number];
  thin: boolean;
  grownPx: number;
  model: { width: number; height: number };
  reference: { width: number; height: number };
  widthOffPct: number;
  heightOffPct: number;
  passes: boolean;
}

/**
 * Scores a model's mask against a reference polygon (R-ASSET-023): both centred on their bounding
 * boxes, both grown by `thinGrowPct` of the frame when the reference fills less than `thinFillPct`
 * of its box, the model moved by up to `outlineShiftPct` of the frame to the best overlap, no
 * rotation and no scaling; the score is 100 times overlap over union, rounded down. It passes
 * when the score is at least `outlineMin` and the model's width and height are each within
 * `dimTolerancePct` of the reference's.
 */
export function scoreView(model: Mask, polygon: readonly (readonly [number, number])[], frame: Frame, settings: OutlineSettings, modelSize: { width: number; height: number }): ViewScore {
  const reference = centre(rasterise(polygon, frame));
  let fitted = centre(model);
  let target = reference;
  const b = polygonBounds(polygon);
  const refW = b.maxX - b.minX;
  const refH = b.maxY - b.minY;
  const thin = (polygonArea(polygon) / (refW * refH)) * 100 < settings.thinFillPct;
  const longer = Math.max(frame.width, frame.height);
  const grownPx = thin ? Math.round((longer * settings.thinGrowPct) / 100) : 0;
  if (thin) {
    fitted = grow(fitted, grownPx);
    target = grow(target, grownPx);
  }
  const reach = Math.floor((longer * settings.outlineShiftPct) / 100);
  let best = -1;
  let at: [number, number] = [0, 0];
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const overlap = iou(shift(fitted, dx, dy), target);
      if (overlap > best) {
        best = overlap;
        at = [dx, dy];
      }
    }
  }
  const score = Math.floor(best * 100 + 1e-9);
  const widthOffPct = (Math.abs(modelSize.width - refW) / refW) * 100;
  const heightOffPct = (Math.abs(modelSize.height - refH) / refH) * 100;
  return {
    score,
    overlap: best,
    shift: at,
    thin,
    grownPx,
    model: modelSize,
    reference: { width: refW, height: refH },
    widthOffPct,
    heightOffPct,
    passes: score >= settings.outlineMin && widthOffPct <= settings.dimTolerancePct && heightOffPct <= settings.dimTolerancePct,
  };
}

/** The mean distance in metres from each boundary pixel of one mask to the nearest boundary pixel of the other, both ways. */
export function contourDistance(a: Mask, b: Mask, pxPerMetre: number): number {
  const edge = (m: Mask): [number, number][] => {
    const out: [number, number][] = [];
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        if (m.data[y * m.width + x] !== 1) continue;
        const outside = (xx: number, yy: number): boolean => xx < 0 || yy < 0 || xx >= m.width || yy >= m.height || m.data[yy * m.width + xx] !== 1;
        if (outside(x - 1, y) || outside(x + 1, y) || outside(x, y - 1) || outside(x, y + 1)) out.push([x, y]);
      }
    }
    return out;
  };
  const ea = edge(a);
  const eb = edge(b);
  if (ea.length === 0 || eb.length === 0) return Infinity;
  const mean = (from: [number, number][], to: [number, number][]): number => {
    let total = 0;
    const step = Math.max(1, Math.floor(from.length / 600));
    let n = 0;
    for (let i = 0; i < from.length; i += step) {
      const [x, y] = from[i] ?? [0, 0];
      let near = Infinity;
      for (const [u, v] of to) near = Math.min(near, (u - x) ** 2 + (v - y) ** 2);
      total += Math.sqrt(near);
      n += 1;
    }
    return total / n;
  };
  return (mean(ea, eb) + mean(eb, ea)) / 2 / pxPerMetre;
}
