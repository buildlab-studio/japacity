// The agents' fees and tells in content: advice:agent-kind-drawn-on-offer, advice:scams-show-their-tells and advice:chaser-runs-around-cheaper: a fee never
// tells the kind, and "No passport needed" is a scammer's line.
import type { Id, OfferEntry } from "@japacity/sim";
import { checkContent } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";

const advice = content.tuning.advice;
const KINDS = ["fixer", "chaser", "overpromiser", "scammer"] as const;
/** The step a fee is drawn in: ₦1,000, in kobo. */
const STEP = 100000;
const STOP: Id<"offer"> = "offer.agent-stop";

type Kind = (typeof KINDS)[number];

/** The range a kind's fee is drawn from, as the simulation reads the tuning: the chaser's is her own. */
function feeRange(kind: Kind, tuning: typeof advice): readonly [number, number] {
  return kind === "chaser" ? tuning.chaserFee : tuning.fees[kind];
}

/** The tells an entry carries for an honest agent (a fixer or a chaser) or a scammer, as its signs mark them. */
function carriedTells(entry: OfferEntry, kind: "fixer" | "chaser" | "scammer"): string[] {
  return entry.signs.filter((sign) => (kind === "scammer" ? sign.fraudBp : sign.honestBp) === 10000).map((sign) => sign.key);
}

/** The kinds that could ask this fee. */
function askedBy(fee: number): string[] {
  return KINDS.filter((kind) => {
    const [min, max] = feeRange(kind, advice);
    return fee >= min && fee <= max && (fee - min) % STEP === 0;
  });
}

/** The share of the narrower of two ranges that the other covers, in basis points. */
function sharedBp(a: readonly [number, number], b: readonly [number, number]): number {
  const shared = Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));
  return Math.floor((shared * 10000) / Math.min(a[1] - a[0], b[1] - b[0]));
}

describe("the agents' fees", () => {
  test("[advice:chaser-runs-around-cheaper] given every fee any kind can ask, in steps of ₦1,000, when the kinds that ask it are counted, then at least two kinds ask every one, so no fee tells the kind", () => {
    const lonely: string[] = [];
    for (const kind of KINDS) {
      const [min, max] = feeRange(kind, advice);
      for (let fee = min; fee <= max; fee += STEP) if (askedBy(fee).length < 2) lonely.push(`${kind} ${String(fee / 100)}`);
    }
    expect(lonely).toEqual([]);
  });

  test("[advice:chaser-runs-around-cheaper] given the chaser's, the fixer's and the scammer's ranges, when each two are laid over each other, then they share most of their span, and the chaser's stays the cheapest at both ends", () => {
    for (const a of ["chaser", "fixer", "scammer"] as const) {
      for (const b of ["chaser", "fixer", "scammer"] as const) expect(sharedBp(feeRange(a, advice), feeRange(b, advice))).toBeGreaterThan(5000);
    }
    expect(advice.chaserFee[0]).toBeLessThanOrEqual(advice.fees.fixer[0]);
    expect(advice.chaserFee[1]).toBeLessThan(advice.fees.fixer[1]);
  });
});

describe("the scammer's tells", () => {
  test("[advice:scams-show-their-tells] given the men at the stop, when a scammer's tells are read, then \"No passport needed, we will arrange everything\" is one of them, never a fixer's or a chaser's, and a look finds it", () => {
    const stop = content.offer[STOP]!;
    expect(carriedTells(stop, "scammer")).toContain("no-passport");
    expect(carriedTells(stop, "fixer")).not.toContain("no-passport");
    expect(carriedTells(stop, "chaser")).not.toContain("no-passport");
    expect(text[`${STOP}.sign.no-passport`]).toBe("He says: \"No passport needed, we will arrange everything.\"");
    expect(text["advice.tell.no-passport.name"]).toBe("he said no passport was needed");
    for (const entry of ["offer.agent-office", "offer.agent-chaser"]) expect(text[`${entry}.sign.no-passport`]).toBeDefined();
    // The content check fails a tell no look finds (advice:scams-show-their-tells).
    expect(checkContent(content).filter((problem) => problem.includes("advice:"))).toEqual([]);
  });
});
