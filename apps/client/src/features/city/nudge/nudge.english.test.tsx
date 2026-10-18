// The English test's wait in the nudge and its result in words (docs/rules/world.md R-WORLD-003, R-WORLD-006,
// R-WORLD-008): while the result is on its way the nudge says when it comes and
// opens nothing; a pass says it meets the route's band; and the study card says it lifts the chance.
import { fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatBand } from "../../../shared/words/format";
import { tidyLines } from "../../../shared/words/lines";
import { bandNeeded } from "../../../shared/words/englishTest";
import { blurbOf, inMonths, say, words } from "../../../shared/words/text";
import { City } from "../City";
import { nudgeOf } from "./nudge";

const PAPER = "document.english-test" as const;

/** The file's English step open, with the result sat and on its way. */
function waitingOnResult() {
  // The waiting months' acts (R-ACTIVITY-013) left out, so the wait's own words can be read.
  const bare = engineView();
  const base = { ...bare, activities: bare.activities.filter((option) => !["activity.open-source", "activity.tech-posts", "activity.be-noticed", "activity.nurse-certification"].includes(option.id)), setpiece: null, interview: null, offers: [], report: null, month: 10 };
  return {
    ...base,
    chapter: { current: "chapter.build-the-file" as const, items: [{ id: "passport", met: true }, { id: "transcript", met: true }, { id: "english", met: false }, { id: "offer", met: false }], done: [], closes: false, next: null },
    documents: [{ id: PAPER, state: "pending" as const, readyMonth: 11, expiresMonth: null, value: null, onItsWay: 11 }],
  };
}

describe("the English result on its way", () => {
  test("[R-WORLD-003] given the test sat and its result pending, when the nudge is chosen, then it says the result comes next month instead of the test again", () => {
    const view = waitingOnResult();
    const nudge = nudgeOf(view);
    expect(nudge).toMatchObject({ key: "chapter.build-the-file.item.english.started", params: { when: inMonths(11, 10) }, about: "step" });
    // The journey, not the wait (text.md R-TEXT-007): the result comes; the player is not told to wait.
    expect(say(nudge.key, nudge.params)).toBe("Your result comes next month");
    expect(say(nudge.key, nudge.params)).not.toMatch(/Score|test centre/);
    // Planned this month, it says to end the month.
    const planned = { ...view, documents: [] };
    expect(say(nudgeOf(planned, undefined, ["activity.sit-english-test"]).key)).toBe("Test booked. Live the month.");
  });

  test("[R-WORLD-003] given the result pending, when the world shows, then nothing under the band opens anything: the result comes by itself, and the road shows only the brief's chip for its moment", async () => {
    await renderWithView(<City world results={() => <p />} />, waitingOnResult());
    const go = document.querySelector<HTMLElement>("[data-opening-go]");
    if (go !== null) fireEvent.click(go);
    // The wait is the Japa app's to tell: in the world only the chip of the brief just handed stands.
    expect(document.querySelector("[data-nudge]")?.getAttribute("data-brief-chip")).toBe("handed");
    expect(document.querySelector("[data-nudge]")?.textContent).not.toContain("Your result comes next month");
    expect(document.querySelector("[data-nudge-open]")).toBeNull();
  });
});

describe("the English result sealed until the morning", () => {
  test("[R-CLOCK-032] given the test sat and its result sealed, pending in the month it was due, when the nudge is chosen and shown, then it says the result comes tomorrow at seven and opens nothing", async () => {
    const waiting = waitingOnResult();
    const sealed = { ...waiting, documents: waiting.documents.map((paper) => ({ ...paper, readyMonth: waiting.month, onItsWay: waiting.month })) };
    const nudge = nudgeOf(sealed);
    expect(nudge).toMatchObject({ key: "ui.wait.morning", about: "step" });
    expect(say(nudge.key, nudge.params)).toBe("Comes in the morning");
    await renderWithView(<City world results={() => <p />} />, sealed);
    const go = document.querySelector<HTMLElement>("[data-opening-go]");
    if (go !== null) fireEvent.click(go);
    // The wait is the Japa app's to tell: in the world nothing says it under the band.
    expect(document.querySelector("[data-nudge]")?.textContent ?? "").not.toContain("Comes in the morning");
    expect(document.querySelector("[data-nudge-open]")).toBeNull();
  });
});

describe("the English test as a long shot", () => {
  test("[R-WORLD-003] [R-WORLD-006] given the English step open with no result sat and the band a long shot, when the nudge is chosen, then it says to study first, and with study planned it says to end the month; a fair chance names the test", () => {
    const base = waitingOnResult();
    const english = (value: number) => base.qualities.map((quality) => (quality.id === "quality.english" ? { ...quality, value } : quality));
    const allowed = (id: string) => base.activities.map((option) => (option.id === id ? { ...option, allowed: true } : option));
    const longShot = { ...base, documents: [], qualities: english(0), activities: allowed("activity.study-english") };
    const nudge = nudgeOf(longShot);
    expect(nudge).toMatchObject({ key: "chapter.build-the-file.item.english.study", about: "step" });
    expect(say(nudge.key)).toBe("Study first: the band is a long shot");
    expect(say(nudgeOf(longShot, undefined, ["activity.study-english"]).key)).toBe("Study planned. Live the month.");
    const fair = { ...longShot, qualities: english(100) };
    expect(nudgeOf(fair).key).toBe("chapter.build-the-file.item.english.nudge");
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
