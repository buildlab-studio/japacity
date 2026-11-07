// The column the door stands in on a wide screen: the start screen's and the age screen's sheets, the ways back in, the
// full screen and the trouble frame, and the door's own steps (DoorFrame), so they agree. Wider than the thumbs' lane
// where the phone and map are, at a reading width for a sheet of a title, a line, three fields and one
// button: 600 px keeps the age screen's line near seventy letters, the three fields as fields and not bars, and the
// yellow button a button. Centred, the scene filling the window around it; on a phone the column is the screen.
// On a desk (`shared/ui/desk`) the account screens' sheet docks to the left instead (account:start-screen-over-live-city).
import type { ReactNode } from "react";

import { useDesk } from "../desk";
import { CentredColumn } from "./CentredColumn";

/** The column's widest, in px. */
export const SHEET_COLUMN_PX = 600;
/** The docked sheet's width on a desk, in px: the door's panel's. */
export const SHEET_DOCK_PX = 460;

export function SheetColumn({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <CentredColumn className={`max-w-[600px] ${className}`} data-sheet-column>
      {children}
    </CentredColumn>
  );
}

/**
 * The account screens' sheet over the live city: on a desk a card docked at the left at the window's foot, so the middle of
 * the city stands clear to its right; elsewhere the centred column.
 */
export function SheetDock({ children }: { children: ReactNode }) {
  const desk = useDesk();
  if (!desk) return <SheetColumn>{children}</SheetColumn>;
  return (
    <div className="flex w-full justify-start px-4 pb-4" data-sheet-dock>
      <div className="w-[460px] max-w-full">{children}</div>
    </div>
  );
}
