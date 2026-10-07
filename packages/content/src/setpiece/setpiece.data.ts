// From docs/rules/route.md, "Entry: setpiece.credibility-interview".
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
};
