// The street's enjoyment and spending: streets:lagos-street-spending (decision 0012). Each is a priced now-act
// paid from the naira as it is done, under the money reason `enjoyment`; a repeat runs as often as the month's time
// allows (activity:acts-may-repeat-in-month), the barber and the clothes once a month. Joined into the activity table in
// activity.data.ts; place.data.ts stages each at its street.
import type { ActivityEntry, Id } from "@japacity/sim";

import { naira } from "../units";

export const enjoyActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // At Ojuelegba.
  // A wrap of suya from the spot by the stop.
  "activity.buy-suya": {
    id: "activity.buy-suya",
    slot: "none",
    when: "now",
    repeat: true,
    halfDays: 1,
    where: "home",
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(2500), reason: "enjoyment" }],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.belly", amount: 20 },
      { type: "quality/add", quality: "quality.wellbeing", amount: 5 },
    ],
    counts: [],
  },
  // Tea on the mallam's bench.
  "activity.mallam-tea": {
    id: "activity.mallam-tea",
    slot: "none",
    when: "now",
    repeat: true,
    halfDays: 1,
    where: "home",
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(500), reason: "enjoyment" }],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.wellbeing", amount: 4 },
      { type: "quality/add", quality: "quality.energy", amount: 5 },
      { type: "quality/add", quality: "quality.standing", amount: 1 },
    ],
    counts: [],
  },
  // A sachet of cold water: a purchase, so it runs as often as money allows and spends no time (activity:now-acts-and-month-acts, activity:now-acts-spend-half-days).
  "activity.pure-water": {
    id: "activity.pure-water",
    slot: "none",
    when: "now",
    purchase: true,
    halfDays: 0,
    where: "home",
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(100), reason: "enjoyment" }],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.energy", amount: 4 },
      { type: "quality/add", quality: "quality.wellbeing", amount: 2 },
    ],
    counts: [],
  },

  // At Bode Thomas.
  // A low cut at the barber's kiosk, once a month.
  "activity.barber": {
    id: "activity.barber",
    slot: "none",
    when: "now",
    halfDays: 1,
    where: "home",
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(3000), reason: "enjoyment" }],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.wellbeing", amount: 5 },
      { type: "quality/add", quality: "quality.standing", amount: 1 },
      { type: "quality/add", quality: "quality.interview-prep", amount: 2 },
    ],
    counts: [],
  },
  // The match at the viewing centre: a day on the bench.
  "activity.viewing-centre": {
    id: "activity.viewing-centre",
    slot: "none",
    when: "now",
    repeat: true,
    halfDays: 2,
    where: "home",
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(1000), reason: "enjoyment" }],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.wellbeing", amount: 8 },
      { type: "quality/add", quality: "quality.energy", amount: -3 },
      { type: "quality/add", quality: "quality.network", amount: 1 },
    ],
    counts: [],
  },
  // A cold one at the joint.
  "activity.beer-joint": {
    id: "activity.beer-joint",
    slot: "none",
    when: "now",
    repeat: true,
    halfDays: 1,
    where: "home",
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(2500), reason: "enjoyment" }],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.wellbeing", amount: 6 },
      { type: "quality/add", quality: "quality.belly", amount: 5 },
      { type: "quality/add", quality: "quality.energy", amount: -4 },
    ],
    counts: [],
  },
  // A night out that starts at the joint and ends at dawn.
  "activity.night-out": {
    id: "activity.night-out",
    slot: "none",
    when: "now",
    repeat: true,
    halfDays: 2,
    where: "home",
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(20000), reason: "enjoyment" }],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.wellbeing", amount: 12 },
      { type: "quality/add", quality: "quality.energy", amount: -20 },
      { type: "quality/add", quality: "quality.network", amount: 2 },
    ],
    counts: [],
  },

  // At Tejuosho Market.
  // New clothes from the market, once a month.
  "activity.buy-clothes": {
    id: "activity.buy-clothes",
    slot: "none",
    when: "now",
    halfDays: 2,
    where: "home",
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(15000), reason: "enjoyment" }],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.standing", amount: 2 },
      { type: "quality/add", quality: "quality.wellbeing", amount: 4 },
    ],
    counts: [],
  },
};
