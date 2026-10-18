// The one palette (docs/rules/assets.md, "The palette"): the starting colours (R-ASSET-002) and the street and building additions.
// Every builder and the palette check import it from here. Values are 8-bit sRGB, as written on the page.
export const palette = {
  // Vehicles and props (the starting palette)
  danfoYellow: 0xf5b800,
  black: 0x1b1b1f,
  glass: 0x27384a,
  tyre: 0x18181a,
  hub: 0x9a9da3,
  cream: 0xfff3c4,
  red: 0xc8321e,
  white: 0xf2f2ee,
  wood: 0x9c6b3f,
  darkWood: 0x6f4a2a,
  blue: 0x2f62b5,
  green: 0x2f8f4e,
  tan: 0xc9a66b,
  seat: 0x5a2f2a,
  canvas: 0x24262b,
  tomato: 0xd9402b,
  pepper: 0x3f9b3c,
  basin: 0x2b78c2,
  // Skin, eight tones
  skin1: 0x3b2219,
  skin2: 0x4a2c20,
  skin3: 0x5c3826,
  skin4: 0x6f4530,
  skin5: 0x82543a,
  skin6: 0x966544,
  skin7: 0xab7752,
  skin8: 0xc08b63,
  // Hair and face
  hair: 0x141112,
  hairBrown: 0x2e1d14,
  lip: 0x4a1f1c,
  // Cloth
  indigo: 0x1f2a6b,
  gold: 0xd9a521,
  wine: 0x7a1f3d,
  teal: 0x1f7a78,
  orange: 0xe2711d,
  khaki: 0xb9a674,
  denim: 0x34527a,
  charcoal: 0x33353b,
  // Additions for streets and buildings
  sand: 0xd9b27c,
  asphalt: 0x4a4a4f,
  marking: 0xe9e3d2,
  sky: 0xf3d9a4,
  laterite: 0xb5653a,
  concrete: 0x9a958c,
  concreteWorn: 0x6e6a63,
  wallCream: 0xe8dcc0,
  wallCreamWorn: 0xc4b79a,
  wallPeach: 0xe9b48a,
  wallPeachWorn: 0xc58f68,
  wallMint: 0xa8d5b5,
  wallMintWorn: 0x84b092,
  wallSky: 0x9cc3d5,
  wallSkyWorn: 0x7a9fb0,
  zinc: 0xa7a9a6,
  zincRust: 0x8a4b2c,
  roofRed: 0xa3362b,
  roofBlue: 0x2f5f8a,
  roofGreen: 0x3c6e47,
  drain: 0x5b5a55,
  purple: 0x6d2b79,
  lagoon: 0x4f6f66,
} as const;

export type PaletteName = keyof typeof palette;

export const paletteNames = Object.keys(palette) as PaletteName[];

export function isPaletteName(name: string): name is PaletteName {
  return Object.hasOwn(palette, name);
}

/** The palette colour as a CSS hex string, for canvas drawing. */
export function paletteCss(name: PaletteName): string {
  return `#${palette[name].toString(16).padStart(6, "0")}`;
}

/** The palette colour as three 8-bit sRGB channels. */
export function paletteRgb(name: PaletteName): [number, number, number] {
  const value = palette[name];
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** One sRGB channel in 0..1 to linear light, as glTF vertex colours are stored. */
export function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** One linear channel in 0..1 back to sRGB in 0..1. */
export function linearToSrgb(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
}

/** The palette entry within `tolerance` on each 8-bit channel, or null. */
export function nearestPaletteName(rgb: readonly [number, number, number], tolerance = 1): PaletteName | null {
  for (const name of paletteNames) {
    const [r, g, b] = paletteRgb(name);
    if (Math.abs(r - rgb[0]) <= tolerance && Math.abs(g - rgb[1]) <= tolerance && Math.abs(b - rgb[2]) <= tolerance) {
      return name;
    }
  }
  return null;
}
