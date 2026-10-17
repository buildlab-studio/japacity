// People written as code. One skeleton for everyone: the
// same bone names and order, so one set of poses drives every body. A person is plain data
// (body numbers, skin, hair, clothes, pattern seed) given to this one builder (R-ASSET-014).
// The output is a skinned mesh as plain arrays (person.types.ts): group 0 is flat palette
// colour, group 1 the one fabric pattern.
import type { PaletteName } from "@japacity/assets";
import type { PatternSpec } from "@japacity/assets/pattern";

import { type Blend, frontAt, project, type Shape, surface, type Surface, type Tri } from "./blend";
import type { PersonBone, PersonMesh } from "./person.types";
import { thin } from "./thin";

export const BONE_NAMES = [
  "hips", "spine", "chest", "neck", "head",
  "upperArmL", "forearmL", "handL", "upperArmR", "forearmR", "handR",
  "upperLegL", "lowerLegL", "footL", "upperLegR", "lowerLegR", "footR",
] as const;
export type BoneName = (typeof BONE_NAMES)[number];
const B = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i])) as Record<BoneName, number>;
export const BONE_PARENTS = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 0, 11, 12, 0, 14, 15] as const;

const ARM_SPLAY = (35 * Math.PI) / 180; // bind pose: arms 35 degrees out from hanging
const HC = 1.578; // head centre height; the top of the head is 1.70 m

/**
 * How faces are drawn: today's (a white round a dark eye), or one of the three directions of the
 * face exploration: "a" soft marks, "b" low poly, "c" big and friendly.
 * One switch for every person, so the same people export each way without touching their data.
 */
export type FaceStyle = "today" | "a" | "b" | "c";
export const FACE_STYLES: readonly FaceStyle[] = ["today", "a", "b", "c"];
/** The style the shipped people are built with. */
export const FACE_STYLE: FaceStyle = "c";
/** A style named on the command line or in JAPACITY_FACE, or the shipped one when none is named. */
export function faceStyleFrom(value: string | undefined): FaceStyle {
  if (value === undefined || value === "") return FACE_STYLE;
  const found = FACE_STYLES.find((style) => style === value);
  if (found === undefined) throw new Error(`No face style ${value}. Known: ${FACE_STYLES.join(", ")}`);
  return found;
}

/** The numbers a face style sets beyond the face: how much larger than life the head, hands and feet are drawn. */
interface Look {
  style: FaceStyle;
  /** Heads are drawn larger than life so they read on a phone. */
  headScale: number;
  handScale: number;
  footScale: number;
}
const LOOKS: Record<FaceStyle, Look> = {
  today: { style: "today", headScale: 1.18, handScale: 1, footScale: 1 },
  a: { style: "a", headScale: 1.18, handScale: 1, footScale: 1 },
  b: { style: "b", headScale: 1.18, handScale: 1, footScale: 1 },
  c: { style: "c", headScale: 1.25, handScale: 1.2, footScale: 1.12 },
};

type Vec = [number, number, number];
type Weights = [number, number][];
type WeightFn = (p: Vec) => Weights;
/** A palette colour, or 1 for the person's fabric pattern. */
export type Fab = PaletteName | number;

export interface Garment {
  type: string;
  fab: Fab;
  sleeve?: "short" | "long" | "half" | "wide";
  hem?: number;
  flare?: number;
  neck?: "strapless";
  straps?: boolean;
  ease?: number;
  placket?: PaletteName;
  rise?: number;
  wide?: number;
  shorts?: boolean;
  stride?: number;
}

export type HairName = "lowcut" | "afro" | "braids" | "locs" | "long" | "bun" | "cornrows";
export type HeadName = "gele" | "fila" | "cap" | "kufi" | "beanie" | "helmet" | "scarf";

export interface PersonSpec {
  name: string;
  /** The name the face is drawn from, where it differs from `name` (an older name). */
  face?: string;
  body: "m" | "f" | "fx" | "mx";
  build?: number;
  shape?: number;
  bust?: number;
  size?: number;
  mass?: number;
  muscle?: number;
  /** 1 is 1.70 m. */
  height?: number;
  skin: PaletteName;
  hair?: HairName;
  hairColor?: PaletteName;
  hairLen?: number;
  head?: HeadName;
  headFab?: Fab;
  shoes?: PaletteName;
  heels?: boolean;
  bag?: PaletteName;
  bagHand?: "L" | "R";
  phone?: boolean;
  shades?: boolean;
  beard?: boolean;
  holding?: PaletteName;
  carry?: { kind: "oranges" | "bread" | "drinks"; tray?: PaletteName; seed?: number };
  stride?: number;
  patterns?: PatternSpec[];
  top: Garment;
  bottom: Garment;
  over?: { fab: Fab; trim: PaletteName };
}

/** The spec with the defaults filled in. */
type Spec = PersonSpec & { build: number; hairColor: PaletteName; shoes: PaletteName; look: Look };

interface Body {
  sh: number;
  hip: number;
  limb: number;
  neck?: number;
  thigh?: number;
  arm?: [number, number];
  torso?: number[][];
  rows?: number[][];
}

// Body types are numbers, not separate models. torso rows: [y, half width, half depth].
const BODY_M: Body = { sh: 0.182, hip: 0.076, limb: 1.0, torso: [[0.9, 0.15, 0.1], [1.03, 0.135, 0.092], [1.24, 0.168, 0.108], [1.385, 0.185, 0.092]] };
const BODY_F: Body = { sh: 0.165, hip: 0.08, limb: 0.88, torso: [[0.9, 0.165, 0.112], [1.05, 0.12, 0.086], [1.24, 0.152, 0.108], [1.385, 0.165, 0.086]] };

// A woman's body as a profile from crotch to neck: rows of [y, half width, half depth, z offset].
// shape (0 straight to 1 figure 8), bust (0 to 1), size (-1 slim, 0, 1 plus size).
function bodyFx(s: Spec): Body {
  const f = s.shape ?? 0;
  const bu = s.bust ?? 0.1 + 0.5 * f;
  const z = s.size ?? 0;
  const zp = Math.max(0, z);
  const zn = Math.min(0, z);
  return {
    neck: 1 + 0.2 * zp + 0.06 * zn, sh: 0.16 + 0.016 * zp + 0.006 * zn, hip: 0.084 + 0.016 * zp, limb: 0.9, thigh: 1 + 0.2 * f + 0.27 * zp + 0.1 * zn,
    arm: [1 + 0.34 * zp + 0.12 * zn, 1 + 0.26 * zp + 0.08 * zn],
    rows: [
      [0.84, 0.125 + 0.03 * zp, 0.1 + 0.03 * zp, -0.004],
      [0.9, 0.165 + 0.03 * f + 0.042 * zp + 0.012 * zn, 0.112 + 0.028 * f + 0.046 * zp + 0.01 * zn, -0.004 - 0.016 * f - 0.012 * zp],
      [0.96, 0.163 + 0.028 * f + 0.044 * zp + 0.012 * zn, 0.11 + 0.022 * f + 0.05 * zp + 0.01 * zn, -0.004 - 0.012 * f],
      [1.02, 0.142 + 0.004 * f + 0.052 * zp + 0.012 * zn, 0.1 + 0.056 * zp + 0.008 * zn, -0.002 + 0.018 * zp],
      [1.09, 0.12 - 0.022 * f + 0.056 * zp + 0.01 * zn, 0.086 - 0.008 * f + 0.056 * zp + 0.006 * zn, 0.014 * zp],
      [1.17, 0.13 - 0.004 * f + 0.042 * zp + 0.01 * zn, 0.094 + 0.04 * zp + 0.006 * zn, 0.004 + 0.008 * zp],
      [1.215, 0.14 + 0.004 * f + 0.006 * bu + 0.036 * zp + 0.009 * zn, 0.099 + 0.035 * zp + 0.72 * (0.008 * f + 0.03 * bu), 0.006 + 0.72 * (0.004 * f + 0.026 * bu)],
      [1.265, 0.148 + 0.01 * f + 0.01 * bu + 0.03 * zp + 0.008 * zn, 0.104 + 0.008 * f + 0.03 * bu + 0.03 * zp, 0.008 + 0.004 * f + 0.026 * bu],
      [1.302, 0.15 + 0.008 * f + 0.006 * bu + 0.026 * zp + 0.008 * zn, 0.098 + 0.025 * zp + 0.7 * (0.008 * f + 0.03 * bu), 0.007 + 0.66 * (0.004 * f + 0.026 * bu)],
      [1.33, 0.15 + 0.004 * f + 0.022 * zp + 0.008 * zn, 0.092 + 0.02 * zp, 0.006],
      [1.385, 0.14 + 0.018 * zp + 0.006 * zn, 0.084 + 0.012 * zp, 0],
      [1.447, 0.062 + 0.006 * zp, 0.058 + 0.006 * zp, 0],
    ],
  };
}

// A man's body: mass (-1 slim, 0, 1 big), muscle (0 to 1, gym fit: wide shoulders and chest, narrow waist, thick arms).
function bodyMx(s: Spec): Body {
  const m = s.mass ?? 0;
  const mp = Math.max(0, m);
  const mn = Math.min(0, m);
  const g = s.muscle ?? 0;
  return {
    neck: 1 + 0.28 * g + 0.2 * mp + 0.08 * mn, sh: 0.182 + 0.042 * g + 0.014 * mp + 0.012 * mn, hip: 0.076 + 0.014 * mp, limb: 1.0, thigh: 1 + 0.16 * g + 0.26 * mp + 0.12 * mn,
    arm: [1 + 0.5 * g + 0.3 * mp + 0.14 * mn, 1 + 0.3 * g + 0.22 * mp + 0.1 * mn],
    rows: [
      [0.84, 0.118 + 0.03 * mp, 0.095 + 0.03 * mp, 0],
      [0.9, 0.15 + 0.036 * mp + 0.014 * mn, 0.1 + 0.042 * mp + 0.01 * mn, -0.004],
      [0.97, 0.148 + 0.042 * mp + 0.014 * mn, 0.098 + 0.055 * mp + 0.01 * mn, 0.012 * mp],
      [1.03, 0.135 - 0.022 * g + 0.064 * mp + 0.014 * mn, 0.092 + 0.078 * mp + 0.01 * mn, 0.034 * mp],
      [1.12, 0.142 + 0.01 * g + 0.058 * mp + 0.014 * mn, 0.097 + 0.07 * mp + 0.01 * mn, 0.03 * mp],
      [1.24, 0.166 + 0.052 * g + 0.032 * mp + 0.014 * mn, 0.106 + 0.03 * g + 0.036 * mp + 0.01 * mn, 0.01 * g + 0.01 * mp],
      [1.33, 0.174 + 0.052 * g + 0.022 * mp + 0.012 * mn, 0.098 + 0.014 * g + 0.02 * mp, 0.004 * g],
      [1.385, 0.16 + 0.022 * g + 0.014 * mp + 0.01 * mn, 0.09 + 0.008 * g + 0.01 * mp, 0],
      [1.447, 0.066 + 0.01 * g + 0.008 * mp, 0.06 + 0.008 * g + 0.008 * mp, 0],
    ],
  };
}

function bodyOf(s: Spec): Body {
  switch (s.body) {
    case "m":
      return BODY_M;
    case "f":
      return BODY_F;
    case "fx":
      return bodyFx(s);
    case "mx":
      return bodyMx(s);
    default: {
      const never: never = s.body;
      throw new Error(`body: ${String(never)}`);
    }
  }
}

const HEAD = [ // [y from head centre, half width, half depth, z offset]
  [-0.122, 0.03, 0.034, 0.018], [-0.095, 0.062, 0.07, 0.012], [-0.045, 0.086, 0.094, 0.004], [0.01, 0.094, 0.102, 0],
  [0.06, 0.09, 0.1, -0.004], [0.1, 0.066, 0.076, -0.006], [0.122, 0.03, 0.036, -0.006],
] as const;

