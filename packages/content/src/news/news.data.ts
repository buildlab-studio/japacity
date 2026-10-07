// From docs/rules/news.md, "Stories". All five touch the UK master's route.
import type { Id, NewsEntry } from "@japacity/sim";

import { pct } from "../units";

const UK: Id<"route"> = "route.uk-masters";

export const newsTable: Record<Id<"news">, NewsEntry> = {
  "news.uk-unis-recruit": {
    id: "news.uk-unis-recruit",
    touches: [UK],
    // Hearing it tells you of the UK master's route (R-NEWS-006).
    hear: [UK],
    standIn: {
      chanceBp: pct(100),
      announce: { between: [1, 3] },
      rumourLead: 0,
      forceLag: 2,
      endsAfter: null,
      sets: [],
      revert: false,
    },
  },
  "news.uk-living-rise": {
    id: "news.uk-living-rise",
    touches: [UK],
    hear: [],
    standIn: {
      chanceBp: pct(100),
      announce: { between: [4, 14] },
      rumourLead: 2,
      forceLag: 4,
      endsAfter: null,
      // Pence a month: £1,203.
      sets: [{ var: "var.uk-living-line", value: 120300 }],
      revert: false,
    },
  },
  "news.uk-refusals-up": {
    id: "news.uk-refusals-up",
    touches: [UK],
    hear: [],
    standIn: {
      chanceBp: pct(60),
      announce: { between: [8, 30] },
      rumourLead: 3,
      forceLag: 2,
      endsAfter: null,
      sets: [{ var: "var.uk-study-strictness", value: 70 }],
      revert: false,
    },
  },
  "news.dollar-scarcity": {
    id: "news.dollar-scarcity",
    touches: [UK],
    hear: [],
    standIn: {
      chanceBp: pct(60),
      announce: { between: [6, 26] },
      rumourLead: 2,
      forceLag: 2,
      // it ends when the float comes into force. The engine ends it by
      // reading the stage of news.naira-float, so no count of ticks is given here.
      endsAfter: null,
      sets: [
        { var: "var.fx-supply", value: 40 },
        { var: "var.fx-bank-queue", value: 2 },
        // US cents.
        { var: "var.fx-bank-allowance", value: 0 },
      ],
      revert: true,
    },
  },
  "news.naira-float": {
    id: "news.naira-float",
    touches: [UK],
    hear: [],
    standIn: {
      // It happens whenever the scarcity reaches in force (R-NEWS-003).
      chanceBp: pct(100),
      announce: { after: "news.dollar-scarcity", stage: "in-force", lag: [3, 6] },
      rumourLead: 1,
      forceLag: 2,
      endsAfter: null,
      sets: [
        { var: "var.fx-supply", value: 90 },
        { var: "var.fx-bank-queue", value: 0 },
        // US cents.
        { var: "var.fx-bank-allowance", value: 50000 },
      ],
      revert: false,
    },
  },
};
