// The admin routes of the switches and the dials (R-SERVER-030, 031). The row
// and its log are the store's, named here for the client.
import type { DialChange, Dials, SettingChange, SwitchLogRow, SwitchName, Switches } from "@japacity/store";

import type { AdminRefusal } from "./admin";

export type { DialChange, Dials, SettingChange, SwitchLogRow, SwitchName, Switches };

/** Every switch, in the order the page lists them and the route names them in a refusal. */
export const SWITCH_NAMES: readonly SwitchName[] = [
  "signups",
  "lottery",
  "adverts",
  "partnerPlay",
  // city.md R-CITY-039: one switch for each board.
  "boards.this-week.everyone",
  "boards.this-week.friends",
  "boards.all-time.everyone",
  "boards.all-time.friends",
  "boards.joined-week",
];

export type SwitchesReply = { ok: true; switches: Switches; dials: Dials } | AdminRefusal;
export type SwitchLogReply = { ok: true; log: SwitchLogRow[] } | AdminRefusal;
