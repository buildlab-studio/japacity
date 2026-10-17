// From docs/rules/goal.md "Entries". Several of the page's conditions have no
// requirement type in the contract; each is written as the nearest one that
// exists.
import type { Effect, Id, GoalEntry, Requirement } from "@japacity/sim";

import { DECEMBER_COUNTRIES } from "../setpiece/setpiece.data";
import { naira } from "../units";

const HOME: Requirement = { type: "place/is", where: "home" };
/**
 * "A return recorded": home again after the send-off. No requirement reads the
 * record of returns, but a character home once the send-off chapter is done has
 * left and come back.
 */
const RETURNED: Requirement[] = [HOME, { type: "place/returned", shapes: ["removed", "assisted", "broke", "by-choice", "with-papers"] }];

function standing(amount: number): Effect {
  return { type: "quality/add", quality: "quality.standing", amount };
}

function wellbeing(amount: number): Effect {
  return { type: "quality/add", quality: "quality.wellbeing", amount };
}

/** The settled and citizen statuses: R-RETURN-004's list of statuses kept on a return with papers. */
const SETTLED_STATUSES: Id<"status">[] = ["status.uk-settled", "status.uk-citizen", "status.ca-resident", "status.ca-citizen"];

export const goalTable: Record<Id<"goal">, GoalEntry> = {
  "goal.first-car": {
    id: "goal.first-car",
    where: "abroad",
    openIf: [{ type: "credit/min", value: 20 }],
    // hasCar: the car obligation is open (R-CAR-002).
    doneIf: [{ type: "obligation/has", obligationType: "car" }],
    reward: [standing(4), wellbeing(4)],
  },
  "goal.own-door": {
    id: "goal.own-door",
    where: "abroad",
    openIf: [{ type: "place/months-here", where: "abroad", months: 6 }],
    // R-GOAL-004: a flat in the character's own name, never a shared room.
    doneIf: [
      {
        type: "any",
        of: [
          { type: "obligation/has", obligationType: "rent", obligation: "obligation.rent-flat-uk" },
          { type: "obligation/has", obligationType: "rent", obligation: "obligation.rent-flat-ca" },
        ],
      },
    ],
    reward: [wellbeing(6)],
  },
  "goal.step-up": {
    id: "goal.step-up",
    where: "abroad",
    openIf: [{ type: "place/months-here", where: "abroad", months: 12 }],
    // no requirement compares pay with the first job abroad. These are the jobs
    // abroad paying at least 20% over the entry job of their ladder: care at £25,000, the
    // warehouse at £23,000 or C$38,000, the skilled salary bar of £41,700.
    doneIf: [
      {
        type: "job/is",
        activities: [
          "activity.job-uk-nurse",
          "activity.job-uk-senior-dev",
          "activity.job-uk-graduate",
          "activity.job-ca-professional",
          "activity.job-ca-dev",
        ],
      },
    ],
    reward: [standing(5)],
  },
  "goal.clean-file": {
    id: "goal.clean-file",
    where: "abroad",
    openIf: [{ type: "credit/min", value: 10 }],
    doneIf: [{ type: "credit/min", value: 60 }],
    reward: [wellbeing(3)],
  },
  "goal.send-well": {
    id: "goal.send-well",
    where: "abroad",
    // Remittances arrive in the naira bank under the reason `remit` (R-ABROAD-006), so the total is read there.
    openIf: [{ type: "wallet/total", flow: "in", reason: "remit", currency: "NGN", amount: 1 }],
    doneIf: [{ type: "wallet/total", flow: "in", reason: "remit", currency: "NGN", amount: naira(2000000) }],
    reward: [standing(6)],
  },
  "goal.december": {
    id: "goal.december",
    where: "abroad",
    openIf: [{ type: "place/months-here", where: "abroad", months: 12 }],
    // R-GOAL-004: done only when the visit was taken, the going answer given in any country's scene.
    doneIf: [
      {
        type: "any",
        of: DECEMBER_COUNTRIES.map((country): Requirement => ({ type: "setpiece/answered-with", setpiece: "setpiece.december", question: `go-${country.suffix}`, answer: "go" })),
      },
    ],
    reward: [wellbeing(5)],
  },
  "goal.settled": {
    id: "goal.settled",
    where: "abroad",
    // A status that counts to settlement.
    openIf: [{ type: "status/is", statuses: ["status.uk-sponsored", "status.uk-talent", "status.ca-resident"] }],
    doneIf: [{ type: "status/is", statuses: SETTLED_STATUSES }],
    reward: [standing(10), wellbeing(8)],
  },
  "goal.home-with-capital": {
    id: "goal.home-with-capital",
    where: "any",
    openIf: RETURNED,
    // The capital bonus is at its cap of +10 with ₦10,000,000 above the ₦500,000 broke line.
    // no requirement reads the bank on the day of the return, so the bank now stands for it.
    doneIf: [{ type: "place/returned", shapes: ["with-papers", "by-choice"] }, { type: "money/min", currency: "NGN", amount: naira(10500000), pocket: "bank" }],
    reward: [standing(8)],
  },
  "goal.the-house": {
    id: "goal.the-house",
    where: "any",
    openIf: [{ type: "money/min", currency: "NGN", amount: naira(5000000), pocket: "bank" }],
    // the building project and the reason `build` arrive with a later page, and no
    // requirement reads a ledger total; until then ₦15,000,000 held stands for ₦15,000,000 paid.
    doneIf: [
      { type: "quality/min", quality: "quality.land", value: 1 },
      { type: "money/min", currency: "NGN", amount: naira(15000000), pocket: "bank" },
    ],
    reward: [standing(10)],
  },
  "goal.second-route": {
    id: "goal.second-route",
    where: "home",
    openIf: RETURNED,
    // A route left on is `departed`, so `granted` on any formal route is a new grant.
    doneIf: [
      {
        type: "any",
        of: ["route.uk-masters", "route.uk-care", "route.uk-skilled", "route.canada-points", "route.uk-talent", "route.gulf-contract"].map(
          (route): Requirement => ({ type: "route/state", route: route as Id<"route">, in: ["granted"] }),
        ),
      },
    ],
    reward: [wellbeing(8)],
  },
};
