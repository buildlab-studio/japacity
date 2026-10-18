// A sticker chip (docs/design/09-the-lively-layer.md, section 2): cost, time and effect as a tilted pill with the
// sticker's white edge ("₦1,500", "A morning", "+Belly"), in the tint of its kind or white.
import type { ReactNode } from "react";

import type { Tint } from "./tint";
import { TINTS } from "./tint";

export interface StickerChipProps {
  tint?: Tint;
  /** The tilt in degrees; a little either way. */
  tilt?: number;
  className?: string;
  children: ReactNode;
}

export function StickerChip({ tint, tilt = -2, className = "", children }: StickerChipProps) {
  return (
    <span className={`sticker-chip ${tint === undefined ? "bg-sheet-2" : TINTS[tint]} ${className}`} style={{ rotate: `${String(tilt)}deg` }} data-sticker-chip data-tint={tint}>
      {children}
    </span>
  );
}
