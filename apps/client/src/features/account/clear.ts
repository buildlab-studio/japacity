// Whether the screen is clear for an ask or an offer that waits its turn over the world: the keep-this-life ask
// (account:guest-secures-the-life) and the card that offers a passkey after a way in (account:passkey-offered-where-it-works).

/** How often an ask or offer that is due looks again for the sheet or card over it to close. */
export const CLEAR_EVERY_MS = 500;

/**
 * Another sheet or card is up (a chapter's opening, an ask, the results), or the first brief's card is still waiting for
 * the place's first frame (its pending mark, chapter:first-chapter-mission-card): an ask or offer waits for it to close.
 */
export function otherSheetUp(): boolean {
  return typeof document !== "undefined" && document.querySelector('[role="dialog"][data-open], [data-brief-pending]') !== null;
}

/**
 * A teach card stands open over the world (the home's card or the first night's): the keep-this-life ask waits for it to be
 * dismissed, as for a sheet (account:guest-secures-the-life).
 */
export function teachUp(): boolean {
  return typeof document !== "undefined" && document.querySelector("[data-home-teach], [data-night-teach]") !== null;
}