// ---------- small maths ----------
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: Vec): number => Math.hypot(a[0], a[1], a[2]);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const mix = (a: Vec, b: Vec, t: number): Vec => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smooth = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
/** The generator for hair lumps, faces and loads, kept so every person looks as drawn. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const at = <T>(list: readonly T[], i: number): T => {
  const item = list[i];
  if (item === undefined) throw new Error(`people: no item ${String(i)}`);
  return item;
};
const bone = (name: string): number => {
  const index = (B as Record<string, number | undefined>)[name];
  if (index === undefined) throw new Error(`people: no bone ${name}`);
  return index;
};

// ---------- geometry buffer ----------
interface Buf {
  pos: number[];
  col: PaletteName[];
  uv: number[];
  si: number[];
  sw: number[];
  idx: [number[], number[], number[]];
  /** The round part each vertex belongs to, shown smooth (R-ASSET-005), or null for a hard-edged one. */
  part: (SmoothPart | null)[];
  current: SmoothPart | null;
}
const makeBuf = (): Buf => ({ pos: [], col: [], uv: [], si: [], sw: [], idx: [[], [], []], part: [], current: null });

/** The round parts of a person, named in the file's node extras so the loader leaves them smooth. */
export type SmoothPart = "head" | "hair" | "headwear" | "hands" | "load" | "robe";
function smoothPart(b: Buf, part: SmoothPart | null, draw: () => void): void {
  const before = b.current;
  b.current = part;
  draw();
  b.current = before;
}
/** A hard-edged piece inside a round part, such as a cap's peak: shown flat. */
const hard = (b: Buf, draw: () => void): void => smoothPart(b, null, draw);

function vert(b: Buf, p: Vec, colour: PaletteName, uv: readonly [number, number], w: Weights): number {
  const i = b.pos.length / 3;
  b.pos.push(p[0], p[1], p[2]);
  b.part.push(b.current);
  b.col.push(colour);
  b.uv.push(uv[0], uv[1]);
  const s = [0, 0, 0, 0];
  const ww = [0, 0, 0, 0];
  let tot = 0;
  w.slice(0, 4).forEach(([bi, wt], k) => {
    s[k] = bi;
    ww[k] = wt;
    tot += wt;
  });
  b.si.push(...s);
  b.sw.push(...ww.map((x) => x / tot));
  return i;
}

interface Cloth {
  group: number;
  color: PaletteName;
}
// A palette key for plain cloth, or a number for the pattern slot.
const fab = (f: Fab): Cloth => (typeof f === "number" ? { group: f, color: "white" } : { group: 0, color: f });

interface Ring {
  c: Vec;
  ru?: number | undefined;
  rv?: number | undefined;
  w: Weights | WeightFn;
  u?: Vec | undefined;
  v?: Vec | undefined;
  fn?: ((th: number, k: number) => Vec) | undefined;
  rmul?: ((k: number, th: number) => number) | null | undefined;
  dy?: ((th: number) => number) | null | undefined;
  color?: PaletteName | undefined;
}

interface TubeOptions {
  sides?: number;
  u?: Vec;
  v?: Vec;
  group?: number;
  tile?: number;
  theta0?: number;
  arc?: [number, number];
  swapUV?: boolean;
  skip?: (i: number, s: number) => boolean;
  color?: PaletteName;
  capStart?: boolean;
  capStartOff?: Vec;
  capEnd?: boolean;
  capEndOff?: Vec;
}

const weightsAt = (r: Ring, p: Vec): Weights => (typeof r.w === "function" ? r.w(p) : r.w);

// A tube through a list of rings. w is a list of [bone, weight], or a function of the vertex position.
function tube(b: Buf, rings: Ring[], o: TubeOptions = {}): void {
  const sides = o.sides ?? 6;
  const U = o.u ?? [1, 0, 0];
  const V = o.v ?? [0, 0, 1];
  const group = o.group ?? 0;
  const tile = o.tile ?? 0.3;
  const th0 = o.theta0 ?? -Math.PI / 2;
  const first = at(rings, 0);
  const last = at(rings, rings.length - 1);
  const out = dot(cross(U, V), sub(last.c, first.c)) < 0;
  const maxCirc = Math.max(...rings.map((r) => Math.PI * ((r.ru ?? 0.1) + (r.rv ?? 0.1))));
  const reps = Math.max(1, Math.round(maxCirc / tile));
  const start = b.pos.length / 3;
  const n = sides + 1;
  const colourOf = (r: Ring): PaletteName => (group !== 0 ? "white" : (r.color ?? o.color ?? "white"));
  let dist = 0;
  rings.forEach((r, i) => {
    if (i > 0) {
      const prev = at(rings, i - 1);
      dist += Math.max(len(sub(r.c, prev.c)), Math.abs((r.ru ?? 0) - (prev.ru ?? 0)));
    }
    const u = r.u ?? U;
    const v = r.v ?? V;
    for (let s = 0; s <= sides; s++) {
      const k = o.arc !== undefined ? s : s % sides;
      const th = o.arc !== undefined ? o.arc[0] + (s / sides) * (o.arc[1] - o.arc[0]) : th0 + (k / sides) * Math.PI * 2;
      const m = r.rmul ? r.rmul(k, th) : 1;
      const p: Vec = r.fn ? [...r.fn(th, k)] : add(r.c, add(mul(u, (r.ru ?? 0) * Math.cos(th) * m), mul(v, (r.rv ?? 0) * Math.sin(th) * m)));
      if (r.dy) p[1] += r.dy(th);
      const uv: [number, number] = o.swapUV === true ? [dist / tile, (s / sides) * reps] : [(s / sides) * reps, dist / tile];
      vert(b, p, colourOf(r), uv, weightsAt(r, p));
    }
  });
  const ix = at(b.idx, group);
  for (let i = 0; i < rings.length - 1; i++) {
    for (let s = 0; s < sides; s++) {
      if (o.skip?.(i, s) === true) continue;
      const a = start + i * n + s;
      const bb = a + 1;
      const c = a + n;
      const d = c + 1;
      if (out) ix.push(a, c, bb, bb, c, d);
      else ix.push(a, bb, c, bb, d, c);
    }
  }
  const cap = (ri: number, off: Vec | undefined, isFirst: boolean): void => {
    const r = at(rings, ri);
    const cen = add(r.c, off ?? [0, 0, 0]);
    const ci = vert(b, cen, colourOf(r), [0.5, (isFirst ? 0 : dist) / tile], weightsAt(r, cen));
    const base = start + ri * n;
    for (let s = 0; s < sides; s++) {
      if (out === isFirst) ix.push(ci, base + s, base + s + 1);
      else ix.push(ci, base + s + 1, base + s);
    }
  };
  if (o.capStart === true) cap(0, o.capStartOff, true);
  if (o.capEnd === true) cap(rings.length - 1, o.capEndOff, false);
}

function box(b: Buf, c: Vec, size: Vec, colour: PaletteName, w: Weights, group = 0): void {
  const [hx, hy, hz] = mul(size, 0.5);
  const i0 = b.pos.length / 3;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) vert(b, [c[0] + sx * hx, c[1] + sy * hy, c[2] + sz * hz], colour, [0, 0], w);
  for (const f of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]] as const) {
    at(b.idx, group).push(i0 + f[0], i0 + f[1], i0 + f[2], i0 + f[0], i0 + f[2], i0 + f[3]);
  }
}

/**
 * A soft shape: the blend's surface on a grid of `cell` metres, thinned to at most `budget` triangles,
 * added in one colour (or the pattern, with texture coordinates from `uv`). Where the second texture
 * coordinate runs round and starts again after `wrapV`, a triangle across the seam gets its own
 * copies of the corners before it, so the pattern does not smear.
 */
function blended(b: Buf, blend: Blend, o: { cell: number; budget: number; colour: PaletteName; w: Weights; group?: number; uv?: (p: Vec) => [number, number]; wrapV?: number; mirror?: boolean }): Surface {
  const shape = o.mirror === true ? mirrored(blend, o.cell, o.budget) : project(blend, thin(surface(blend, o.cell), o.budget), o.cell);
  const start = b.pos.length / 3;
  const uvs = shape.positions.map((p): [number, number] => o.uv?.(p) ?? [0, 0]);
  shape.positions.forEach((p, i) => vert(b, p, o.colour, at(uvs, i), o.w));
  const ix = at(b.idx, o.group ?? 0);
  const wrap = o.wrapV;
  for (const tri of shape.triangles) {
    const vs = tri.map((i) => at(uvs, i)[1]);
    if (wrap === undefined || Math.max(...vs) - Math.min(...vs) <= wrap / 2) {
      ix.push(...tri.map((i) => start + i));
      continue;
    }
    ix.push(...tri.map((i) => {
      const [u, v] = at(uvs, i);
      return v < wrap / 2 ? vert(b, at(shape.positions, i), o.colour, [u, v + wrap], o.w) : start + i;
    }));
  }
  return shape;
}

/**
 * A blend that is the same on both sides of x = 0, thinned on one side and mirrored, so a low poly
 * shape's planes fall the same way left and right instead of where the thinning happened to leave them.
 * The seam is cut flat, its flat face dropped, and its edge shared by both halves.
 */
function mirrored(blend: Blend, cell: number, budget: number): Surface {
  const half: Blend = { k: 0, shapes: [{ kind: "blend", blend }], cut: [{ kind: "half", p: [0, 0, 0], n: [1, 0, 0] }], cutK: 0 };
  const s = project(half, thin(surface(half, cell), Math.round(budget / 2)), cell);
  // The flat face of the cut looks along -x; every other triangle is the shape's own.
  const normalX = ([a, b, c]: Tri): number => {
    const [p, q, r] = [at(s.positions, a), at(s.positions, b), at(s.positions, c)];
    const n = cross(sub(q, p), sub(r, p));
    return n[0] / (len(n) || 1);
  };
  const kept = s.triangles.filter((t) => normalX(t) > -0.9);
  // The edge left open where the flat face was is the seam: its points stand on x = 0, shared by both halves.
  const edges = new Map<string, number>();
  const key = (i: number, j: number): string => (i < j ? `${String(i)},${String(j)}` : `${String(j)},${String(i)}`);
  for (const [a, b, c] of kept) for (const [i, j] of [[a, b], [b, c], [c, a]] as const) edges.set(key(i, j), (edges.get(key(i, j)) ?? 0) + 1);
  const seam = new Set<number>();
  for (const [k, n] of edges) if (n === 1) for (const i of k.split(",")) seam.add(Number(i));
  const snapped = s.positions.map((p, i): Vec => (seam.has(i) ? [0, p[1], p[2]] : p));
  const positions: Vec[] = [];
  const index = new Map<number, number>();
  const twin = new Map<number, number>();
  const keep = (i: number): number => {
    let j = index.get(i);
    if (j === undefined) {
      j = positions.length;
      positions.push(at(snapped, i));
      index.set(i, j);
    }
    return j;
  };
  const mirror = (i: number): number => {
    const p = at(snapped, i);
    if (seam.has(i)) return keep(i);
    let j = twin.get(i);
    if (j === undefined) {
      j = positions.length;
      positions.push([-p[0], p[1], p[2]]);
      twin.set(i, j);
    }
    return j;
  };
  const triangles: Tri[] = kept.map(([a, b, c]): Tri => [keep(a), keep(b), keep(c)]);
  for (const [a, b, c] of kept) triangles.push([mirror(a), mirror(c), mirror(b)]);
  return { positions, triangles };
}

// ---------- head surface ----------
function headRing(y: number): Vec {
  for (let i = 0; i < HEAD.length - 1; i++) {
    const a = at(HEAD, i);
    const b = at(HEAD, i + 1);
    if (y <= b[0]) {
      const t = Math.max(0, (y - a[0]) / (b[0] - a[0]));
      return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
    }
  }
  const top = at(HEAD, HEAD.length - 1);
  return [top[1], top[2], top[3]];
}
function headPoint(y: number, th: number, scale = 1, lift = 0): Vec {
  const [rx, rz, cz] = headRing(y);
  return [rx * scale * Math.cos(th), HC + y * (1 + (scale - 1) * 0.8) + lift, cz + rz * scale * Math.sin(th)];
}
const wHead: Weights = [[B.head, 1]];
// A head-attached point given in body space, in metres.
const unHead = (p: Vec, hs: number): Vec => [p[0] / hs, 1.455 + (p[1] - 1.455) / hs, p[2] / hs];

