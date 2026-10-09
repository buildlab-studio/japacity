// The hidden places' life at home: docs/rules/streets.md R-STREET-001 to 004
// and 008. The figures are `tuning.street`. Joined into the activity table in
// activity.data.ts; place.data.ts stages each where it happens.
import type { ActivityEntry, Id } from "@japacity/sim";

import { tuning } from "../tuning/tuning.data";

const { street } = tuning;
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const TECH: Id<"quality"> = "quality.tech";

export const streetActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // R-STREET-001. The price is the activity kind's, read from the tuning and paid from cash, so the entry names none.
  "activity.buy-phone": {
    id: "activity.buy-phone",
    slot: "none",
    requires: [],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: WELLBEING, amount: street.phoneMood },
      { type: "quality/add", quality: "quality.network", amount: street.phoneNetwork },
    ],
    counts: [],
  },
  // R-STREET-002: hunted and held like any other job; each month held runs its effects.
  "activity.job-phone-sales": {
    id: "activity.job-phone-sales",
    slot: "main",
    requires: [{ type: "quality/min", quality: "quality.edu-level", value: 2 }],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: street.salesPay },
    hireBp: street.salesHireBp,
    effects: [
      { type: "quality/add", quality: TECH, amount: 1 },
      { type: "quality/add", quality: WELLBEING, amount: -1 },
    ],
    counts: [],
  },
  // R-STREET-003: "under" the bar, so the most tech it allows is one below it.
  "activity.apprentice-repair": {
    id: "activity.apprentice-repair",
    slot: "free",
    requires: [{ type: "quality/max", quality: TECH, value: street.apprenticeUntil - 1 }],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: TECH, amount: street.apprenticeTech },
      { type: "quality/add", quality: WELLBEING, amount: -1 },
    ],
    counts: [],
  },
  // R-STREET-004: only with nowhere else, naira cash and bank together under the broke line; the rest an empty slot gives.
  "activity.sleep-rough": {
    id: "activity.sleep-rough",
    slot: "free",
    requires: [{ type: "not", of: { type: "money/min", currency: "NGN", amount: tuning.place.brokeLine } }],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [{ type: "quality/add", quality: WELLBEING, amount: tuning.quality.wellbeingRest }],
    counts: [],
  },
  // R-STREET-008.
  "activity.morning-run": {
    id: "activity.morning-run",
    slot: "free",
    requires: [],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [{ type: "quality/add", quality: WELLBEING, amount: street.runMood }],
    counts: [],
  },
};
