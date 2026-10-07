// Routes and schools: docs/rules/route.md. Stub: every route starts unknown (R-SCENARIO-002).
import type { RegisteredKind } from "../engine/kind";
import { effectsNotBuilt, requirementsNotBuilt } from "../engine/stub";
import type { Id, RouteSlice, RouteState, RouteView } from "../engine/types";
import type { RouteEvent } from "./route.events";

export function unknownRoute(): RouteState {
  return {
    state: "unknown",
    heardMonth: null,
    knownMonth: null,
    schools: {},
    school: null,
    depositPaid: 0,
    support: null,
    funds: { heldMonths: 0, covered: false, shown: 0, required: 0 },
    visa: null,
    refusals: 0,
    lastRefusal: null,
    depositRefund: null,
    gate: null,
    secret: { sponsorFraud: null },
    bannedUntil: null,
  };
}

export const routeKind: RegisteredKind<RouteSlice, RouteEvent> = {
  kind: "route",
  initial(_scenario, content) {
    const slice: RouteSlice = {};
    for (const entry of Object.values(content.route)) slice[entry.id] = unknownRoute();
    return slice;
  },
  effects: effectsNotBuilt(["route/hear", "route/look-into", "route/apply-school", "route/apply", "route/support", "route/interview-scored"]),
  evolve: (slice) => slice,
  requirements: requirementsNotBuilt(["route/state", "route/offer", "route/deposit", "route/funds", "route/unexplained-max"]),
  invariants(state, content) {
    return Object.keys(state.route)
      .filter((id) => content.route[id as Id<"route">] === undefined)
      .map((id) => `The state holds ${id}, which is not a route in content.`);
  },
  view: ({ state }) => ({
    routes: Object.entries(state.route).map(([id, route]): RouteView => ({
      id: id as Id<"route">,
      state: route.state,
      percent: null,
      window: "open",
      checklist: [],
      schools: Object.entries(route.schools).map(([school, application]) => ({
        id: school as Id<"school">,
        state: application.state,
        readyMonth: application.readyMonth,
        discount: application.discount,
      })),
      school: route.school,
      depositPaid: route.depositPaid,
      support: route.support,
      funds: route.funds,
      unexplainedBp: 0,
      visa: route.visa === null ? null : { submittedMonth: route.visa.submittedMonth, decisionMonth: route.visa.decisionMonth },
      refusals: route.refusals,
      lastRefusal: route.lastRefusal,
      depositRefund: route.depositRefund,
    })),
  }),
};