interface CapOptions {
  scale: number;
  front: number;
  back: number;
  color: PaletteName;
  group?: number;
  side?: number | null;
  swapUV?: boolean;
  tile?: number;
}

// A cap that follows the skull. Its edge is the hairline height at each angle. It reuses the head's own
// ring heights, so its facets lie parallel to the head's and never cut through it.
function skullCap(b: Buf, { scale, front, back, color, group = 0, side = null, swapUV = false, tile = 0.3 }: CapOptions): void {
  const edge = (th: number): number => {
    const f = (Math.sin(th) + 1) / 2;
    const e = lerp(back, front, smooth(f));
    return side === null ? e : lerp(e, side, Math.pow(Math.abs(Math.cos(th)), 4));
  };
  const levels = [0.1, 0.06, 0.01, -0.045].filter((y) => y > back + 0.004);
  const rings: Ring[] = levels.map((y) => ({ c: [0, HC + y, 0], ru: 0.1 * scale, rv: 0.1 * scale, w: wHead, fn: (th: number) => headPoint(Math.max(y, edge(th)), th, scale) }));
  rings.push({ c: [0, HC + back - 0.002, 0], ru: 0.1, rv: 0.1, w: wHead, fn: (th: number) => headPoint(edge(th), th, scale) });
  rings.reverse();
  // Sixteen sides, so the cap's flat facets stay outside the round head beneath it.
  tube(b, rings, { sides: 16, color, group, swapUV, tile, capEnd: true, capEndOff: [0, 0.022 * scale + 0.003, -0.006] });
}

const clothOf = (f: Fab | undefined): Cloth => fab(f ?? "white");
const capCloth = (f: Fab | undefined): { color: PaletteName; group: number } => clothOf(f);

// ---------- hair and headwear ----------
const HAIR: Record<HairName, (b: Buf, s: Spec) => void> = {
  lowcut: (b, s) => skullCap(b, { scale: 1.04, front: 0.068, back: -0.035, side: 0.02, color: s.hairColor }),
  // An afro: a round mass and a crown of lumps, blended into one surface, the face cut out of its
  // front from the hairline down, thinned and shown smooth.
  afro: (b, s) => {
    const o: Vec = [0, HC + 0.05, -0.03];
    const shapes: Shape[] = [{ kind: "ellipsoid", c: o, r: [0.152, 0.138, 0.155] }];
    const r = rng(5);
    for (let i = 0; i < 26; i++) {
      // Directions spread evenly over the sphere, kept off the face and the neck.
      const y = 1 - (2 * (i + 0.5)) / 26;
      const ring = Math.sqrt(1 - y * y);
      const a = i * 2.39996;
      const d: Vec = [ring * Math.cos(a), y, ring * Math.sin(a)];
      if (d[1] < -0.55 || (d[2] > 0.45 && d[1] < 0.35)) continue;
      shapes.push({ kind: "ball", c: add(o, mul(d, 0.128 + r() * 0.012)), r: 0.04 + r() * 0.012 });
    }
    // The face below the hairline, then the cheeks back to just in front of the ears.
    const face: Shape = { kind: "ellipsoid", c: [0, HC - 0.07, 0.13], r: [0.105, 0.145, 0.13] };
    const cheeks: Shape = { kind: "ellipsoid", c: [0, HC - 0.04, 0.19], r: [0.3, 0.14, 0.2] };
    blended(b, { shapes, k: 0.035, cut: [face, cheeks], cutK: 0.02 }, { cell: 0.008, budget: 700, colour: s.hairColor, w: wHead });
  },
  braids: (b, s) => {
    skullCap(b, { scale: 1.06, front: 0.072, back: -0.03, side: 0.0, color: s.hairColor });
    const N = 15;
    for (let i = 0; i < N; i++) {
      const a = lerp(-0.45, Math.PI + 0.45, i / (N - 1));
      const th = -a;
      const backness = Math.pow(Math.max(0, Math.sin(a)), 1.5);
      const p0 = headPoint(0.03, th, 1.07);
      const endY = lerp(1.41, s.hairLen ?? 1.2, backness);
      const r1 = lerp(0.118, 0.13, backness);
      const p2: Vec = [Math.cos(th) * r1 * 1.05, endY, Math.sin(th) * r1 - 0.01];
      const p1 = mix(p0, p2, 0.5);
      p1[0] *= 1.08;
      p1[2] = p1[2] * 1.08;
      tube(b, [{ c: p0, ru: 0.013, rv: 0.013, w: wHead }, { c: p1, ru: 0.013, rv: 0.013, w: wHead }, { c: p2, ru: 0.009, rv: 0.009, w: wHead }], { sides: 4, color: s.hairColor, capEnd: true });
    }
  },
  // Locs: a close cap of hair over the skull, its own hairline cut, and the strands hanging from it
  // to the shoulders, each a rod that thins to its end; the roots melt into the cap, the strands stay apart.
  locs: (b, s) => {
    const cap: Blend = {
      k: 0.01,
      shapes: [{ kind: "ellipsoid", c: [0, HC + 0.006, -0.004], r: [0.098, 0.124, 0.106] }],
      cut: [
        { kind: "ellipsoid", c: [0, HC - 0.07, 0.12], r: [0.1, 0.138, 0.12] },
        { kind: "half", p: [0, HC + 0.01, 0], n: [0, 1, -0.3] },
      ],
      cutK: 0.012,
    };
    const shapes: Shape[] = [{ kind: "blend", blend: cap }];
    const r = rng(11);
    const N = 22;
    for (let i = 0; i < N; i++) {
      const a = lerp(-0.75, Math.PI + 0.75, i / (N - 1)) + (r() - 0.5) * 0.1;
      const th = -a;
      const y0 = lerp(0.04, 0.1, r());
      const p0 = headPoint(y0, th, 1.0);
      const dropTo = lerp(1.4, 1.5, r());
      const rad = lerp(0.118, 0.135, r());
      const p2: Vec = [Math.cos(th) * rad, dropTo, Math.sin(th) * rad - 0.005];
      const p1: Vec = [Math.cos(th) * rad * 1.02, lerp(HC + y0, dropTo, 0.4), Math.sin(th) * rad * 1.02];
      shapes.push({ kind: "capsule", a: p0, b: p1, ra: 0.016, rb: 0.015 }, { kind: "capsule", a: p1, b: p2, ra: 0.015, rb: 0.011 });
    }
    for (let i = 0; i < 5; i++) {
      // A few short ones standing on the crown.
      const th = r() * 6.28;
      const p0 = headPoint(0.1, th, 0.8);
      const p1 = add(p0, [Math.cos(th) * 0.04, 0.018, Math.sin(th) * 0.04]);
      shapes.push({ kind: "capsule", a: p0, b: p1, ra: 0.017, rb: 0.014 });
    }
    blended(b, { shapes, k: 0.006 }, { cell: 0.005, budget: 1280, colour: s.hairColor, w: wHead });
  },
  // Long straight hair: a cap, one sheet from ear to ear down the back, and a lock brought forward over each collarbone.
  long: (b, s) => {
    skullCap(b, { scale: 1.075, front: 0.074, back: -0.03, side: -0.012, color: s.hairColor });
    const endY = s.hairLen ?? 1.12;
    const R = (y: number, fn: (th: number, k: number) => Vec): Ring => ({ c: [0, y, 0], ru: 0.12, rv: 0.12, w: wHead, fn });
    const odd = (k: number): boolean => k % 2 !== 0;
    tube(b, [
      R(endY, (th, k) => unHead([Math.cos(th) * 0.16, endY + 0.02 * Math.abs(Math.cos(th)) + (odd(k) ? 0.035 : 0), -0.128 - 0.012 * Math.abs(Math.sin(th)) + (odd(k) ? 0.014 : -0.006)], s.look.headScale)),
      R(1.25, (th, k) => unHead([Math.cos(th) * 0.158, 1.25, -0.118 - 0.012 * Math.abs(Math.sin(th)) + (odd(k) ? 0.016 : -0.008)], s.look.headScale)),
      R(1.38, (th, k) => unHead([Math.cos(th) * 0.15, 1.385, Math.min(0.0, Math.sin(th) * 0.13) - 0.035 + (odd(k) ? 0.012 : -0.006)], s.look.headScale)),
      R(1.52, (th) => headPoint(-0.02, th, 1.1)),
      R(1.6, (th) => headPoint(0.03, th, 1.085)),
    ], { sides: 10, arc: [0.3, -Math.PI - 0.3], color: s.hairColor });
    for (const sg of [1, -1]) {
      const u: Vec = [0, 0, 1];
      const v: Vec = [1, 0, 0];
      tube(b, [
        { c: headPoint(0.0, sg > 0 ? 0.25 : Math.PI - 0.25, 1.09), ru: 0.032, rv: 0.012, u, v, w: wHead },
        { c: unHead([sg * 0.118, 1.4, 0.055], s.look.headScale), ru: 0.034, rv: 0.012, u, v, w: wHead },
        { c: unHead([sg * 0.082, 1.22, 0.108], s.look.headScale), ru: 0.026, rv: 0.01, u: [1, 0, 0], v: [0, 0, 1], w: wHead },
      ], { sides: 4, theta0: 0, color: s.hairColor, capEnd: true });
    }
  },
  // Slicked back into a bun.
  bun: (b, s) => {
    skullCap(b, { scale: 1.04, front: 0.07, back: -0.04, side: 0.005, color: s.hairColor });
    const R = (y: number, r: number): Ring => ({ c: [0, HC + y, -0.045], ru: r, rv: r, w: wHead });
    tube(b, [R(0.1, 0.034), R(0.135, 0.052), R(0.17, 0.036)], { sides: 6, color: s.hairColor, capStart: true, capStartOff: [0, -0.012, 0], capEnd: true, capEndOff: [0, 0.014, 0] });
  },
  // Cornrows: rows braided flat from the hairline to the nape, raised on a close cover of hair,
  // blended so the rows stand out as ridges and the scalp between them is hair, not skin.
  cornrows: (b, s) => {
    const rx = 0.094;
    const ry = 0.124;
    const rz = 0.102;
    const shapes: Shape[] = [{
      kind: "blend",
      blend: {
        k: 0,
        shapes: [{ kind: "ellipsoid", c: [0, HC + 0.004, -0.003], r: [0.093, 0.121, 0.1] }],
        cut: [
          { kind: "ellipsoid", c: [0, HC - 0.07, 0.12], r: [0.1, 0.138, 0.12] },
          { kind: "half", p: [0, HC - 0.01, 0], n: [0, 1, -0.35] },
        ],
        cutK: 0.01,
      },
    }];
    for (let k = -4; k <= 4; k++) {
      const x0 = k * 0.0205;
      const q = Math.sqrt(1 - (x0 / rx) ** 2);
      const a0 = 0.5 + Math.abs(k) * 0.05;
      const points: Vec[] = [];
      for (let j = 0; j <= 7; j++) {
        const al = lerp(a0, Math.PI + 0.42, j / 7);
        points.push([x0 * 1.01, HC + ry * q * Math.sin(al), rz * q * Math.cos(al) - 0.003]);
      }
      for (let j = 0; j < points.length - 1; j++) shapes.push({ kind: "capsule", a: at(points, j), b: at(points, j + 1), ra: 0.0105, rb: 0.0105 });
    }
    blended(b, { shapes, k: 0.004 }, { cell: 0.0042, budget: 900, colour: s.hairColor, w: wHead });
  },
};

