import type { Content, GuideEntry } from "../packages/sim/src/engine/types";
import { describe, expect, test } from "vitest";

import { content } from "../packages/content/src/index";
import { guidesStale } from "./guides-stale";

/** The content with every guide checked, and its sources read, on one day. */
function checkedOn(day: string): Content {
  const guide = Object.fromEntries(
    Object.entries(content.guide).map(([id, entry]) => [id, { ...entry, checkedOn: day, sources: entry.sources.map((source) => ({ ...source, readOn: day })) } satisfies GuideEntry]),
  );
  return { ...content, guide };
}

describe("the stale guides tool", () => {
  const months = content.tuning.guide.staleMonths;

  test("[R-GUIDE-004] given guides checked exactly staleMonths before today, when the tool runs, then it lists none", () => {
    expect(months).toBe(6);
    const result = guidesStale(["--today", "2026-10-08"], checkedOn("2026-04-08"));
    expect(result).toEqual({ lines: ["No guide is more than 6 months past its check on 2026-10-08."], code: 0 });
  });

  test("[R-GUIDE-004] given guides checked staleMonths and one day before today, when the tool runs, then it lists every one with its date", () => {
    const result = guidesStale(["--today", "2026-10-09"], checkedOn("2026-04-08"));
    expect(result.code).toBe(0);
    expect(result.lines[0]).toBe(`${String(Object.keys(content.guide).length)} guide(s) not checked for 6 months on 2026-10-09:`);
    expect(result.lines).toContain("guide.uk-masters  checked 2026-04-08  What a UK student visa really needs: funds, the 28 days and the interview");
  });

  test("[R-GUIDE-004] given no date or a date that is not on the calendar, when the tool runs, then it says how to call it and fails", () => {
    expect(guidesStale([]).code).toBe(1);
    expect(guidesStale(["--today"]).lines).toEqual(["Usage: tsx tools/guides-stale.ts --today YYYY-MM-DD"]);
    expect(guidesStale(["--today", "2026-02-30"]).code).toBe(1);
  });
});
