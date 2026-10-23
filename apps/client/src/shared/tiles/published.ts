// The interface's pictures as published (assets:pictures-shipped-light, assets:pictures-sharp-at-three): each a WebP
// under tiles, found through the publish manifest. A model's tile is published twice, at 512 pixels and small at 192,
// and a thing the send-off draws large once more as a poster; the browser is offered every size there is by its width,
// with the box the picture fills, so a small box fetches the small one and a large box the one that is sharp there.
import { useEffect, useState } from "react";

import { assetUrl, loadManifest, type PublishManifest } from "../three/manifest";

/** The pixels across each size (tools/assets/shoot.ts TILE_SHOT and POSTER_SHOT, tools/assets/webp.ts SMALL). */
export const SMALL_PX = 192;
export const TILE_PX = 512;
export const POSTER_PX = 896;

/** A published picture's path under public/assets, by its name: `prop_radio`, `person_ada-face`, `prop_bus-shelter-poster`. */
export function picturePath(name: string): string {
  return `tiles/${name}.webp`;
}

/** What an image is given: its source, and where more than one size is published, every size offered by width for its box. */
export interface Offered {
  srcSet?: string;
  sizes?: string;
  src: string;
}

/**
 * A picture offered for a box of `box` CSS pixels across (after any scale it is drawn at): its small size, itself and,
 * where asked, its poster, each where published; null when the picture itself is not. A box not known gets the picture
 * alone. The choice comes before the source, so the browser picks once.
 */
export function offer(manifest: PublishManifest, name: string, box: number | null, poster = false): Offered | null {
  const src = assetUrl(manifest, picturePath(name));
  if (src === null) return null;
  const sizes: [string | null, number][] = [
    [assetUrl(manifest, picturePath(`${name}-small`)), SMALL_PX],
    [src, TILE_PX],
    [poster ? assetUrl(manifest, picturePath(`${name}-poster`)) : null, POSTER_PX],
  ];
  const offered = sizes.filter((size): size is [string, number] => size[0] !== null);
  if (box === null || offered.length < 2) return { src };
  return { srcSet: offered.map(([url, width]) => `${url} ${String(width)}w`).join(", "), sizes: `${String(Math.ceil(box))}px`, src };
}

/** The publish manifest once it is read, null before (or where it cannot be read). */
export function usePublishManifest(): PublishManifest | null {
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
  return manifest;
}
