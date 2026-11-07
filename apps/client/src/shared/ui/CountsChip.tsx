// What an act counts toward, as a chip and never a clause of its line (activity:waiting-months-build-profile,
// text:show-then-tell): a plane and the way in words, "Health care in the UK", named "Counts toward: health care in
// the UK" for a screen reader.
import { PlaneTakeoff } from "lucide-react";

import { countsRoutes, countsWords } from "../words/profile";
import { hasWords, lowerFirst, nameOf, say } from "../words/text";

/** The chip for an act, or nothing when the act counts toward no way. */
export function CountsChip({ id }: { id: string }) {
  const routes = countsRoutes(id);
  const label = countsWords(id);
  if (routes === null || label === null) return null;
  return (
    <span role="img" aria-label={label} title={label} className="sticker-chip chip-wrap bg-tint-money" style={{ rotate: "1.5deg", color: "var(--money-ink)" }} data-counts>
      <PlaneTakeoff size={15} aria-hidden />
      <span aria-hidden>{routes}</span>
    </span>
  );
}

/** A way's short name as a chip says it: "The study visa", "Health care in the UK". */
export function routeShortName(route: string): string {
  const named = hasWords(`ui.counts.route.${route}`) ? say(`ui.counts.route.${route}`) : nameOf(route);
  return named.charAt(0).toUpperCase() + named.slice(1);
}

/** The ways a paper counts toward, a plane chip each with the way's short name, named "Counts toward" for a screen reader (text:show-then-tell). */
export function RouteChips({ routes }: { routes: readonly string[] }) {
  if (routes.length === 0) return null;
  return (
    <>
      {routes.map((route, index) => {
        const label = say("ui.counts.toward", { routes: lowerFirst(routeShortName(route)) });
        return (
          <span key={route} role="img" aria-label={label} title={label} className="sticker-chip chip-wrap bg-tint-money" style={{ rotate: `${index % 2 === 0 ? 1.5 : -1.5}deg`, color: "var(--money-ink)" }} data-counts={route}>
            <PlaneTakeoff size={15} aria-hidden />
            <span aria-hidden>{routeShortName(route)}</span>
          </span>
        );
      })}
    </>
  );
}
