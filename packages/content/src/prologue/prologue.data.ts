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
import { int, pocketFor, type Effect, type Id, type PrologueStep, type Requirement, type ScenarioEntry } from "@japacity/sim";

import { qualityTable } from "../quality/quality.data";
import { tuning } from "../tuning/tuning.data";
import { naira } from "../units";

/** R-HOME-010: what the room in a compound takes at once, the year's rent and the agent's and the agreement's fees on it. */
const COMPOUND_MOVE_IN = tuning.home.compound.rentYear + int.bp(tuning.home.compound.rentYear, tuning.home.compound.feesBp);

type Answer = PrologueStep["answers"][number];
type Outcome = NonNullable<Answer["draw"]>[number];

function add(quality: Id<"quality">, amount: number): Effect {
  return { type: "quality/add", quality, amount };
}

/** Earned money (R-PROLOGUE-003), to the pocket its size takes (R-WALLET-018): years of earnings land in the bank. */
function earned(amount: number): Effect {
  return { type: "money/add", currency: "NGN", pocket: pocketFor(amount, tuning.wallet), amount, reason: "gig" };
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
const CARE = "quality.care";
const ENGLISH = "quality.english";
const NETWORK = "quality.network";
const STANDING = "quality.standing";
const WELLBEING = "quality.wellbeing";
const EDU_LEVEL = "quality.edu-level";
const AGE = "quality.age-months";

/** The age card keeps every start inside 18 years and 29 years and 11 months (R-PROLOGUE-009). */
const YOUNGEST = 18 * 12;
const OLDEST = 29 * 12 + 11;
/** What each year older brings in saving, the brief's working value. */
const OLDER_SAVED = 120000;

/** At the first retake card the character is 213 months old; at a second, 228. */
const FIRST_RETAKE_ONLY: Requirement = { type: "quality/max", quality: "quality.age-months", value: 226 };

/** The shop job after school: edu-level 1, ₦70,000 a month saved for a year. */
const SHOP_WORK: Effect[] = [add(EDU_LEVEL, 1), earned(naira(300000))];

/**
 * R-PROLOGUE-001 starts every quality at its minimum, and nothing on the page lifts wellbeing from 0, so
 * the life opened run down and fell ill by its third month. The draw card's answer gives the sixteen-year-old the
 * wellbeing the fixed lives start with (50 to 70); the answers after it move it by -22 to +15, so every path closes
 * above the run-down line.
 */
const START_WELLBEING = 60;

export const prologueTable: Record<string, PrologueStep> = {
  draw: {
    id: "draw",
    months: 0,
    next: "subjects",
    answers: [answer("begin", [add(WELLBEING, START_WELLBEING)])],
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
          { type: "money/add", currency: "NGN", pocket: "bank", amount: tuning.prologue.privateSession, reason: "gift", flagged: true },
          { type: "money/take", currency: "NGN", pocket: "bank", amount: tuning.prologue.privateSession, reason: "fee-school" },
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
  // Graduating as a nurse adds care 30 with the licence, so the course and the licence leave her at care 60,
  // the staff nurse's bar (prologue.md R-PROLOGUE-010).
  graduation: {
    id: "graduation",
    months: 3,
    next: "service",
    answers: [
      answer("results", [add(EDU_LEVEL, 3)], {
        requires: [{ type: "quality/max", quality: "quality.care", value: 29 }],
      }),
      answer("results-nurse", [add(EDU_LEVEL, 3), add("quality.care", 30), { type: "document/grant", document: "document.nursing-licence" }], {
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
    next: "age",
    answers: [
      answer("uk", [{ type: "route/hear", route: "route.uk-masters", via: "friend" }]),
      answer("canada", [{ type: "route/hear", route: "route.canada-points", via: "friend" }]),
      answer("tech", [{ type: "route/hear", route: "route.uk-talent", via: "friend" }], {
        requires: [{ type: "quality/min", quality: TECH, value: 40 }],
      }),
      // The nurses' crowd: a life with care behind it hears of care work abroad at its own send-off, so its chapters lean that way.
      answer("care", [{ type: "route/hear", route: "route.uk-care", via: "friend" }], {
        requires: [{ type: "quality/min", quality: CARE, value: 30 }],
      }),
      answer("nowhere", [add(STANDING, 2), add(WELLBEING, 3)]),
      // The drivers' crowd: a trade's send-off talks of driving in the Gulf, so the Gulf is heard before the motor park.
      answer("drivers", [{ type: "route/hear", route: "route.gulf-contract", via: "friend" }]),
    ],
  },

  // The age in steps (R-PROLOGUE-009, the review): the front door's tile sends the step the player set,
  // never typed. Older starts with a little more saved and, from two years, the passport held; younger has more
  // years before the young-favouring routes close. Each step keeps the start inside 18 to 29. The first answer
  // changes nothing, so a life that takes the first open answer keeps its years.
  age: {
    id: "age",
    months: 0,
    next: "home",
    answers: [
      answer("as-is", []),
      ...[1, 2, 3].map((years) => answer(`younger-${String(years)}`, [add(AGE, -12 * years)], { requires: [{ type: "quality/min", quality: AGE, value: YOUNGEST + 12 * years }] })),
      ...[1, 2, 3].map((years) =>
        answer(`older-${String(years)}`, [add(AGE, 12 * years), earned(naira(OLDER_SAVED * years)), ...(years >= 2 ? [{ type: "document/grant", document: "document.passport" } as const] : [])], {
          requires: [{ type: "quality/max", quality: AGE, value: OLDEST - 12 * years }],
        }),
      ),
    ],
  },

  // Closes the prologue: the upkeep opens at the amount chosen (R-PROLOGUE-006), the room in a compound's year
  // (R-PROLOGUE-013, home.md R-HOME-010), or Makoko's rent (R-PROLOGUE-012).
  home: {
    id: "home",
    months: 0,
    next: null,
    answers: [
      answer("family-house", [
        { type: "obligation/open", obligation: "obligation.upkeep", amount: naira(95000) },
        add(STANDING, 3),
      ]),
      // A room of one's own: the year's rent and the fees taken at once, the year paid (R-OBLIGATION-015), the room's
      // own upkeep in place of the family's, and the move. Held first: the rent, the fees and a month of living there.
      answer(
        "compound-room",
        [
          { type: "money/take", currency: "NGN", pocket: "any", amount: COMPOUND_MOVE_IN, reason: "rent" },
          { type: "obligation/open", obligation: "obligation.rent-compound", amount: tuning.home.compound.rentYear },
          { type: "obligation/open", obligation: "obligation.upkeep-compound", amount: tuning.home.compound.upkeep },
          { type: "home/move", place: "place.compound-room" },
        ],
        { requires: [{ type: "money/can-pay", currency: "NGN", amount: COMPOUND_MOVE_IN + tuning.home.compound.upkeep }] },
      ),
      // A room on the water (R-PROLOGUE-012, home.md): the rent opens first so the card says it as the other homes
      // do, and the move takes the room at that charge. The family house stays there to go back to.
      answer("makoko", [
        { type: "obligation/open", obligation: "obligation.upkeep-makoko", amount: tuning.home.makokoUpkeep },
        { type: "home/move", place: "place.makoko" },
      ]),
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

/**
 * R-PROLOGUE-001: the life the prologue builds from. Every quality at its
 * minimum but age, at sixteen; no money, job, documents or obligations.
 * Joined to the scenario table in index.ts by the maintainer.
 */
export const prologueScenario: ScenarioEntry = {
  id: "scenario.prologue",
  prologue: true,
  qualities: {
    ...Object.fromEntries(Object.values(qualityTable).map((entry) => [entry.id, entry.min])),
    "quality.age-months": tuning.prologue.startAgeMonths,
  },
  job: null,
  tenure: {},
  // The prologue draws the siblings (R-PROLOGUE-002); nothing starts with any.
  siblings: 0,
  pockets: {},
  documents: [],
  obligations: [],
};
