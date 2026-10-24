// The overstay's stage in words, read from the engine's view (status:view-shows-status): the grace with its months and what can
// still be applied for from inside, the overstay with its cash work and the landlord's check, the notice with its months
// before removal. Never a chance.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { abroadView } from "../testing/fixtures";
import { graceView, noticeGame, overstayingGame } from "../testing/overstay";
import { overstayWords } from "./overstay";
import { say, sayCount } from "./text";

const UK = content.status["status.uk-overstayer"]!;

describe("the overstay in words", () => {
  test("[status:grace-before-overstaying] [status:view-shows-status] given the graduate whose visa has just lapsed, when the stage is read, then it says the months of grace left and what can still be applied for from inside", () => {
    const view = graceView();
    const left = view.status?.overstay?.graceLeft ?? 0;
    // The month the visa was lost is the grace's first.
    expect(left).toBe(UK.graceMonths);
    const said = overstayWords(view);
    expect(said).toMatchObject({ stage: "grace", title: sayCount("ui.status.overstay.grace", left, { months: left }), line: say("ui.status.overstay.grace-line.country.uk") });
    expect(said?.line).toMatch(/sponsor/);
    expect(said?.line).toMatch(/course/);
    expect(said?.line).toMatch(/partner/);
  });

  test("[status:grace-before-overstaying] [status:view-shows-status] given the grace's last month, in the UK the month the visa was lost, when the stage is read, then it is still the grace with 1 month left, never overstaying", () => {
    const view = graceView();
    expect(view.status?.overstay?.graceLeft).toBe(1);
    const said = overstayWords(view);
    expect(said).toMatchObject({ stage: "grace", title: say("ui.status.overstay.grace.one"), line: say("ui.status.overstay.grace-line.country.uk") });
    expect(said?.title).toBe("1 month of grace left");
  });

  test("[status:view-shows-status] given the grace passed with nobody noticing, when the stage is read, then it says overstaying, work in cash only and the room may be checked", () => {
    const said = overstayWords(overstayingGame().view());
    expect(said).toMatchObject({ stage: "over", title: say("ui.status.overstay.over"), line: say("ui.status.overstay.over-line.country.uk") });
    expect(said?.line).toMatch(/cash/);
    expect(said?.line).toMatch(/landlord/);
  });

  test("[status:detection-gives-notice] [status:view-shows-status] given an overstay that was noticed, when the stage is read, then it says the months left before removal, and never a chance", () => {
    const view = noticeGame().view();
    const left = view.status?.overstay?.noticeLeft ?? null;
    expect(left).toBe(UK.noticeMonths);
    const said = overstayWords(view);
    expect(said).toMatchObject({ stage: "notice", title: sayCount("ui.status.overstay.notice", left!, { months: left! }) });
    expect(`${said?.title ?? ""} ${said?.line ?? ""}`).not.toMatch(/%|chance|likely/i);
  });

  test("[status:view-shows-status] given a status that is not an overstay, then there is no stage to say", () => {
    expect(overstayWords(abroadView())).toBeNull();
  });
});
