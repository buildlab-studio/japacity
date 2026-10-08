// From docs/rules/route.md, "Entry: setpiece.credibility-interview"; road.md for the
// road's two set pieces; return.md for the December visit.
import { int, type Currency, type Effect, type Id, type Requirement, type SetpieceAnswer, type SetpieceQuestion, type SetpieceEntry } from "@japacity/sim";

import { countryTable } from "../country/country.data";
import { tuning } from "../tuning/tuning.data";
import { naira, pct } from "../units";

const UK: Id<"route"> = "route.uk-masters";

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
 * One country's December: first whether to go, then the party, the gifts and
 * the look, each answer paying in the country's currency (reason `social` for
 * the party and the look, `family` for the gifts) and moving the qualities the
 * page gives. the set piece kind draws the order of the questions on
 * `visa` and closes only when every question drawn is answered, so `go` is not
 * always first and `stay` cannot end the scene; and an answer the pocket cannot
 * cover is still allowed, its debit taking nothing while its gains apply. The
 * set piece kind needs a fixed order, an answer that closes the scene, and
 * answers judged as R-OFFER-003 judges choices.
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
      answer("stay", []),
      answer("go", [{ type: "money/take", currency: fare.currency, pocket: "any", amount: fare.amount, reason: "fare" }]),
    ],
  };
  const spending = SPENDING.map(
    (question): SetpieceQuestion => ({
      id: `${question.question}-${suffix}`,
      when: here,
      answers: question.answers.map((option) => {
        const price = decemberPrice(country, option.naira);
        const reason = question.question === "gifts" ? "family" : "social";
        const paid: Effect[] = price.amount === 0 ? [] : [{ type: "money/take", currency: price.currency, pocket: "any", amount: price.amount, reason }];
        return answer(option.id, [...paid, ...option.gains.map(([quality, amount]) => gain(quality, amount))]);
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
          { id: "agent", score: -2, when: [], thenScore: null, effects: [] },
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
          { id: "sponsor", score: -1, when: [], thenScore: null, effects: [] },
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
          { id: "gift", score: -2, when: [], thenScore: null, effects: [] },
          { id: "savings", score: -2, when: [], thenScore: null, effects: [] },
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
  // `decemberQuestions` below, each asked only in its own country, so every amount is in that
  // country's currency.
  "setpiece.december": {
    id: "setpiece.december",
    // Every question whose `when` holds is asked: the four of the country the character is in.
    ask: 4,
    questions: DECEMBER_COUNTRIES.flatMap(decemberQuestions),
  },
};
