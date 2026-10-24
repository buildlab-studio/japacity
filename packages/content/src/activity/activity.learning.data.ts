// Learning tech at home in bands (quality:skill-bands-slow-gains): the free path (activity:free-path-keeps-a-streak) and the paid
// paths (activity:paid-tech-courses, activity:bootcamp-paid-after-a-job), and the trades' papers (document:trade-papers). The
// day's coding class is in activity.data.ts. From activity.md, "Free-slot activities"; the band gains are working values.
// Joined into the activity table in activity.data.ts; place.data.ts stages each.
import type { ActivityEntry, Id } from "@japacity/sim";

import { tuning } from "../tuning/tuning.data";
import { naira } from "../units";

export const ICAN_EXAM: Id<"setpiece"> = "setpiece.ican-exam";
const DIPLOMA_FEES: Id<"obligation"> = "obligation.tech-diploma";

export const learningActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // The free path: the month's data, +3, +2, +1 by band and nothing from 70, where real skill comes from work.
  "activity.learn-free": {
    id: "activity.learn-free",
    slot: "free",
    once: true,
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: tuning.activity.freePathData, reason: "study" }],
    pay: null,
    hireBp: null,
    effects: [],
    bandGains: [3, 2, 1],
    counts: [],
  },
  // A short paid course: ₦45,000 once at its start, three months, +6 while starting and +3 up to 59.
  "activity.online-course": {
    id: "activity.online-course",
    slot: "free",
    once: true,
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(45000), reason: "study" }],
    pay: null,
    hireBp: null,
    effects: [],
    bandGains: [6, 3, 3],
    bandUntil: 59,
    course: { months: 3, effects: [{ type: "quality/add", quality: "quality.portfolio", amount: 1 }] },
    counts: [],
  },
  // A year's diploma: ₦40,000 a month as its own obligation, opened in its first month.
  "activity.tech-diploma": {
    id: "activity.tech-diploma",
    slot: "free",
    once: true,
    requires: [],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [],
    onMonth: [{ at: 1, effects: [{ type: "obligation/open", obligation: DIPLOMA_FEES, principal: naira(480000) }] }],
    bandGains: [4, 3, 2],
    course: {
      months: 12,
      effects: [
        { type: "quality/add", quality: "quality.portfolio", amount: 2 },
        { type: "quality/add", quality: "quality.network", amount: 5 },
      ],
    },
    counts: [],
  },
  // A full-time bootcamp: the entry test judged at its start, six months with no job, paid after a developer job.
  "activity.bootcamp": {
    id: "activity.bootcamp",
    slot: "free",
    once: true,
    requires: [
      { type: "quality/min", quality: "quality.tech", value: 10 },
      { type: "quality/min", quality: "quality.english", value: 55 },
    ],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [],
    bandGains: [6, 5, 5],
    bandUntil: 54,
    course: {
      months: 6,
      effects: [
        { type: "quality/add", quality: "quality.portfolio", amount: 3 },
        { type: "quality/add", quality: "quality.network", amount: 10 },
      ],
    },
    counts: [],
  },
  // An 8-week online internship for the junior-ready: free, +2 a month up to 69.
  "activity.free-internship": {
    id: "activity.free-internship",
    slot: "free",
    once: true,
    requires: [{ type: "quality/min", quality: "quality.tech", value: 30 }],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [],
    bandGains: [2, 2, 2],
    bandUntil: 69,
    course: {
      months: 2,
      effects: [
        { type: "quality/add", quality: "quality.portfolio", amount: 1 },
        { type: "quality/add", quality: "quality.network", amount: 5 },
      ],
    },
    counts: [],
  },

  // document:trade-papers: the teaching registration, asked for from the Papers app.
  "activity.get-trcn": {
    id: "activity.get-trcn",
    slot: "free",
    where: "home",
    requires: [
      { type: "quality/min", quality: "quality.education-level", value: 3 },
      { type: "document/absent", document: "document.trcn" },
    ],
    param: null,
    cost: [{ currency: "NGN", amount: naira(25000), reason: "fee-document" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "document/request", document: "document.trcn" }],
    counts: [],
  },
  // document:trade-papers: the chartered exams, a slot for 18 months; the activity kind sits each paper in its 6th, 12th and 18th month.
  "activity.ican-exams": {
    id: "activity.ican-exams",
    slot: "free",
    where: "home",
    once: true,
    requires: [
      { type: "quality/min", quality: "quality.education-level", value: 3 },
      { type: "document/absent", document: "document.ican" },
    ],
    param: null,
    // Paid on the day of each sitting; a sitting that cannot be paid waits six months for the next.
    cost: [{ currency: "NGN", amount: naira(50000), reason: "fee-test" }],
    pay: null,
    hireBp: null,
    effects: [],
    onMonth: [{ at: 6, repeat: true, effects: [{ type: "setpiece/open", setpiece: ICAN_EXAM, route: null }] }],
    exam: { setpiece: ICAN_EXAM, pass: 2, sittings: 3, effects: [{ type: "document/request", document: "document.ican" }] },
    counts: [],
  },
};
