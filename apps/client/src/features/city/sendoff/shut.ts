// Why the airport's gate will not board yet, said where its button was before the tap (route/depart): held funds still open, or
// the funds a points route asks again on the day short of its line (route-gates:canada-funds-checked-at-departure).
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";

import { formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";

/** The words that stand for the gate's button while the flight on `route` would be refused, or null when it may board. */
export function gateShut(view: Pick<PlayerView, "obligations" | "routes">, route: Id<"route">): string | null {
  if (view.obligations.some((owed) => content.obligation[owed.entry]?.type === "held-funds")) return say("ui.world.depart-held");
  const gate = view.routes.find((each) => each.id === route)?.gate;
  // The points route's funds are counted in Canadian cents (route-gates:entering-the-pool).
  if (gate?.gate === "points" && gate.fundsShort > 0) return say("ui.world.depart-funds", { amount: formatMoney(gate.fundsShort, "CAD") });
  return null;
}
