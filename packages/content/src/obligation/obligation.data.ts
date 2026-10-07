// From docs/rules/obligation.md, "Entries".
import type { Id, ObligationEntry } from "@japacity/sim";

import { pct } from "../units";

export const obligationTable: Record<Id<"obligation">, ObligationEntry> = {
  "obligation.upkeep": {
    id: "obligation.upkeep",
    type: "upkeep",
    currency: "NGN",
    // The scenario sets the monthly charge.
    amount: 0,
    rateBp: 0,
    term: null,
    locksPrincipal: false,
    sink: "upkeep",
    // No interest is ever charged; the contract still needs a reason.
    interestSink: "upkeep",
    grace: 0,
    onMiss: [
      { type: "quality/add", quality: "quality.standing", amount: -3 },
      { type: "quality/add", quality: "quality.wellbeing", amount: -5 },
    ],
    onDefault: [],
  },
  "obligation.home-support": {
    id: "obligation.home-support",
    type: "support",
    currency: "NGN",
    amount: 0,
    rateBp: 0,
    term: null,
    locksPrincipal: false,
    sink: "family",
    interestSink: "family",
    grace: 0,
    onMiss: [{ type: "quality/add", quality: "quality.standing", amount: -6 }],
    onDefault: [],
  },
  "obligation.salary-loan": {
    id: "obligation.salary-loan",
    type: "loan",
    currency: "NGN",
    amount: 0,
    rateBp: pct(2),
    term: 12,
    locksPrincipal: false,
    sink: "loan-repay",
    interestSink: "loan-interest",
    grace: 1,
    onMiss: [{ type: "quality/add", quality: "quality.standing", amount: -4 }],
    onDefault: [
      { type: "quality/add", quality: "quality.standing", amount: -15 },
      { type: "quality/add", quality: "quality.credit-mark", amount: 1 },
    ],
  },
  "obligation.quick-loan": {
    id: "obligation.quick-loan",
    type: "loan",
    currency: "NGN",
    amount: 0,
    rateBp: pct(20),
    term: 1,
    locksPrincipal: false,
    sink: "loan-repay",
    interestSink: "loan-interest",
    grace: 1,
    onMiss: [{ type: "quality/add", quality: "quality.standing", amount: -8 }],
    onDefault: [
      { type: "quality/add", quality: "quality.standing", amount: -15 },
      { type: "quality/add", quality: "quality.credit-mark", amount: 1 },
    ],
  },
  "obligation.held-funds": {
    id: "obligation.held-funds",
    type: "held-funds",
    currency: "NGN",
    amount: 0,
    rateBp: pct(5),
    term: null,
    locksPrincipal: true,
    sink: "held-funds-return",
    interestSink: "held-funds-interest",
    // A missed month closes it at once (R-OBLIGATION-007).
    grace: 0,
    onMiss: [{ type: "quality/add", quality: "quality.standing", amount: -5 }],
    onDefault: [],
  },
  "obligation.held-funds-agent": {
    id: "obligation.held-funds-agent",
    type: "held-funds",
    currency: "NGN",
    amount: 0,
    rateBp: pct(3),
    term: null,
    locksPrincipal: true,
    sink: "held-funds-return",
    interestSink: "held-funds-interest",
    grace: 0,
    onMiss: [{ type: "quality/add", quality: "quality.standing", amount: -5 }],
    onDefault: [],
  },

  // road.md R-ROAD-006 and 007: the ransom nobody paid. It follows the character home or on to Italy.
  // the page gives no schedule, rate or grace, so it charges nothing a month and never defaults;
  // it stays open as what is owed.
  "obligation.agent-debt": {
    id: "obligation.agent-debt",
    type: "agent-debt",
    where: "any",
    currency: "NGN",
    amount: 0,
    rateBp: 0,
    term: null,
    locksPrincipal: false,
    sink: "agent-debt",
    interestSink: "agent-debt",
    grace: 0,
    onMiss: [],
    onDefault: [],
  },
};
