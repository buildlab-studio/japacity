// Thinning a blended surface to a triangle budget: edges collapse cheapest first, the cost being how
// far the new point lies from the planes of the faces it replaces (quadric error). A collapse that
// would fold a face over or pinch the surface is refused, so the result stays a closed surface.
import type { Surface, Tri, Vec } from "./blend";

const norm = (v: Vec): number => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);

type Quadric = Float64Array; // a2 ab ac ad b2 bc bd c2 cd d2

function planeQuadric(a: Vec, b: Vec, c: Vec): Quadric {
  const u: Vec = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v: Vec = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n: Vec = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const area = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
  const q = new Float64Array(10);
  if (area === 0) return q;
  const [x, y, z] = [n[0] / area, n[1] / area, n[2] / area];
  const d = -(x * a[0] + y * a[1] + z * a[2]);
  const w = area;
  q.set([x * x, x * y, x * z, x * d, y * y, y * z, y * d, z * z, z * d, d * d].map((value) => value * w));
  return q;
}

function cost(q: Quadric, p: Vec): number {
  const [x, y, z] = p;
  const g = (i: number): number => q[i] ?? 0;
  return g(0) * x * x + 2 * g(1) * x * y + 2 * g(2) * x * z + 2 * g(3) * x + g(4) * y * y + 2 * g(5) * y * z + 2 * g(6) * y + g(7) * z * z + 2 * g(8) * z + g(9);
}

/** The point that minimises the quadric, or null where the faces are too nearly flat to fix one. */
function optimum(q: Quadric): Vec | null {
  const g = (i: number): number => q[i] ?? 0;
  const [a, b, c, d, e, f, h, i, j] = [g(0), g(1), g(2), g(4), g(5), g(7), -g(3), -g(6), -g(8)];
  const det = a * (d * f - e * e) - b * (b * f - c * e) + c * (b * e - c * d);
  const trace = a + d + f;
  if (Math.abs(det) < 1e-9 * trace * trace * trace) return null;
  return [
    (h * (d * f - e * e) - b * (i * f - e * j) + c * (i * e - d * j)) / det,
    (a * (i * f - e * j) - h * (b * f - c * e) + c * (b * j - i * c)) / det,
    (a * (d * j - i * e) - b * (b * j - i * c) + h * (b * e - c * d)) / det,
  ];
}

interface Candidate {
  cost: number;
  u: number;
  v: number;
  p: Vec;
  stamp: number;
}

function less(x: Candidate, y: Candidate): boolean {
  return x.cost !== y.cost ? x.cost < y.cost : x.u !== y.u ? x.u < y.u : x.v < y.v;
}

function push(heap: Candidate[], item: Candidate): void {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    const up = heap[parent];
    if (up === undefined || !less(item, up)) break;
    heap[i] = up;
    i = parent;
  }
  heap[i] = item;
}

function pop(heap: Candidate[]): Candidate | undefined {
  const top = heap[0];
  const last = heap.pop();
  if (top === undefined || last === undefined || heap.length === 0) return top;
  let i = 0;
  for (;;) {
    const l = 2 * i + 1;
    const r = l + 1;
    let m = i;
    let best = last;
    const left = heap[l];
    const right = heap[r];
    if (left !== undefined && less(left, best)) {
      m = l;
      best = left;
    }
    if (right !== undefined && less(right, best)) m = r;
    if (m === i) break;
    heap[i] = heap[m] ?? last;
    i = m;
  }
  heap[i] = last;
  return top;
}

