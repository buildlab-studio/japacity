// What is coming with a month to it (docs/rules/world.md R-WORLD-002): the soonest under the band, and
// the whole list from the chip, soonest first, each as months away and never as a month number. Only
// dates the player can act on or is waiting on: an ask's deadline, a paper on its way, a visa decision,
// the next birthday, and a route's age limit once it is near (the design).
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

import { nameOf, say, words } from "../../shared/words/text";

export interface Coming {
  what: string;
  /** The month it comes, in the simulation's count; said as months away. */
  month: number;
  kind: "offer" | "paper" | "visa" | "birthday" | "age-limit";
}

const AGE = "quality.age-months";
const MONTHS_IN_YEAR = 12;
/** A route's age limit joins the list once it is within this many months. */
export const AGE_LIMIT_NEAR = 36;

export function ageMonthsOf(view: Pick<PlayerView, "qualities">): number {
  return view.qualities.find((quality) => quality.id === AGE)?.value ?? 0;
}

/** Everything coming with a month to it, soonest first; nothing past. */
export function comingOf(view: Pick<PlayerView, "month" | "offers" | "documents" | "routes" | "qualities">): Coming[] {
  const list: Coming[] = [];
  for (const offer of view.offers) list.push({ what: words(`${offer.entry}.name`), month: offer.expiresMonth, kind: "offer" });
  for (const paper of view.documents) if (paper.state === "pending" && paper.readyMonth !== null) list.push({ what: nameOf(paper.id), month: paper.readyMonth, kind: "paper" });
  for (const route of view.routes) {
    if (route.visa !== null && (route.state === "applying" || route.state === "known")) list.push({ what: nameOf(route.id), month: route.visa.decisionMonth, kind: "visa" });
  }
  const age = ageMonthsOf(view);
  const toBirthday = MONTHS_IN_YEAR - (age % MONTHS_IN_YEAR);
  list.push({ what: say("ui.world.coming.birthday", { age: Math.floor(age / MONTHS_IN_YEAR) + 1 }), month: view.month + toBirthday, kind: "birthday" });
  for (const route of view.routes) {
    if (route.state === "unknown") continue;
    const limit = content.route[route.id]?.contract?.maxAgeMonths;
    if (limit === undefined) continue;
    const left = limit - age;
    if (left > 0 && left <= AGE_LIMIT_NEAR) list.push({ what: say("ui.world.coming.age-limit", { route: nameOf(route.id) }), month: view.month + left, kind: "age-limit" });
  }
  return list.filter((item) => item.month >= view.month).sort((a, b) => a.month - b.month);
}

/** The soonest, for the band's chip. */
export function soonest(view: Parameters<typeof comingOf>[0]): Coming | null {
  return comingOf(view)[0] ?? null;
}
