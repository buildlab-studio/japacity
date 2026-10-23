// The picture on a choice (design page 09, the pictures): a model's tile, found through the publish manifest as the
// place files are, offered at its small size and its own by the box's width (assets:pictures-sharp-at-three), or the
// emoji standing in where no model exists. Plain; the sticker's cut wraps it.
import { useMemo } from "react";

import { Glyph } from "./Glyph";
import { offer, usePublishManifest } from "./published";
import { tileOf } from "./tiles.data";

/** An id's picture, a square of `size` CSS pixels; words beside it carry the meaning, so the picture is silent to a screen reader. */
export function Tile({ of, size = 64, className }: { of: string; size?: number; className?: string }) {
  const picture = tileOf(of);
  const model = "model" in picture ? picture.model : null;
  const manifest = usePublishManifest();
  const offered = useMemo(() => (manifest === null || model === null ? null : offer(manifest, model, size)), [manifest, model, size]);
  const box = { width: `${String(size)}px`, height: `${String(size)}px` };
  // An act's glyph is drawn here, so it fetches nothing and stands in for nothing (world:fan-of-sticker-buttons).
  if ("glyph" in picture) {
    return (
      <span data-tile={of} data-glyph={picture.glyph} aria-hidden="true" className={`inline-block shrink-0 ${className ?? ""}`} style={box}>
        <Glyph glyph={picture.glyph} size={size} />
      </span>
    );
  }
  if (!("model" in picture)) {
    return (
      <span data-tile={of} data-stand-in="true" aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center leading-none select-none ${className ?? ""}`} style={{ ...box, fontSize: `${String(Math.round(size * 0.62))}px` }}>
        {picture.emoji}
      </span>
    );
  }
  return (
    <span data-tile={of} className={`inline-block shrink-0 ${className ?? ""}`} style={box}>
      {offered === null ? null : <img {...offered} alt="" width={size} height={size} draggable={false} className="block h-full w-full object-contain" />}
    </span>
  );
}
