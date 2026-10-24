// The bag's Go home on a status a trip home keeps (return:papers-return-keeps-status, return:standing-by-return-shape, status:absence-breaks-settlement):
// the return with papers says the status is kept, the month it runs to and that the character can fly back on it, in place of the status ending.
import { content } from "@japacity/content";
import { describe, expect, test, vi } from "vitest";

import { keptStatusGame } from "../../../shared/testing/fixtures";
import { monthYearOf } from "../../../shared/words/monthName";
import { nameOf, say } from "../../../shared/words/text";
import { goHomeAsk } from "./goHome";

const BEGAN = Date.UTC(2026, 2, 10);

function hands() {
  return { who: "The shared room", go: vi.fn(), dismiss: () => undefined, beganAt: BEGAN };
}

describe("Go home on a kept status", () => {
  test("[return:papers-return-keeps-status] [return:standing-by-return-shape] given the Graduate visa with months left, when the card is drawn, then the return reads with papers and its chips say the visa runs to its month and the flight back, never that the status ends", () => {
    const view = keptStatusGame().view();
    expect(view.place.wayHome?.shape).toBe("with-papers");
    const ask = goHomeAsk(view, hands());
    expect(ask?.line).toBe(say("ui.world.go-home.line.with-papers"));
    const to = monthYearOf(BEGAN, view.month + view.status!.monthsLeft! - 1);
    expect(ask?.facts).toContain(say("ui.world.go-home.kept", { status: nameOf("status.uk-graduate"), to }));
    expect(ask?.facts).not.toContain(say("ui.world.go-home.status"));
    expect(ask?.facts).not.toContain(say("ui.world.go-home.kept.settle", { months: content.tuning.status.absenceMonths }));
  });

  test("[status:absence-breaks-settlement] given the Global Talent, which counts toward settlement, when the card is drawn, then a chip says the line at home that starts the road to settling again", () => {
    const view = keptStatusGame("status.uk-talent").view();
    const ask = goHomeAsk(view, hands());
    expect(ask?.facts).toContain(say("ui.world.go-home.kept.settle", { months: content.tuning.status.absenceMonths }));
  });

  test("[return:papers-return-keeps-status] given the settled status, when the card is drawn, then a chip says it is kept and the flight back", () => {
    const view = keptStatusGame("status.uk-settled").view();
    const ask = goHomeAsk(view, hands());
    expect(ask?.facts).toContain(say("ui.world.go-home.kept.always", { status: nameOf("status.uk-settled") }));
    expect(ask?.facts).not.toContain(say("ui.world.go-home.status"));
  });
});
