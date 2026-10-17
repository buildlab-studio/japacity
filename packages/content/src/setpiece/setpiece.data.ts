// From docs/rules/route.md, "Entry: setpiece.credibility-interview"; road.md for the
// road's two set pieces; return.md for the December visit.
import { int, type Currency, type Effect, type Id, type Requirement, type SetpieceAnswer, type SetpieceQuestion, type SetpieceEntry } from "@japacity/sim";

import { countryTable } from "../country/country.data";
import { tuning } from "../tuning/tuning.data";
import { naira, pct } from "../units";
import { NURSE_EXAM, TALK } from "../activity/activity.profile.data";

const UK: Id<"route"> = "route.uk-masters";

/**
 * A quiz question (R-ACTIVITY-013): the right answer scores 1 and the rest 0. On the last question
 * every answer marks the paper (`activity/exam`), so the pass is judged the moment it is answered.
 */
function examQuestion(id: string, answers: string[], right: string, last: boolean): SetpieceQuestion {
  const mark: Effect[] = last ? [{ type: "activity/exam", activity: "activity.nurse-certification" }] : [];
  return { id, when: [], answers: answers.map((answer) => ({ id: answer, score: answer === right ? 1 : 0, when: [], thenScore: null, effects: mark })) };
}

// ---------------------------------------------------------------------------
// The December visit: return.md R-RETURN-005
// ---------------------------------------------------------------------------

/** The countries the December visit is flown from, with the suffix their questions carry. */
export const DECEMBER_COUNTRIES: { country: Id<"country">; suffix: string }[] = [
  { country: "country.uk", suffix: "uk" },
  { country: "country.canada", suffix: "ca" },
  { country: "country.uae", suffix: "uae" },
  { country: "country.italy", suffix: "it" },
];

/**
 * The page's spending, in naira, with what each answer moves. The answer that
 * costs nothing comes first, as "not this year" does on the go question.
 */
const SPENDING: { question: string; answers: { id: string; naira: number; gains: [Id<"quality">, number][] }[] }[] = [
  {
    question: "party",
    answers: [
      { id: "home", naira: 0, gains: [["quality.standing", -3], ["quality.wellbeing", 1]] },
      { id: "big", naira: 400000, gains: [["quality.standing", 6], ["quality.wellbeing", 6], ["quality.network", 4]] },
      { id: "small", naira: 120000, gains: [["quality.standing", 2], ["quality.wellbeing", 4], ["quality.network", 2]] },
    ],
  },
  {
    question: "gifts",
    answers: [
      { id: "none", naira: 0, gains: [["quality.standing", -6], ["quality.wellbeing", -3]] },
      { id: "all", naira: 600000, gains: [["quality.standing", 8], ["quality.wellbeing", 2]] },
      { id: "some", naira: 200000, gains: [["quality.standing", 3]] },
    ],
  },
  {
    question: "look",
    answers: [
      { id: "plain", naira: 0, gains: [["quality.standing", -1]] },
      { id: "outfit", naira: 250000, gains: [["quality.standing", 4], ["quality.wellbeing", 3]] },
    ],
  },
];

function countryOf(id: Id<"country">) {
  const entry = countryTable[id];
  if (entry === undefined) throw new Error(`The December visit names ${id}, which is not a country.`);
  return entry;
}

/** R-RETURN-005 and R-PLACE-006: the fare both ways, each way times the December factor, in the country's currency. */
export function decemberFare(id: Id<"country">): { currency: Currency; amount: number } {
  const entry = countryOf(id);
  return { currency: entry.currency, amount: 2 * int.bp(entry.fare, entry.decemberFactorBp) };
}

/**
 * A naira amount of the page in the country's currency, in whole units.
 * the page pays it "at the official rate", and an answer's effect
 * holds a fixed amount, so it is converted once at the content's starting
 * official rate (`tuning.rate.start`).
 */
export function decemberPrice(id: Id<"country">, whole: number): { currency: Currency; amount: number } {
  const { currency } = countryOf(id);
  if (currency === "NGN" || whole === 0) return { currency, amount: 0 };
  const units = int.mulDiv(naira(whole), 1, tuning.rate.start[currency]);
  return { currency, amount: units * int.MINOR_PER_UNIT };
}

function gain(quality: Id<"quality">, amount: number): Effect {
  return { type: "quality/add", quality, amount };
}

function answer(id: string, effects: Effect[]): SetpieceAnswer {
  return { id, score: 0, when: [], thenScore: null, effects };
}

/**
 * R-SETPIECE-003: an answer that pays is given only while the money is there.
 * route.md says `money/can-pay`, which for a foreign
 * currency also counts the naira bank (R-WALLET-009), while `money/take` from
 * `any` takes only that currency's cash and bank. Judged with `money/can-pay`,
 * an answer could pass with the money in naira and then take nothing, so it is
 * judged with `money/min` on the pockets the debit takes from, as the offer
 * and obligation kinds judge a foreign debit.
 */
