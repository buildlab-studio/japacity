// The player's own colours on a shipped look (prologue.md R-PROLOGUE-015): a skin tone, a hair colour, a top colour
// and, on a look with a printed top, the fabric. A style is a copy's paint, never a new model and never a stat: what
// is left out stays as the look was made. Nothing here loads three, so the door's first screen stays light; the
// painting itself is in colours.ts, loaded with the scene.
import { isPaletteName, type PaletteName, paletteCss } from "@japacity/assets";
import { useSyncExternalStore } from "react";
import { listeners } from "../listeners/listeners";

export const FABRICS = ["plain", "ankara", "adire", "aso-oke"] as const;
export type Fabric = (typeof FABRICS)[number];

/** What the player changed; a part left out stays as made. */
export interface LookStyle {
  skin?: PaletteName;
  hair?: PaletteName;
  top?: PaletteName;
  fabric?: Fabric;
}

export type Part = "skin" | "hair" | "top";
export const PARTS: readonly Part[] = ["skin", "hair", "top"];

/** The swatches, each from the one palette: eight skin tones, four hair colours, eight tops. */
export const SWATCHES: Readonly<Record<Part, readonly PaletteName[]>> = {
  skin: ["skin1", "skin2", "skin3", "skin4", "skin5", "skin6", "skin7", "skin8"],
  hair: ["hair", "hairBrown", "wine", "gold"],
  top: ["indigo", "wine", "teal", "orange", "gold", "green", "charcoal", "white"],
};

/**
 * The look as made, read from its figure through the skeleton: each part's colour, or null where the look has none
 * (a head under a cap has no hair to read), and the printed top's fabric, or null where the top is plain cloth.
 */
export interface OwnColours {
  skin: PaletteName | null;
  hair: PaletteName | null;
  top: PaletteName | null;
  fabric: Exclude<Fabric, "plain"> | null;
}

/** A row's swatches: the look's own colour first where the list lacks it, so the row always starts as made. */
export function swatchesFor(part: Part, own: PaletteName | null): readonly PaletteName[] {
  const list = SWATCHES[part];
  return own === null || list.includes(own) ? list : [own, ...list];
}

/** True when nothing is changed: the look as made, which needs no paint and no photo of its own. */
export function isMade(style: LookStyle | undefined): boolean {
  return style === undefined || Object.keys(style).length === 0;
}

/** One string a style, the same for the same choices in any order: what the paint and the photo are kept under. */
export function styleKey(style: LookStyle | undefined): string {
  if (style === undefined) return "";
  return [style.skin ?? "", style.hair ?? "", style.top ?? "", style.fabric ?? ""].join("|");
}

/**
 * The style after a pick. Picking what the look was made with takes the part back to as made, so a style only ever
 * holds what differs; `undefined` takes the part back as well.
 */
export function pickStyle(style: LookStyle | undefined, own: OwnColours, part: Part | "fabric", value: string | undefined): LookStyle {
  const next: LookStyle = { ...style };
  if (part === "fabric") {
    if (value === undefined || value === own.fabric || !(FABRICS as readonly string[]).includes(value)) delete next.fabric;
    else next.fabric = value as Fabric;
    return next;
  }
  if (value === undefined || value === own[part] || !isPaletteName(value)) delete next[part];
  else next[part] = value;
  return next;
}

/** A style as read back from the device: only the parts that are a palette colour or a fabric, else nothing. */
export function readStyle(value: unknown): LookStyle | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  const style: LookStyle = {};
  for (const part of PARTS) {
    const colour = raw[part];
    if (typeof colour === "string" && isPaletteName(colour)) style[part] = colour;
  }
  if (typeof raw.fabric === "string" && (FABRICS as readonly string[]).includes(raw.fabric)) style.fabric = raw.fabric as Fabric;
  return isMade(style) ? undefined : style;
}

/** A swatch's colour for the screen. */
export const swatchCss = (name: PaletteName): string => paletteCss(name);

// What the figure on the plinth read of its look, by look: the scene writes it once a look is loaded, and the
// first screen's rows read it. Where no figure is drawn nothing is read, and the rows do not show.
const read = new Map<string, OwnColours>();
const { subscribe, notify } = listeners();

export function reportOwn(look: string, own: OwnColours): void {
  const held = read.get(look);
  if (held !== undefined && held.skin === own.skin && held.hair === own.hair && held.top === own.top && held.fabric === own.fabric) return;
  read.set(look, own);
  notify();
}

export function ownOf(look: string): OwnColours | null {
  return read.get(look) ?? null;
}

/** The look's own colours once its figure has been read, else null. */
export function useOwnColours(look: string): OwnColours | null {
  return useSyncExternalStore(
    subscribe,
    () => ownOf(look),
    () => null,
  );
}

/** Forgets every reading: for tests. */
export function forgetOwnColours(): void {
  read.clear();
  notify();
}
