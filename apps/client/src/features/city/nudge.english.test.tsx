// The English test's wait in the nudge and its result in words (docs/rules/world.md R-WORLD-003, R-WORLD-006,
// R-WORLD-008): while the result is on its way the nudge says when it comes and
// opens nothing; a pass says it meets the route's band; and the study card says it lifts the chance.
import { fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatBand } from "../../shared/words/format";
import { tidyLines } from "../../shared/words/lines";
import { bandNeeded } from "../../shared/words/test";
import { blurbOf, inMonths, say, words } from "../../shared/words/text";
import { City } from "./City";
import { nudgeOf } from "./nudge";

const PAPER = "document.english-test" as const;

/** The file's English step open, with the result sat and on its way. */
function waitingOnResult() {
  const base = { ...engineView(), setpiece: null, interview: null, offers: [], report: null, month: 10 };
  return {
    ...base,
    chapter: { current: "chapter.build-the-file" as const, items: [{ id: "passport", met: true }, { id: "transcript", met: true }, { id: "english", met: false }, { id: "offer", met: false }], done: [] },
    documents: [{ id: PAPER, state: "pending" as const, readyMonth: 11, expiresMonth: null, value: null }],
  };
}

describe("the English result on its way", () => {
  test("[R-WORLD-003] given the test sat and its result pending, when the nudge is chosen, then it says the result comes next month instead of the test again", () => {
    const view = waitingOnResult();
    const nudge = nudgeOf(view);
    expect(nudge).toMatchObject({ key: "chapter.build-the-file.item.english.started", params: { when: inMonths(11, 10) }, about: "step" });
    expect(say(nudge.key, nudge.params)).toBe("Your result comes next month.");
    expect(say(nudge.key, nudge.params)).not.toMatch(/Score|test centre/);
    // Planned this month, it says to end the month.
    const planned = { ...view, documents: [] };
    expect(say(nudgeOf(planned, undefined, ["activity.sit-english-test"]).key)).toBe("The test is this month. End the month and see.");
  });

  test("[R-WORLD-003] given the result pending, when the world shows the nudge, then it opens nothing: there is nothing to do but wait", async () => {
    await renderWithView(<City world month={<p />} results={() => <p />} />, waitingOnResult());
    const go = document.querySelector<HTMLElement>("[data-opening-go]");
    if (go !== null) fireEvent.click(go);
    expect(document.querySelector("[data-nudge]")?.textContent).toBe("Your result comes next month.");
    expect(document.querySelector("[data-nudge-open]")).toBeNull();
  });
});

describe("the English result told", () => {
  test("[R-WORLD-008] given a band that meets the route's, when the result is told, then it says the band and that it meets the route's band", () => {
    const needed = bandNeeded();
    const [told] = tidyLines([{ key: "line.document.issued-band", params: { document: PAPER, band: needed + 5 }, tone: "good", attention: false, counts: [] }]);
    const plain = words("line.document.issued-band", { document: PAPER, band: needed + 5 });
    expect(words(told?.key ?? "", told?.params)).toBe(`${plain} That meets the route's ${formatBand(needed)}.`);
    expect(plain).toContain(`Band ${formatBand(needed + 5)}.`);
  });

  test("[R-WORLD-006] given the study card, when its line is read, then it says a month of study lifts the chance at the test", () => {
    expect(blurbOf("activity.study-english")).toContain("A month of study lifts your chance at the test.");
    expect(richView()).toBeTruthy();
  });
});