function paying(id: string, price: { currency: Currency; amount: number }, effects: Effect[]): SetpieceAnswer {
  return { ...answer(id, effects), requires: [{ type: "money/min", currency: price.currency, amount: price.amount }] };
}

/**
 * One country's December: first whether to go, then the party, the gifts and
 * the look, each answer paying in the country's currency (reason `social` for
 * the party and the look, `family` for the gifts) and moving the qualities the
 * page gives. Staying home closes the scene (R-SETPIECE-004), and every answer
 * that pays needs the money for it (R-SETPIECE-003).
 */
export function decemberQuestions({ country, suffix }: { country: Id<"country">; suffix: string }, index: number): SetpieceQuestion[] {
  const here: Requirement[] =
    index === 0
      ? // the first country's questions are asked wherever the character is in none of the
        // others, so the scene still has questions when an effect opens it at home.
        DECEMBER_COUNTRIES.slice(1).map((other): Requirement => ({ type: "not", of: { type: "place/is", where: "abroad", country: other.country } }))
      : [{ type: "place/is", where: "abroad", country }];
  const fare = decemberFare(country);
  const go: SetpieceQuestion = {
    id: `go-${suffix}`,
    when: here,
    answers: [
      { ...answer("stay", []), closes: true },
      paying("go", fare, [{ type: "money/take", currency: fare.currency, pocket: "transfer", amount: fare.amount, reason: "fare" }]),
    ],
  };
  const spending = SPENDING.map(
    (question): SetpieceQuestion => ({
      id: `${question.question}-${suffix}`,
      when: here,
      answers: question.answers.map((option) => {
        const price = decemberPrice(country, option.naira);
        const reason = question.question === "gifts" ? "family" : "social";
        const gains = option.gains.map(([quality, amount]) => gain(quality, amount));
        if (price.amount === 0) return answer(option.id, gains);
        return paying(option.id, price, [{ type: "money/take", currency: price.currency, pocket: "transfer", amount: price.amount, reason }, ...gains]);
      }),
    }),
  );
  return [go, ...spending];
}

