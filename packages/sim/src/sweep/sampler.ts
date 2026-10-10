// The sweep's own sampler: every command testing/legal.ts builds, and the
// commands of the whole life it leaves out, read from the view alone. Each
// one added here is accepted whenever the view lets it through.
import type { PlayerView } from "../engine/types";
import { legalCommands } from "../testing/legal";
import type { Loose } from "../testing/play";

/**
 * R-STATUS-006. The view's `renew` carries the fee and the surcharge. 
 * offered when the status's own currency's bank pocket alone covers both and,
 * on a one-employer status, a job is held.
 */
function fromStatus(view: PlayerView): Loose[] {
  const status = view.status;
  if (status?.renew === null || status?.renew === undefined) return [];
  if (status.work === "one-employer" && view.job.id === null) return [];
  const { currency, fee, surcharge } = status.renew;
  return view.pockets[currency].bank >= fee + surcharge ? [{ type: "status/renew" }] : [];
}

/**
 * R-CAR-004: the car handed back with the amount 0 once half its price is
 * paid, which the view's `car` now carries. A car paid off and owned is not
 * listed (R-CAR-005) and cannot be handed back.
 */
function fromCar(view: PlayerView): Loose[] {
  return view.obligations.flatMap((owed): Loose[] => (owed.car !== null && owed.outstanding > 0 && owed.car.paid >= owed.car.half ? [{ type: "obligation/pay", obligation: owed.id, amount: 0 }] : []));
}

/** R-ACTIVITY-010: the side job given up on its own. */
function fromSide(view: PlayerView): Loose[] {
  return view.job.side === null ? [] : [{ type: "activity/quit", side: true }];
}

/** Every legal command testing/legal.ts builds, and the ones above. */
export function sampleCommands(view: PlayerView): Loose[] {
  const legal = legalCommands(view);
  if (view.ended || view.prologue !== null) return legal;
  return [...legal, ...fromStatus(view), ...fromCar(view), ...fromSide(view)];
}

/** Every command type a player may send. The sweep reports the ones its sampler never produced. */
export const PLAYER_COMMANDS: Loose["type"][] = [
  "turn/end",
  "activity/quit",
  "activity/now",
  "offer/choose",
  "wallet/convert",
  "wallet/move",
  "obligation/pay",
  "route/pay-deposit",
  "route/depart",
  "setpiece/answer",
  "wallet/remit",
  "prologue/choose",
  "status/renew",
  "return/home",
];
