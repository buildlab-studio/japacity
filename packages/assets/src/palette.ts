// The one palette (docs/rules/assets.md, "The palette"): the design's colours and the street and building additions.
// Filled by the pipeline work from the page's tables; every builder and the palette check import it from here.
export const palette = {
  danfoYellow: 0xf5b800,
} as const;

export type PaletteName = keyof typeof palette;
