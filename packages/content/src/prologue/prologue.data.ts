// From docs/rules/prologue.md, "The steps" and "The apprenticeship branch". A
// step's months are added to age when it is answered (R-PROLOGUE-004).
//
// the first step is `draw`, the opening card that shows step 0's draw;
// its one answer begins the prologue.
// an answer's requirements read qualities, not flags or the draw, so
// "science" is tech 10 or more (only science gives tech before the course), and
// "town" is network 13 or less (only a town child of parents without schooling
// is that low after the subjects step).
// a retake is allowed once. The second retake card offers only work,
// since a second retake or the apprenticeship would end the prologue past 25.
import type { Effect, Id, PrologueStep, Requirement } from "@japacity/sim";

import { naira } from "../units";

type Answer = PrologueStep["answers"][number];
type Outcome = NonNullable<Answer["draw"]>[number];

function add(quality: Id<"quality">, amount: number): Effect {
  return { type: "quality/add", quality, amount };
}

/** Earned cash, to the cash pocket (R-PROLOGUE-003). */
function earned(amount: number): Effect {
  return { type: "money/add", currency: "NGN", pocket: "cash", amount, reason: "gig" };
}

function answer(id: string, effects: Effect[], more: Partial<Omit<Answer, "id" | "effects">> = {}): Answer {
  return {
    id,
    requires: more.requires ?? [],
    effects,
    flags: more.flags ?? [],
    gradeBase: more.gradeBase ?? 0,
    next: more.next ?? null,
    draw: more.draw ?? null,
  };
}

function outcome(id: string, bp: number, effects: Effect[], next: string | null): Outcome {
  return { id, bp, effects, next };
}

const TECH = "quality.tech";
const ENGLISH = "quality.english";
const NETWORK = "quality.network";
const STANDING = "quality.standing";
const WELLBEING = "quality.wellbeing";
const EDU_LEVEL = "quality.edu-level";

/** At the first retake card the character is 213 months old; at a second, 228. */
const FIRST_RETAKE_ONLY: Requirement = { type: "quality/max", quality: "quality.age-months", value: 226 };

/** The shop job after school: edu-level 1, ₦70,000 a month saved for a year. */
const SHOP_WORK: Effect[] = [add(EDU_LEVEL, 1), earned(naira(300000))];