const HEADWEAR: Record<HeadName, (b: Buf, s: Spec) => void> = {
  // Gele, after reference photos of real ones: the cloth is wrapped low and tight in bands over the forehead,
  // then stands up as a wide pleated fan behind the head, like a halo, larger on one side, with a knot by one ear.
  // From the side it is thin. Blended from three stepped wraps, a fan of pleats and a knot, shown smooth;
  // the pattern runs round the fan, as the pleats do.
  gele: (b, s) => {
    const f = capCloth(s.headFab);
    const yc = HC + 0.034;
    const tilt = 0.22;
    const face: Shape = { kind: "ellipsoid", c: [0, HC - 0.08, 0.12], r: [0.1, 0.13, 0.12] };
    const tiers: [number, number, number][] = [[1.04, 0.058, -0.06], [1.09, 0.086, -0.035], [1.14, 0.108, -0.012]]; // scale, front edge, back edge
    const shapes: Shape[] = tiers.map(([sc, front, back]) => ({
      kind: "blend",
      blend: {
        k: 0,
        shapes: [{ kind: "ellipsoid", c: [0, HC + 0.006, -0.004], r: [0.098 * sc, 0.124 * sc, 0.106 * sc] }],
        cut: [face, { kind: "half", p: [0, HC + (front + back) / 2, 0], n: [0, 1, -(front - back) / 0.2] }],
        cutK: 0.014,
      },
    }));
    const a0 = -0.62;
    const a1 = Math.PI + 0.62; // from below one ear, over the top, to below the other
    const taper = (ph: number): number => 0.66 + 0.34 * smooth(Math.min(ph - a0, a1 - ph) / 0.6); // narrower where it meets the neck
    const big = (ph: number): number => 1 + 0.16 * Math.cos(ph - 2.2); // larger up and to one side
    const plane = (x: number, y: number, z: number): Vec => [x, yc + y, -0.012 + z - y * tilt];
    const normal = mul([0, tilt, 1], 1 / Math.hypot(tilt, 1));
    const P = 15;
    for (let i = 0; i < P; i++) {
      const ph = lerp(a0, a1, (i + 0.5) / P);
      const inner: [number, number] = [0.104 * Math.cos(ph), 0.13 * Math.sin(ph) - 0.034];
      const R = 0.232 * taper(ph) * big(ph);
      const outer: [number, number] = [0.014 + R * 1.06 * Math.cos(ph), R * Math.sin(ph)];
      const radial: Vec = [outer[0] - inner[0], outer[1] - inner[1], -(outer[1] - inner[1]) * tilt];
      const length = len(radial);
      const along = mul(radial, 1 / length);
      const across = cross(normal, along);
      const fold = i % 2 !== 0 ? 0.012 : -0.008;
      const mid = plane((inner[0] + outer[0]) / 2, (inner[1] + outer[1]) / 2, fold);
      const width = ((a1 - a0) / P) * R * 0.62;
      shapes.push({ kind: "ellipsoid", c: mid, r: [length / 2 + 0.012, width, 0.011], axes: [along, across, normal] });
    }
    const knot = plane(0.155, -0.061, 0.06);
    shapes.push({ kind: "ball", c: knot, r: 0.04 }, { kind: "ball", c: add(knot, [0.022, -0.028, -0.004]), r: 0.028 }, { kind: "ball", c: add(knot, [-0.018, -0.03, 0.006]), r: 0.026 });
    // Round a point at the neck, where there is no cloth, so the pattern neither pinches nor seams on the gele.
    const tile = 0.09;
    const round = 2 * Math.PI * 0.18;
    const uv = (p: Vec): [number, number] => {
      const x = p[0];
      const y = p[1] - (HC - 0.09);
      let ph = Math.atan2(y, x);
      if (ph < -Math.PI / 2) ph += 2 * Math.PI;
      return [Math.hypot(x, y) / tile, ((ph + Math.PI / 2) * 0.18) / tile];
    };
    blended(b, { shapes, k: 0.012 }, { cell: 0.005, budget: 1200, colour: f.color, w: wHead, group: f.group, uv, wrapV: round / tile });
  },
  // Fila: a soft round cap that leans to one side.
  fila: (b, s) => {
    const R = (y: number, ru: number, rv: number, cx: number, dy: ((th: number) => number) | null = null): Ring => ({ c: [cx, HC + y, -0.004], ru, rv, w: wHead, dy });
    tube(b, [
      R(0.045, 0.097, 0.105, 0, (th) => 0.02 * Math.sin(th)),
      R(0.105, 0.101, 0.108, 0.004),
      R(0.15, 0.1, 0.104, 0.022, (th) => -0.03 * Math.cos(th)),
      R(0.15, 0.062, 0.07, 0.062, (th) => -0.03 * Math.cos(th)),
      R(0.112, 0.03, 0.04, 0.098),
    ], { sides: 8, ...capCloth(s.headFab), tile: 0.16, capEnd: true });
  },
  // Face cap, as worn by youth corps members.
  cap: (b, s) => {
    const colour = capCloth(s.headFab).color;
    skullCap(b, { scale: 1.06, front: 0.05, back: -0.01, side: 0.03, color: colour });
    hard(b, () => box(b, [0, HC + 0.052, 0.14], [0.13, 0.008, 0.085], colour, wHead));
  },
  // Kufi: a short round cap with a flat top.
  kufi: (b, s) => {
    const R = (y: number, ru: number, rv: number): Ring => ({ c: [0, HC + y, -0.004], ru, rv, w: wHead, dy: y < 0.06 ? (th: number) => 0.018 * Math.sin(th) : null });
    tube(b, [R(0.05, 0.096, 0.104), R(0.128, 0.094, 0.1)], { sides: 8, ...capCloth(s.headFab), capEnd: true });
  },
  beanie: (b, s) => skullCap(b, { scale: 1.07, front: 0.06, back: -0.035, side: 0.022, color: capCloth(s.headFab).color }),
  // An open-face helmet: a thick round shell over the skull, the face and neck cut out, a flat peak.
  helmet: (b, s) => {
    blended(b, {
      k: 0,
      shapes: [{ kind: "ellipsoid", c: [0, HC + 0.022, -0.008], r: [0.124, 0.134, 0.132] }],
      cut: [
        { kind: "ellipsoid", c: [0, HC - 0.075, 0.13], r: [0.098, 0.12, 0.11] },
        { kind: "half", p: [0, HC - 0.045, 0], n: [0, 1, -0.25] },
      ],
      cutK: 0.012,
    }, { cell: 0.006, budget: 320, colour: capCloth(s.headFab).color, w: wHead });
    hard(b, () => box(b, [0, HC + 0.06, 0.135], [0.17, 0.012, 0.06], "black", wHead));
  },
  // A plain head scarf, tied at the back. Everyday wear, where a gele is for occasions.
  scarf: (b, s) => {
    const f = capCloth(s.headFab);
    skullCap(b, { scale: 1.08, front: 0.062, back: -0.055, side: -0.01, ...f, swapUV: true, tile: 0.12 });
    const R = (z: number, r: number): Ring => ({ c: [0, HC - 0.03, z], ru: r, rv: r, w: wHead });
    tube(b, [R(-0.1, 0.03), R(-0.135, 0.05), R(-0.165, 0.028)], { sides: 6, u: [1, 0, 0], v: [0, 1, 0], ...f, capStart: true, capEnd: true });
  },
};

// ---------- the body ----------
type Joints = Record<string, Vec>;
function jointsFor(P: Body): Joints {
  const J: Joints = {};
  for (const [sd, sg] of [["L", 1], ["R", -1]] as const) {
    const d: Vec = [sg * Math.sin(ARM_SPLAY), -Math.cos(ARM_SPLAY), 0];
    const S: Vec = [sg * (P.sh - 0.012), 1.368, 0];
    const E = add(S, mul(d, 0.27));
    J[`S${sd}`] = S;
    J[`E${sd}`] = E;
    J[`W${sd}`] = add(E, mul(d, 0.24));
    J[`d${sd}`] = d;
    J[`u${sd}`] = [sg * Math.cos(ARM_SPLAY), Math.sin(ARM_SPLAY), 0];
    J[`H${sd}`] = [sg * P.hip, 0.9, 0];
    J[`K${sd}`] = [sg * P.hip, 0.49, 0];
    J[`A${sd}`] = [sg * P.hip, 0.085, 0];
  }
  return J;
}
const joint = (J: Joints, key: string): Vec => {
  const v = J[key];
  if (v === undefined) throw new Error(`people: no joint ${key}`);
  return v;
};
function bonePositions(J: Joints): Vec[] {
  return [[0, 0.95, 0], [0, 1.08, 0], [0, 1.24, 0], [0, 1.44, 0], [0, 1.5, 0], ...["SL", "EL", "WL", "SR", "ER", "WR", "HL", "KL", "AL", "HR", "KR", "AR"].map((k) => joint(J, k))];
}
const legSide = (wl: number): WeightFn => (p) =>
  p[0] > 0.04 ? [[B.hips, 1 - wl], [B.upperLegL, wl]] : p[0] < -0.04 ? [[B.hips, 1 - wl], [B.upperLegR, wl]] : [[B.hips, 1 - wl], [B.upperLegL, wl / 2], [B.upperLegR, wl / 2]];
const shinSide = (wl: number): WeightFn => (p) =>
  p[0] > 0.04 ? [[B.hips, 1 - wl], [B.lowerLegL, wl]] : p[0] < -0.04 ? [[B.hips, 1 - wl], [B.lowerLegR, wl]] : [[B.hips, 1 - wl], [B.lowerLegL, wl / 2], [B.lowerLegR, wl / 2]];

function buildTorso(b: Buf, P: Body, s: Spec, T: number[][]): void {
  const t0 = at(T, 0);
  const t1 = at(T, 1);
  const t2 = at(T, 2);
  const t3 = at(T, 3);
  const top = s.top;
  const bot = s.bottom;
  const g = (row: number[], i: number): number => at(row, i);
  const wH: Weights = [[B.hips, 1]];
  const wW: Weights = [[B.hips, 0.5], [B.spine, 0.5]];
  const wC: Weights = [[B.spine, 0.25], [B.chest, 0.75]];
  const wS: Weights = [[B.chest, 1]];
  const wN: Weights = [[B.chest, 0.5], [B.neck, 0.5]];
  tube(b, [
    { c: [0, bot.type === "trousers" ? 0.872 : 0.83, 0], ru: g(t0, 1) * 0.5, rv: g(t0, 2) * 0.6, w: wH },
    { c: [0, g(t0, 0), g(t0, 3)], ru: g(t0, 1), rv: g(t0, 2), w: wH },
    { c: [0, g(t1, 0), g(t1, 3)], ru: g(t1, 1), rv: g(t1, 2), w: wW },
  ], { sides: 8, ...fab(bot.fab), capStart: true });
  const rings: Ring[] = [];
  const ease = top.hem !== undefined ? 0.012 : 0;
  if (top.hem !== undefined) {
    const flare = top.flare ?? 0.012;
    if (top.hem < 0.88) rings.push({ c: [0, top.hem, g(t0, 3)], ru: g(t0, 1) + flare + 0.012, rv: g(t0, 2) + flare + 0.012, w: legSide(1) });
    const low = top.hem < 0.88;
    rings.push({ c: [0, Math.max(top.hem, 0.9), g(t0, 3)], ru: g(t0, 1) + (low ? 0.014 : flare + 0.01), rv: g(t0, 2) + (low ? 0.014 : flare + 0.01), w: wH });
  }
  rings.push(
    { c: [0, g(t1, 0), g(t1, 3)], ru: g(t1, 1) + ease, rv: g(t1, 2) + ease, w: wW },
    { c: [0, g(t2, 0), g(t2, 3) * 0.4], ru: g(t2, 1) + ease * 0.5, rv: g(t2, 2) + ease * 0.5, w: wC },
    { c: [0, g(t3, 0), 0], ru: g(t3, 1) - 0.022, rv: g(t3, 2), w: wS },
    { c: [0, 1.447, 0], ru: 0.062, rv: 0.058, w: wN },
  );
  tube(b, rings, { sides: 8, ...fab(top.fab) });
  const nk = P.neck ?? 1;
  tube(b, [{ c: [0, 1.4, 0], ru: 0.047 * nk, rv: 0.047 * nk, w: wN }, { c: [0, 1.475, 0.004], ru: 0.045 * nk, rv: 0.045 * nk, w: [[B.neck, 0.5], [B.head, 0.5]] }], { sides: 6, color: s.skin });
}

