// The overstay's stage in words (status:view-shows-status, status:grace-before-overstaying, status:detection-gives-notice), read from the
// engine's view and nothing else: the grace with its months and what can still be applied for from inside, the overstay
// with its cash work and its hardship, the notice with its months before removal. Papers, the warning over the phone's apps
// and the Japa app all say it in these words. Never a chance (text:bands-not-figures).
import type { PlayerView } from "@japacity/sim";

import { formatMoney } from "./format";
import { hasWords, say, sayCount } from "./text";

export type OverstayStage = "grace" | "over" | "notice";

export interface OverstayWords {
  stage: OverstayStage;
  /** The stage in a few words, with its months: "1 month of grace left", "Overstaying", "3 months before removal". */
  title: string;
  /** What the stage means for the life, in a sentence. */
  line: string;
  /** An application made from inside holds the stage while it waits, or null. */
  pending: string | null;
  /** The UAE's fine owed, as money, or null. */
  fine: string | null;
}

/** The stage the view's overstay is in: a notice stands, the grace still has months, or the overstay itself. */
export function overstayStage(view: Pick<PlayerView, "status">): OverstayStage | null {
  const overstay = view.status?.overstay ?? null;
  if (overstay === null) return null;
  if (overstay.noticeLeft !== null) return "notice";
  return overstay.graceLeft > 0 ? "grace" : "over";
}

/** A stage's line in the country's own words where content has them, else the plain ones. */
function lineOf(key: string, country: string | null): string {
  const own = country === null ? null : `${key}.country.${country.slice("country.".length)}`;
  return say(own !== null && hasWords(own) ? own : key);
}

/** The overstay's stage in words, or null on any status that is not an overstay. */
export function overstayWords(view: Pick<PlayerView, "status" | "place">): OverstayWords | null {
  const overstay = view.status?.overstay ?? null;
  const stage = overstayStage(view);
  if (overstay === null || stage === null) return null;
  const country = view.place.country;
  const title =
    stage === "grace"
      ? sayCount("ui.status.overstay.grace", overstay.graceLeft, { months: overstay.graceLeft })
      : stage === "notice"
        ? sayCount("ui.status.overstay.notice", overstay.noticeLeft ?? 0, { months: overstay.noticeLeft ?? 0 })
        : say("ui.status.overstay.over");
  return {
    stage,
    title,
    line: lineOf(`ui.status.overstay.${stage}-line`, country),
    pending: overstay.pending ? say("ui.status.overstay.pending") : null,
    fine: overstay.fine === null || overstay.fine.amount === 0 ? null : say("ui.status.overstay.fine", { fine: formatMoney(overstay.fine.amount, overstay.fine.currency) }),
  };
}
