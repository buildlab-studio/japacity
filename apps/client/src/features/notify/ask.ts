// When the bank-full notice may be asked for (docs/rules/clock.md R-CLOCK-031,
// guides.md R-GUIDE-015): after a good moment, never on load, never before the
// early win, not again for `reaskDays` after a dismissal, never after the
// browser's own refusal.
import type { ReportLine } from "@japacity/sim";
import { time } from "@japacity/sim";

import type { Permission } from "./notify.api";

/**
 * A good moment: a line of tone `good` that is staged on its own (`big`: the
 * first salary, a grant, the send-off) or asks the player to look (`attention`).
 */
export function isGoodMoment(lines: readonly ReportLine[]): boolean {
  return lines.some((line) => line.tone === "good" && (line.big === true || line.attention));
}

export interface AskTerms {
  permission: Permission;
  /** The deployment's public key; no key, no ask. */
  key: string | null;
  dismissedAt: number | null;
  now: number;
  reaskDays: number;
}

/** True when this device may be asked now. A dismissal waits exactly `reaskDays` days. */
export function mayAsk({ permission, key, dismissedAt, now, reaskDays }: AskTerms): boolean {
  if (permission !== "default" || key === null) return false;
  return dismissedAt === null || now - dismissedAt >= reaskDays * time.DAY_MS;
}

/** R-ANALYTICS-011: the ask's client counters, keyed by the ask and by when it came against the early win. */
export type CountAsk = (name: "ask/shown" | "ask/accepted", ask: "notify", when: "before" | "after") => void;

// the analytics agent's client counter takes this seam's place when it lands; until then nothing is counted.
export const countAsk: CountAsk = () => undefined;