// ---------- a torso built in zones: bottom garment, bare skin, top garment, bare shoulders ----------
type Profile = (y: number) => Vec;
function profileOf(rows: number[][]): Profile {
  return (y) => {
    const first = at(rows, 0);
    if (y <= at(first, 0)) return [at(first, 1), at(first, 2), at(first, 3)];
    for (let i = 0; i < rows.length - 1; i++) {
      const a = at(rows, i);
      const b = at(rows, i + 1);
      if (y <= at(b, 0)) {
        const t = (y - at(a, 0)) / (at(b, 0) - at(a, 0));
        return [lerp(at(a, 1), at(b, 1), t), lerp(at(a, 2), at(b, 2), t), lerp(at(a, 3), at(b, 3), t)];
      }
    }
    const last = at(rows, rows.length - 1);
    return [at(last, 1), at(last, 2), at(last, 3)];
  };
}
const wTorso = (y: number): Weights =>
  y <= 0.98 ? [[B.hips, 1]]
    : y < 1.12 ? [[B.hips, 1 - (y - 0.98) / 0.14], [B.spine, (y - 0.98) / 0.14]]
      : y < 1.24 ? [[B.spine, 1 - (y - 1.12) / 0.12], [B.chest, (y - 1.12) / 0.12]]
        : y < 1.44 ? [[B.chest, 1]] : [[B.chest, 0.5], [B.neck, 0.5]];
function zoneRings(rows: number[][], prof: Profile, y0: number, y1: number, ease: number): Ring[] {
  const ys = [y0, ...rows.map((r) => at(r, 0)).filter((y) => y > y0 + 0.004 && y < y1 - 0.004), y1];
  return ys.map((y) => {
    const [rx, rz, cz] = prof(y);
    const e = y > 1.44 ? Math.min(ease, 0.003) : ease;
    return { c: [0, y, cz], ru: rx + e, rv: rz + e, w: wTorso(y) };
  });
}
function buildTorsoZones(b: Buf, P: Body, s: Spec, rows: number[][]): void {
  const prof = profileOf(rows);
  const top = s.top;
  const bot = s.bottom;
  const rise = bot.rise ?? 1.05;
  const hem = top.hem ?? rise;
  const topEnd = top.neck === "strapless" ? 1.318 : 1.447;
  const trs = bot.type === "trousers";
  tube(b, [{ c: [0, trs ? 0.872 : 0.8, 0], ru: 0.07, rv: 0.06, w: [[B.hips, 1]] }, ...zoneRings(rows, prof, trs ? 0.89 : 0.84, rise, bot.ease ?? 0.004)], { sides: 10, ...fab(bot.fab), capStart: true });
  if (hem > rise + 0.01) tube(b, zoneRings(rows, prof, rise, hem, 0), { sides: 10, color: s.skin });
  const te = top.ease ?? (hem < rise ? 0.012 : 0.006);
  const topRings = zoneRings(rows, prof, Math.max(hem, 0.88), topEnd, te);
  if (hem < 0.86) {
    const [hx, hz, hcz] = prof(0.9);
    const fl = top.flare ?? 0.03;
    const low = [hem, ...(hem < 0.4 ? [0.48] : []), ...(hem < 0.62 ? [0.7] : [])];
    topRings.unshift(...low.map((y): Ring => ({ c: [0, y, hcz * 0.6], ru: hx + te + fl * (0.9 - y), rv: hz + te + fl * (0.9 - y) * 0.6, w: y < 0.4 ? shinSide(1) : legSide(1) })));
  }
  tube(b, topRings, { sides: 10, ...fab(top.fab) });
  if (top.placket !== undefined) {
    const [, rz, cz] = prof(1.3);
    box(b, [0, 1.33, cz + rz + te + 0.002], [0.022, 0.21, 0.01], top.placket, [[B.chest, 1]]);
    box(b, [0, 1.442, 0.004], [0.14, 0.016, 0.13], top.placket, [[B.chest, 0.5], [B.neck, 0.5]]);
  }
  if (topEnd < 1.44) {
    tube(b, zoneRings(rows, prof, topEnd, 1.447, 0), { sides: 10, color: s.skin });
    if (top.straps === true) {
      for (const sx of [-1, 1]) {
        const [, rz, cz] = prof(1.36);
        const cloth = fab(top.fab);
        box(b, [sx * 0.078, (topEnd + 1.415) / 2, cz], [0.02, 1.415 - topEnd + 0.03, rz * 2 + 0.014], cloth.color, [[B.chest, 1]], cloth.group);
      }
    }
  }
  const nk = P.neck ?? 1;
  tube(b, [{ c: [0, 1.4, 0], ru: 0.047 * nk, rv: 0.047 * nk, w: [[B.chest, 0.5], [B.neck, 0.5]] }, { c: [0, 1.475, 0.004], ru: 0.045 * nk, rv: 0.045 * nk, w: [[B.neck, 0.5], [B.head, 0.5]] }], { sides: 6, color: s.skin });
}
// A fitted or flared skirt that follows the profile from the waistband to the hem.
function buildSkirtZones(b: Buf, s: Spec, rows: number[][]): void {
  const prof = profileOf(rows);
  const bot = s.bottom;
  const rise = bot.rise ?? 1.05;
  const hem = bot.hem ?? 0.5;
  const flare = bot.flare ?? -0.012;
  const [hx, hz, hcz] = prof(0.9);
  const e = 0.008;
  const rings: Ring[] = [{ c: [0, hem, hcz * 0.6], ru: hx + flare, rv: hz + flare * 0.5 - 0.004, w: hem < 0.4 ? shinSide(1) : legSide(1) }];
  if (hem < 0.45) rings.push({ c: [0, 0.48, hcz * 0.7], ru: hx + flare * 0.6, rv: hz + flare * 0.3, w: legSide(1), rmul: bot.type === "iro" ? (k: number) => (k === 6 ? 1.07 : 1) : null });
  if (hem < 0.8) rings.push({ c: [0, 0.84, hcz * 0.9], ru: hx + e - 0.002 + Math.max(0, flare) * 0.4, rv: hz + e - 0.002, w: legSide(0.5) });
  rings.push(...zoneRings(rows, prof, 0.9, rise, e));
  tube(b, rings, { sides: 10, ...fab(bot.fab) });
}

