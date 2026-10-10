// How big the page's photo is drawn (prologue.md R-PROLOGUE-015): sharp on the screen it is seen on, and small
// enough to keep with the person beside the save on the device.

/** The photo box's width the photo is drawn for, in CSS pixels: the box on the page is 98 by 128, so this leaves room to spare. */
export const PHOTO_CSS_WIDTH = 160;
/** The photo box's shape, height over width, as the box on the page (98 by 128). */
const SHAPE = 224 / 172;
/** The fewest pixels across a photo is drawn at, whatever the screen: twice the width above. */
export const PHOTO_MIN_PX = PHOTO_CSS_WIDTH * 2;
/** The most pixels across: three times the width above, the sharpest phone screens. */
const PHOTO_MAX_PX = PHOTO_CSS_WIDTH * 3;
/**
 * The most a photo's data address may hold, in characters (about 190 KB). The person is kept in the device's storage
 * beside the save (authority/person.ts), which holds a few megabytes for the whole site; a photo stays a small share of it.
 */
export const PHOTO_MAX_CHARS = 256_000;

/** The pixels across a photo is drawn at on a screen of this pixel ratio: the box's width times the ratio, 2 to 3. */
export function photoWidth(pixelRatio: number): number {
  const ratio = Number.isFinite(pixelRatio) ? pixelRatio : 1;
  return Math.min(PHOTO_MAX_PX, Math.max(PHOTO_MIN_PX, Math.ceil(PHOTO_CSS_WIDTH * ratio)));
}

/** The photo's height in pixels for its width, in the box's shape. */
export function photoHeight(width: number): number {
  return Math.round(width * SHAPE);
}

/** True when a kept photo of this width is as sharp as this screen wants; a photo kept without its width was drawn small. */
export function sharpEnough(keptPx: number | undefined, pixelRatio: number): boolean {
  return keptPx !== undefined && keptPx >= photoWidth(pixelRatio);
}
