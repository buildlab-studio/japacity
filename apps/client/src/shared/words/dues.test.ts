// The month's dues abroad against what is held (docs/rules/world.md R-WORLD-003, 019).
import { describe, expect, test } from "vitest";

import { abroadView } from "../testing/fixtures";
import { duesGap } from "./dues";


describe("the dues gap and the month's pay", () => {
  test("[R-WORLD-003] given pounds short of the dues but a job whose month's pay covers the rest, when the gap is read, then there is none; without the job, there is", () => {
    const view = abroadView();
    const rent = view.obligations.find((owed) => owed.due > 0);
    if (rent === undefined) throw new Error("No dues abroad.");
    const due = view.obligations.reduce((sum, owed) => (owed.due > 0 ? sum + owed.due : sum), 0);
    const short = { ...view, pockets: { ...view.pockets, GBP: { bank: Math.max(0, due - 50_000), cash: 0, locked: 0 } } };
    expect(duesGap({ ...short, job: { id: null, months: 0, side: null } })).not.toBeNull();
    expect(duesGap({ ...short, job: { id: "activity.job-uk-retail-part" as const, months: 1, side: null } })).toBeNull();
  });
});
