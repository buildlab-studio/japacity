// From docs/rules/route.md, "Entry: setpiece.credibility-interview"; road.md for the
// road's two set pieces; return.md for the December visit.
import type { Id, SetpieceEntry } from "@japacity/sim";

import { pct } from "../units";

const UK: Id<"route"> = "route.uk-masters";

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
          },
          { id: "better", score: -1, when: [], thenScore: null },
          { id: "agent", score: -2, when: [], thenScore: null },
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
          },
          { id: "lender", score: 0, when: [], thenScore: null },
          { id: "sponsor", score: -1, when: [], thenScore: null },
        ],
      },
      {
        id: "after",
        when: [],
        answers: [
          { id: "return", score: 2, when: [], thenScore: null },
          { id: "undecided", score: -1, when: [], thenScore: null },
          { id: "stay", score: -2, when: [], thenScore: null },
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
          },
          { id: "brief", score: 0, when: [], thenScore: null },
        ],
      },
      {
        id: "deposit",
        // Asked when the unexplained share is above 30%.
        when: [{ type: "not", of: { type: "route/unexplained-max", route: UK, bp: pct(30) } }],
        answers: [
          { id: "agreement", score: 0, when: [], thenScore: null },
          { id: "gift", score: -2, when: [], thenScore: null },
          { id: "savings", score: -2, when: [], thenScore: null },
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
          },
          { id: "sort", score: -1, when: [], thenScore: null },
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
          { id: "go", score: 0, when: [], thenScore: null },
          { id: "turn-back", score: 0, when: [], thenScore: null },
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
        answers: [
          { id: "pay", score: 0, when: [], thenScore: null },
          { id: "call-home", score: 0, when: [], thenScore: null },
          { id: "exit", score: 0, when: [], thenScore: null },
        ],
      },
    ],
  },

  // return.md, "The December set piece". the amounts and the standing, wellbeing and network
  // changes have no field on an answer, so they are not here; every answer scores 0.
  "setpiece.december": {
    id: "setpiece.december",
    ask: 3,
    questions: [
      {
        id: "party",
        when: [],
        answers: [
          { id: "big", score: 0, when: [], thenScore: null },
          { id: "small", score: 0, when: [], thenScore: null },
          { id: "home", score: 0, when: [], thenScore: null },
        ],
      },
      {
        id: "gifts",
        when: [],
        answers: [
          { id: "all", score: 0, when: [], thenScore: null },
          { id: "some", score: 0, when: [], thenScore: null },
          { id: "none", score: 0, when: [], thenScore: null },
        ],
      },
      {
        id: "look",
        when: [],
        answers: [
          { id: "outfit", score: 0, when: [], thenScore: null },
          { id: "plain", score: 0, when: [], thenScore: null },
        ],
      },
    ],
  },
};
