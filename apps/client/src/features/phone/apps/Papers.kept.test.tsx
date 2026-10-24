// A status a trip home keeps, in Papers and Japa at home (return:papers-return-keeps-status, status:absence-breaks-settlement): the month it runs to
// and that the character can fly back on it, and past the line at home that the road to settling starts again.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { keptAtHomeGame } from "../../../shared/testing/fixtures";
import { monthYearOf } from "../../../shared/words/monthName";
import { nameOf, say } from "../../../shared/words/text";
import { openJapa, openPapers } from "../phone.testing";

const GRADUATE = "status.uk-graduate";
const TALENT = "status.uk-talent";

function text(selector: string): string {
  return document.querySelector(selector)?.textContent ?? "";
}

describe("a kept status at home", () => {
  test("[return:papers-return-keeps-status] given the Graduate visa kept at home, when Papers opens, then it says the month the visa runs to and that the character can fly back on it", async () => {
    const view = keptAtHomeGame().view();
    const until = view.place.kept?.until ?? null;
    expect(until).not.toBeNull();
    const { store } = await openPapers(view);
    expect(text("[data-papers-place]")).toContain(say("ui.place.kept.until", { status: nameOf(GRADUATE), to: monthYearOf(store.getState().beganAt, until! - 1) }));
  });

  test("[return:papers-return-keeps-status] [status:absence-breaks-settlement] given the Global Talent lived on for 2 months, kept, and the line at home crossed, when Japa opens at home, then it says the month the visa runs to and that the road to settling starts again", async () => {
    const view = keptAtHomeGame(TALENT, content.tuning.status.absenceMonths, 2).view();
    expect(view.place.kept?.restarts).toBe(true);
    const { store } = await openJapa(view);
    const kept = text("[data-japa-kept]");
    expect(kept).toContain(say("ui.place.kept.until", { status: nameOf(TALENT), to: monthYearOf(store.getState().beganAt, view.place.kept!.until! - 1) }));
    expect(kept).toContain(say("ui.place.kept.restarts", { months: content.tuning.status.absenceMonths }));
  });

  test("[status:absence-breaks-settlement] given the Global Talent lived on for 2 months, kept, and only a month at home, when Papers opens, then nothing says the road to settling starts again", async () => {
    const view = keptAtHomeGame(TALENT, 1, 2).view();
    expect(view.place.kept?.restarts).toBe(false);
    await openPapers(view);
    expect(text("[data-papers-place]")).not.toContain(say("ui.place.kept.restarts", { months: content.tuning.status.absenceMonths }));
  });
});
