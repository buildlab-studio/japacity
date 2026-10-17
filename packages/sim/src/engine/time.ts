// Real-time lengths the design gives, in milliseconds, in one place.
// The simulation never reads a clock (R-ENGINE-012), so nothing in the sim
// uses these. The authority does: the local one in the tab now, the server
// later. They are plain numbers so either can read them without a clock.

export const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Lagos keeps UTC+1 all year (R-CLOCK-014). */
export const LAGOS_OFFSET_MS = HOUR_MS;

/** The hour in Lagos a sealed result opens: what real life made you wait for comes in the morning (R-CLOCK-032). */
export const MORNING_HOUR_LAGOS = 7;

// The world's own clock (R-CLOCK-033, decision 0036): one game day runs on real time but faster than life, the same
// moment for everyone, so a sitting sees the sun move. Each life's months turn only when that life sleeps.

/**
 * One game day in real time: an hour and three quarters. Not a divisor of the real day (R-CLOCK-033):
 * 24 hours hold 13 and five sevenths game days, so a player who sits down at the same real hour
 * each evening meets a different hour of the game's day each day of the week, every part of it inside a week.
 * 105 minutes split into 1,440 game minutes of 4,375 ms each, whole, so the clock's arithmetic stays in integers.
 */
export const GAME_DAY_MS = 105 * MINUTE_MS;

/** The real moment game day 0 began at its midnight: a Friday 18:00 UTC, the same epoch as the server's ticks (R-CLOCK-002), so day 0 is a Friday. */
export const GAME_DAY_EPOCH_MS = 1_791_568_800_000;

/** The game day's hours, 0 to 23, and where its parts begin: morning at six, the afternoon at noon, evening at six, night at ten. */
export const GAME_HOURS = 24;
export const MORNING_HOUR = 6;
export const AFTERNOON_HOUR = 12;
export const EVENING_HOUR = 18;
export const NIGHT_HOUR = 22;

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
