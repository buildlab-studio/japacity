// The column the door stands in on a wide screen: the start screen's and the age screen's sheets, the ways back in, the
// full screen and the trouble frame, and the door's own steps (DoorFrame), so they agree. Wider than the thumbs' lane, at a reading width for a sheet of a title, a line, three fields and one
// button: 600 px keeps the age screen's line near seventy letters, the three fields as fields and not bars, and the
// yellow button a button. Centred, the scene filling the window around it; on a phone the column is the screen.
import type { ReactNode } from "react";

import { CentredColumn } from "./CentredColumn";

/** The column's widest, in px. */
export const SHEET_COLUMN_PX = 600;

export function SheetColumn({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <CentredColumn className={`max-w-[600px] ${className}`} data-sheet-column>
      {children}
    </CentredColumn>
  );
}
