// Activities and jobs: docs/rules/activity.md. Stub: initial and view are
// real, so random play has legal moves from day one. Everything else waits for
// the activity work.
import { check } from "../engine/check";
import type { RegisteredKind } from "../engine/kind";
import { effectsNotBuilt, requirementsNotBuilt } from "../engine/stub";
import type { ActivityOption, ActivitySlice, Currency, ReadCtx } from "../engine/types";
import type { ActivityEvent } from "./activity.events";

/** Every free-slot activity as the player may pick it now (R-ACTIVITY-002 is judged from this). */
export function activityOptions(read: ReadCtx): ActivityOption[] {
  return Object.values(read.content.activity)
    .filter((entry) => entry.slot === "free")
    .map((entry) => {
      const missing = entry.requires.filter((requirement) => !check(read, requirement).met);
      const cost = entry.cost.map((item) => ({
        currency: item.currency,
        amount: typeof item.amount === "number" ? item.amount : 0,
      }));
      return {
        id: entry.id,
        allowed: missing.length === 0,
        missing,
        // The stub offers no params, so param activities are listed but cannot be played yet.
        params: entry.param === null ? null : [],
        cost,
        affordable: cost.every((item) => canPay(read, item.currency, item.amount)),
      };
    });
}

function canPay(read: ReadCtx, currency: Currency, amount: number): boolean {
  const pocket = read.state.wallet.pockets[currency];
  return pocket.bank + pocket.cash >= amount;
}

export const activityKind: RegisteredKind<ActivitySlice, ActivityEvent> = {
  kind: "activity",
  initial: (scenario) => ({ job: scenario.job, tenure: { ...scenario.tenure }, lastSlots: [] }),
  effects: effectsNotBuilt(["activity/hunt", "activity/start-job", "activity/end-job", "activity/gig"]),
  evolve: (slice) => slice,
  requirements: requirementsNotBuilt(["job/any", "job/none", "job/is", "activity/tenure"]),
  invariants(state, content) {
    const problems: string[] = [];
    if (state.activity.job !== null && content.activity[state.activity.job]?.slot !== "main") {
      problems.push(`The job ${state.activity.job} is not a main-slot activity in content.`);
    }
    for (const [id, months] of Object.entries(state.activity.tenure)) {
      if (!Number.isSafeInteger(months) || months < 0) problems.push(`Tenure in ${id} is ${String(months)}.`);
    }
    return problems;
  },
  view: (read) => ({
    job: {
      id: read.state.activity.job,
      months: read.state.activity.job === null ? 0 : (read.state.activity.tenure[read.state.activity.job] ?? 0),
    },
    activities: activityOptions(read),
    lastSlots: read.state.activity.lastSlots,
  }),
};
