// The trader's own shop: a life from sixteen that served its master and holds the
// settlement opens a shop of her own. The act is offered only to a life with no degree and a shop's capital in
// hand; the shop it opens is a main job no hunt lists, since it has no hiring chance (R-ACTIVITY-005). Joined
// into the activity table in activity.data.ts.
// no rule id names the shop yet; the tests cite R-ACTIVITY-001 (a job held and paid) and R-PROLOGUE-011.
import type { ActivityEntry, Id } from "@japacity/sim";

import { naira } from "../units";

export const SHOP: Id<"activity"> = "activity.run-shop";
const OPEN: Id<"activity"> = "activity.open-shop";
const EDU_LEVEL: Id<"quality"> = "quality.edu-level";
/** A bachelor's degree is edu-level 3 (quality.md): the shop is a trade's way, never a graduate's. */
const BELOW_DEGREE = 2;
/**
 * The naira in hand that stocks a shop. under the fair settlement (₦2,500,000), so a trader keeps
 * the act for the months her living costs take before she opens; over the most a life from sixteen holds
 * without a settlement (the shop counter's savings, the cheated settlement), so only a settled trade has it.
 */
const CAPITAL = naira(1000000);

export const shopActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // should the capital become the stock? No ledger reason says "stock" (a new reason needs a decision
  // record), so opening costs nothing and the takings are what the shop clears after it restocks.
  [OPEN]: {
    id: OPEN,
    slot: "free",
    where: "home",
    requires: [
      { type: "quality/max", quality: EDU_LEVEL, value: BELOW_DEGREE },
      { type: "money/min", currency: "NGN", amount: CAPITAL },
      { type: "not", of: { type: "job/is", activities: [SHOP] } },
    ],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [{ type: "activity/start-job", job: SHOP }],
    counts: [],
  },
  // the takings grow by `tuning.activity.raiseBp` a year in the shop (activity.pay.ts) until tuning has a key of its own.
  [SHOP]: {
    id: SHOP,
    slot: "main",
    where: "home",
    requires: [],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(180000) },
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.wellbeing", amount: -3 },
      { type: "quality/add", quality: "quality.standing", amount: 1 },
    ],
    counts: [],
  },
};