export const prologueTable: Record<string, PrologueStep> = {
  draw: {
    id: "draw",
    months: 0,
    next: "subjects",
    answers: [answer("begin", [])],
  },

  subjects: {
    id: "subjects",
    months: 12,
    next: "after-school",
    answers: [
      answer("science", [add(TECH, 10), add(ENGLISH, 5)]),
      answer("arts", [add(ENGLISH, 15), add(NETWORK, 5)]),
      answer("commercial", [add(ENGLISH, 8), add(NETWORK, 8), add(TECH, 3)]),
    ],
  },

  // the school certificate fee (₦27,500) and the entrance exam fee (₦8,700) are paid by the family and
  // move nothing the character holds. The standing -2 for a family under 30 needs an effect that reads a quality,
  // which an answer cannot hold, so it is left to the prologue kind.
  "after-school": {
    id: "after-school",
    months: 6,
    next: null,
    answers: [
      answer("jamb", [], { next: "exam" }),
      answer("apprentice", [], {
        requires: [
          {
            type: "any",
            of: [
              { type: "quality/max", quality: "quality.family-means", value: 39 },
              { type: "quality/max", quality: NETWORK, value: 13 },
            ],
          },
        ],
        next: "master",
      }),
      answer("work", SHOP_WORK, { next: "shop" }),
    ],
  },

  // The cut-off is 150 of 400; the pass chances stand in for it. `expo` is caught with chance 2000, so its four
  // outcomes are pass or fail, caught or not.
  exam: {
    id: "exam",
    months: 3,
    next: null,
    answers: [
      answer("study", [add(WELLBEING, -5)], {
        draw: [outcome("pass", 7500, [], "course"), outcome("fail", 2500, [], "retake")],
      }),
      answer("cram", [], {
        draw: [outcome("pass", 5000, [], "course"), outcome("fail", 5000, [], "retake")],
      }),
      answer("expo", [], {
        flags: ["cut-corner"],
        draw: [
          outcome("pass", 5200, [], "course"),
          outcome("pass-caught", 1300, [add(STANDING, -5)], "course"),
          outcome("fail", 2800, [], "retake"),
          outcome("fail-caught", 700, [add(STANDING, -5)], "retake"),
        ],
      }),
    ],
  },

  retake: {
    id: "retake",
    months: 12,
    next: null,
    answers: [
      answer("again", [], { requires: [FIRST_RETAKE_ONLY], next: "exam" }),
      answer("apprentice", [], { requires: [FIRST_RETAKE_ONLY], next: "master" }),
      answer("work", SHOP_WORK, { next: "shop" }),
    ],
  },

  course: {
    id: "course",
    months: 12,
    next: "university",
    answers: [
      answer("computer-science", [add(TECH, 20)]),
      answer("nursing", [add("quality.care", 30)], {
        requires: [{ type: "quality/min", quality: TECH, value: 10 }],
        flags: ["nurse"],
      }),
      answer("accounting", [add(NETWORK, 10), add(ENGLISH, 5)]),
      answer("mass-comm", [add(ENGLISH, 15), add(NETWORK, 10)]),
    ],
  },

  // federal or private is its own card with no months, because an answer cannot change its effects by
  // family means. Federal is open to all; its ₦110,000 a session is paid by the family. Private needs family means
  // 60: the family's ₦2,500,000 passes through the account as a flagged gift and out as the session's fee.
  university: {
    id: "university",
    months: 0,
    next: "strike",
    answers: [
      answer("federal", []),
      answer(
        "private",
        [
          { type: "money/add", currency: "NGN", pocket: "bank", amount: naira(2500000), reason: "gift", flagged: true },
          { type: "money/take", currency: "NGN", pocket: "bank", amount: naira(2500000), reason: "fee-school" },
          add(STANDING, 5),
        ],
        { requires: [{ type: "quality/min", quality: "quality.family-means", value: 60 }], gradeBase: 1 },
      ),
    ],
  },

  // the strike draw follows the answer, and the answer's effects apply only if the strike comes. A strike
  // adds its 8 months through the `strike-drag` card.
  strike: {
    id: "strike",
    months: 12,
    next: null,
    answers: [
      answer("wait", [], {
        draw: [outcome("strike", 5000, [add(WELLBEING, -8)], "strike-drag"), outcome("no-strike", 5000, [], "side-skill")],
      }),
      answer("learn", [], {
        draw: [
          outcome("strike", 5000, [add(TECH, 10), add(WELLBEING, -3)], "strike-drag"),
          outcome("no-strike", 5000, [], "side-skill"),
        ],
      }),
      answer("hustle", [], {
        draw: [
          outcome("strike", 5000, [earned(naira(250000)), add(NETWORK, 5)], "strike-drag"),
          outcome("no-strike", 5000, [], "side-skill"),
        ],
      }),
    ],
  },
  "strike-drag": {
    id: "strike-drag",
    months: 8,
    next: "side-skill",
    answers: [answer("back", [])],
  },

  "side-skill": {
    id: "side-skill",
    months: 12,
    next: "hustle",
    answers: [
      answer("code", [add(TECH, 15), add(WELLBEING, -4)]),
      answer("trade", [add(NETWORK, 10), earned(naira(200000))]),
      answer("content", [add(NETWORK, 15), add(STANDING, -5)]),
      answer("books", [add(WELLBEING, -4)], { gradeBase: 1 }),
    ],
  },

  hustle: {
    id: "hustle",
    months: 12,
    next: "graduation",
    answers: [
      answer("freelance", [add("quality.portfolio", 1), earned(naira(400000))], {
        requires: [{ type: "quality/min", quality: TECH, value: 30 }],
      }),
      answer("campus-shop", [earned(naira(350000)), add(NETWORK, 5)]),
      answer("focus", [], { gradeBase: 1 }),
    ],
  },

  // No choice: one answer is allowed. The grade (2 plus grade base, +1 at 4000, -1 at 2000 after `expo`, kept
  // between 2 and 5) is the prologue kind's: an answer has no field for it. Care 30 or more is a nurse.
  graduation: {
    id: "graduation",
    months: 3,
    next: "service",
    answers: [
      answer("results", [add(EDU_LEVEL, 3)], {
        requires: [{ type: "quality/max", quality: "quality.care", value: 29 }],
      }),
      answer("results-nurse", [add(EDU_LEVEL, 3), add("quality.care", 10), { type: "document/grant", document: "document.nursing-licence" }], {
        requires: [{ type: "quality/min", quality: "quality.care", value: 30 }],
      }),
    ],
  },

  // The allowance is ₦77,000 a month; what is left after living is the cash.
  service: {
    id: "service",
    months: 12,
    next: "friend",
    answers: [
      answer("serve", [add(STANDING, 8), add(NETWORK, 8), add(WELLBEING, 4), earned(naira(500000))]),
      answer("redeploy", [add(NETWORK, 15), earned(naira(300000)), add(STANDING, 2)], {
        requires: [{ type: "quality/min", quality: "quality.family-means", value: 40 }],
      }),
      answer("skip", [add(STANDING, -10), earned(naira(700000))], { flags: ["no-nysc"] }),
    ],
  },

  friend: {
    id: "friend",
    months: 1,
    next: "home",
    answers: [
      answer("uk", [{ type: "route/hear", route: "route.uk-masters", via: "friend" }]),
      answer("canada", [{ type: "route/hear", route: "route.canada-points", via: "friend" }]),
      answer("tech", [{ type: "route/hear", route: "route.uk-talent", via: "friend" }], {
        requires: [{ type: "quality/min", quality: TECH, value: 40 }],
      }),
      answer("nowhere", [add(STANDING, 2), add(WELLBEING, 3)]),
    ],
  },

  // Closes the prologue: the upkeep opens at the amount chosen (R-PROLOGUE-006).
  home: {
    id: "home",
    months: 0,
    next: null,
    answers: [
      answer("family-house", [
        { type: "obligation/open", obligation: "obligation.upkeep", amount: naira(95000) },
        add(STANDING, 3),
      ]),
      answer(
        "room",
        [
          { type: "obligation/open", obligation: "obligation.upkeep", amount: naira(180000) },
          add(WELLBEING, 8),
          add(STANDING, -2),
        ],
        { requires: [{ type: "money/min", currency: "NGN", amount: naira(300000), pocket: "cash" }] },
      ),
    ],
  },

  // The apprenticeship branch: six years, no stipend, a settlement at the end.

  master: {
    id: "master",
    months: 24,
    next: "years",
    answers: [
      answer("electronics", [add(EDU_LEVEL, 1), add(TECH, 8)]),
      answer("textiles", [add(EDU_LEVEL, 1), add(NETWORK, 8)]),
      answer("spare-parts", [add(EDU_LEVEL, 1), add(NETWORK, 5), add(STANDING, 3)]),
    ],
  },
  years: {
    id: "years",
    months: 24,
    next: null,
    answers: [
      answer("stay", [add(NETWORK, 15), add(STANDING, 5)], { next: "settlement" }),
      answer("leave", [earned(naira(150000)), add(STANDING, -8)], { next: "friend" }),
    ],
  },
  settlement: {
    id: "settlement",
    months: 24,
    next: "friend",
    answers: [
      answer("settle", [], {
        draw: [
          outcome("generous", 3000, [earned(naira(6000000)), add("quality.land", 1)], "friend"),
          outcome("fair", 5000, [earned(naira(2500000))], "friend"),
          outcome("cheated", 2000, [earned(naira(400000)), add(STANDING, -5)], "friend"),
        ],
      }),
    ],
  },

  // the page sends the shop job straight to step 10, which would end the prologue at 17 or 18. Four years
  // behind the counter bring it to about 22, as the other paths do.
  shop: {
    id: "shop",
    months: 48,
    next: "friend",
    answers: [
      answer("stay", [add(NETWORK, 5), add(STANDING, 2)]),
      answer("save", [earned(naira(200000)), add(WELLBEING, -4)]),
    ],
  },
};
