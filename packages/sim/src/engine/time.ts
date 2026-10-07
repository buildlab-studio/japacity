// Real-time lengths the design gives, in milliseconds, in one place.
// The simulation never reads a clock (R-ENGINE-012), so nothing in the sim
// uses these. The authority does: the local one in the tab now, the server
// later. They are plain numbers so either can read them without a clock.

export const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** One new turn every two real hours. docs/design/01-concept.md section 9, docs/rules/turn.md "Outside the simulation". */
export const TURN_REFILL_MS = 2 * HOUR_MS;

/** Twelve new turns a real day. docs/design/01-concept.md section 9. */
export const TURNS_PER_REAL_DAY = 12;

/**
 * An empty bank refills to the cap (tuning.turn.cap, 24) in two real days.
 * docs/design/01-concept.md section 9: "two days away with nothing lost".
 */
export const BANK_REFILLS_IN_MS = 2 * DAY_MS;

// Placeholders for the server. The first milestone's clock is one tick per
// month played (docs/rules/engine.md section 7), so these are not used yet.

/** Online, a world tick is half a real day: the rates "tick twice a real day". docs/design/01-concept.md section 13. */
export const WORLD_TICK_MS = 12 * HOUR_MS;

/** An era lasts about four real weeks. docs/design/01-concept.md section 7, "Eras". */
export const ERA_MS = 28 * DAY_MS;

/** Nothing takes effect less than two real days after it is announced. docs/design/01-concept.md section 7, fairness rule 4. */
export const ANNOUNCE_TO_FORCE_MIN_MS = 2 * DAY_MS;

/** A partner who stops playing is warned after seven real days. docs/design/01-concept.md section 6. */
export const PARTNER_IDLE_WARNING_MS = 7 * DAY_MS;

/** After fourteen real days a labelled stand-in takes over for an idle partner. docs/design/01-concept.md section 6. */
export const PARTNER_STAND_IN_MS = 14 * DAY_MS;
