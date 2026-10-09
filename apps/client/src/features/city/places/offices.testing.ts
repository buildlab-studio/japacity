// What the offices' tests read from the recorded life: the view a few
// commands before the flight, when the deposit is paid and the funds held for the visa are still open.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

import { recordedGame } from "../../../shared/testing/fixtures";

/** The recorded life before its last two commands: the held funds still open, then the flight. */
export function heldFundsOpen(): PlayerView {
  return recordedGame("ada-careful", 2).view();
}

/** The recorded life before its last command: the held funds paid back, only the flight left. */
export function heldFundsPaid(): PlayerView {
  return recordedGame("ada-careful", 1).view();
}

/**
 * What the view lets a thing's acts open, as the City reads it (City.tsx: the activities allowed and the
 * command acts due): held funds still open make the counter's pay-back due.
 */
export function offeredFrom(view: PlayerView): Set<string> {
  const held = view.obligations.some((owed) => content.obligation[owed.entry]?.type === "held-funds");
  return new Set([...view.activities.filter((option) => option.allowed).map((option) => option.id), ...(held ? ["command:obligation/pay"] : [])]);
}
