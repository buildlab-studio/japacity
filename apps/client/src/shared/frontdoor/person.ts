// The person built at the front door (prologue:front-door-builds-a-person, prologue:archetype-presets-answers, prologue:player-colours-on-looks): a look, a first name, an
// archetype, and the player's own colours on the look with the page's photo in them. The simulation holds none of them: they are kept on the device beside the save, under one
// key of their own, and the city and the rides draw the character in the look.
import { text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

import { readStyle, type LookStyle } from "./style";
import { browserStorage, PERSON_KEY } from "../kept/storage";

export interface KeptPerson {
  /** A shipped person's file name, `person_ada`: a whole look, never a stat. */
  look: string;
  /** The character's first name, from the pool. Never the account's. */
  name: string;
  /** The archetype whose preset the prologue plays, or null for a ready life. */
  archetype: string | null;
  /** The player's own colours on the look (prologue:player-colours-on-looks); absent as made. Paint only, never a stat. */
  style?: LookStyle;
  /** The page's photo: the figure rendered in its colours, or as made, as an image's data address; absent where nothing could draw it. */
  photo?: string;
  /** The photo's width in pixels as drawn. A photo kept without it was drawn small and is drawn again, sharper. */
  photoPx?: number;
}

/** A photo kept with the person: a small image of its own, never an address elsewhere. */
const PHOTO = /^data:image\/(png|webp|jpeg);base64,/;

type Read = Pick<Storage, "getItem">;
type Write = Pick<Storage, "setItem">;

function isPerson(value: unknown): value is KeptPerson {
  if (typeof value !== "object" || value === null) return false;
  const { look, name, archetype } = value as Record<string, unknown>;
  return typeof look === "string" && /^person_[a-z_]+$/.test(look) && typeof name === "string" && (archetype === null || typeof archetype === "string");
}

/** The person kept on this device, or null when none is, or what is kept cannot be read. */
export function readPerson(storage: Read | null = browserStorage()): KeptPerson | null {
  try {
    const raw = storage?.getItem(PERSON_KEY) ?? null;
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isPerson(parsed)) return null;
    const { look, name, archetype } = parsed;
    const style = readStyle(parsed.style);
    // A photo is kept as made too; one drawn in a style that does not read back is not the figure's.
    const drawnAs = style !== undefined || parsed.style === undefined;
    const photo = drawnAs && typeof parsed.photo === "string" && PHOTO.test(parsed.photo) ? parsed.photo : undefined;
    const photoPx = photo !== undefined && typeof parsed.photoPx === "number" && Number.isInteger(parsed.photoPx) && parsed.photoPx > 0 ? parsed.photoPx : undefined;
    return { look, name, archetype, ...(style === undefined ? {} : { style }), ...(photo === undefined ? {} : { photo }), ...(photoPx === undefined ? {} : { photoPx }) };
  } catch {
    return null;
  }
}

/** False when a private window refused storage: the person then lasts the visit only. */
export function keepPerson(person: KeptPerson, storage: Write | null = browserStorage()): boolean {
  try {
    storage?.setItem(PERSON_KEY, JSON.stringify(person));
    return storage !== null;
  } catch {
    return false;
  }
}

/** The kept look as a shipped file, `shared/person/person_ada.glb`, or null when no look is kept. */
export function keptLookFile(storage: Read | null = browserStorage()): string | null {
  const person = readPerson(storage);
  return person === null ? null : `shared/person/${person.look}.glb`;
}

/** The style the kept person wears on a look's file, `shared/person/person_ada.glb`; none where that is not their look. */
export function keptStyleOf(file: string, storage: Read | null = browserStorage()): LookStyle | undefined {
  const person = readPerson(storage);
  return person !== null && `shared/person/${person.look}.glb` === file ? person.style : undefined;
}

/**
 * The player's first name for the life on screen (prologue:front-door-builds-a-person): the one given at the door, kept beside the save, else
 * a ready life's own. No computer person carries it (person:one-mixed-name-pool).
 */
export function playerName(view: Pick<PlayerView, "scenario"> | null, storage: Read | null = browserStorage()): string | null {
  if (view === null) return null;
  const given = readPerson(storage)?.name.trim() ?? "";
  if (given !== "") return given;
  return text[`share.first-name.${view.scenario}`] ?? null;
}
