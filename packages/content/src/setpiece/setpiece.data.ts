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
          { id: "big", score: 0, when: [], thenScore: null, effects: [] },
          { id: "small", score: 0, when: [], thenScore: null, effects: [] },
          { id: "home", score: 0, when: [], thenScore: null, effects: [] },
        ],
      },
      {
        id: "gifts",
        when: [],
        answers: [
          { id: "all", score: 0, when: [], thenScore: null, effects: [] },
          { id: "some", score: 0, when: [], thenScore: null, effects: [] },
          { id: "none", score: 0, when: [], thenScore: null, effects: [] },
        ],
      },
      {
        id: "look",
        when: [],
        answers: [
          { id: "outfit", score: 0, when: [], thenScore: null, effects: [] },
          { id: "plain", score: 0, when: [], thenScore: null, effects: [] },
        ],
      },
    ],
  },
};
