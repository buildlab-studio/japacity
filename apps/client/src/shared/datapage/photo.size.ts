// How big the page's photo is drawn (prologue:player-colours-on-looks): at the size the box shows
// it, times the screen's pixel ratio, so one drawn pixel is one pixel on the glass; and small enough to keep with the
// person beside the save on the device.

/** The photo box on the page, in CSS pixels: the photo is drawn for exactly this. */
export const PHOTO_BOX = { width: 98, height: 128 } as const;
/** The fewest screen pixels for one CSS pixel the photo is drawn at, whatever the screen. */
const RATIO_MIN = 2;
/** The most: the sharpest phone screens. */
const RATIO_MAX = 3;
/** The fewest pixels across a photo is drawn at. */
export const PHOTO_MIN_PX = PHOTO_BOX.width * RATIO_MIN;
/**
 * The most a photo's data address may hold, in characters (about 190 KB). The person is kept in the device's storage
 * beside the save (shared/front-door/person.ts), which holds a few megabytes for the whole site; a photo stays a small share of it.
 */
export const PHOTO_MAX_CHARS = 256_000;

/** The screen's pixel ratio held to 2 to 3; 2 where it is not a number. */
function heldRatio(pixelRatio: number): number {
  return Number.isFinite(pixelRatio) ? Math.min(RATIO_MAX, Math.max(RATIO_MIN, pixelRatio)) : RATIO_MIN;
}

/** The pixels across a photo is drawn at on a screen of this pixel ratio: the box's width times the ratio, 2 to 3. */
export function photoWidth(pixelRatio: number): number {
  return Math.ceil(PHOTO_BOX.width * heldRatio(pixelRatio));
}

/** The photo's height in pixels for its width, in the box's shape. */
export function photoHeight(width: number): number {
  return Math.round((width * PHOTO_BOX.height) / PHOTO_BOX.width);
}

/** True when a kept photo of this width is as sharp as this screen wants; a photo kept without its width was drawn small. */
export function sharpEnough(keptPx: number | undefined, pixelRatio: number): boolean {
  return keptPx !== undefined && keptPx >= photoWidth(pixelRatio);
}
