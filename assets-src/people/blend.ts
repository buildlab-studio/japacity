// Soft organic shapes for people (R-ASSET-005, design 07 section 5 rule 3): simple shapes blended
// into one surface by a smooth minimum of their distances, turned into triangles on a grid, then
// thinned (thin.ts) and shown smooth. Build time only: the phone receives the finished triangles.
export type Vec = [number, number, number];
export type Tri = [number, number, number];

export type Shape =
  | { kind: "ball"; c: Vec; r: number }
  /** An ellipsoid with radii along its own axes (x, y, z unless `axes` are given, each of unit length). */
  | { kind: "ellipsoid"; c: Vec; r: Vec; axes?: [Vec, Vec, Vec] }
  /** A rod from a to b whose radius runs from ra to rb. */
  | { kind: "capsule"; a: Vec; b: Vec; ra: number; rb: number }
  /** Everything on the side of the plane through p that n points away from. */
  | { kind: "half"; p: Vec; n: Vec }
  /** A blend of its own, with its own cuts, melted into the rest as one shape. */
  | { kind: "blend"; blend: Blend };

export interface Blend {
  shapes: Shape[];
  /** How far, in metres, neighbouring shapes melt into each other. */
  k: number;
  /** Shapes carved out of the union, melted by `cutK`. */
  cut?: Shape[];
  cutK?: number;
}

export interface Surface {
  positions: Vec[];
  triangles: Tri[];
}

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec): number => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function smoothMin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}

/** Signed distance to one shape, negative inside; exact for balls and planes, close for the others. */
export function distance(shape: Shape, p: Vec): number {
  switch (shape.kind) {
    case "ball":
      return len(sub(p, shape.c)) - shape.r;
    case "ellipsoid": {
      const d = sub(p, shape.c);
      const q: Vec = shape.axes === undefined ? d : [dot(d, shape.axes[0]), dot(d, shape.axes[1]), dot(d, shape.axes[2])];
      const [rx, ry, rz] = shape.r;
      const [ax, ay, az] = [q[0] / rx, q[1] / ry, q[2] / rz];
      const [bx, by, bz] = [ax / rx, ay / ry, az / rz];
      const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
      const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
      return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
    }
    case "capsule": {
      const ab = sub(shape.b, shape.a);
      const ap = sub(p, shape.a);
      const l2 = dot(ab, ab);
      const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, dot(ap, ab) / l2));
      const r = shape.ra + (shape.rb - shape.ra) * t;
      return len(sub(ap, [ab[0] * t, ab[1] * t, ab[2] * t])) - r;
    }
    case "half":
      return dot(sub(p, shape.p), shape.n) / len(shape.n);
    case "blend":
      return field(shape.blend, p);
    default: {
      const never: never = shape;
      throw new Error(`blend: ${String(never)}`);
    }
  }
}

export function field(blend: Blend, p: Vec): number {
  let d = Infinity;
  for (const shape of blend.shapes) d = smoothMin(d, distance(shape, p), blend.k);
  for (const shape of blend.cut ?? []) d = -smoothMin(-d, distance(shape, p), blend.cutK ?? blend.k);
  return d;
}

function bounds(shapes: readonly Shape[], margin: number): { min: Vec; max: Vec } {
  const min: Vec = [Infinity, Infinity, Infinity];
  const max: Vec = [-Infinity, -Infinity, -Infinity];
  const grow = (c: Vec, r: number): void => {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis] ?? 0, (c[axis] ?? 0) - r - margin);
      max[axis] = Math.max(max[axis] ?? 0, (c[axis] ?? 0) + r + margin);
    }
  };
  for (const shape of shapes) {
    if (shape.kind === "ball") grow(shape.c, shape.r);
    else if (shape.kind === "ellipsoid") grow(shape.c, Math.max(...shape.r));
    else if (shape.kind === "capsule") {
      grow(shape.a, shape.ra);
      grow(shape.b, shape.rb);
    } else if (shape.kind === "blend") {
      const inner = bounds(shape.blend.shapes, shape.blend.k);
      grow(inner.min, 0);
      grow(inner.max, 0);
    } else throw new Error("blend: a half space has no bounds, so it can only cut");
  }
  return { min, max };
}

function gradient(blend: Blend, p: Vec, e: number): Vec {
  return [
    field(blend, [p[0] + e, p[1], p[2]]) - field(blend, [p[0] - e, p[1], p[2]]),
    field(blend, [p[0], p[1] + e, p[2]]) - field(blend, [p[0], p[1] - e, p[2]]),
    field(blend, [p[0], p[1], p[2] + e]) - field(blend, [p[0], p[1], p[2] - e]),
  ].map((g) => g / (2 * e)) as Vec;
}

/**
 * The blend's surface as triangles, one vertex a grid cell the surface crosses (surface nets), each
 * vertex within a cell of the surface. `cell` is the grid's spacing in metres.
 */