/** A face is seven small numbers drawn from the person's name: eye height, spacing and size, nose width and length, mouth width and height, brows. */
interface Face {
  ey: number;
  ex: number;
  ew: number;
  eh: number;
  nw: number;
  nl: number;
  mw: number;
  my: number;
  brow: boolean;
}
function faceOf(s: Spec): Face {
  let h = 7;
  for (const ch of s.face ?? s.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = rng(h || 1);
  const j = (a: number): number => (r() - 0.5) * 2 * a;
  const f: Face = { ey: 0.014 + j(0.007), ex: 0.036 + j(0.005), ew: 0.02 + j(0.004), eh: 0.026 + j(0.007), nw: 0.022 + j(0.006), nl: 0.03 + j(0.008), mw: 0.038 + j(0.01), my: -0.064 + j(0.006), brow: r() < 0.6 };
  const style = s.look.style;
  switch (style) {
    case "today":
    case "b":
      return f;
    // Soft marks: the eyes set a little wider apart.
    case "a":
      return { ...f, ex: f.ex * 1.1 };
    // Big and friendly: larger eyes, set lower and wider, a smaller nose, a narrower mouth.
    case "c":
      return { ...f, ey: f.ey - 0.014, ex: f.ex * 1.12, ew: f.ew * 1.3, eh: f.eh * 1.2, nw: f.nw * 0.85, nl: f.nl * 0.75, mw: f.mw * 0.85 };
    default: {
      const never: never = style;
      throw new Error(`face: ${String(never)}`);
    }
  }
}

// The head as blended shapes: a skull inside the old head's outline (so caps and hair still sit
// outside it), a jaw and chin, cheeks, a brow, a nose from the face's numbers, and ears.
function headBlend(f: Face, style: FaceStyle = "today"): Blend {
  const at0 = (x: number, y: number, z: number): Vec => [x, HC + y, z];
  const noseY = -0.02 - (f.nl - 0.03) / 2;
  const skull: Shape[] = [
    { kind: "ellipsoid", c: at0(0, 0.0, -0.002), r: [0.089, 0.116, 0.097] },
    { kind: "ellipsoid", c: at0(0, -0.058, 0.016), r: [0.07, 0.056, 0.078] },
    { kind: "ball", c: at0(0, -0.097, 0.048), r: 0.024 },
  ];
  const ears: Shape[] = [
    { kind: "ellipsoid", c: at0(0.09, -0.01, -0.004), r: [0.012, 0.024, 0.018] },
    { kind: "ellipsoid", c: at0(-0.09, -0.01, -0.004), r: [0.012, 0.024, 0.018] },
  ];
  const mouth: Shape = { kind: "ellipsoid", c: at0(0, f.my + 0.002, 0.08), r: [f.mw * 0.6, 0.016, 0.02] };
  if (style !== "b") {
    return {
      k: 0.022,
      shapes: [
        ...skull,
        { kind: "ball", c: at0(0.042, -0.028, 0.062), r: 0.028 },
        { kind: "ball", c: at0(-0.042, -0.028, 0.062), r: 0.028 },
        { kind: "ellipsoid", c: at0(0, 0.036, 0.072), r: [0.068, 0.016, 0.024] },
        { kind: "ellipsoid", c: at0(0, noseY, 0.09), r: [f.nw * 0.42, f.nl * 0.62, 0.02] },
        { kind: "ball", c: at0(f.nw * 0.4, noseY - f.nl * 0.36, 0.093), r: 0.011 },
        { kind: "ball", c: at0(-f.nw * 0.4, noseY - f.nl * 0.36, 0.093), r: 0.011 },
        mouth,
        ...ears,
      ],
    };
  }
  // Low poly: a brow shelf, high cheekbones and a nose wedge, melted less so their planes stay
  // apart, and a crease for the mouth, cut before thinning so the few faces left fall along it. The
  // light does the rest. Sockets for the eyes were tried and left out: under a sun from above they
  // shade as a frown.
  const solid: Blend = {
    k: 0.014,
    shapes: [
      ...skull,
      { kind: "ellipsoid", c: at0(0, 0.036, 0.068), r: [0.066, 0.013, 0.018] },
      { kind: "ball", c: at0(0.046, -0.022, 0.064), r: 0.03 },
      { kind: "ball", c: at0(-0.046, -0.022, 0.064), r: 0.03 },
      { kind: "ellipsoid", c: at0(0, noseY + 0.004, 0.088), r: [f.nw * 0.5, f.nl * 0.7, 0.024] },
      mouth,
      ...ears,
    ],
  };
  const front = (x: number, y: number): number => frontAt(solid, x, HC + y, 0.2, -0.1);
  return {
    ...solid,
    cut: [
      { kind: "ellipsoid", c: at0(0, f.my, front(0, f.my) + 0.005), r: [f.mw * 0.55, 0.003, 0.008] },
    ],
    cutK: 0.006,
  };
}

/** How far forward a head's face is at (x, y from the head centre), before the head is drawn larger. */
function frontOf(blend: Blend, x: number, y: number): number {
  return frontAt(blend, x, HC + y, 0.2, -0.1);
}
/** How far forward today's face is: the shipped people's marks and shades are placed by it. */
function faceFront(f: Face, x: number, y: number): number {
  return frontOf(headBlend(f), x, y);
}

// A small lens lying on the face, for an eye, a brow or the mouth: smooth, in one colour.
function lens(b: Buf, c: Vec, ru: number, rv: number, depth: number, colour: PaletteName, sides = 8): void {
  tube(b, [{ c, ru, rv, w: wHead }], { sides, u: [1, 0, 0], v: [0, 1, 0], color: colour, capStart: true, capStartOff: [0, 0, -depth], capEnd: true, capEndOff: [0, 0, depth] });
}

/**
 * An eye as one dark almond lying on the face: pointed at the corners, the lower lid flatter than
 * the upper, the outer corner lifted by `lift`, so it reads as calm rather than round and staring.
 */
function almond(b: Buf, c: Vec, ru: number, rv: number, lift: number, colour: PaletteName, sides = 10, onFace?: { head: Blend; rise: number }): void {
  const outward = Math.sign(c[0]);
  const fn = (th: number): Vec => {
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    const y = rv * sn * (0.45 + 0.55 * Math.abs(sn)) * (sn < 0 ? 0.7 : 1) + lift * cs * outward;
    const x = c[0] + ru * cs;
    // A wide eye follows the face round to its corners rather than standing off it as a flat disc.
    return [x, c[1] + y, onFace === undefined ? c[2] : frontOf(onFace.head, x, c[1] + y - HC) + onFace.rise];
  };
  tube(b, [{ c, ru, rv, w: wHead, fn }], { sides, u: [1, 0, 0], v: [0, 1, 0], color: colour, capStart: true, capStartOff: [0, 0, -0.004], capEnd: true, capEndOff: [0, 0, 0.004] });
}

/** A soft line lying on the face through points (x, y from the head centre): a thin rod, half sunk, in one colour. */
function stroke(b: Buf, head: Blend, pts: readonly [number, number][], thick: number, colour: PaletteName, sides = 6): void {
  const depth = thick * 0.8;
  const rings: Ring[] = pts.map(([x, y], i) => {
    const prev = at(pts, Math.max(0, i - 1));
    const next = at(pts, Math.min(pts.length - 1, i + 1));
    const l = Math.hypot(next[0] - prev[0], next[1] - prev[1]) || 1;
    return { c: [x, HC + y, frontOf(head, x, y) + depth * 0.3], ru: thick, rv: depth, w: wHead, u: [-(next[1] - prev[1]) / l, (next[0] - prev[0]) / l, 0], v: [0, 0, 1] };
  });
  tube(b, rings, { sides, u: [0, 1, 0], v: [0, 0, 1], color: colour, capStart: true, capEnd: true });
}

/** The mouth in the palette's lip colour, or in wine on the three darkest skins, where lip does not show. */
const mouthColour = (s: Spec): PaletteName => (["skin1", "skin2", "skin3"] as PaletteName[]).includes(s.skin) ? "wine" : "lip";

// Today's face: a white round a dark eye, so the face reads on the darkest skins too.
function todayFace(b: Buf, s: Spec, f: Face): void {
  for (const sx of [-1, 1]) {
    const x = sx * f.ex;
    const z = faceFront(f, x, f.ey);
    lens(b, [x, HC + f.ey, z + 0.002], f.ew * 0.78, f.eh * 0.48, 0.006, "white");
    lens(b, [x, HC + f.ey, z + 0.005], f.ew * 0.4, f.eh * 0.42, 0.006, "black");
    if (f.brow) {
      const y = f.ey + f.eh / 2 + 0.012;
      lens(b, [x, HC + y, faceFront(f, x, y) + 0.001], f.ew / 2 + 0.007, 0.0045, 0.005, s.hairColor, 6);
    }
  }
  lens(b, [0, HC + f.my, faceFront(f, 0, f.my)], f.mw * 0.58, 0.0065, 0.005, mouthColour(s));
}

// Soft marks (A), and the same marks larger on a larger head (C): no whites; each eye a dark almond
// with one small highlight toward the sun, a soft arc of brow, the mouth a curved line that smiles.
function softFace(b: Buf, s: Spec, f: Face, head: Blend, big: boolean): void {
  for (const sx of [-1, 1]) {
    const x = sx * f.ex;
    const z = frontOf(head, x, f.ey);
    const ru = f.ew * 0.55 * (big ? 1.5 : 1);
    const rv = f.eh * (big ? 0.4 * 1.4 : 0.34);
    let glintZ = z + 0.0056;
    if (big) {
      // Large enough to read on a 60 pixel person: the dark almond lies in a muted cream one a little longer than it,
      // which shows at the corners as an eye's whites do, so the eye reads on the darkest skin and never as a ring.
      almond(b, [x, HC + f.ey, z + 0.0015], ru * 1.25, rv * 0.96, rv * 0.25, "wallCream", 8, { head, rise: 0.0015 });
      almond(b, [x, HC + f.ey, z + 0.0028], ru, rv, rv * 0.25, "black", 8, { head, rise: 0.0028 });
      glintZ = z + 0.0064;
    } else {
      almond(b, [x, HC + f.ey, z + 0.002], ru, rv, rv * 0.25, "black", 8);
    }
    const glint = big ? 0.0045 : 0.0026;
    lens(b, [x + ru * 0.3, HC + f.ey + rv * 0.36, glintZ], glint, glint, 0.0015, "white", 4);
    const by = f.ey + rv + (big ? 0.011 : 0.011);
    const half = big ? ru * 0.95 : ru + 0.004;
    // Few points and four sides a stroke: the marks cost about what today's lenses did.
    const brow: [number, number][] = (big ? [-1, 0, 1] : [-1, -1 / 3, 1 / 3, 1]).map((t) => [x + t * half, by + 0.0035 * (1 - t * t) + 0.0012 * t * sx]);
    stroke(b, head, brow, big ? 0.0032 : 0.0022, s.hairColor, 4);
  }
  const hw = f.mw * 0.5;
  const smile = big ? 0.005 : 0.0045;
  const mouth: [number, number][] = (big ? [-1, -1 / 3, 1 / 3, 1] : [-1, -0.5, 0, 0.5, 1]).map((t) => [t * hw, f.my + smile * t * t]);
  stroke(b, head, mouth, 0.0024, mouthColour(s), 4);
}

// Low poly (B): the head stays faceted, shown flat; the eyes are small dark marks set into the face
// and the mouth a thin crease, so the planes of the brow, the nose and the cheeks do the face.
function lowPolyFace(b: Buf, s: Spec, f: Face, head: Blend): void {
  for (const sx of [-1, 1]) {
    const x = sx * f.ex;
    lens(b, [x, HC + f.ey, frontOf(head, x, f.ey) + 0.0008], f.ew * 0.55, f.eh * 0.34, 0.0015, "black", 6);
  }
  const hw = f.mw * 0.5;
  stroke(b, head, [-1, -0.5, 0, 0.5, 1].map((t): [number, number] => [t * hw, f.my + 0.003 * t * t]), 0.002, mouthColour(s), 4);
}

/**
 * The bare head's own budget: today's 380 triangles; fewer for the low poly head, so its planes show;
 * 300 for the big head, so its face costs no more than today's and the busiest people stay inside
 * 80% of a person's budget.
 */
export const HEAD_BUDGET: Record<FaceStyle, number> = { today: 380, a: 380, b: 160, c: 300 };

function buildHead(b: Buf, s: Spec): void {
  const f = faceOf(s);
  const style = s.look.style;
  const head = headBlend(f, style);
  const skin = { cell: 0.006, budget: HEAD_BUDGET[style], colour: s.skin, w: wHead, mirror: style === "b" };
  switch (style) {
    case "today":
      blended(b, head, skin);
      todayFace(b, s, f);
      return;
    case "a":
    case "c":
      blended(b, head, skin);
      softFace(b, s, f, head, style === "c");
      return;
    case "b":
      hard(b, () => {
        blended(b, head, skin);
        lowPolyFace(b, s, f, head);
      });
      return;
    default: {
      const never: never = style;
      throw new Error(`face: ${String(never)}`);
    }
  }
}

function buildArm(b: Buf, P: Body, s: Spec, J: Joints, sd: "L" | "R"): void {
  const S = joint(J, `S${sd}`);
  const E = joint(J, `E${sd}`);
  const W = joint(J, `W${sd}`);
  const d = joint(J, `d${sd}`);
  const u = joint(J, `u${sd}`);
  const k = P.limb;
  const ua = bone(`upperArm${sd}`);
  const fa = bone(`forearm${sd}`);
  const ha = bone(`hand${sd}`);
  const ak = P.arm ?? [1, 1];
  const pts = [S, mix(S, E, 0.5), E, mix(E, W, 0.5), W];
  const rad = [0.052 * ak[0], 0.049 * ak[0], (0.043 * (ak[0] + ak[1])) / 2, 0.041 * ak[1], 0.032 * (1 + (ak[1] - 1) * 0.5)].map((x) => x * k);
  const wts: Weights[] = [[[B.chest, 0.35], [ua, 0.65]], [[ua, 1]], [[ua, 0.5], [fa, 0.5]], [[fa, 1]], [[fa, 0.6], [ha, 0.4]]];
  const ring = (i: number, extra = 0, c: Vec | null = null): Ring => ({ c: c ?? at(pts, i), ru: at(rad, i) + extra, rv: at(rad, i) + extra, w: at(wts, i) });
  const o: TubeOptions = { sides: 6, u, v: [0, 0, 1] };
  const cap: TubeOptions = { capStart: true, capStartOff: mul(d, -0.016) };
  const sl = s.top.sleeve;
  const f = fab(s.top.fab);
  let skinFrom = 0;
  if (sl === "short") {
    tube(b, [ring(0, 0.005), ring(1, 0.011, mix(S, E, 0.55))], { ...o, ...f, ...cap });
    skinFrom = 1;
  }
  if (sl === "long") {
    tube(b, [ring(0, 0.01), ring(1, 0.01), ring(2, 0.01), ring(3, 0.009), ring(4, 0.012)], { ...o, ...f, ...cap });
    skinFrom = 5;
  }
  if (sl === "half") {
    tube(b, [ring(0, 0.01), ring(1, 0.022), ring(2, 0.03, mix(S, E, 0.95))], { ...o, ...f, ...cap });
    skinFrom = 2;
  }
  if (sl === "wide") {
    tube(b, [ring(0, 0.012), ring(1, 0.028), ring(2, 0.045), ring(3, 0.058, mix(E, W, 0.55))], { ...o, ...f, ...cap });
    skinFrom = 2;
  }
  if (skinFrom < 4) tube(b, [0, 1, 2, 3, 4].filter((i) => i >= skinFrom).map((i) => ring(i)), { ...o, color: s.skin, ...(skinFrom === 0 ? cap : {}) });
  const hk = k * s.look.handScale;
  smoothPart(b, "hands", () => tube(b, [
    { c: W, ru: 0.02 * hk, rv: 0.031 * hk, w: [[ha, 1]] },
    { c: add(W, mul(d, 0.045 * s.look.handScale)), ru: 0.021 * hk, rv: 0.038 * hk, w: [[ha, 1]] },
    { c: add(W, mul(d, 0.088 * s.look.handScale)), ru: 0.013 * hk, rv: 0.027 * hk, w: [[ha, 1]] },
  ], { ...o, color: s.skin, capEnd: true, capEndOff: mul(d, 0.012 * s.look.handScale) }));
}

function buildLeg(b: Buf, P: Body, s: Spec, sd: "L" | "R"): void {
  const sg = sd === "L" ? 1 : -1;
  const x = sg * P.hip;
  const k = P.limb;
  const bot = s.bottom;
  const ul = bone(`upperLeg${sd}`);
  const ll = bone(`lowerLeg${sd}`);
  const ft = bone(`foot${sd}`);
  const th = P.thigh ?? 1;
  const wide = bot.wide ?? 0;
  const ys = [0.92, 0.7, 0.49, 0.32, 0.1];
  const rad = [0.08 * th, 0.072 * th, 0.056 * (1 + (th - 1) * 0.6), 0.057 * (1 + (th - 1) * 0.75), 0.038 * (1 + (th - 1) * 0.35)].map((v) => v * k);
  const wts: Weights[] = [[[B.hips, 0.6], [ul, 0.4]], [[ul, 1]], [[ul, 0.5], [ll, 0.5]], [[ll, 1]], [[ll, 0.7], [ft, 0.3]]];
  const rows = P.rows ?? null;
  const hipRow = rows !== null ? profileOf(rows)(0.9) : null;
  const trousers = bot.type === "trousers";
  if (hipRow !== null && trousers) {
    rad[0] = Math.max(at(rad, 0), hipRow[0] - P.hip + 0.002);
    rad[1] = Math.max(at(rad, 1), at(rad, 0) * 0.86);
  }
  const zOff = hipRow !== null && trousers ? [hipRow[2] * 0.9, hipRow[2] * 0.45, 0, 0, 0] : [0, 0, 0, 0, 0];
  const ring = (i: number, extra = 0): Ring => ({
    c: [x, at(ys, i), at(zOff, i)], ru: at(rad, i) + extra, rv: at(rad, i) + extra + (i === 0 && hipRow !== null && trousers ? hipRow[1] - at(rad, 0) : 0), w: at(wts, i),
  });
  if (trousers && bot.shorts === true) {
    // Fabric to above the knee, bare leg below.
    const e = bot.ease ?? 0.012;
    const r = lerp(at(rad, 1), at(rad, 2), 0.55);
    const cut = { c: [x, 0.585, 0] as Vec, w: [[ul, 1]] as Weights };
    tube(b, [ring(0, e * 0.5), ring(1, e), { ...cut, ru: r + e + 0.01, rv: r + e + 0.01 }], { sides: 6, ...fab(bot.fab) });
    tube(b, [{ ...cut, ru: r, rv: r }, ring(2), ring(3), ring(4)], { sides: 6, color: s.skin });
  } else if (trousers) {
    const e = bot.ease ?? 0.008;
    tube(b, [ring(0, e * 0.5), ring(1, e + wide * 0.15), ring(2, e + 0.006 + wide * 0.6), ring(3, e + 0.004 + wide * 0.9), { ...ring(4, e + 0.016 + wide * 1.15), c: [x, wide !== 0 ? 0.05 : 0.085, 0] }], { sides: 6, ...fab(bot.fab) });
  } else {
    // Bare leg from the ring just above the hem.
    const hem = bot.hem ?? 0.5;
    const from = Math.max(0, ys.findLastIndex((y) => y > hem + 0.02));
    tube(b, [0, 1, 2, 3, 4].filter((i) => i >= from).map((i) => ring(i)), { sides: 6, color: s.skin });
  }
  const fk = s.look.footScale;
  // A larger foot grows forward from the heel and up from the sole.
  const R = (z: number, ru: number, rv: number, cy: number): Ring => ({ c: [x, cy * fk, z + (z + 0.058) * (fk - 1)], ru: ru * fk, rv: rv * fk, w: [[ft, 1]] });
  if (s.heels === true) {
    // A raised heel on a spike, toe on the ground.
    tube(b, [R(-0.05, 0.027, 0.024, 0.062), R(0.02, 0.034, 0.03, 0.05), R(0.1, 0.04, 0.02, 0.022), R(0.155, 0.026, 0.012, 0.013)], { sides: 6, u: [1, 0, 0], v: [0, 1, 0], theta0: 0, color: s.shoes, capStart: true, capEnd: true, capEndOff: [0, 0, 0.012] });
    box(b, [x, 0.021 * fk, -0.052 - 0.006 * (fk - 1)], [0.014 * fk, 0.042 * fk, 0.014 * fk], s.shoes, [[ft, 1]]);
  } else {
    tube(b, [R(-0.058, 0.036, 0.04, 0.043), R(0.02, 0.043, 0.045, 0.047), R(0.115, 0.046, 0.03, 0.032), R(0.165, 0.036, 0.018, 0.02)], { sides: 6, u: [1, 0, 0], v: [0, 1, 0], theta0: 0, color: s.shoes, capStart: true, capEnd: true, capEndOff: [0, 0, 0.012] });
  }
}

// Things carried or worn: a small bag, a phone, sunglasses, a beard, a bottle held up, a head load.
function buildExtras(b: Buf, s: Spec, J: Joints): void {
  if (s.bag !== undefined) {
    const sd = s.bagHand ?? "L";
    const sg = sd === "L" ? 1 : -1;
    const tip = add(joint(J, `W${sd}`), mul(joint(J, `d${sd}`), 0.085 * s.look.handScale));
    const w: Weights = [[bone(`hand${sd}`), 1]];
    box(b, add(tip, [sg * 0.012, -0.075, 0]), [0.045, 0.1, 0.14], s.bag, w);
    box(b, add(tip, [sg * 0.006, -0.018, 0]), [0.01, 0.03, 0.07], s.bag, w);
  }
  if (s.phone === true) box(b, add(joint(J, "WR"), mul(joint(J, "dR"), 0.075)), [0.014, 0.075, 0.038], "black", [[B.handR, 1]]);
  if (s.shades === true) {
    const f = faceOf(s);
    // Today's shades keep their height; the other styles' sit on the eyes, wherever those are, in front of any socket.
    const y = s.look.style === "today" ? 0.014 : f.ey;
    const solid: Blend = { ...headBlend(f, s.look.style), cut: [] };
    box(b, [0, HC + y, frontOf(solid, f.ex, y) + 0.004], [0.158, 0.034, 0.016], "black", wHead);
  }
  if (s.beard === true) {
    // The jaw, chin and lower cheeks grown a little, below the cheekbones, with the mouth left open.
    const f = faceOf(s);
    const at0 = (x: number, y: number, z: number): Vec => [x, HC + y, z];
    smoothPart(b, "hair", () => blended(b, {
      k: 0.02,
      shapes: [
        { kind: "ellipsoid", c: at0(0, -0.06, 0.018), r: [0.078, 0.064, 0.086] },
        { kind: "ball", c: at0(0, -0.1, 0.05), r: 0.032 },
        { kind: "ball", c: at0(0.05, -0.05, 0.05), r: 0.03 },
        { kind: "ball", c: at0(-0.05, -0.05, 0.05), r: 0.03 },
      ],
      cut: [
        { kind: "half", p: at0(0, f.my + 0.022, 0), n: [0, -1, 0] },
        { kind: "half", p: at0(0, 0, -0.005), n: [0, 0, 1] },
        { kind: "ellipsoid", c: at0(0, f.my, 0.09), r: [f.mw * 0.62, 0.011, 0.04] },
      ],
      cutK: 0.012,
    }, { cell: 0.005, budget: 220, colour: s.hairColor, w: wHead }));
  }
  if (s.holding !== undefined) {
    // A bottle held up for sale.
    box(b, add(joint(J, "WR"), mul(joint(J, "dR"), 0.11)), [0.05, 0.12, 0.05], s.holding, [[B.handR, 1]]);
    box(b, add(joint(J, "WR"), mul(joint(J, "dR"), 0.19)), [0.024, 0.04, 0.024], "white", [[B.handR, 1]]);
  }
  if (s.carry !== undefined) {
    const carry = s.carry;
    smoothPart(b, "load", () => buildHeadLoad(b, carry, s.look.headScale));
  }
}

// A hawker's load: a cloth pad on the head, a wide basin on the pad, piled with one kind of goods.
function buildHeadLoad(b: Buf, carry: NonNullable<PersonSpec["carry"]>, hs: number): void {
  const top = 1.455 + (1.7 - 1.455) * hs - 0.012; // just into the top of the head, in body space
  const R = (y: number, r: number): Ring => ({ c: [0, 1.7 + y, 0], ru: r, rv: r, w: wHead, fn: (th) => unHead([r * Math.cos(th), top + y, r * Math.sin(th)], hs) });
  tube(b, [R(0.0, 0.085), R(0.02, 0.095), R(0.04, 0.08)], { sides: 8, color: "tan", capEnd: true });
  tube(b, [R(0.03, 0.1), R(0.045, 0.2), R(0.105, 0.27), R(0.096, 0.25), R(0.05, 0.18)], { sides: 10, color: carry.tray ?? "hub", capStart: true, capEnd: true });
  const r = rng(carry.seed ?? 3);
  const pos = (x: number, y: number, z: number): Vec => unHead([x, top + 0.03 + y, z], hs);
  const k = 1 / hs;
  const item = (x: number, y: number, z: number, size: Vec, col: PaletteName): void => hard(b, () => box(b, pos(x, y, z), mul(size, k), col, wHead));
  const round = (x: number, y: number, z: number, rad: number, col: PaletteName): void =>
    tube(b, [{ c: pos(x, y, z), ru: rad * k, rv: rad * k, w: wHead }], { sides: 5, color: col, capStart: true, capStartOff: [0, -rad * k, 0], capEnd: true, capEndOff: [0, rad * k, 0] });
  if (carry.kind === "oranges") {
    for (const [n, rad, y] of [[9, 0.17, 0.085], [6, 0.1, 0.15], [1, 0, 0.21]] as const) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + y * 9;
        round(Math.cos(a) * rad, y, Math.sin(a) * rad, 0.05, i % 4 === 3 ? "danfoYellow" : "orange");
      }
    }
  }
  if (carry.kind === "bread") {
    for (const [x, y, z] of [[-0.11, 0.09, -0.07], [0.11, 0.09, -0.07], [-0.11, 0.09, 0.08], [0.11, 0.09, 0.08], [0, 0.185, -0.07], [0, 0.185, 0.08], [0, 0.275, 0]] as const) {
      item(x, y, z, [0.2, 0.09, 0.13], y > 0.15 ? "tan" : "cream");
    }
  }
  if (carry.kind === "drinks") {
    const drinks: PaletteName[] = ["orange", "red", "green", "white", "basin"];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 6.283;
      const rad = i % 2 !== 0 ? 0.16 : 0.07;
      const col = at(drinks, Math.floor(r() * 5));
      item(Math.cos(a) * rad, 0.13, Math.sin(a) * rad, [0.058, 0.15, 0.058], col);
      item(Math.cos(a) * rad, 0.225, Math.sin(a) * rad, [0.026, 0.045, 0.026], "white");
    }
  }
}

