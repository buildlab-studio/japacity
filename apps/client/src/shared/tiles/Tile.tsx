// The picture on a choice (design page 13, the pictures): a model's tile, found through the publish manifest as the
// place files are, or the emoji standing in where no model exists. Plain; the sticker's cut wraps it.
import { useEffect, useState } from "react";

import { assetUrl, loadManifest } from "../three/manifest";
import { Glyph } from "./Glyph";
import { tileOf } from "./tiles.data";

/** The published URL of a model's tile, null until the manifest is read or when it is not published. */
function useTileUrl(model: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (model === null) return;
    let alive = true;
    void loadManifest()
      .then((manifest) => {
        if (alive) setUrl(assetUrl(manifest, `tiles/${model}.png`));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [model]);
  return model === null ? null : url;
}

/** An id's picture, a square of `size` CSS pixels; words beside it carry the meaning, so the picture is silent to a screen reader. */
export function Tile({ of, size = 64, className }: { of: string; size?: number; className?: string }) {
  const picture = tileOf(of);
  const model = "model" in picture ? picture.model : null;
  const url = useTileUrl(model);
  const box = { width: `${String(size)}px`, height: `${String(size)}px` };
  // An act's glyph is drawn here, so it fetches nothing and stands in for nothing (R-WORLD-034).
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
      {url === null ? null : <img src={url} alt="" width={size} height={size} draggable={false} className="block h-full w-full object-contain" />}
    </span>
  );
}
