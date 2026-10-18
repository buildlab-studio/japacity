// The nurse's chapter card (share:card-contents, chapter:chapters-follow-lean-route): her
// first chapter closes on care work, which is shut to applicants from abroad (route-gates:care-route-needs-verification) and so
// gives no japacity figure (japacity:best-open-route-is-japacity). The card names the way out the chapters follow and its own
// figure, never two empty bands.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { routePercent } from "../japacity/japacity.logic";
import { start, type Game } from "../testing/play";

const CARE = "route.uk-care" as const;
const LOOK = "activity.look-into-route" as const;

/** Ngozi, months played until care work is heard of, then its page read: the month the first chapter closes. */
function nurseLooksIntoCare(): Game {
  const game = start({ scenario: "scenario.ngozi", seed: "nurse-card", content });
  game.accept({ type: "activity/now", activity: "activity.meetup", param: null });
  for (let month = 0; month < 8 && game.state.route[CARE]?.state === "unknown"; month += 1) {
    game.endTurn();
    if (game.state.route[CARE]?.state === "unknown") game.accept({ type: "activity/now", activity: "activity.meetup", param: null });
  }
  game.endTurn([{ activity: LOOK, param: CARE }]);
  return game;
}

describe("the nurse's chapter card", () => {
  test("[share:card-contents] [chapter:chapters-follow-lean-route] given the ready nurse whose first chapter closes on care work while it is shut to applicants from abroad, when the card is read, then it names care work and its own figure", () => {
    const game = nurseLooksIntoCare();
    const view = game.view();
    expect(view.japacity).toEqual({ percent: null, route: null });
    expect(view.chapter.current).toBe("chapter.build-the-file-care");
    const read = { state: game.state, world: game.world(), content };
    const figure = routePercent(read, CARE);
    expect(figure).not.toBeNull();
    expect(view.card).toMatchObject({ kind: "chapter", chapter: "chapter.find-your-feet", route: CARE, percent: figure });
  });
});
