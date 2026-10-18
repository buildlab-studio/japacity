// The page's READY is Japa's figure (world:phone-holds-what-phones-hold): the nurse's page and Japa
// say one figure, never READY 0% beside "How ready you are to go 40%". Care work counts no japacity figure from
// Nigeria, so Japa reads the plan's own, and the page reads the same. Played on the real engine.
import { describe, expect, test } from "vitest";

import { Japa } from "../features/phone/apps/Japa";
import { newGame, viewAfter } from "../shared/testing/fixtures";
import { renderWithView } from "../shared/testing/render";
import { say } from "../shared/words/text";
import { readyWords } from "../shared/words/ready";
import { pageOf } from "../shared/datapage/PageSheet";

const CARE = "route.uk-care";

describe("one figure for how ready", () => {
  test("[world:phone-holds-what-phones-hold] given the ready nurse whose plan is care work, its page read, with no japacity figure, when the page and Japa are read, then the page's READY is the figure Japa shows, not 0%", async () => {
    const game = newGame("scenario.ngozi");
    viewAfter(game, [{ type: "route/hear", route: CARE, via: "meetup" }]);
    game.accept({ type: "activity/now", activity: "activity.look-into-route", param: CARE });
    const view = game.view();
    expect(view.japacity.percent).toBeNull();
    const plan = view.routes.find((route) => route.id === CARE)?.percent ?? 0;
    expect(plan).toBeGreaterThan(0);
    await renderWithView(<Japa />, view);
    expect(document.querySelector("[data-japa-percent]")?.getAttribute("data-japa-percent")).toBe(String(plan));
    expect(pageOf(view, null).ready).toBe(readyWords(plan));
    expect(pageOf(view, null).strip?.percent).toBe(plan);
  });

  test("[world:phone-holds-what-phones-hold] given a life with no plan, when the page is read, then READY is 0%, as Japa shows no figure", async () => {
    const view = newGame("scenario.ngozi").view();
    expect(view.plan.route).toBeNull();
    await renderWithView(<Japa />, view);
    expect(document.querySelector("[data-japa-percent]")).toBeNull();
    expect(pageOf(view, null).ready).toBe(say("prologue.page.ready.band.0"));
  });
});
