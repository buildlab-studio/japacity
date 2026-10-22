// The person built at the front door (prologue:front-door-builds-a-person, prologue:archetype-presets-answers, prologue:player-colours-on-looks): a look, a first name, an
// archetype, and the player's own colours on the look with the page's photo in them. The simulation holds none of them: they are kept on the device beside the save, under one
// key of their own, and the city and the rides draw the character in the look. Online the server keeps them with the character too, all but the photo, and its copy
// wins on this phone (account:person-kept-with-character).
import type { KeptPersonWire } from "@japacity/api";
import { doorLookOf } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

import { readStyle, styleKey, type LookStyle } from "./style";
import { browserStorage, PERSON_KEY } from "../storage/storage";

export interface KeptPerson {
  /** A shipped person's file name, `person_ada`: a whole look, never a stat. Absent where the look kept is one the game no longer ships: each reader then shows the look it shows with no person kept. */
  look?: string;
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

/** The name and the archetype a kept person needs; the look is read on its own, so a look the game no longer ships drops alone. */
function isPerson(value: unknown): value is Record<string, unknown> & Pick<KeptPerson, "name" | "archetype"> {
  if (typeof value !== "object" || value === null) return false;
  const { name, archetype } = value as Record<string, unknown>;
  return typeof name === "string" && (archetype === null || typeof archetype === "string");
}

/** A look the front door offers: a shipped person who is a passer-by, from content's one list, which the server reads too. */
function isLook(id: string): boolean {
  return doorLookOf(id) !== null;
}

/** The person kept on this device, or null when none is, or what is kept cannot be read. */
export function readPerson(storage: Read | null = browserStorage()): KeptPerson | null {
  try {
    const raw = storage?.getItem(PERSON_KEY) ?? null;
    return raw === null ? null : personFrom(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** A person read from what was kept or sent; a look the game no longer ships drops alone. */
function personFrom(parsed: unknown): KeptPerson | null {
  if (!isPerson(parsed)) return null;
  const { name, archetype } = parsed;
  // A look the game no longer ships (an old `chr_` name, any name not of the looks) is dropped, never the person with it.
  const look = typeof parsed.look === "string" && isLook(parsed.look) ? parsed.look : undefined;
  const style = readStyle(parsed.style);
  // A photo is kept as made too; one drawn in a style that does not read back is not the figure's.
  const drawnAs = style !== undefined || parsed.style === undefined;
  const photo = drawnAs && typeof parsed.photo === "string" && PHOTO.test(parsed.photo) ? parsed.photo : undefined;
  const photoPx = photo !== undefined && typeof parsed.photoPx === "number" && Number.isInteger(parsed.photoPx) && parsed.photoPx > 0 ? parsed.photoPx : undefined;
  return { ...(look === undefined ? {} : { look }), name, archetype, ...(style === undefined ? {} : { style }), ...(photo === undefined ? {} : { photo }), ...(photoPx === undefined ? {} : { photoPx }) };
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

/**
 * account:person-kept-with-character: the person to keep with a new character, as it travels: never the photo, which each phone
 * draws again; none where no look the game ships is kept, since the server keeps only a whole person.
 */
export function personToSend(storage: Read | null = browserStorage()): KeptPersonWire | null {
  const kept = readPerson(storage);
  if (kept?.look === undefined) return null;
  return { name: kept.name, look: kept.look, archetype: kept.archetype, ...(kept.style === undefined ? {} : { style: kept.style }) };
}

/**
 * account:person-kept-with-character: the person the server keeps with the character, taken onto this phone. It fills a phone
 * that keeps none and wins on any difference; the photo stays only while it was drawn of the same look in the same colours,
 * else the page draws it again. False when what was sent is not a person.
 */
export function adoptPerson(sent: unknown, storage: (Read & Write) | null = browserStorage()): boolean {
  const read = personFrom(sent);
  if (read === null) return false;
  const wire: KeptPerson = { ...(read.look === undefined ? {} : { look: read.look }), name: read.name, archetype: read.archetype, ...(read.style === undefined ? {} : { style: read.style }) };
  const kept = readPerson(storage);
  const drawnAlike = kept !== null && kept.look === wire.look && styleKey(kept.style) === styleKey(wire.style);
  if (drawnAlike && kept.name === wire.name && kept.archetype === wire.archetype) return true;
  const photo = drawnAlike && kept.photo !== undefined ? { photo: kept.photo, ...(kept.photoPx === undefined ? {} : { photoPx: kept.photoPx }) } : {};
  keepPerson({ ...wire, ...photo }, storage);
  return true;
}

/** The kept look as a shipped file, `shared/person/person_ada.glb`, or null when no look is kept. */
export function keptLookFile(storage: Read | null = browserStorage()): string | null {
  const look = readPerson(storage)?.look;
  return look === undefined ? null : `shared/person/${look}.glb`;
}

/** The style the kept person wears on a look's file, `shared/person/person_ada.glb`; none where that is not their look. */
export function keptStyleOf(file: string, storage: Read | null = browserStorage()): LookStyle | undefined {
  const person = readPerson(storage);
  return person?.look !== undefined && `shared/person/${person.look}.glb` === file ? person.style : undefined;
}

/**
 * The player's first name for the life on screen (prologue:front-door-builds-a-person): the one given at the door, kept beside the save.
 * A ready life has no name of its own (scenario.md), so with none given there is none. No computer person carries it
 * (person:one-mixed-name-pool).
 */
export function playerName(view: Pick<PlayerView, "scenario"> | null, storage: Read | null = browserStorage()): string | null {
  if (view === null) return null;
  const given = readPerson(storage)?.name.trim() ?? "";
  return given !== "" ? given : null;
}