function buildSkirt(b: Buf, s: Spec, T: number[][]): void {
  const t0 = at(T, 0);
  const t1 = at(T, 1);
  const bot = s.bottom;
  const hem = bot.hem ?? 0.5;
  const wrap = bot.type === "iro";
  const fold = wrap ? (k: number) => (k === 4 ? 1.07 : 1) : null; // the wrapper's overlapping edge, front left
  const R = (y: number, ru: number, rv: number, w: Weights | WeightFn): Ring => ({ c: [0, y, at(t0, 3) * 0.5], ru, rv, w, rmul: fold });
  const rings: Ring[] = [
    R(at(t1, 0), at(t1, 1) + 0.006, at(t1, 2) + 0.006, [[B.hips, 0.5], [B.spine, 0.5]]),
    R(0.9, at(t0, 1) + 0.01, at(t0, 2) + 0.012, [[B.hips, 1]]),
    R(0.7, at(t0, 1) + 0.008, at(t0, 2) + 0.016, legSide(1)),
  ];
  if (hem < 0.45) rings.push(R(0.48, at(t0, 1) - 0.006, at(t0, 2) + 0.01, legSide(1)), R(hem, at(t0, 1) - 0.014, at(t0, 2) + 0.004, shinSide(1)));
  else rings.push(R(hem, at(t0, 1) + 0.004, at(t0, 2) + 0.014, legSide(1)));
  tube(b, rings.reverse(), { sides: 10, ...fab(bot.fab) });
}

