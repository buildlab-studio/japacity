// The phone's apps in the lively dress (docs/design/13-the-lively-layer.md section 2): a
// card is white with the thin edge, a picture of the thing on a soft tile at its left, a title of a few words, one line
// under it, and the chips that earn their place (money in green, a word in a pill). A way out of the app (to the map, to
// another app) is a white button with the navy underside; the one yellow action stays each surface's own.
import type { ComponentProps, ReactNode } from "react";

import { Tile } from "../../shared/tiles/Tile";
import type { Tint } from "../../shared/ui/lively/tint";
import { TINTS } from "../../shared/ui/lively/tint";

/** A thing's picture on its soft tile, cut as a sticker: the tile of the id, tilted a little. */
export function PicTile({ of, size = 64, tint = "plain", tilt = -5 }: { of: string; size?: number; tint?: Tint; tilt?: number }) {
  const picture = Math.round(size * 0.7);
  return (
    <span className={`phone-pic flex shrink-0 items-center justify-center ${TINTS[tint]}`} style={{ width: size, height: size }} aria-hidden data-pic={of}>
      <span className="sticker-cut" style={{ rotate: `${String(tilt)}deg` }}>
        <Tile of={of} size={picture} />
      </span>
    </span>
  );
}

export interface PicCardProps extends Omit<ComponentProps<"div">, "title"> {
  /** The id whose tile is the card's picture; none leaves the picture out. */
  pic?: string;
  tint?: Tint;
  /** A small line over the title: who or what it is from. */
  over?: ReactNode;
  title: ReactNode;
  line?: ReactNode;
  /** The chips under the line. */
  chips?: ReactNode;
  /** What stands at the right: a pill, an arrow. */
  side?: ReactNode;
  /** The card picked, with the yellow ring. */
  picked?: boolean;
  /** What follows under the card's row, inside it: a button, a list. */
  foot?: ReactNode;
  muted?: boolean;
}

/** A card of an app: the picture, the words, the chips, and anything at its side or its foot. */
export function PicCard({ pic, tint = "plain", over, title, line, chips, side, picked = false, foot, muted = false, className = "", ...rest }: PicCardProps) {
  return (
    <div {...rest} className={`lively-card p-3 ${picked ? "phone-picked" : ""} ${muted ? "opacity-70" : ""} ${className}`} data-lively-card data-picked={picked ? "true" : undefined}>
      <div className="flex items-center gap-3">
        {pic === undefined ? null : <PicTile of={pic} tint={tint} size={60} />}
        <div className="min-w-0 flex-1">
          {over === undefined || over === null ? null : <p className="truncate text-[13px] font-semibold text-text-2">{over}</p>}
          <p className="text-[18px] leading-tight font-bold">{title}</p>
          {line === undefined || line === null ? null : <div className="mt-0.5 text-[14px] leading-snug text-text-2">{line}</div>}
          {chips === undefined || chips === null ? null : <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{chips}</div>}
        </div>
        {side === undefined || side === null ? null : <div className="shrink-0">{side}</div>}
      </div>
      {foot === undefined || foot === null ? null : <div className="mt-2.5">{foot}</div>}
    </div>
  );
}

/** Money as a chip: green for money in or a pay, the sheet's own for money out. */
export function MoneyChip({ children, out = false, ...rest }: { children: ReactNode; out?: boolean } & ComponentProps<"span">) {
  return (
    <span {...rest} className={`sticker-chip text-[13px] ${out ? "bg-sheet-2" : "bg-tint-money"}`} style={{ rotate: "-2deg", ...(out ? {} : { color: "var(--money-ink)" }) }} data-money-chip>
      {children}
    </span>
  );
}

/** A word in a pill (a chance, a state, a count): the study blue, the soft yellow for what is carried now, red for a loss. */
export function WordChip({ children, tone = "study", ...rest }: { children: ReactNode; tone?: "study" | "soft" | "bad" | "body" | "plain" } & ComponentProps<"span">) {
  const tones = { study: "bg-tint-study", soft: "bg-[var(--soft)]", bad: "bg-sheet-2", body: "bg-tint-body", plain: "bg-sheet-2" } as const;
  const ink = tone === "soft" ? "var(--soft-ink)" : tone === "bad" ? "var(--out)" : undefined;
  return (
    // A chip may wrap inside its card rather than run out of it: the era's "Begun 27 months ago. Due to end in 3 months"
    // ran past the News card and was cut. A short chip still keeps to one line.
    <span {...rest} className={`sticker-chip chip-wrap max-w-full text-[13px] ${tones[tone]}`} style={{ rotate: "1.5deg", ...(ink === undefined ? {} : { color: ink }) }} data-word-chip={tone}>
      {children}
    </span>
  );
}

/** A way out of the app (to the map, to another app): the layer's ghost button, filling the row (`wide`). */
export { GhostButton } from "../../shared/ui/lively/GhostButton";
