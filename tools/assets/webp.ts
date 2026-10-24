// The pictures the interface shows are published as WebP (assets:pictures-shipped-light): lossy at quality 85, the
// transparency kept whole (its own channel stored losslessly, never quantised), from the shooter's PNG renders, which
// stay the source of truth beside each model. A tile the map, the phone and the fans draw small is published a second
// time at a small size, so a small box never fetches the large one (assets:pictures-sharp-at-three).
import sharp from "sharp";

/** The encoder's settings: quality 85, the alpha channel lossless, and the encoder's search at 5 of 6 (6 saves under 2% more at twenty times the time). */
export const WEBP = { quality: 85, alphaQuality: 100, effort: 5 } as const;

/**
 * A tile's small size, in pixels across: three times the largest small box a tile fills (64 CSS pixels, a choice's
 * tile at its default size; the map, the phone's apps, the fans and the ride sheets draw them at 11 to 60). Drawn down
 * with the two-lobe Lanczos kernel, sharp but without the three-lobe's ringing round a cut edge, which costs a third
 * more bytes in the transparency.
 */
export const SMALL = { width: 192, kernel: "lanczos2" } as const;
/** The small size's name beside the picture's own: `prop_radio-small.webp` beside `prop_radio.webp`. */
export const SMALL_SUFFIX = "-small";

/** A render as published: WebP, at its own size, or drawn down to the small size. */
export async function toWebp(png: Uint8Array, small = false): Promise<Buffer> {
  const image = sharp(png);
  return (small ? image.resize({ width: SMALL.width, kernel: SMALL.kernel, withoutEnlargement: true }) : image).webp(WEBP).toBuffer();
}

interface Pixels {
  data: Buffer;
  width: number;
  height: number;
}

async function pixelsOf(image: ReturnType<typeof sharp>): Promise<Pixels> {
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * How far a published picture may stray from its render: the mean difference of each colour channel, weighted by
 * the cover (so what shows counts, and colour under a clear pixel does not), in steps of 255. On the shipped
 * renders quality 85 strays 1.3 to 6.5 (the busiest face), the small sizes up to 6.3; a different render has a
 * different cover and fails on the transparency first.
 */
export const MAX_DRIFT = 10;
/** How far the transparency of a small size may stray from the render drawn down, a pixel at a time: the resampling's rounding. */
export const MAX_SMALL_ALPHA_STEP = 2;

/** The WebP chunks a file holds, by their four letters, with each chunk's body. */
export function webpChunks(file: Uint8Array): Map<string, Uint8Array> | null {
  const bytes = Buffer.from(file);
  if (bytes.length < 12 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunks = new Map<string, Uint8Array>();
  for (let at = 12; at + 8 <= bytes.length; ) {
    const kind = bytes.toString("ascii", at, at + 4);
    const size = bytes.readUInt32LE(at + 4);
    chunks.set(kind, bytes.subarray(at + 8, at + 8 + size));
    at += 8 + size + (size % 2);
  }
  return chunks;
}

/**
 * What is wrong with a published picture as WebP, or null: it must be a WebP, lossy (a `VP8 ` chunk, not the lossless
 * `VP8L`), and where it has transparency, the `ALPH` chunk stored losslessly with no preprocessing (the format's level
 * reduction, which an alpha quality under 100 turns on).
 */
export function webpProblem(file: Uint8Array): string | null {
  const chunks = webpChunks(file);
  if (chunks === null) return "is not a WebP";
  if (!chunks.has("VP8 ")) return chunks.has("VP8L") ? "is lossless WebP, not lossy" : "holds no picture";
  const alpha = chunks.get("ALPH");
  if (alpha === undefined) return null;
  const header = alpha[0] ?? 0;
  if ((header & 0b11) !== 1) return "stores its transparency lossy";
  if (((header >> 4) & 0b11) !== 0) return "has its transparency quantised";
  return null;
}

/**
 * What is wrong with a published picture against the render it was made from, or null: the same size as the render
 * (or the render drawn down to the small size), the transparency the same pixel for pixel at its own size, and the
 * colour within `MAX_DRIFT`. A picture of something else, or a render stretched or shrunk, fails.
 */
export async function drawnFrom(published: Uint8Array, render: Uint8Array, small = false): Promise<string | null> {
  const format = webpProblem(published);
  if (format !== null) return format;
  const shown = await pixelsOf(sharp(published));
  const source = await pixelsOf(small ? sharp(render).resize({ width: SMALL.width, kernel: SMALL.kernel, withoutEnlargement: true }) : sharp(render));
  if (shown.width !== source.width || shown.height !== source.height) return `is ${String(shown.width)} by ${String(shown.height)}, its render ${small ? "drawn down " : ""}${String(source.width)} by ${String(source.height)}`;
  let alphaStep = 0;
  let apart = 0;
  let cover = 0;
  for (let at = 0; at < shown.data.length; at += 4) {
    const a = shown.data[at + 3] ?? 0;
    const b = source.data[at + 3] ?? 0;
    alphaStep = Math.max(alphaStep, Math.abs(a - b));
    cover += Math.max(a, b) / 255;
    for (let channel = 0; channel < 3; channel += 1) apart += Math.abs((shown.data[at + channel] ?? 0) * a - (source.data[at + channel] ?? 0) * b) / 255;
  }
  const drift = cover === 0 ? 0 : apart / (cover * 3);
  if (alphaStep > (small ? MAX_SMALL_ALPHA_STEP : 0)) return `has its transparency changed by up to ${String(alphaStep)} of 255`;
  if (drift > MAX_DRIFT) return `strays ${drift.toFixed(1)} of 255 from its render, over ${String(MAX_DRIFT)}`;
  return null;
}
