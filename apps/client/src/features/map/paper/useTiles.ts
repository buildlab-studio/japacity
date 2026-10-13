// The published tiles the painted map stands its stickers on (design page 13, the pictures): read once from the publish
// manifest, as the Tile component reads its own, and asked for by model name.
import { useEffect, useMemo, useState } from "react";

import { assetUrl, loadManifest, type PublishManifest } from "../../../shared/three/manifest";

/** A model's tile url, or null until the manifest is read or when the model has no tile. */
export type TileUrl = (model: string) => string | null;

export function useTiles(): TileUrl {
  const [manifest, setManifest] = useState<PublishManifest | null>(null);
  useEffect(() => {
    let alive = true;
    void loadManifest()
      .then((read) => {
        if (alive) setManifest(read);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return useMemo<TileUrl>(() => (model) => (manifest === null ? null : assetUrl(manifest, `tiles/${model}.png`)), [manifest]);
}
