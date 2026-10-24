// The English in Papers (document:degree-english-statement, document:who-sits-the-english-test, route:degree-meets-masters-english): for the UK work routes
// a graduate's box lists the degree's English statement, asked on the phone, with its fee and its month, and not the test; a
// life with no degree is asked the test; and for the master's the degree itself stands as the English, with no paper and no test.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../../../shared/testing/fixtures";
import { formatMoney } from "../../../shared/words/format";
import { say, sayCount, words } from "../../../shared/words/text";
import { openPapers } from "../phone.testing";
import { stepWay } from "./Japa";

const STATEMENT = "document.degree-english";
const TEST = "document.english-test";
const CARE = "route.uk-care";

/** The nurse with the care route as her plan; `degree: false` takes her bachelor's away, so the test is the English she needs. */
function nurseOnCare(degree = true): PlayerView {
  const game = newGame("scenario.nurse");
  return viewAfter(game, [{ type: "route/hear", route: CARE, via: "meetup" }, ...(degree ? [] : [{ type: "quality/add" as const, quality: "quality.education-level" as const, amount: -1 }])]);
}

function row(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-paper="${id}"]`);
}

describe("the English in Papers", () => {
  test("[document:degree-english-statement] [document:who-sits-the-english-test] given the nurse with a degree on the care route, when Papers opens, then it lists the degree's English statement with its fee and its month, asked on the phone, and not the English test", async () => {
    const view = nurseOnCare();
    expect(view.plan.route).toBe(CARE);
    await openPapers(view);
    const statement = row(STATEMENT);
    expect(statement?.dataset.state).toBe("not-yet");
    expect(statement?.querySelector("[data-paper-act]")?.getAttribute("data-act-how")).toBe("phone");
    const fee = content.activity["activity.degree-english"]!.cost[0]!.amount as number;
    const months = content.document[STATEMENT]!.wait[0];
    expect(statement?.querySelector("[data-paper-costs]")?.textContent).toBe(sayCount("phone.papers.costs", months, { fee: formatMoney(fee, "NGN"), months }));
    expect(row(TEST)).toBeNull();
  });

  test("[document:who-sits-the-english-test] given a life with no degree on the care route, when Papers opens, then the English test is the paper it lists, and not the statement", async () => {
    await openPapers(nurseOnCare(false));
    expect(row(TEST)?.dataset.state).toBe("not-yet");
    expect(row(STATEMENT)).toBeNull();
  });

  test("[route:degree-meets-masters-english] given the graduate on the master's, when Papers opens, then the degree stands as its English and no English paper is asked", async () => {
    const view = viewAfter(newGame("scenario.graduate"), [{ type: "route/hear", route: "route.uk-masters", via: "meetup" }]);
    expect(view.plan.route).toBe("route.uk-masters");
    await openPapers(view);
    const degree = document.querySelector<HTMLElement>("[data-paper-degree]");
    expect(degree?.textContent).toContain(words("route.uk-masters.item.english"));
    expect(degree?.textContent).toContain(say("ui.document.held"));
    expect([row(TEST), row(STATEMENT)]).toEqual([null, null]);
  });
});

describe("the English step's way in Japa", () => {
  test("[document:who-sits-the-english-test] [document:degree-english-statement] given the care route's English step, when its way is read, then a graduate is sent to ask for the statement and a life with no degree to the test centre", () => {
    const item = { id: "english", met: false };
    expect(stepWay(CARE, item, nurseOnCare().qualities)).toEqual({ way: say("route.uk-care.item.english.way.degree") });
    expect(stepWay(CARE, item, nurseOnCare(false).qualities)).toEqual({ way: say("route.uk-care.item.english.way") });
    expect(stepWay("route.uk-skilled", item, nurseOnCare().qualities)).toEqual({ way: say("route.uk-skilled.item.english.way.degree") });
  });
});
