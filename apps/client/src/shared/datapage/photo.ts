// The page's photo in the player's own colours (prologue.md R-PROLOGUE-015): the figure rendered once to a small
// image when the page prints, and kept with the person, so the page in the world shows the same face. As made the
// look's own picture stands; where WebGL is missing, so does the picture. The drawing is loaded only when needed.
import { useEffect, useState } from "react";

import { keepPerson, readPerson } from "../../authority/person";
import { canDraw } from "../frontdoor/Gate";
import { isMade, type LookStyle, styleKey } from "../frontdoor/style";

const made = new Map<string, string>();
const drawing = new Map<string, Promise<string | null>>();

const keyOf = (look: string, style: LookStyle | undefined): string => `${look}|${styleKey(style)}`;

/** The photo already drawn for a look in a style this visit, if any. */
export function madePhoto(look: string, style: LookStyle | undefined): string | undefined {
  return made.get(keyOf(look, style));
}

/** Keeps a drawn photo with the person where the person kept wears that look in that style. */
function keepWithPerson(look: string, style: LookStyle | undefined, photo: string): void {
  const person = readPerson();
  if (person === null || person.look !== look || styleKey(person.style) !== styleKey(style) || person.photo === photo) return;
  keepPerson({ ...person, photo });
}

function draw(look: string, style: LookStyle): Promise<string | null> {
  const key = keyOf(look, style);
  const held = drawing.get(key);
  if (held !== undefined) return held;
  const started = import("./photoRender")
    .then(({ renderPhoto }) => renderPhoto(`shared/chr/${look}.glb`, style))
    .catch(() => null)
    .then((photo) => {
      if (photo !== null) made.set(key, photo);
      return photo;
    });
  drawing.set(key, started);
  return started;
}

/**
 * The photo for a look in a style: the one given (kept with the person), else one drawn now, else null while it
 * draws, as made, or where nothing can draw it. A photo drawn for the kept person is kept with them.
 */
export function usePhoto(look: string | undefined, style: LookStyle | undefined, given?: string): string | null {
  const key = look === undefined || isMade(style) ? null : keyOf(look, style);
  const [photo, setPhoto] = useState<{ key: string; photo: string } | null>(null);
  useEffect(() => {
    if (key === null || look === undefined || style === undefined || given !== undefined || !canDraw()) return;
    let alive = true;
    void draw(look, style).then((drawn) => {
      if (drawn === null) return;
      keepWithPerson(look, style, drawn);
      if (alive) setPhoto({ key, photo: drawn });
    });
    return () => {
      alive = false;
    };
    // Drawn once for each look and style; the style object may be a new one with the same choices.
  }, [key, given]);
  if (key === null) return null;
  return given ?? (photo?.key === key ? photo.photo : (made.get(key) ?? null));
}
