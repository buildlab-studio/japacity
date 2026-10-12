// A sticker (docs/design/13-the-lively-layer.md, section 2): a picture of the thing, cut with a white edge and a soft
// shadow and tilted a few degrees, the render of the game's own model where one exists and an emoji standing in where
// none does yet. With a tint, it sits on a soft tile the colour of its kind.
import type { Tint } from "./tint";
import { TINTS } from "./tint";

export interface StickerProps {
  /** The picture: a published tile of the game's own model. */
  src?: string;
  /** The stand-in while no model exists. */
  emoji?: string;
  /** What the picture shows, for a screen reader. */
  alt: string;
  /** The picture's size in px. */
  size?: number;
  /** The tilt in degrees; a few either way. */
  tilt?: number;
  /** A soft tile behind it, the colour of its kind. */
  tint?: Tint;
  className?: string;
}

export function Sticker({ src, emoji, alt, size = 48, tilt = -5, tint, className = "" }: StickerProps) {
  const standIn = src === undefined;
  const tile = tint === undefined ? "" : `${TINTS[tint]} rounded-[16px]`;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${tile} ${className}`}
      style={tint === undefined ? undefined : { padding: Math.round(size / 4) }}
      data-sticker
      data-stand-in={standIn ? "" : undefined}
      data-tint={tint}
    >
      {/* The tilt is the element's own rotate, so a wobble's transform leaves it be. */}
      <span className="sticker-cut" style={{ rotate: `${String(tilt)}deg` }} data-sticker-cut>
        {standIn ? (
          <span role="img" aria-label={alt} style={{ fontSize: Math.round(size * 0.92) }}>
            {emoji}
          </span>
        ) : (
          <img src={src} alt={alt} width={size} height={size} draggable={false} className="block object-contain" />
        )}
      </span>
    </span>
  );
}
