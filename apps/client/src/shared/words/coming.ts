// What is coming with a month to it (docs/rules/world.md R-WORLD-002): the soonest under the band, and
// the whole list from the chip, soonest first, each as months away and never as a month number. Only
// dates the player can act on or is waiting on: an ask's deadline, a paper on its way, a visa decision,
// the next birthday, and a route's age limit once it is near (the design). In shared/ so the
// city's band and the phone's Japa read one list in one order.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

import { formatMoney } from "./format";
import { sealedTillMorning } from "./morning";
import { planMarks } from "./plan";
import { nameOf, say, words } from "./text";

export interface Coming {
  what: string;
  /** The month it comes, in the simulation's count; said as months away. */
  month: number;
  kind: "offer" | "paper" | "visa" | "birthday" | "age-limit" | "plan" | "rent";
  /** For an ask: the offer's entry, so the Calendar can name where it is answered. */
  entry?: string;
  /** When it comes in words, in place of the months away: a result sealed until the morning (R-CLOCK-032). */
  when?: string;
}

const AGE = "quality.age-months";
const MONTHS_IN_YEAR = 12;
/** A route's age limit joins the list once it is within this many months. */
export const AGE_LIMIT_NEAR = 36;
/** The room's yearly rent joins the list this many months before the month it is taken (R-HOME-010). */
export const RENT_NEAR = 2;

export function ageMonthsOf(view: Pick<PlayerView, "qualities">): number {
  return view.qualities.find((quality) => quality.id === AGE)?.value ?? 0;
}

/** Everything coming with a month to it, soonest first; nothing past. */
export function comingOf(view: Pick<PlayerView, "month" | "offers" | "documents" | "routes" | "qualities" | "plan" | "home">): Coming[] {
  const list: Coming[] = [];
  for (const offer of view.offers) list.push({ what: words(`${offer.entry}.name`), month: offer.expiresMonth, kind: "offer", entry: offer.entry });
  // R-DOCUMENT-008: a paper on its way, a renewal of one held among them.
  // A result sealed until the morning comes tomorrow at seven, never "this month" (R-CLOCK-032).
  for (const paper of view.documents) if (paper.onItsWay !== null) list.push({ what: nameOf(paper.id), month: paper.onItsWay, kind: "paper", ...(sealedTillMorning(view, paper.id) ? { when: say("ui.wait.morning.short") } : {}) });
  for (const route of view.routes) {
    if (route.visa !== null && route.state === "applying") list.push({ what: nameOf(route.id), month: route.visa.decisionMonth, kind: "visa" });
  }
  // The plan's own dated waits (R-CHAPTER-009): a school's answer, the points profile, the endorsement's wait.
  for (const mark of planMarks(view)) list.push({ what: mark.what, month: mark.month, kind: "plan" });
  // R-HOME-010: the room's year of rent, from two months before the month whose end takes it.
  const rent = view.home.roomRent;
  if (rent !== null && rent.dueIn <= RENT_NEAR) list.push({ what: say("ui.world.coming.rent", { amount: formatMoney(rent.year, "NGN") }), month: view.month + rent.dueIn, kind: "rent" });
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

/** The kinds the band's chip may say: things to answer or wait on. The birthday and an age limit stand only in the list, so the chip never peeks for them. */
const CHIP_KINDS: ReadonlySet<Coming["kind"]> = new Set(["offer", "paper", "visa", "plan", "rent"]);

/** The soonest thing to answer or wait on, for the band's chip; null when there is none. */
export function soonest(view: Parameters<typeof comingOf>[0]): Coming | null {
  return comingOf(view).find((item) => CHIP_KINDS.has(item.kind)) ?? null;
}