export function surface(blend: Blend, cell: number): Surface {
  const { min, max } = bounds(blend.shapes, blend.k + 2 * cell);
  const n = [0, 1, 2].map((axis) => Math.ceil(((max[axis] ?? 0) - (min[axis] ?? 0)) / cell)) as Vec;
  const [nx, ny, nz] = n;
  const sx = nx + 1;
  const sy = ny + 1;
  const at = (i: number, j: number, k: number): number => i + sx * (j + sy * k);
  const point = (i: number, j: number, k: number): Vec => [min[0] + i * cell, min[1] + j * cell, min[2] + k * cell];
  // A coarse grid first: a coarse cell whose corners are all far from the surface, on one side, holds
  // no surface (the field changes no faster than the distance), so its fine points take the coarse
  // sign and only the band near the surface is sampled finely.
  const step = 4;
  const cx = Math.ceil(nx / step);
  const cy = Math.ceil(ny / step);
  const cz = Math.ceil(nz / step);
  const coarse = new Float64Array((cx + 1) * (cy + 1) * (cz + 1));
  const cat = (i: number, j: number, k: number): number => i + (cx + 1) * (j + (cy + 1) * k);
  for (let k = 0; k <= cz; k++) for (let j = 0; j <= cy; j++) for (let i = 0; i <= cx; i++) coarse[cat(i, j, k)] = field(blend, point(i * step, j * step, k * step));
  const far = step * cell * 1.8;
  const values = new Float64Array(sx * sy * (nz + 1));
  for (let k = 0; k <= nz; k++) {
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const [ci, cj, ck] = [Math.min(cx - 1, Math.floor(i / step)), Math.min(cy - 1, Math.floor(j / step)), Math.min(cz - 1, Math.floor(k / step))];
        let lo = Infinity;
        let hi = -Infinity;
        for (const [a, b2, c] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] as const) {
          const v = coarse[cat(ci + a, cj + b2, ck + c)] ?? 0;
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
        values[at(i, j, k)] = lo > far ? lo : hi < -far ? hi : field(blend, point(i, j, k));
      }
    }
  }
  const value = (i: number, j: number, k: number): number => values[at(i, j, k)] ?? 1;

  const cellVertex = new Int32Array(nx * ny * nz).fill(-1);
  const cellId = (i: number, j: number, k: number): number => i + nx * (j + ny * k);
  const positions: Vec[] = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] as const;
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]] as const;
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const v = corners.map(([a, b, c]) => value(i + a, j + b, k + c));
        if (v.every((x) => x < 0) || v.every((x) => x >= 0)) continue;
        const sum: Vec = [0, 0, 0];
        let count = 0;
        for (const [e0, e1] of edges) {
          const a = v[e0] ?? 0;
          const b = v[e1] ?? 0;
          if (a < 0 === b < 0) continue;
          const t = a / (a - b);
          const c0 = corners[e0];
          const c1 = corners[e1];
          for (let axis = 0; axis < 3; axis++) sum[axis] = (sum[axis] ?? 0) + (c0[axis] ?? 0) + ((c1[axis] ?? 0) - (c0[axis] ?? 0)) * t;
          count += 1;
        }
        cellVertex[cellId(i, j, k)] = positions.length;
        positions.push([min[0] + (i + sum[0] / count) * cell, min[1] + (j + sum[1] / count) * cell, min[2] + (k + sum[2] / count) * cell]);
      }
    }
  }

  const triangles: Tri[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean): void => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    const [p, q, r, s] = flip ? [a, d, c, b] : [a, b, c, d];
    const pa = positions[p] ?? [0, 0, 0];
    const pb = positions[q] ?? [0, 0, 0];
    const pc = positions[r] ?? [0, 0, 0];
    const pd = positions[s] ?? [0, 0, 0];
    if (len(sub(pa, pc)) <= len(sub(pb, pd))) triangles.push([p, q, r], [p, r, s]);
    else triangles.push([p, q, s], [q, r, s]);
  };
  const cv = (i: number, j: number, k: number): number => cellVertex[cellId(i, j, k)] ?? -1;
  for (let k = 1; k < nz; k++) {
    for (let j = 1; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = value(i, j, k);
        if (a < 0 !== value(i + 1, j, k) < 0) quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k), a < 0);
      }
    }
  }
  for (let k = 1; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 1; i < nx; i++) {
        const a = value(i, j, k);
        if (a < 0 !== value(i, j + 1, k) < 0) quad(cv(i - 1, j, k - 1), cv(i - 1, j, k), cv(i, j, k), cv(i, j, k - 1), a < 0);
      }
    }
  }
  for (let k = 0; k < nz; k++) {
    for (let j = 1; j < ny; j++) {
      for (let i = 1; i < nx; i++) {
        const a = value(i, j, k);
        if (a < 0 !== value(i, j, k + 1) < 0) quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k), a < 0);
      }
    }
  }

  if (signedVolume({ positions, triangles }) < 0) for (const t of triangles) [t[1], t[2]] = [t[2], t[1]];
  return { positions, triangles };
}

/** Each vertex pulled onto the blend's surface along the field's slope, never by more than a cell. */
export function project(blend: Blend, s: Surface, cell: number): Surface {
  const e = cell / 8;
  const positions = s.positions.map((start): Vec => {
    const p: Vec = [...start];
    for (let step = 0; step < 3; step++) {
      const f = field(blend, p);
      const g = gradient(blend, p, e);
      const g2 = dot(g, g);
      if (g2 === 0) break;
      const move = Math.max(-cell, Math.min(cell, f / g2));
      for (let axis = 0; axis < 3; axis++) p[axis] = (p[axis] ?? 0) - move * (g[axis] ?? 0);
    }
    return p;
  });
  return { positions, triangles: s.triangles };
}

/** Six times the volume a closed surface holds: positive when its triangles face outward. */
export function signedVolume(s: Surface): number {
  let v = 0;
  for (const [a, b, c] of s.triangles) v += dot(s.positions[a] ?? [0, 0, 0], cross(s.positions[b] ?? [0, 0, 0], s.positions[c] ?? [0, 0, 0]));
  return v;
}

/** The front of the blend at (x, y): the largest z where the field crosses zero, marching back from `from`. */
export function frontAt(blend: Blend, x: number, y: number, from: number, to: number): number {
  const step = 0.001;
  let z = from;
  while (z > to && field(blend, [x, y, z]) > 0) z -= step;
  let lo = z;
  let hi = z + step;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (field(blend, [x, y, mid]) > 0) hi = mid;
    else lo = mid;
  }
  return lo;
}
