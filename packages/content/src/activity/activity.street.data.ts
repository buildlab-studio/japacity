// The hidden places' life at home: streets:buy-phone-at-computer-village, streets:phone-sales-job, streets:apprentice-learns-repair, streets:sleeping-under-the-bridge and streets:stadium-morning-run. The figures are `tuning.street`. Joined into the activity table in
// activity.data.ts; place.data.ts stages each where it happens.
import type { ActivityEntry, Id } from "@japacity/sim";

import { tuning } from "../tuning/tuning.data";

const { street } = tuning;
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const TECH: Id<"quality"> = "quality.tech";

export const streetActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // streets:buy-phone-at-computer-village. The price is the activity kind's, read from the tuning and paid from cash, so the entry names none.
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
  // streets:phone-sales-job: hunted and held like any other job; each month held runs its effects.
  "activity.job-phone-sales": {
    id: "activity.job-phone-sales",
    slot: "main",
    employer: "informal",
    // Secondary school: the phone sellers at Computer Village are school leavers.
    requires: [{ type: "quality/min", quality: "quality.education-level", value: 1 }],
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
  // streets:apprentice-learns-repair: "under" the bar, so the most tech it allows is one below it.
  "activity.apprentice-repair": {
    id: "activity.apprentice-repair",
    slot: "free",
    requires: [{ type: "quality/max", quality: TECH, value: street.apprenticeUntil - 1 }],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    // quality:skill-bands-slow-gains: the apprenticeship's gain is a tech study's, given while starting; the bar stops it at 30.
    effects: [{ type: "quality/add", quality: WELLBEING, amount: -1 }],
    bandGains: [street.apprenticeTech],
    counts: [],
  },
  // streets:sleeping-under-the-bridge: only with nowhere else, naira cash and bank together under the broke line; the rest an empty slot gives.
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
  // streets:stadium-morning-run.
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
