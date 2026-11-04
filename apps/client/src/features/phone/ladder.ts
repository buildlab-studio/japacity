// activity:each-trade-climbs-its-ladder: the held job's next rung, as the passbook's ladder road reads it, and the road across to
// another trade's rung that counts the held job's months too, for Jobs and Papers alike.
import { content } from "@japacity/content";
import type { Id, PassbookRoad, PlayerView } from "@japacity/sim";

/** The pay a job's entry writes, or null where it writes none. */
function written(job: Id<"activity">): { currency: string; amount: number } | null {
  const pay = content.activity[job]?.pay;
  return pay === undefined || pay === null || typeof pay.amount !== "number" ? null : { currency: pay.currency, amount: pay.amount };
}

/** The passbook's ladder road, when its rung asks months in the job held: the held job's next rung. */
export function ladderRung(view: Pick<PlayerView, "job" | "passbook">): PassbookRoad | null {
  const held = view.job.id;
  const road = view.passbook?.roads.find((each) => each.road === "ladder");
  if (held === null || road === undefined) return null;
  return countsOver(road.via as Id<"activity">, held) === null ? null : road;
}

/** The fewest jobs a job's tenure counts the held job's months over, or null where it does not count them. */
function countsOver(job: Id<"activity">, held: Id<"activity">): number | null {
  const widths = (content.activity[job]?.requires ?? []).flatMap((need) => (need.type === "activity/tenure" && need.activities.includes(held) ? [need.activities.length] : []));
  return widths.length === 0 ? null : Math.min(...widths);
}

/**
 * activity:each-trade-climbs-its-ladder: the road across, a better-paid rung of another trade that counts the held job's months
 * among more jobs than the next rung does, the lowest paid of them: a banker's months reach the chartered accountant.
 * Null with no next rung or none across.
 */
export function roadAcross(view: Pick<PlayerView, "job">, rung: PassbookRoad | null): Id<"activity"> | null {
  const held = view.job.id;
  if (held === null || rung === null) return null;
  const own = countsOver(rung.via as Id<"activity">, held);
  const heldPay = written(held);
  if (own === null || heldPay === null) return null;
  const across = Object.values(content.activity).flatMap((entry) => {
    if (entry === undefined || entry.slot !== "main" || entry.where === "abroad" || entry.id === held || entry.id === rung.via) return [];
    const width = countsOver(entry.id, held);
    const pay = written(entry.id);
    return width !== null && width > own && pay !== null && pay.currency === heldPay.currency && pay.amount > heldPay.amount ? [{ id: entry.id, amount: pay.amount }] : [];
  });
  return across.sort((a, b) => a.amount - b.amount)[0]?.id ?? null;
}

