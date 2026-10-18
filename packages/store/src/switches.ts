// The switch row and the dials of the private settings (server:private-settings-and-dials,
// server:four-off-switches): one row the server reads on each request, cached, so a change
// takes effect without a deploy, and an append-only log of every change.
import type { StoreResult } from "./types";

/**
 * server:four-off-switches: the four off switches, each on by default; city:boards-switch-when-and-who:
 * one switch for each board, the four on and the joined-week board off.
 */
export interface Switches {
  signups: boolean;
  lottery: boolean;
  adverts: boolean;
  partnerPlay: boolean;
  "boards.this-week.everyone": boolean;
  "boards.this-week.friends": boolean;
  "boards.all-time.everyone": boolean;
  "boards.all-time.friends": boolean;
  "boards.joined-week": boolean;
}

export type SwitchName = keyof Switches;

/**
 * server:private-settings-and-dials: the dials. A dial left unset (absent or null) falls back to
 * the content's number: the place entry's `crowd.target` (city:residents-fill-to-target),
 * `tuning.people.computerAfterMonths` (person:computer-partner-offer-dial). The lottery's runs on `tuning.lottery.odds` (lottery:odds-fixed-at-draw-open).
 */
export interface Dials {
  /** By place id. */
  placeTargets: Record<string, number>;
  computerAfterMonths: number | null;
}

/** One dial set to a whole number from 0, or unset with null. */
export type DialChange =
  | { dial: "placeTarget"; place: string; value: number | null }
  | { dial: "computerAfterMonths"; value: number | null };

/** The raffle's top-up dial, which nothing sets under decision 0016: a stored log line that carries one still reads. */
export interface TopUpDialChange {
  dial: "topUpTickets";
  value: number | null;
}

/** What one logged change did. */
export type SettingChange = { switch: SwitchName; on: boolean } | DialChange | TopUpDialChange;

/** server:four-off-switches: who changed what, when and why. `n` rises with every change. */
export interface SwitchLogRow {
  n: number;
  at: number;
  admin: string;
  reason: string;
  change: SettingChange;
}

export interface SwitchRow {
  switches: Switches;
  dials: Dials;
}

/** server:private-settings-and-dials, server:four-off-switches: the row as an empty store reads it. */
export const DEFAULT_SWITCH_ROW: SwitchRow = {
  switches: {
    signups: true,
    lottery: true,
    adverts: true,
    partnerPlay: true,
    "boards.this-week.everyone": true,
    "boards.this-week.friends": true,
    "boards.all-time.everyone": true,
    "boards.all-time.friends": true,
    "boards.joined-week": false,
  },
  dials: { placeTargets: {}, computerAfterMonths: null },
};

/**
 * server:private-settings-and-dials, server:four-off-switches. Every write is logged with the row change in one
 * step; the log has no update and no delete. `at` is passed in: no store reads a clock.
 */
export interface SwitchStore {
  /** The row, or `DEFAULT_SWITCH_ROW` when nothing was ever set. */
  read: () => Promise<SwitchRow>;
  /** Sets one switch and logs it, even when it already held that value. Returns the row after. */
  set: (name: SwitchName, on: boolean, admin: string, reason: string, at: number) => Promise<SwitchRow>;
  /** Sets or unsets one dial and logs it. A value that is not a whole number from 0 to `MAX_DIAL` is refused with `bad-write` and nothing is logged. */
  setDial: (change: DialChange, admin: string, reason: string, at: number) => Promise<StoreResult<SwitchRow>>;
  /** Every change in the order it was made. */
  log: () => Promise<SwitchLogRow[]>;
}

/** The largest dial a store keeps: a Postgres `integer`. */
export const MAX_DIAL = 2_147_483_647;

/** True for a dial value the store accepts. */
export function isDialValue(value: number | null): boolean {
  return value === null || (Number.isInteger(value) && value >= 0 && value <= MAX_DIAL);
}
