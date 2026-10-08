// What a draw fixes when it opens (docs/rules/lottery.md R-LOTTERY-007, 012,
// 021), compared the same way by every store's `putDraw`.
import type { NewDraw } from "./types";

/** True when two puts of a draw fix the same commitments, top-up, odds and jackpot. */
export function sameDraw(stored: NewDraw, row: NewDraw): boolean {
  const odds = Object.keys(stored.odds) as (keyof NewDraw["odds"])[];
  return (
    stored.secret === row.secret &&
    stored.fingerprint === row.fingerprint &&
    stored.beaconRound === row.beaconRound &&
    stored.topUpTickets === row.topUpTickets &&
    stored.jackpot === row.jackpot &&
    odds.length === Object.keys(row.odds).length &&
    odds.every((key) => stored.odds[key] === row.odds[key])
  );
}