// Agbada: a wide robe worn over the top and trousers, with the sleeves folded up toward the shoulders.
// Three pieces, all on the body's own bones, so no extra rig: the body panel hangs from the chest and
// hips, its front following the thighs and shins so it lies over the lap when seated; each sleeve is
// a wide folded tube that belongs wholly to the upper arm, so raised arms carry it without tearing.
function buildAgbada(b: Buf, P: Body, s: Spec, J: Joints): void {
  const over = s.over;
  if (over === undefined) return;
  const k = s.build;
  const belly = (k - 1) * 0.5;
  const f = fab(over.fab);
  const sides = 14;
  const cz = 0.008 + belly * 0.02;
  const pleat = (amp: number) => (kk: number): number => 1 + (kk % 2 !== 0 ? amp : -amp);
  // Front cloth goes with the legs, back cloth stays with the hips, the sides share.
  const fall = (legL: number, legR: number): WeightFn => (p) => {
    const t = smooth((p[2] - cz + 0.05) / 0.1);
    const leg: Weights = p[0] > 0.04 ? [[legL, t]] : p[0] < -0.04 ? [[legR, t]] : [[legL, t / 2], [legR, t / 2]];
    return ([[B.hips, 1 - t], ...leg] as Weights).filter((x) => x[1] > 0.001);
  };
  const rows: [number, number, number, Weights | WeightFn, ((kk: number) => number) | null][] = [ // y, half width, half depth, weights, pleats
    [1.452, 0.078, 0.07, [[B.chest, 0.6], [B.neck, 0.4]], null],
    [1.398, P.sh + 0.035, 0.114 + belly * 0.1, [[B.chest, 1]], null],
    [1.18, 0.285, 0.16 + belly * 0.4, [[B.chest, 0.6], [B.spine, 0.4]], pleat(0.02)],
    [0.9, 0.3, 0.176 + belly * 0.5, [[B.hips, 1]], pleat(0.025)],
    [0.56, 0.3, 0.18 + belly * 0.4, fall(B.upperLegL, B.upperLegR), pleat(0.03)],
    [0.15, 0.33, 0.19 + belly * 0.3, fall(B.lowerLegL, B.lowerLegR), pleat(0.04)],
  ];
  const rings: Ring[] = rows.map(([y, ru, rv, w, rmul]) => ({ c: [0, y, cz], ru, rv, w, rmul }));
  tube(b, rings.slice().reverse(), { sides, ...f, tile: 0.22, skip: (i, sI) => i <= 2 && (sI === 3 || sI === 10) }); // open sides from the hem to the ribs
  for (const sd of ["L", "R"] as const) {
    const S = joint(J, `S${sd}`);
    const d = joint(J, `d${sd}`);
    const u = joint(J, `u${sd}`);
    const ua = bone(`upperArm${sd}`);
    const along = (t: number): Vec => add(S, mul(d, 0.27 * t));
    const R = (t: number, ru: number, rv: number, w: Weights = [[ua, 1]]): Ring => ({ c: along(t), ru, rv, w });
    // One wide sheet that widens from the shoulder to the folded edge, its folds in the pleats.
    const fold = pleat(0.06);
    const W = (t: number, ru: number, rv: number, w?: Weights): Ring => ({ ...R(t, ru, rv, w), rmul: fold });
    tube(b, [R(-0.02, 0.07, 0.105, [[B.chest, 0.4], [ua, 0.6]]), W(0.25, 0.108, 0.138), W(0.55, 0.126, 0.156), W(0.85, 0.136, 0.166), W(1.12, 0.13, 0.16)],
      { sides: 10, u, v: [0, 0, 1], ...f, tile: 0.22, capStart: true, capStartOff: mul(d, -0.03) });
  }
  // Embroidery: a gold yoke round the neck and down the chest, a plain panel inside it, a gold placket.
  const zAt = (x: number, y: number): number => {
    let i = 0;
    while (i < rows.length - 2 && y < at(rows, i + 1)[0]) i++;
    const a = at(rows, i);
    const c = at(rows, i + 1);
    const t = (a[0] - y) / (a[0] - c[0]);
    const ru = lerp(a[1], c[1], t);
    const rv = lerp(a[2], c[2], t);
    return cz + rv * Math.sqrt(Math.max(0, 1 - (x / ru) ** 2));
  };
  const shield = (sc: number, lift: number, colour: PaletteName, mid = 1.27): void => {
    const pts = [[0, mid], [-0.086, 1.449], [-0.128, 1.33], [-0.082, 1.14], [0, 1.02], [0.082, 1.14], [0.128, 1.33], [0.086, 1.449]].map(([x = 0, y = 0], i) =>
      i !== 0 ? [x * sc, mid + (y - mid) * (y > mid ? 1 : sc)] : [x, y]);
    const i0 = b.pos.length / 3;
    for (const [x = 0, y = 0] of pts) vert(b, [x, y, zAt(x, y) + lift], colour, [0, 0], [[B.chest, 1]]);
    for (let i = 1; i < pts.length; i++) b.idx[0].push(i0, i0 + i, i0 + (i % (pts.length - 1)) + 1);
  };
  shield(1, 0.02, over.trim);
  shield(0.7, 0.026, over.fab === "white" ? "cream" : "white");
  hard(b, () => box(b, [0, 1.25, zAt(0, 1.25) + 0.028], [0.022, 0.26, 0.006], over.trim, [[B.chest, 1]]));
}

// ---------- shading ----------
interface Shaded {
  positions: number[];
  normals: number[];
  colours: PaletteName[];
  uvs: number[];
  joints: number[];
  weights: number[];
  groups: [number[], number[]];
  smooth: SmoothPart[];
}

/**
 * Normals for one welded mesh that is partly smooth and partly flat (R-ASSET-005): a round part keeps
 * its shared vertices, each with the mean of the faces around it, joined across seams where two
 * vertices of the part sit at one point; every other triangle gets three vertices of its own, each
 * with the face's normal, so it shades flat with no help from the loader.
 */
function shade(b: Buf): Shaded {
  const count = b.pos.length / 3;
  const p = (i: number): Vec => [b.pos[i * 3] ?? 0, b.pos[i * 3 + 1] ?? 0, b.pos[i * 3 + 2] ?? 0];
  const faceNormal = (i: number, j: number, k: number): Vec => cross(sub(p(j), p(i)), sub(p(k), p(i)));
  const smoothTri = (i: number, j: number, k: number): boolean => {
    const part = b.part[i] ?? null;
    return part !== null && b.part[j] === part && b.part[k] === part;
  };
  const spot = (i: number): string => `${b.part[i] ?? ""}:${p(i).map((x) => Math.round(x * 100000)).join(",")}`;
  const sums = new Map<string, Vec>();
  for (const group of [b.idx[0], b.idx[1]]) {
    for (let t = 0; t < group.length; t += 3) {
      const [i, j, k] = [group[t] ?? 0, group[t + 1] ?? 0, group[t + 2] ?? 0];
      if (!smoothTri(i, j, k)) continue;
      const n = faceNormal(i, j, k);
      for (const v of [i, j, k]) sums.set(spot(v), add(sums.get(spot(v)) ?? [0, 0, 0], n));
    }
  }
  const out: Shaded = { positions: [], normals: [], colours: [], uvs: [], joints: [], weights: [], groups: [[], []], smooth: [] };
  const unit = (n: Vec): Vec => {
    const l = len(n);
    return l === 0 ? [0, 1, 0] : mul(n, 1 / l);
  };
  const copy = (i: number, n: Vec): number => {
    const o = out.positions.length / 3;
    out.positions.push(...p(i));
    out.normals.push(...unit(n));
    out.colours.push(at(b.col, i));
    out.uvs.push(b.uv[i * 2] ?? 0, b.uv[i * 2 + 1] ?? 0);
    out.joints.push(...b.si.slice(i * 4, i * 4 + 4));
    out.weights.push(...b.sw.slice(i * 4, i * 4 + 4));
    return o;
  };
  const shared = new Int32Array(count).fill(-1);
  const parts = new Set<SmoothPart>();
  [b.idx[0], b.idx[1]].forEach((group, g) => {
    const into = at(out.groups, g);
    for (let t = 0; t < group.length; t += 3) {
      const tri = [group[t] ?? 0, group[t + 1] ?? 0, group[t + 2] ?? 0] as const;
      if (smoothTri(...tri)) {
        parts.add(b.part[tri[0]] ?? "head");
        for (const v of tri) {
          if ((shared[v] ?? -1) < 0) shared[v] = copy(v, sums.get(spot(v)) ?? [0, 1, 0]);
          into.push(shared[v] ?? 0);
        }
      } else {
        const n = faceNormal(...tri);
        for (const v of tri) into.push(copy(v, n));
      }
    }
  });
  out.smooth = [...parts].sort();
  return out;
}

// ---------- assemble ----------
export function buildPerson(spec: PersonSpec, face: FaceStyle = FACE_STYLE): PersonMesh {
  const s: Spec = { ...spec, build: spec.build ?? 1, hairColor: spec.hairColor ?? "hair", shoes: spec.shoes ?? "black", look: LOOKS[face] };
  const hs = s.look.headScale;
  const P = bodyOf(s);
  const b = makeBuf();
  const J = jointsFor(P);
  const k = s.build;
  const T = (P.torso ?? []).map(([y = 0, rx = 0, rz = 0], i) => {
    const g = i < 3 ? k : lerp(k, 1, 0.5);
    const bellyZ = i === 1 ? (k - 1) * 0.11 : i === 0 ? (k - 1) * 0.05 : i === 2 ? (k - 1) * 0.03 : 0;
    return [y, rx * (i === 1 ? lerp(1, g, 1.3) : g), rz * g + bellyZ * 0.5, bellyZ * 0.5];
  });
  const rows = P.rows ?? null;
  if (rows !== null) buildTorsoZones(b, P, s, rows);
  else buildTorso(b, P, s, T);
  const headFrom = b.pos.length / 3;
  smoothPart(b, "head", () => buildHead(b, s));
  const headTo = b.pos.length / 3;
  for (const sd of ["L", "R"] as const) {
    buildArm(b, P, s, J, sd);
    buildLeg(b, P, s, sd);
  }
  if (s.bottom.type !== "trousers") {
    if (rows !== null) buildSkirtZones(b, s, rows);
    else buildSkirt(b, s, T);
  }
  buildExtras(b, s, J);
  if (s.over !== undefined) smoothPart(b, "robe", () => buildAgbada(b, P, s, J));
  const { hair, head } = s;
  if (hair !== undefined) smoothPart(b, "hair", () => HAIR[hair](b, s));
  if (head !== undefined) smoothPart(b, "headwear", () => HEADWEAR[head](b, s));
  if (b.idx[2].length > 0) throw new Error(`${s.name}: a second pattern; a person ships one (R-ASSET-005)`);
  const patterns = s.patterns ?? [];
  if (b.idx[1].length > 0 && patterns[0] === undefined) throw new Error(`${s.name}: patterned cloth with no pattern`);

  // Stylise: a larger head reads better at phone size. Then rescale so every adult is still 1.70 m times their height number.
  const pivotY = 1.455;
  // The top of the bare head, as blended, stands at 1.70 m times the height number once drawn larger.
  let headTop = 0;
  for (let i = headFrom; i < headTo; i++) headTop = Math.max(headTop, b.pos[i * 3 + 1] ?? 0);
  const kH = ((s.height ?? 1) * 1.7) / (pivotY + (headTop - pivotY) * hs);
  for (let i = 0; i < b.pos.length / 3; i++) {
    if (b.si[i * 4] === B.head && b.sw[i * 4] === 1) {
      b.pos[i * 3] = (b.pos[i * 3] ?? 0) * hs;
      b.pos[i * 3 + 1] = pivotY + ((b.pos[i * 3 + 1] ?? 0) - pivotY) * hs;
      b.pos[i * 3 + 2] = (b.pos[i * 3 + 2] ?? 0) * hs;
    }
    for (let a = 0; a < 3; a++) b.pos[i * 3 + a] = (b.pos[i * 3 + a] ?? 0) * kH;
  }
  // Feet on the ground (R-ASSET-003): the soles sit a few millimetres up in the source numbers.
  let minY = Infinity;
  for (let i = 1; i < b.pos.length; i += 3) minY = Math.min(minY, b.pos[i] ?? 0);
  for (let i = 1; i < b.pos.length; i += 3) b.pos[i] = (b.pos[i] ?? 0) - minY;

  const shaded = shade(b);
  const world = bonePositions(J).map((p) => mul(p, kH));
  const bones: PersonBone[] = BONE_NAMES.map((name, i) => {
    const parent = at(BONE_PARENTS, i);
    const p = at(world, i);
    const position: Vec = parent < 0 ? [p[0], p[1] - minY, p[2]] : sub(p, at(world, parent));
    return { name, parent, position };
  });
  return {
    name: s.name,
    positions: shaded.positions,
    normals: shaded.normals,
    colours: shaded.colours,
    uvs: shaded.uvs,
    joints: shaded.joints,
    weights: shaded.weights,
    groups: shaded.groups,
    smooth: shaded.smooth,
    pattern: b.idx[1].length > 0 ? (patterns[0] ?? null) : null,
    bones,
  };
}
