// The admin routes of the switches and the dials (server:private-settings-and-dials, server:four-off-switches). The row
// and its log are the store's, named here for the client.
import type { DialChange, Dials, MAX_DIAL as STORE_MAX_DIAL, SettingChange, SwitchLogRow, SwitchName, Switches } from "@japacity/store";

import type { AdminRefusal } from "./admin";

export type { DialChange, Dials, SettingChange, SwitchLogRow, SwitchName, Switches };

/** Every switch, in the order the page lists them and the route names them in a refusal. */
export const SWITCH_NAMES: readonly SwitchName[] = [
  "signups",
  "lottery",
  "adverts",
  "partnerPlay",
  // city:boards-switch-when-and-who: one switch for each board.
  "boards.this-week.everyone",
  "boards.this-week.friends",
  "boards.all-time.everyone",
  "boards.all-time.friends",
  "boards.joined-week",
];

/** The largest a dial may be set to: the store's, whose type holds this exact number. */
export const MAX_DIAL: typeof STORE_MAX_DIAL = 2_147_483_647;

export type SwitchesReply = { ok: true; switches: Switches; dials: Dials } | AdminRefusal;
export type SwitchLogReply = { ok: true; log: SwitchLogRow[] } | AdminRefusal;
