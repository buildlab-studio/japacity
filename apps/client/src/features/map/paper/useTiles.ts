// The published tiles the painted map stands its stickers on (docs/design/09-the-games-look.md, the pictures): read once from the publish
// manifest, as the Tile component reads its own, and asked for by model name and the box the sticker fills on the
// screen, so a small sticker fetches the tile's small size (assets:pictures-sharp-at-three).
import { useMemo } from "react";

import { type Offered, offer, usePublishManifest } from "../../../shared/tiles/published";

/** A model's tile offered for a box of `box` CSS pixels on the screen, or null until the manifest is read or when the model has no tile. */
export type TileUrl = (model: string, box: number) => Offered | null;

export function useTiles(): TileUrl {
  const manifest = usePublishManifest();
  return useMemo<TileUrl>(() => (model, box) => (manifest === null ? null : offer(manifest, model, box)), [manifest]);
}
