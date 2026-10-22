// The door's pictures (prologue:front-door-builds-a-person, prologue:front-door-three-screens): a look's face for the look strip and the
// life cards, its whole figure standing with a hand on the hip on the first screen and cheering on the page after
// Begin, each shot by the asset shooter from the shipped model and published as a tile (`tiles/<look>-face.png`,
// `-figure.png`, `-cheer.png`), and a model's own tile for a life's thing or a home. No three.js turntable and no drag:
// the figure is a sticker. Until the manifest is read, or where a picture is missing, the look's own small picture
// stands in. A figure in the player's own colours (prologue:player-colours-on-looks) is drawn once as a still in their place.
import { useEffect, useState } from "react";

import { assetUrl, loadManifest } from "../three/manifest";
import { type Tint, TINTS } from "../ui/lively/tint";
import { canDraw } from "./Gate";
import { lookOf } from "./looks";
import { isMade, type LookStyle, styleKey } from "./style";
import { afterPaint } from "./view";

export type Portrait = "face" | "figure" | "cheer";

/** The published URL of a file under public/assets, null until the manifest is read or when it is not published. */
function usePublished(path: string | null): string | null {
  const [url, setUrl] = useState<{ path: string; url: string | null } | null>(null);
  useEffect(() => {
    if (path === null) return;
    let alive = true;
    void loadManifest()
      .then((manifest) => {
        if (alive) setUrl({ path, url: assetUrl(manifest, path) });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [path]);
  return url !== null && url.path === path ? url.url : null;
}

/** A look's portrait as published, or the look's own small picture while it is not. */
function useLookPicture(look: string, view: Portrait): string {
  const published = usePublished(`tiles/${look}-${view}.png`);
  return published ?? lookOf(look)?.picture ?? "";
}

/** A round face sticker: the look's face in a soft disc with the cut's white rim, ringed in yellow when it is the one picked. */
export function FaceSticker({ look, size, on = false, tilt = 0, tint = "plain", className = "" }: { look: string; size: number; on?: boolean; tilt?: number; tint?: Tint; className?: string }) {
  const src = useLookPicture(look, "face");
  const own = src !== lookOf(look)?.picture;
  return (
    <span className={`face-sticker ${TINTS[tint]} ${className}`} style={{ width: size, height: size, rotate: `${String(tilt)}deg` }} data-face-sticker={look} {...(on ? { "data-on": "" } : {})} aria-hidden>
      {/* The stand-in is the whole figure, so it is drawn tall and cropped to the head. */}
      {src === "" ? null : own ? <img src={src} alt="" draggable={false} /> : <img src={src} alt="" draggable={false} style={{ height: "330%", width: "auto", left: "50%", top: "-4%", translate: "-50% 0", objectFit: "contain" }} />}
    </span>
  );
}

/** A model's tile by the model's name, `prop_laptop-desk`, cut as a sticker by the caller. */
export function ModelPicture({ model, size, className = "" }: { model: string; size: number; className?: string }) {
  const src = usePublished(`tiles/${model}.png`);
  return (
    <span className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size }} data-model={model} aria-hidden>
      {src === null ? null : <img src={src} alt="" width={size} height={size} draggable={false} className="block h-full w-full object-contain" />}
    </span>
  );
}

/**
 * How many stills are kept for the visit besides those on screen: a colour picked again, or the first screen opened
 * again from Back, shows at once. Each is an object address held until revoked, so the rest are let go.
 */
export const STILLS_KEPT = 4;
/** The stills kept, oldest first, by look, view and style. */
const drawn = new Map<string, string>();
/** How many pictures show each still now. */
const showing = new Map<string, number>();

function letGo(src: string): void {
  if (src.startsWith("blob:")) URL.revokeObjectURL(src);
}

/** Revokes the oldest stills off screen until no more than `STILLS_KEPT` are kept. */
function trim(): void {
  for (const [key, src] of drawn) {
    if (drawn.size <= STILLS_KEPT) return;
    if ((showing.get(src) ?? 0) > 0) continue;
    drawn.delete(key);
    letGo(src);
  }
}

function keepStill(key: string, src: string): void {
  const before = drawn.get(key);
  drawn.delete(key);
  drawn.set(key, src);
  if (before !== undefined && before !== src && (showing.get(before) ?? 0) === 0) letGo(before);
  trim();
}

/** Counts a still as on screen until the returned function is called, when it is revoked if no longer kept. */
function onScreen(src: string): () => void {
  showing.set(src, (showing.get(src) ?? 0) + 1);
  return () => {
    const left = (showing.get(src) ?? 1) - 1;
    if (left > 0) {
      showing.set(src, left);
      return;
    }
    showing.delete(src);
    if ([...drawn.values()].includes(src)) trim();
    else letGo(src);
  };
}

/**
 * The whole figure in the player's colours, drawn once a style as a still (prologue:player-colours-on-looks), or null while it draws,
 * as made, or where nothing can draw it: the published figure stands then. The still is an object address, revoked
 * once nothing shows it and it is not among the few kept.
 */
function useFigureInColours(look: string, style: LookStyle | undefined, view: Exclude<Portrait, "face">): string | null {
  const key = isMade(style) ? null : `${look}|${view}|${styleKey(style)}`;
  const [still, setStill] = useState<{ key: string; src: string } | null>(null);
  useEffect(() => {
    if (key === null || drawn.has(key) || !canDraw()) return;
    let alive = true;
    // Drawing holds the main thread, so the swatch's tick paints first, and of colours tapped faster than a frame only
    // the last is drawn (110 to 440 ms a colour under 4x CPU throttling).
    const wait = afterPaint(() => {
      void import("../datapage/photoRender")
        .then(({ renderFigure }) => renderFigure(`shared/person/${look}.glb`, style, view))
        .then((src) => {
          if (src === null) return;
          keepStill(key, src);
          if (alive) setStill({ key, src });
        })
        .catch(() => undefined);
    });
    return () => {
      alive = false;
      wait();
    };
    // Drawn once for each look and style; the style object may be a new one with the same choices.
  }, [key]);
  const src = key === null ? null : ((still?.key === key ? still.src : undefined) ?? drawn.get(key) ?? null);
  // The still shown is never revoked; once it is replaced or its picture unmounted it is let go unless kept.
  useEffect(() => (src === null ? undefined : onScreen(src)), [src]);
  return src;
}

/** The whole figure: the still in the player's colours where one is drawn, else the published figure, else the look's picture. */
export function FigurePicture({ look, style, view = "figure", className = "" }: { look: string; style?: LookStyle | undefined; view?: Exclude<Portrait, "face">; className?: string }) {
  const published = useLookPicture(look, view);
  const own = useFigureInColours(look, style, view);
  const src = own ?? published;
  return src === "" ? null : <img src={src} alt="" draggable={false} className={className} data-figure={look} data-figure-worn={own === null ? "made" : "own"} />;
}
