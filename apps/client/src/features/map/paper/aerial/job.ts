// The aerial layout of Lagos as a job the map's views share (world:map-is-painted-lagos): laid once for the page, in
// idle slices, the skeleton first and then square by square, the squares a view shows before the rest (the view that
// asks most first, nearest its middle first). It runs only while some view wants it, so it never takes time from the
// world when the map is put away. A view reads the squares laid so far and is told when more are laid.
import { CELL, groundOf } from "../draw";
import type { Ground } from "../scatter";
import { type AerialTuning, AERIAL, laySkeleton, layBlocks, laySquare, type Quad, type Skeleton, type Square, squareKey } from "./layout";
import { clock, later as idle, type Later, runUntil } from "./slices";

/** A part of the paper a view shows, [x0, y0, x1, y1], and how much it matters (the card in front and the open map most). */
export interface Want {
  box: readonly [number, number, number, number];
  weight: number;
}

/** How far the layout has come: the squares laid of all there are (none known before the skeleton), and what they hold. */
export interface Progress {
  laid: number;
  total: number;
  roofs: number;
  windows: number;
  /** The letters of path data the squares hold, the time the slices took in all and the longest of them, in milliseconds. */
  letters: number;
  busy: number;
  longest: number;
}

export interface AerialJob {
  /** The squares laid so far, by key; the same map until a square is added, then a new one. */
  squares: () => ReadonlyMap<string, Square>;
  /** In what turn a square was laid (the first is 1), so a view drawn before that turn fades it in; 0 for one not laid. */
  laidAt: (key: string) => number;
  /** Whether every square is laid. */
  done: () => boolean;
  progress: () => Progress;
  want: (id: string, want: Want) => void;
  unwant: (id: string) => void;
  subscribe: (listener: () => void) => () => void;
  /** How long each slice ran, in the job's clock: for the tests and the measures. */
  slices: () => readonly number[];
}

export interface JobOptions {
  later?: Later;
  now?: () => number;
  /** Tells the views in a task of its own, so a view's drawing never lengthens a slice. */
  defer?: (run: () => void) => void;
  tuning?: AerialTuning;
}

export function aerialJob(ground: () => Ground, { later = idle, now = clock, defer = (run) => void setTimeout(run, 0), tuning = AERIAL }: JobOptions = {}): AerialJob {
  let squares: ReadonlyMap<string, Square> = new Map();
  const laid = new Map<string, number>();
  const wants = new Map<string, Want>();
  const listeners = new Set<() => void>();
  const slices: number[] = [];
  let skeleton: Skeleton | null = null;
  let blocks = new Map<string, Quad[]>();
  let finished = false;
  let total = 0;
  let roofs = 0;
  let windows = 0;
  let letters = 0;
  let cancel: (() => void) | null = null;
  let telling = false;

  function* blocksOf(sx: number, sy: number): Generator<undefined, Quad[]> {
    const key = squareKey(sx, sy);
    const kept = blocks.get(key);
    if (kept !== undefined) return kept;
    if (skeleton === null) return [];
    const made = yield* layBlocks(skeleton, sx, sy, tuning);
    blocks.set(key, made);
    return made;
  }

  /** The next square to lay: the one a view wants most, nearest that view's middle; else the nearest any view; else the first left. */
  function pick(all: readonly (readonly [number, number])[]): readonly [number, number] | null {
    let best: readonly [number, number] | null = null;
    let score = -Infinity;
    for (const square of all) {
      if (squares.has(squareKey(square[0], square[1]))) continue;
      const x0 = square[0] * CELL;
      const y0 = square[1] * CELL;
      const mx = x0 + CELL / 2;
      const my = y0 + CELL / 2;
      let here = -1e9;
      for (const { box, weight } of wants.values()) {
        const shown = x0 < box[2] && x0 + CELL > box[0] && y0 < box[3] && y0 + CELL > box[1];
        const away = Math.hypot(mx - (box[0] + box[2]) / 2, my - (box[1] + box[3]) / 2);
        here = Math.max(here, (shown ? weight * 1e6 : 0) - away);
      }
      if (here > score) {
        score = here;
        best = square;
      }
    }
    return best;
  }

  function* work(): Generator<undefined> {
    const laidSkeleton = yield* laySkeleton(ground(), tuning);
    skeleton = laidSkeleton;
    total = laidSkeleton.squares.length;
    for (;;) {
      const square = pick(laidSkeleton.squares);
      if (square === null) break;
      const made = yield* laySquare(laidSkeleton, square[0], square[1], blocksOf, tuning);
      const next = new Map(squares);
      next.set(made.key, made);
      squares = next;
      laid.set(made.key, squares.size);
      roofs += made.count.roofs;
      windows += made.count.windows;
      letters += made.lanes.length + made.waves.length + made.windows.length + made.roofs.reduce((sum, path) => sum + path.length, 0);
      tell();
    }
    // Every square is laid: only their paths are kept.
    skeleton = null;
    blocks = new Map();
    finished = true;
  }

  const job = work();

  function tell(): void {
    if (telling) return;
    telling = true;
    defer(() => {
      telling = false;
      for (const listener of [...listeners]) listener();
    });
  }

  function slice(left: number): void {
    cancel = null;
    const start = now();
    const { more, at } = runUntil(job, start + left, now);
    slices.push(at - start);
    if (more && wants.size > 0) cancel = later(slice);
  }

  function run(): void {
    if (finished || cancel !== null || wants.size === 0) return;
    cancel = later(slice);
  }

  return {
    squares: () => squares,
    laidAt: (key) => laid.get(key) ?? 0,
    done: () => finished,
    progress: () => ({ laid: squares.size, total, roofs, windows, letters, busy: slices.reduce((sum, ms) => sum + ms, 0), longest: Math.max(0, ...slices) }),
    want(id, want) {
      wants.set(id, want);
      run();
    },
    unwant(id) {
      wants.delete(id);
      if (wants.size === 0 && cancel !== null) {
        cancel();
        cancel = null;
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    slices: () => slices,
  };
}

let lagos: AerialJob | null = null;

/** Lagos's aerial layout, made the first time a view asks for it and kept for the page. */
export function lagosAerial(): AerialJob {
  lagos ??= aerialJob(groundOf);
  return lagos;
}
