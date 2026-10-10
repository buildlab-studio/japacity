// The data page's stamps (prologue.md R-PROLOGUE-009): none until a visa is granted. The visa's is
// the first, round and red, with the way under it; the steps after it stamp beneath it, in the order a life takes them:
// the flight out, the landing, a status secured. Nothing before the visa stamps the page.
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";

import { hasWords, say } from "../words/text";
import type { PageStamp } from "./DataPage";

type Read = Pick<PlayerView, "routes" | "plan" | "place" | "status">;

const GRANTED: readonly string[] = ["granted", "departed"];

/** True for a status that is the end of a way: settled, or a citizen, which the page counts as secured. */
function secured(status: Id<"status">): boolean {
  return Object.values(content.status).some((entry) => entry.settled === status || entry.citizen === status);
}

/** The stamps on the page, oldest first: nothing before the visa. */
export function stampsOf(view: Read): PageStamp[] {
  const plan = view.plan.route === null ? undefined : view.routes.find((route) => route.id === view.plan.route);
  // The road gives no visa (its route holds no status abroad), so it never stamps the page.
  if (plan === undefined || !GRANTED.includes(plan.state) || (content.route[plan.id]?.status ?? null) === null) return [];
  const way = `prologue.page.way.${plan.id}`;
  const stamps: PageStamp[] = [{ words: say("prologue.page.stamp.granted"), ...(hasWords(way) ? { under: say(way) } : {}) }];
  if (plan.state === "departed") stamps.push({ words: say("ui.page.stamp.flight") });
  if (view.place.where === "abroad") stamps.push({ words: say("ui.page.stamp.landed") });
  if (view.status !== null && secured(view.status.entry)) stamps.push({ words: say("ui.page.stamp.secured") });
  return stamps;
}
