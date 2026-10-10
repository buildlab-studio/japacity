// The page's photo in the player's own colours (prologue.md R-PROLOGUE-015): the figure rendered once to a small
// image when the page prints, and kept with the person, so the page in the world shows the same face. As made the
// look's own picture stands; where WebGL is missing, so does the picture. The drawing is loaded only when needed.
import { useEffect, useState } from "react";

import { keepPerson, readPerson } from "../../authority/person";
import { canDraw } from "../frontdoor/Gate";
import { isMade, type LookStyle, styleKey } from "../frontdoor/style";
import { photoWidth, sharpEnough } from "./photo.size";

/** A photo drawn and its width in pixels. */
export interface Drawn {
  photo: string;
  px: number;
}

const made = new Map<string, Drawn>();
const drawing = new Map<string, Promise<Drawn | null>>();
/** The screen's pixel ratio, 1 where there is no window. */
const ratio = (): number => (typeof window === "undefined" ? 1 : window.devicePixelRatio);

const keyOf = (look: string, style: LookStyle | undefined): string => `${look}|${styleKey(style)}`;

/** The photo already drawn for a look in a style this visit, if any. */
export function madePhoto(look: string, style: LookStyle | undefined): Drawn | undefined {
  return made.get(keyOf(look, style));
}

/** Keeps a drawn photo with the person where the person kept wears that look in that style. */
function keepWithPerson(look: string, style: LookStyle | undefined, drawn: Drawn): void {
  const person = readPerson();
  if (person === null || person.look !== look || styleKey(person.style) !== styleKey(style) || person.photo === drawn.photo) return;
  keepPerson({ ...person, photo: drawn.photo, photoPx: drawn.px });
}

function draw(look: string, style: LookStyle): Promise<Drawn | null> {
  const key = keyOf(look, style);
  const held = drawing.get(key);
  if (held !== undefined) return held;
  // Drawn at the screen's own pixels, so the photo is sharp in its box.
  const px = photoWidth(ratio());
  const started = import("./photoRender")
    .then(({ renderPhoto }) => renderPhoto(`shared/chr/${look}.glb`, style, px))
    .catch(() => null)
    .then((photo) => {
      if (photo === null) return null;
      const drawn = { photo, px };
      made.set(key, drawn);
      return drawn;
    });
  drawing.set(key, started);
  return started;
}

/**
 * The photo for a look in a style: one drawn this visit, else the one given (kept with the person), else null while
 * it draws, as made, or where nothing can draw it. A given photo kept without its width, or narrower than this screen
 * wants, is shown while a sharper one draws. A photo drawn for the kept person is kept with them.
 */
export function usePhoto(look: string | undefined, style: LookStyle | undefined, given?: string, givenPx?: number): string | null {
  const key = look === undefined || isMade(style) ? null : keyOf(look, style);
  const [photo, setPhoto] = useState<{ key: string; photo: string } | null>(null);
  const sharp = given !== undefined && sharpEnough(givenPx, ratio());
  useEffect(() => {
    if (key === null || look === undefined || style === undefined || sharp || !canDraw()) return;
    let alive = true;
    void draw(look, style).then((drawn) => {
      if (drawn === null) return;
      keepWithPerson(look, style, drawn);
      if (alive) setPhoto({ key, photo: drawn.photo });
    });
    return () => {
      alive = false;
    };
    // Drawn once for each look and style; the style object may be a new one with the same choices.
  }, [key, sharp]);
  if (key === null) return null;
  return (photo?.key === key ? photo.photo : undefined) ?? made.get(key)?.photo ?? given ?? null;
}
