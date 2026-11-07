// The boat work at Makoko's net shed (activity:boat-work-at-the-net-shed) and the match at its viewing centre (activity:watch-the-match).
// The men's trade beside the fish racks: the third in Sewanu's canoe, offered once a life, then your own canoe opened with its
// capital (activity:capital-opens-own-work), each paid by the month's catch on a written base (activity:catch-drawn-each-month).
// The two side jobs are taken at the shed by acts of their own, certain once asked, as the POS stand is started by its act.
// Joined into the activity table in activity.data.ts; place.data.ts stages the acts at Makoko.
import type { ActivityEntry, Effect, Id, Requirement } from "@japacity/sim";

import { naira } from "../units";

export const CANOE_CREW: Id<"activity"> = "activity.job-canoe-crew";
export const OWN_CANOE: Id<"activity"> = "activity.job-own-canoe";
export const MEND_NETS: Id<"activity"> = "activity.mend-nets";
export const CANOE_TAXI: Id<"activity"> = "activity.canoe-taxi";
/** The boat trade's ladder, first rung to top (activity:each-trade-climbs-its-ladder). */
export const BOAT_JOBS: Id<"activity">[] = [CANOE_CREW, OWN_CANOE];

/** "Lives in Makoko" is the room on the lagoon being rented, as the racks read it. */
const LIVES_IN_MAKOKO: Requirement = { type: "obligation/has", obligationType: "upkeep", obligation: "obligation.upkeep-makoko" };

function wellbeing(amount: number): Effect {
  return { type: "quality/add", quality: "quality.wellbeing", amount };
}

/** A now-act at the shed that starts a job with no hunt: a canoe bought with its capital, or a side job taken as it is asked. */
function starts(id: Id<"activity">, job: Id<"activity">, capital: number | null, requires: Requirement[]): ActivityEntry {
  return {
    id,
    slot: "free",
    where: "home",
    requires,
    param: null,
    cost: capital === null ? [] : [{ currency: "NGN", amount: naira(capital), reason: "goods" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "activity/start-job", job }],
    counts: [],
  };
}

export const boatActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // The first rung: never hunted and never on the board, so its hire chance is none. The captain's share grows as the third
  // learns, so its base is reviewed as informal work's is (activity:naira-pay-reviewed-yearly).
  [CANOE_CREW]: {
    id: CANOE_CREW,
    slot: "main",
    employer: "informal",
    where: "home",
    catch: true,
    requires: [LIVES_IN_MAKOKO],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(75000) },
    hireBp: null,
    // Out before dawn under the bridge, throwing and hauling.
    effects: [wellbeing(-5)],
    counts: [],
  },
  // Own work: the base grows as own work grows (activity:capital-opens-own-work).
  [OWN_CANOE]: {
    id: OWN_CANOE,
    slot: "main",
    employer: "own",
    where: "home",
    catch: true,
    requires: [{ type: "activity/tenure", activities: [CANOE_CREW], months: 12 }],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(140000) },
    hireBp: null,
    effects: [wellbeing(-5)],
    counts: [],
  },
  // The quiet side job: certain once asked, light on the body.
  [MEND_NETS]: {
    id: MEND_NETS,
    slot: "side",
    where: "home",
    requires: [LIVES_IN_MAKOKO],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(45000) },
    hireBp: null,
    effects: [wellbeing(-1)],
    counts: [],
  },
  // The canoe fishes at dawn and carries people in the afternoon.
  [CANOE_TAXI]: {
    id: CANOE_TAXI,
    slot: "side",
    where: "home",
    requires: [{ type: "job/is", activities: [OWN_CANOE] }],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(90000) },
    hireBp: null,
    effects: [wellbeing(-4)],
    counts: [],
  },

  // The acts at the net shed.
  // Sewanu's place is offered by the act's own rule (activity.logic.ts), with the crew's job as its term; the offer's conditions decide.
  "activity.ask-fisherman": { id: "activity.ask-fisherman", slot: "free", where: "home", requires: [], param: null, cost: [], pay: null, hireBp: null, effects: [], counts: [] },
  "activity.take-net-work": starts("activity.take-net-work", MEND_NETS, null, [LIVES_IN_MAKOKO]),
  // A second hand canoe: one savings circle's pot (₦20,000 for ten months) buys it.
  "activity.buy-canoe": starts("activity.buy-canoe", OWN_CANOE, 200000, [
    { type: "activity/tenure", activities: [CANOE_CREW], months: 12 },
    { type: "not", of: { type: "job/is", activities: [OWN_CANOE] } },
  ]),
  "activity.start-canoe-taxi": starts("activity.start-canoe-taxi", CANOE_TAXI, null, [{ type: "job/is", activities: [OWN_CANOE] }]),

  // The match at the viewing centre: a small fee, people, and word of the boat work (activity:watch-the-match).
  "activity.watch-match": {
    id: "activity.watch-match",
    slot: "free",
    where: "home",
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(1000), reason: "social" }],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.network", amount: 2 },
      { type: "quality/add", quality: "quality.wellbeing", amount: 3 },
    ],
    counts: [],
  },
};
