// A status a trip home keeps, in words (return:papers-return-keeps-status, status:absence-breaks-settlement): the month it runs to and that the
// character can fly back on it, and a stay at home that starts the road to settling again. Read from the view: the client works out no rule but
// the month's name, and Papers, Japa and the bag's Go home card all say it from here.
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";

import { monthYearOf } from "./monthName";
import { nameOf, say } from "./text";

/** The last month a status that ends at `until` is in force: it holds while the month is below its end. */
function lastMonth(until: number): number {
  return until - 1;
}

/** At home: what the status kept from the return says, or nothing while none is kept. */
export function keptAtHome(view: Pick<PlayerView, "place">, beganAt: number): string[] {
  const status = view.place.heldAbroad;
  if (status === null) return [];
  const kept = view.place.kept;
  const until = kept?.until ?? null;
  const first = until === null ? say("ui.place.token", { status: nameOf(status) }) : say("ui.place.kept.until", { status: nameOf(status), to: monthYearOf(beganAt, lastMonth(until)) });
  return kept?.restarts === true ? [first, say("ui.place.kept.restarts", { months: content.tuning.status.absenceMonths })] : [first];
}

/**
 * On the Go home card, for a return with papers: the status the return keeps and when it runs to, and for one that counts toward settlement and has an
 * end, the line a long stay at home crosses. The status is the one held: a return with papers keeps it (place:return-shape-decided-at-once).
 */
export function keptOnGoingHome(view: Pick<PlayerView, "status" | "month">, beganAt: number): string[] {
  const held = view.status;
  if (held === null) return [];
  const status: Id<"status"> = held.entry;
  if (held.monthsLeft === null) return [say("ui.world.go-home.kept.always", { status: nameOf(status) })];
  const runs = say("ui.world.go-home.kept", { status: nameOf(status), to: monthYearOf(beganAt, lastMonth(view.month + held.monthsLeft)) });
  const settles = content.status[status]?.countsToSettlement === true;
  return settles ? [runs, say("ui.world.go-home.kept.settle", { months: content.tuning.status.absenceMonths })] : [runs];
}