export const setpieceTable: Record<Id<"setpiece">, SetpieceEntry> = {
  "setpiece.credibility-interview": {
    id: "setpiece.credibility-interview",
    ask: 3,
    questions: [
      {
        id: "why-uk",
        when: [],
        answers: [
          {
            id: "course",
            score: 0,
            when: [{ type: "quality/min", quality: "quality.interview-prep", value: 20 }],
            thenScore: 2,
            effects: [],
          },
          { id: "better", score: -1, when: [], thenScore: null, effects: [] },
          { id: "agent", score: -2, when: [], thenScore: null, effects: [], followUp: "agent-said" },
        ],
      },
      {
        id: "who-pays",
        when: [],
        answers: [
          {
            id: "own",
            score: -2,
            when: [{ type: "route/unexplained-max", route: UK, bp: pct(20) }],
            thenScore: 2,
            effects: [],
          },
          { id: "lender", score: 0, when: [], thenScore: null, effects: [] },
          { id: "sponsor", score: -1, when: [], thenScore: null, effects: [], followUp: "sponsor-who" },
        ],
      },
      {
        id: "after",
        when: [],
        answers: [
          { id: "return", score: 2, when: [], thenScore: null, effects: [] },
          { id: "undecided", score: -1, when: [], thenScore: null, effects: [] },
          { id: "stay", score: -2, when: [], thenScore: null, effects: [] },
        ],
      },
      {
        id: "course",
        when: [],
        answers: [
          {
            id: "detail",
            score: -1,
            when: [{ type: "quality/min", quality: "quality.interview-prep", value: 40 }],
            thenScore: 2,
            effects: [],
          },
          { id: "brief", score: 0, when: [], thenScore: null, effects: [] },
        ],
      },
      {
        id: "deposit",
        // Asked when the unexplained share is above 30%.
        when: [{ type: "not", of: { type: "route/unexplained-max", route: UK, bp: pct(30) } }],
        answers: [
          { id: "agreement", score: 0, when: [], thenScore: null, effects: [] },
          { id: "gift", score: -2, when: [], thenScore: null, effects: [], followUp: "gift-uncle" },
          { id: "savings", score: -2, when: [], thenScore: null, effects: [] },
        ],
      },
      {
        // R-ADVICE-008: the officer has checked the papers; a transcript that is not genuine is asked about, and no answer saves it.
        id: "papers",
        when: [
          { type: "document/held", document: "document.transcript" },
          { type: "not", of: { type: "document/genuine", document: "document.transcript" } },
        ],
        answers: [
          { id: "genuine", score: -2, when: [], thenScore: null, effects: [] },
          { id: "agent", score: -2, when: [], thenScore: null, effects: [] },
          { id: "admit", score: -1, when: [], thenScore: null, effects: [] },
        ],
      },
      {
        id: "living",
        when: [],
        answers: [
          {
            id: "figures",
            score: -1,
            when: [{ type: "quality/min", quality: "quality.interview-prep", value: 20 }],
            thenScore: 1,
            effects: [],
          },
          { id: "sort", score: -1, when: [], thenScore: null, effects: [] },
        ],
      },
    ],
    // R-SETPIECE-008: asked only after the answer that names one, never drawn. First drafts, for the
    // lead to put on the rule page's entry.
    followUps: [
      {
        id: "sponsor-who",
        when: [],
        answers: [
          {
            id: "relative",
            score: -1,
            when: [{ type: "route/unexplained-max", route: UK, bp: pct(20) }],
            thenScore: 1,
            effects: [],
          },
          { id: "friend", score: -2, when: [], thenScore: null, effects: [] },
        ],
      },
      {
        id: "agent-said",
        when: [],
        answers: [
          {
            id: "modules",
            score: -1,
            when: [{ type: "quality/min", quality: "quality.interview-prep", value: 20 }],
            thenScore: 1,
            effects: [],
          },
          { id: "visa", score: -2, when: [], thenScore: null, effects: [] },
          { id: "little", score: -1, when: [], thenScore: null, effects: [] },
        ],
      },
      {
        id: "gift-uncle",
        when: [],
        answers: [
          { id: "letter", score: 0, when: [], thenScore: null, effects: [] },
          { id: "unknown", score: -2, when: [], thenScore: null, effects: [] },
        ],
      },
    ],
  },

  // road.md R-ROAD-004 and 005. Scores mean nothing here: the road kind reads the answer chosen.
  // Every set piece in the chain keeps an exit.

  "setpiece.road-night": {
    id: "setpiece.road-night",
    ask: 1,
    questions: [
      {
        id: "night",
        when: [],
        answers: [
          { id: "go", score: 0, when: [], thenScore: null, effects: [{ type: "route/road-step", step: "truth" }] },
          // R-ROAD-004: turning back costs the deposit, already paid, and standing 2.
          {
            id: "turn-back",
            score: 0,
            when: [],
            thenScore: null,
            effects: [
              { type: "quality/add", quality: "quality.standing", amount: -2 },
              { type: "route/road-step", step: "turned-back" },
            ],
          },
        ],
      },
    ],
  },
  "setpiece.road-truth": {
    id: "setpiece.road-truth",
    ask: 1,
    questions: [
      {
        id: "truth",
        when: [],
        // R-ROAD-005. The road's step takes the money asked from cash, or the family means for it.
        answers: [
          { id: "pay", score: 0, when: [], thenScore: null, effects: [{ type: "route/road-step", step: "pay" }] },
          {
            id: "call-home",
            score: 0,
            when: [],
            thenScore: null,
            // The stake is at most 1, so adding 1 sets it to 1.
            effects: [
              { type: "quality/add", quality: "quality.family-stake", amount: 1 },
              { type: "quality/add", quality: "quality.standing", amount: -5 },
              { type: "route/road-step", step: "call-home" },
            ],
          },
          {
            id: "exit",
            score: 0,
            when: [],
            thenScore: null,
            effects: [
              { type: "quality/add", quality: "quality.standing", amount: -4 },
              { type: "route/road-step", step: "exit" },
            ],
          },
        ],
      },
    ],
  },

  // return.md R-RETURN-005, "The December set piece". The questions are made for each country by
  // `decemberQuestions` above, each asked only in its own country, so every amount is in that
  // country's currency.
  "setpiece.december": {
    id: "setpiece.december",
    // The four of the country the character is in, the going question first (R-SETPIECE-001).
    ask: 4,
    order: "fixed",
    questions: DECEMBER_COUNTRIES.flatMap(decemberQuestions),
  },

  // activity.md R-ACTIVITY-013: the nurse's certification, sat as three questions from the care route's
  // own facts (the care guide), in the order written. A right answer scores 1; the last question's answers
  // mark the paper, and two right is a pass.
  [NURSE_EXAM]: {
    id: NURSE_EXAM,
    ask: 3,
    order: "fixed",
    questions: [
      examQuestion("register", ["nmc", "embassy", "agent"], "nmc", false),
      examQuestion("verify", ["six-months", "two-years", "at-once"], "two-years", false),
      examQuestion("sponsorship", ["nurse", "nobody", "employer"], "employer", true),
    ],
  },
  // R-ACTIVITY-013: the talk is one question, how it opens; the activity carries what the talk gives. The answer marks
  // how it went: the code run live or the bug's story holds the room, the slides read out do
  // not. Opened with no route, so nothing is scored on the state; the act reads these scores, as the exam does.
  [TALK]: {
    id: TALK,
    ask: 1,
    questions: [
      {
        id: "open",
        when: [],
        answers: ["demo", "story", "slides"].map((id) => ({ id, score: id === "slides" ? 0 : 1, when: [], thenScore: null, effects: [{ type: "activity/exam", activity: "activity.conference-talk" }] })),
      },
    ],
  },
};
