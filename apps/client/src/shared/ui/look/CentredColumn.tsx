// The centred column (docs/design/09-the-games-look.md, section 2): on a laptop the band, the nudge, the thumbs, the
// toasts, the teaching cards and the phone stand in a column of phone width in the middle, and the world fills the
// screen around it. On a phone the column is the screen. Fixed along both sides, it centres itself as well.
import type { ComponentProps } from "react";

/** The column's widest, in px: a large phone's width. */
export const COLUMN_PX = 430;

export function CentredColumn({ className = "", children, ...rest }: ComponentProps<"div">) {
  return (
    <div {...rest} className={`centred-column ${className}`} data-centred-column>
      {children}
    </div>
  );
}
