// The street kiosk while the world runs the Friday draw (docs/rules/lottery.md R-LOTTERY-001; world.md R-WORLD-005):
// the kiosk keeps its id, its name and its act, and the same tap opens the online kiosk's sheet, which sends
// `lottery/buy`. Offline (`view.lottery` null) the act is the luck kiosk's now-act and its slip, as before. Pure.
import type { PlayerView } from "@japacity/sim";

/** The entry the kiosk's act stages in the place files and the table. */
export const KIOSK = "activity.play-lotto";

/** R-WALLET-020: the naira earned in the game, the naira held less the marked, topped-up share a ticket is never paid from. */
export function earnedNaira(view: Pick<PlayerView, "pockets" | "wallet">): number {
  const { bank, cash } = view.pockets.NGN;
  return Math.max(0, bank + cash - view.wallet.marked);
}

/** R-WALLET-020, R-LOTTERY-018: the naira held would pay `cost`, but only with the marked share, so the kiosk is shut with its words. */
export function earnedShort(view: Pick<PlayerView, "pockets" | "wallet">, cost: number): boolean {
  const { bank, cash } = view.pockets.NGN;
  return bank + cash >= cost && earnedNaira(view) < cost;
}

/** True while the world runs the Friday draw, so the kiosk sells its tickets (R-LOTTERY-001). */
export function kioskOnline(view: Pick<PlayerView, "lottery">): boolean {
  return view.lottery !== null;
}

/**
 * The acts a place's things may offer (`actsOffered`), with the kiosk's while the world runs the draw: online the
 * view never allows the offline act (R-LOTTERY-001), and the kiosk's act stands for the draw's sheet instead.
 */
export function withKiosk(offered: readonly string[], view: Pick<PlayerView, "lottery">): string[] {
  return kioskOnline(view) && !offered.includes(KIOSK) ? [...offered, KIOSK] : [...offered];
}

/**
 * True when the sheet an act opens is the online kiosk's: the act stages the kiosk and the world runs the draw. The
 * offline now-act is never offered online, also when a view still lists it as allowed: the online sheet shows only.
 */
export function opensKiosk(activity: string, view: Pick<PlayerView, "lottery">): boolean {
  return activity === KIOSK && kioskOnline(view);
}
