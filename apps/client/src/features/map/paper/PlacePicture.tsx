// A place's own picture on the painted map and the ride sheet (design page 13, the pictures): its tile from the table,
// or the emoji standing in, cut as a sticker; the passport office's counter with the flag flying behind it.
import type { CSSProperties } from "react";

import { tileOf } from "../../../shared/tiles/tiles.data";
import type { TileUrl } from "./useTiles";

/** The flag over the passport office: a pole and the green, white and green, waving. */
function Flag() {
  return (
    <svg viewBox="0 0 40 64" className="absolute" style={{ width: "68%", height: "98%", right: "-16%", top: "-22%" }} aria-hidden>
      <path d="M8,4 L8,62" stroke="#8a7a60" strokeWidth="3" strokeLinecap="round" />
      <circle cx="8" cy="4" r="2.6" fill="#e0a21b" />
      <path d="M9,7 C17,4 23,10 32,7 L32,27 C23,30 17,24 9,27 Z" fill="#ffffff" stroke="#1b2a4a" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M9,7 C12,6 14,6.4 16.5,7.2 L16.5,26.2 C14,25.6 12,25.8 9,27 Z" fill="#1f8a4c" />
      <path d="M24.5,8.6 C27,8.8 29,8.2 32,7 L32,27 C29,28 27,28.6 24.5,28.4 Z" fill="#1f8a4c" />
    </svg>
  );
}

/**
 * A place whose own picture is the kit's tile with something beside it: the passport office is a counter with the flag
 * flying behind it, so it reads apart from the bank's counter (the tile table's row is the counter alone).
 */
const FLAGGED: ReadonlySet<string> = new Set(["place.passport-office"]);

/** A place's picture: its tile from the table, or the emoji standing in; the flag behind it where it has one. */
export function PlacePicture({ id, size, tiles }: { id: string; size: number; tiles: TileUrl }) {
  const picture = tileOf(id);
  if (FLAGGED.has(id) && "model" in picture) {
    const front = tiles(picture.model);
    return (
      <span className="paper-cut relative block" style={{ width: size, height: size, ...({ "--e": "2px" } as CSSProperties) }} data-picture={`${picture.model}+flag`}>
        <Flag />
        {front === null ? null : <img src={front} alt="" draggable={false} className="absolute object-contain" style={{ width: "88%", height: "88%", left: "0", bottom: "0" }} />}
      </span>
    );
  }
  if (!("model" in picture)) {
    return (
      <span className="paper-cut flex items-center justify-center" style={{ width: size, height: size, fontSize: Math.round(size * 0.7) }} aria-hidden>
        {/* A place is a model or a stand-in, never an act's glyph (shared/tiles). */}
        {"emoji" in picture ? picture.emoji : null}
      </span>
    );
  }
  const url = tiles(picture.model);
  return <span className="paper-cut block" style={{ width: size, height: size, ...({ "--e": "2px" } as CSSProperties) }}>{url === null ? null : <img src={url} alt="" draggable={false} className="block size-full object-contain" />}</span>;
}
