// Obligations: docs/rules/obligation.md. Stub: the scenario's obligations are
// real and get instance ids from the engine's counter (R-SCENARIO-002).
import type { RegisteredKind } from "../engine/kind";
import { effectsNotBuilt } from "../engine/stub";
import type { ObligationSlice } from "../engine/types";
import type { ObligationEvent } from "./obligation.events";

export const obligationKind: RegisteredKind<ObligationSlice, ObligationEvent> = {
  kind: "obligation",
  initial(scenario, _content, ids) {
    if (ids === undefined) throw new Error("The obligation kind needs an id source to open the scenario's obligations.");
    const items: ObligationSlice["items"] = {};
    for (const owed of scenario.obligations) {
      const id = ids.next("obligation");
      items[id] = {
        id,
        entry: owed.obligation,
        state: "active",
        openedMonth: 0,
        amount: owed.amount,
        principal: 0,
        outstanding: 0,
        monthsLeft: null,
        missed: 0,
      };
    }
    return { items };
  },
  effects: effectsNotBuilt(["obligation/open"]),
  evolve: (slice) => slice,
  invariants(state, content) {
    const problems: string[] = [];
    for (const [id, item] of Object.entries(state.obligation.items)) {
      if (item.id !== id) problems.push(`Obligation ${id} is stored under the wrong key.`);
      if (content.obligation[item.entry] === undefined) problems.push(`Obligation ${id} names ${item.entry}, which is not in content.`);
      if (item.outstanding < 0 || item.amount < 0) problems.push(`Obligation ${id} owes a negative amount.`);
    }
    return problems;
  },
  view: ({ state }) => ({
    obligations: Object.values(state.obligation.items).map((item) => ({ ...item, due: item.amount })),
  }),
};
