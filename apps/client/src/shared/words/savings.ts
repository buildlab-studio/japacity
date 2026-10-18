// The savings toward the move, one figure for the Bank and the results sheet (R-WORLD-019): the plan's route read as the Japa app reads it, what its decision day asks for plus the
// fees still ahead, against every money held at the official rate.
import { content } from "@japacity/content";
import { CURRENCIES, int, type Currency, type ForeignCurrency, type PlayerView, type RouteView } from "@japacity/sim";


/** The route the plan follows: the japacity figure's route, else the furthest one heard of. */
export function planRoute(view: PlayerView): RouteView | null {
  const lead = view.routes.find((route) => route.id === view.japacity.route);
  if (lead !== undefined) return lead;
  return view.routes.find((route) => route.state !== "unknown" && route.state !== "heard" && route.gate?.gate !== "road") ?? null;
}

/**
 * The route the savings count toward: the plan's, read as the Japa app reads it (the way the chapters follow,
 * else the japacity figure's route or the furthest one on), else the first with a figure to show.
 */
export function savingsRoute(view: PlayerView): RouteView | null {
  const lean = view.plan.route === null ? null : (view.routes.find((route) => route.id === view.plan.route) ?? null);
  const planned = lean ?? planRoute(view);
  if (planned !== null) return planned;
  return view.routes.find((route) => route.funds.required > 0) ?? null;
}

/**
 * What is saved toward fees, in the route's money: every money held that can pay, bank and cash, at the
 * official rate. Locked money only sits to be shown, so it pays no fee. A way with no funds to
 * show on its decision day has no rule for funds shown, so its figure is the money there is to pay with.
 */
export function savedFor(view: Pick<PlayerView, "pockets" | "rates">, currency: Currency): number {
  const official = Object.fromEntries(Object.entries(view.rates).map(([each, rate]) => [each, rate.official])) as Record<ForeignCurrency, number>;
  return CURRENCIES.reduce((sum, each) => sum + int.convertMinor(view.pockets[each].bank + view.pockets[each].cash, each, currency, official), 0);
}

/**
 * The fees still ahead on a gated way, in its money, as the engine prices them now: each act that counts
 * toward the route and costs that money (the endorsement, the visa and its surcharge), less those done (a
 * paper held or on its way, an application sent), so the talent visa has a figure too.
 */
function feesAhead(view: Pick<PlayerView, "activities" | "documents">, route: RouteView, currency: Currency): number {
  const sent = route.state === "applying" || route.state === "granted" || route.state === "departed";
  return Object.values(content.activity).reduce((sum, entry) => {
    if (entry === undefined || !entry.counts.includes(route.id)) return sum;
    if (sent && entry.effects.some((effect) => effect.type === "route/apply" && effect.route === route.id)) return sum;
    const papers = entry.effects.flatMap((effect) => (effect.type === "document/request" ? [effect.document] : []));
    if (papers.some((paper) => view.documents.some((held) => held.id === paper && (held.state === "held" || held.state === "pending")))) return sum;
    const option = view.activities.find((each) => each.id === entry.id);
    return sum + (option?.cost ?? []).filter((cost) => cost.currency === currency).reduce((total, cost) => total + cost.amount, 0);
  }, 0);
}

/**
 * The funds now: the checklist's funds item carries them live, the route's record the last check. A gated
 * way (sponsor, points, talent, contract) counts what its decision day asks for and the fees still ahead on
 * it, against the funds shown; a way with neither shows no figure.
 */
export function savingsOf(view: PlayerView): { shown: number; required: number; currency: Currency } | null {
  const route = savingsRoute(view);
  if (route === null) return null;
  const ids = (content.route[route.id]?.checklist ?? []).filter((item) => item.requirement.type === "route/funds").map((item) => item.id);
  const live = route.checklist.find((item) => ids.includes(item.id) && item.have !== null && item.need !== null);
  const country = content.route[route.id]?.country ?? null;
  const currency = (country === null ? undefined : content.country[country]?.currency) ?? "GBP";
  if (route.gate !== null) {
    const required = (live?.need ?? 0) + feesAhead(view, route, currency);
    if (required === 0) return null;
    return { shown: live?.have ?? savedFor(view, currency), required, currency };
  }
  const shown = live?.have ?? route.funds.shown;
  const required = live?.need ?? route.funds.required;
  if (required === 0) return null;
  return { shown, required, currency };
}

