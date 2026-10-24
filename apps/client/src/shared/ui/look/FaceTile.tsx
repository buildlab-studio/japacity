// A look's face as a round sticker, the door's published face tile (`tiles/<look>-face.webp`), for a line that names a
// player by the name it shows (city:board-line-and-ranking, moderation:blocked-list-in-settings). Drawn here, not with the
// door's own sticker (shared/front-door/LookPicture.tsx), so a chunk that draws it stays clear of the door's colours and the
// city's models: a module shared with those regroups the first visit's chunks (engine:first-download-has-budget).
import { useEffect, useState } from "react";

import { assetUrl, loadManifest } from "../../three/manifest";
import { type Tint, TINTS } from "./tint";

export function FaceTile({ look, tint = "plain", tilt = 0, size = 36 }: { look: string; tint?: Tint; tilt?: number; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void loadManifest()
      .then((manifest) => {
        if (alive) setSrc(assetUrl(manifest, `tiles/${look}-face.webp`));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [look]);
  return (
    <span className={`face-sticker ${TINTS[tint]}`} style={{ width: size, height: size, rotate: `${String(tilt)}deg` }} data-face-sticker={look} aria-hidden>
      {src === null ? null : <img src={src} alt="" draggable={false} />}
    </span>
  );
}
