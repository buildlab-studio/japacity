// The waiting months' acts (docs/rules/activity.md R-ACTIVITY-013): each moves a figure a route's gate
// reads, and each card names the route it counts toward. The developer's open source, tech posts, the
// talk and being noticed at work; the nurse's certification, sat as a quiz at the clinic; a master's at
// home for Canada's points. Joined into the activity table in activity.data.ts; place.data.ts stages each.
import type { ActivityEntry, Id, Requirement } from "@japacity/sim";

import { naira } from "../units";

const TALENT: Id<"route"> = "route.uk-talent";
const CARE: Id<"route"> = "route.uk-care";
const CANADA: Id<"route"> = "route.canada-points";
const STUDY: Id<"route"> = "route.uk-masters";

export const TALK: Id<"setpiece"> = "setpiece.conference-talk";
export const NURSE_EXAM: Id<"setpiece"> = "setpiece.nurse-exam";
const NURSE_CERTIFICATE: Id<"document"> = "document.nurse-certificate";
const MASTERS_FEES: Id<"obligation"> = "obligation.masters-at-home";

function atLeast(quality: Id<"quality">, value: number): Requirement {
  return { type: "quality/min", quality, value };
}

export const profileActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // The developer gives code away in public: network now, a portfolio piece every second month played.
  "activity.open-source": {
    id: "activity.open-source",
    slot: "free",
    once: true,
    requires: [atLeast("quality.tech", 40)],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.network", amount: 2 },
      { type: "quality/add", quality: "quality.wellbeing", amount: -2 },
    ],
    onMonth: [{ at: 2, repeat: true, effects: [{ type: "quality/add", quality: "quality.portfolio", amount: 1 }] }],
    counts: [TALENT],
  },
  // From the phone, beside the month: no slot, once a month. The endorsement reads the network as the "notable" line.
  "activity.tech-posts": {
    id: "activity.tech-posts",
    slot: "none",
    once: true,
    requires: [atLeast("quality.tech", 30)],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.network", amount: 1 },
      { type: "quality/add", quality: "quality.standing", amount: 1 },
    ],
    counts: [TALENT],
  },
  // Once a life: the set piece of one question is the talk itself, and a talk given closes it for good.
  "activity.conference-talk": {
    id: "activity.conference-talk",
    slot: "free",
    once: true,
    requires: [atLeast("quality.portfolio", 2), atLeast("quality.network", 40), { type: "not", of: { type: "setpiece/answered", setpiece: TALK } }],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "setpiece/open", setpiece: TALK, route: null },
      { type: "quality/add", quality: "quality.portfolio", amount: 1 },
      { type: "quality/add", quality: "quality.standing", amount: 5 },
      { type: "quality/add", quality: "quality.network", amount: 5 },
    ],
    // How the talk went, told from its one answer. What it gives stays the act's own.
    exam: { setpiece: TALK, pass: 1, effects: [] },
    counts: [TALENT],
  },
  // Any job, six months in: the raise is a draw the activity kind makes (tuning.activity), once for each job.
  // the six months are the months in work where the character is (activity/local-tenure), and the
  // raise goes to the job held now. A raise counts toward the funds the study visa and Canada's points ask for.
  "activity.be-noticed": {
    id: "activity.be-noticed",
    slot: "free",
    once: true,
    requires: [{ type: "job/any" }, { type: "activity/local-tenure", months: 6 }],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.standing", amount: 2 },
      { type: "quality/add", quality: "quality.wellbeing", amount: -3 },
    ],
    counts: [STUDY, CANADA],
  },
  // The nurse's certification: paid, sat as three questions at the clinic, passed with two right; a pass
  // asks for the certificate (two months) and adds care. Counts toward UK care.
  "activity.nurse-certification": {
    id: "activity.nurse-certification",
    slot: "free",
    once: true,
    requires: [atLeast("quality.care", 50), { type: "document/held", document: "document.nursing-licence" }, { type: "document/absent", document: NURSE_CERTIFICATE }],
    param: null,
    cost: [{ currency: "NGN", amount: naira(120000), reason: "fee-test" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "setpiece/open", setpiece: NURSE_EXAM, route: null }],
    exam: {
      setpiece: NURSE_EXAM,
      pass: 2,
      effects: [
        { type: "document/request", document: NURSE_CERTIFICATE },
        { type: "quality/add", quality: "quality.care", amount: 10 },
      ],
    },
    counts: [CARE],
  },
  // A master's at home: twelve months of one slot, the fees an obligation of twelve instalments opened in the
  // first month, the level of a master's in the twelfth. Counts toward Canada's points (the education row).
  "activity.masters-at-home": {
    id: "activity.masters-at-home",
    slot: "free",
    once: true,
    requires: [atLeast("quality.edu-level", 3), { type: "quality/max", quality: "quality.edu-level", value: 3 }],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: -2 }],
    onMonth: [
      { at: 1, effects: [{ type: "obligation/open", obligation: MASTERS_FEES, principal: naira(1800000) }] },
      { at: 12, effects: [{ type: "quality/add", quality: "quality.edu-level", amount: 1 }] },
    ],
    counts: [CANADA],
  },
};
