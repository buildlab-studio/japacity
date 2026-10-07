// Counter-based random streams: docs/decisions/0001-random-streams.md.
// The nth draw of a stream depends only on the seed, the stream's name and n
// (R-ENGINE-005), so streams never disturb each other and a save stores only
// how many draws each stream has made. Only Math.imul, shifts and xor are used,
// which every JavaScript engine computes the same way.
import { mulDiv } from "./int";
import type { Random, Stream } from "./types";

/** Two to the power 32: the number of possible draws. */
export const DRAW_RANGE = 4294967296;

/** The golden-ratio step between consecutive draws of one stream. */
const STEP = 0x9e3779b9;

/** FNV-1a over the UTF-16 code units of a string. A 32-bit unsigned whole number. */
export function hashString32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The SplitMix32 output mix. A 32-bit unsigned whole number. */
export function mix32(x: number): number {
  let z = x | 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  return (z ^ (z >>> 15)) >>> 0;
}

/** The base of a stream: a hash of `seed + "/" + stream`. */
export function streamBase(seed: string, stream: string): number {
  return hashString32(`${seed}/${stream}`);
}

/**
 * The nth draw of a stream, a uint32. The stream is a plain string so the
 * world can use the same function with its own seed and names (`rate`,
 * `shock`, `rule`).
 */
export function drawAt(seed: string, stream: string, n: number): number {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`Draw position must be a whole number from 0, got ${String(n)}.`);
  // Math.imul keeps n * STEP exact modulo 2^32 for every n.
  return mix32((streamBase(seed, stream) + Math.imul(n, STEP)) >>> 0);
}

/** A whole number from 0 up to, not including, n, from one uint32 draw: floor(u32 * n / 2^32). */
export function scaleDraw(u32: number, n: number): number {
  if (!Number.isSafeInteger(n) || n < 1 || n > DRAW_RANGE) {
    throw new Error(`A draw range must be a whole number from 1 to 2^32, got ${String(n)}.`);
  }
  return mulDiv(u32, n, DRAW_RANGE);
}

/** Random draws over any set of stream names. */
export interface RandomOf<S extends string> {
  int(stream: S, n: number): number;
  between(stream: S, min: number, max: number): number;
  chance(stream: S, bp: number): boolean;
}

/**
 * A Random bound to a draw-count table. Each draw reads the stream's count,
 * draws at that position and raises the count by one. The table is changed in
 * place: the caller owns it, and the engine keeps it in its draft so a
 * rejected command drops the draws with everything else (R-ENGINE-002).
 */
export function createRandom<S extends string>(seed: string, counts: Partial<Record<S, number>>): RandomOf<S> {
  const next = (stream: S): number => {
    const n = counts[stream] ?? 0;
    counts[stream] = n + 1;
    return drawAt(seed, stream, n);
  };
  const int = (stream: S, n: number): number => scaleDraw(next(stream), n);
  return {
    int,
    between(stream, min, max) {
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) {
        throw new Error(`between needs whole numbers with min <= max, got ${String(min)} and ${String(max)}.`);
      }
      return min + int(stream, max - min + 1);
    },
    // Always draws, even at 0 or 10000, so a stream's position never depends on a chance's size.
    chance(stream, bp) {
      if (!Number.isSafeInteger(bp)) throw new Error(`A chance must be whole basis points, got ${String(bp)}.`);
      return int(stream, 10000) < bp;
    },
  };
}

/** The character's Random, over the streams named in engine.md section 6. */
export function characterRandom(seed: string, counts: Partial<Record<Stream, number>>): Random {
  return createRandom<Stream>(seed, counts);
}
