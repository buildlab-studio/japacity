// The switch row and the dials of the private settings (server.md R-SERVER-030,
// R-SERVER-031): one row the server reads on each request, cached, so a change
// takes effect without a deploy, and an append-only log of every change.
import type { StoreResult } from "./types";

/** R-SERVER-031: the four off switches, each on by default. */
export interface Switches {
  signups: boolean;
  lottery: boolean;
  adverts: boolean;
  partnerPlay: boolean;
}

export type SwitchName = keyof Switches;

/**
 * R-SERVER-030: the dials. A dial left unset (absent or null) falls back to
 * the content's number: the place entry's `crowd.target` (R-CITY-032),
 * `tuning.people.computerAfterMonths` (R-PEOPLE-060), `tuning.lottery.topUpTickets` (R-LOTTERY-021).
 */
export interface Dials {
  /** By place id. */
  placeTargets: Record<string, number>;
  computerAfterMonths: number | null;
  topUpTickets: number | null;
}

/** One dial set to a whole number from 0, or unset with null. */
export type DialChange =
  | { dial: "placeTarget"; place: string; value: number | null }
  | { dial: "computerAfterMonths"; value: number | null }
  | { dial: "topUpTickets"; value: number | null };

/** What one logged change did. */
export type SettingChange = { switch: SwitchName; on: boolean } | DialChange;

/** R-SERVER-031: who changed what, when and why. `n` rises with every change. */
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

/** R-SERVER-030, R-SERVER-031: the row as an empty store reads it. */
export const DEFAULT_SWITCH_ROW: SwitchRow = {
  switches: { signups: true, lottery: true, adverts: true, partnerPlay: true },
  dials: { placeTargets: {}, computerAfterMonths: null, topUpTickets: null },
};

/**
 * R-SERVER-030, R-SERVER-031. Every write is logged with the row change in one
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