/** Thins a closed surface to at most `target` triangles. Deterministic: ties go to the lower vertex numbers. */
export function thin(input: Surface, target: number): Surface {
  const pos: Vec[] = input.positions.map((p) => [...p]);
  const faces: Tri[] = input.triangles.map((t) => [...t]);
  const alive = faces.map(() => true);
  const around: Set<number>[] = pos.map(() => new Set<number>());
  faces.forEach((f, fi) => {
    for (const v of f) around[v]?.add(fi);
  });
  const quadric: Quadric[] = pos.map(() => new Float64Array(10));
  faces.forEach(([a, b, c]) => {
    const q = planeQuadric(pos[a] ?? [0, 0, 0], pos[b] ?? [0, 0, 0], pos[c] ?? [0, 0, 0]);
    for (const v of [a, b, c]) {
      const into = quadric[v];
      if (into !== undefined) for (let i = 0; i < 10; i++) into[i] = (into[i] ?? 0) + (q[i] ?? 0);
    }
  });
  const stamp = pos.map(() => 0);
  const gone = pos.map(() => false);
  let count = faces.length;
  const heap: Candidate[] = [];

  // An entry is stale once either end has moved since it was costed.
  const key = (a: number, b: number): number => (stamp[a] ?? 0) * 1048576 + (stamp[b] ?? 0);
  const neighbours = (v: number): Set<number> => {
    const out = new Set<number>();
    for (const fi of around[v] ?? []) for (const w of faces[fi] ?? []) if (w !== v) out.add(w);
    return out;
  };
  const sum = (u: number, v: number): Quadric => {
    const q = new Float64Array(10);
    const qu = quadric[u];
    const qv = quadric[v];
    for (let i = 0; i < 10; i++) q[i] = (qu?.[i] ?? 0) + (qv?.[i] ?? 0);
    return q;
  };
  const consider = (u: number, v: number): void => {
    const [a, b] = u < v ? [u, v] : [v, u];
    const q = sum(a, b);
    const pa = pos[a] ?? [0, 0, 0];
    const pb = pos[b] ?? [0, 0, 0];
    const mid: Vec = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2];
    const choices: Vec[] = [mid, pa, pb];
    const best = optimum(q);
    // The optimum is trusted only near the edge, so a nearly flat patch does not throw a point far off.
    if (best !== null) {
      const edge = norm([pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]]);
      if (norm([best[0] - mid[0], best[1] - mid[1], best[2] - mid[2]]) <= edge) choices.unshift(best);
    }
    let p = mid;
    let c = Infinity;
    for (const choice of choices) {
      const k = cost(q, choice);
      if (k < c) {
        c = k;
        p = choice;
      }
    }
    push(heap, { cost: c, u: a, v: b, p, stamp: key(a, b) });
  };
  const normal = (a: Vec, b: Vec, c: Vec): Vec => {
    const u: Vec = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w: Vec = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  };
  // Refuses a collapse that pinches (the two ends share more than the two corners of their faces)
  // or turns any remaining face over or nearly flat.
  const allowed = (u: number, v: number, p: Vec): boolean => {
    const shared = [...(around[u] ?? [])].filter((fi) => faces[fi]?.includes(v) === true);
    if (shared.length !== 2) return false;
    const nu = neighbours(u);
    let common = 0;
    for (const w of neighbours(v)) if (nu.has(w)) common += 1;
    if (common !== 2) return false;
    for (const end of [u, v]) {
      for (const fi of around[end] ?? []) {
        const f = faces[fi];
        if (f === undefined || f.includes(u) && f.includes(v)) continue;
        const before = normal(pos[f[0]] ?? [0, 0, 0], pos[f[1]] ?? [0, 0, 0], pos[f[2]] ?? [0, 0, 0]);
        const moved = f.map((w) => (w === u || w === v ? p : (pos[w] ?? [0, 0, 0]))) as [Vec, Vec, Vec];
        const after = normal(moved[0], moved[1], moved[2]);
        const lb = norm(before);
        const la = norm(after);
        if (la === 0 || lb === 0) return false;
        if ((before[0] * after[0] + before[1] * after[1] + before[2] * after[2]) / (lb * la) < 0.3) return false;
      }
    }
    return true;
  };

  const seed = (): void => {
    heap.length = 0;
    const seen = new Set<number>();
    faces.forEach((f, fi) => {
      if (alive[fi] !== true) return;
      for (let i = 0; i < 3; i++) {
        const a = f[i] ?? 0;
        const b = f[(i + 1) % 3] ?? 0;
        const id = Math.min(a, b) * pos.length + Math.max(a, b);
        if (seen.has(id)) continue;
        seen.add(id);
        consider(a, b);
      }
    });
  };

  // A refused collapse leaves the queue; once the queue runs dry every edge is costed again,
  // until a whole round collapses nothing.
  for (let progress = true; count > target && progress; ) {
    progress = false;
    seed();
    while (count > target) {
      const next = pop(heap);
      if (next === undefined) break;
      const { u, v, p } = next;
      if (gone[u] === true || gone[v] === true || next.stamp !== key(u, v) || !allowed(u, v, p)) continue;
      for (const fi of [...(around[v] ?? [])]) {
        const f = faces[fi];
        if (f === undefined) continue;
        if (f.includes(u)) {
          alive[fi] = false;
          count -= 1;
          for (const w of f) around[w]?.delete(fi);
        } else {
          f[f.indexOf(v)] = u;
          around[u]?.add(fi);
        }
      }
      around[v]?.clear();
      gone[v] = true;
      pos[u] = p;
      quadric[u] = sum(u, v);
      stamp[u] = (stamp[u] ?? 0) + 1;
      progress = true;
      for (const w of neighbours(u)) consider(u, w);
    }
  }

  const remap = new Map<number, number>();
  const positions: Vec[] = [];
  const triangles: Tri[] = [];
  faces.forEach((f, fi) => {
    if (alive[fi] !== true) return;
    const t = f.map((v) => {
      let i = remap.get(v);
      if (i === undefined) {
        i = positions.length;
        remap.set(v, i);
        positions.push(pos[v] ?? [0, 0, 0]);
      }
      return i;
    }) as Tri;
    triangles.push(t);
  });
  return { positions, triangles };
}
