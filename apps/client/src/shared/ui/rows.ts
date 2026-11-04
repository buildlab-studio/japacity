// A short list of taps in one card, as a phone's settings list them (world:phone-rises-over-scene): the card, and each row in
// it, a name with its icon and a mark at the end, the whole row the tap, at least 48 px tall (world:reach-and-read).

/** The card the rows stand in, a line between each two. */
export const ROWS_CARD = "look-card flex flex-col divide-y divide-sheet-line overflow-hidden";

/** One row of the card. */
export const ROW = "flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[16px] font-semibold active:bg-sheet-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink";
