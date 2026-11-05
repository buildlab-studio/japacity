// What an act counts toward, as a chip and never a clause of its line (activity:waiting-months-build-profile,
// text:show-then-tell): a plane and the way in words, "Health care in the UK", named "Counts toward: health care in
// the UK" for a screen reader.
import { PlaneTakeoff } from "lucide-react";

import { countsRoutes, countsWords } from "../words/profile";

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
