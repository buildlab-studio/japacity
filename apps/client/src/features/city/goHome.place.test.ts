// The way home from the bag's Go home on the engine's own forecast (docs/rules/place.md R-PLACE-004, R-PLACE-005), moved
// from the old place panel: the fare bought from naira, the return a life would make today read before it happens, the
// assisted ticket, and no way home with a status held and nothing to pay. The card and its one button are drawn and
// sent in goHome.test.tsx; the fare and the times home are read in Papers (features/phone/apps/Papers.place.test.tsx).
import { content } from "@japacity/content";
import { describe, expect, test, vi } from "vitest";

import { abroadGame, setPockets, viewAfter } from "../../shared/testing/fixtures";
import { nairaForFee } from "../../shared/words/cost";
import { say } from "../../shared/words/text";
import { goHomeAsk } from "./goHome";

const UK = content.country["country.uk"]!;

function hands() {
  return { who: "The shared room", go: vi.fn(), dismiss: () => undefined };
}

describe("the bag's Go home on the engine's forecast", () => {
  test("[R-PLACE-004] given Ada abroad with no pounds and naira enough, then the card asks the naira the fare takes, and its button goes home", () => {
    const game = abroadGame();
    setPockets(game, { NGN: 500_000_000 });
    const view = game.view();
    expect(view.pockets.GBP.bank + view.pockets.GBP.cash).toBeLessThan(UK.fare);
    const hand = hands();
    const ask = goHomeAsk(view, hand);
    expect(ask?.cost).toEqual({ amount: nairaForFee(view, "GBP", UK.fare), currency: "NGN" });
    expect(ask?.blocked).toBeUndefined();
    ask?.act();
    expect(hand.go).toHaveBeenCalledTimes(1);
  });

  test("[R-PLACE-005] given Ada on a student visa with pounds for the fare and savings besides, and naira at home no more than the broke line, then the return she would make today reads by choice, before it happens, with the standing it brings", () => {
    const game = abroadGame();
    setPockets(game, { GBP: 200_000, NGN: content.tuning.place.brokeLine });
    const view = game.view();
    const standing = content.tuning.return.standing["by-choice"];
    expect(view.place.wayHome).toMatchObject({ paidFrom: "local", shape: "by-choice", standing });
    const ask = goHomeAsk(view, hands());
    expect(ask?.line).toBe(say("ui.world.go-home.line.by-choice"));
    expect(ask?.facts).toContain(say(standing > 0 ? "ui.world.go-home.standing.up" : standing < 0 ? "ui.world.go-home.standing.down" : "ui.world.go-home.standing.same"));
    // Nothing is on record until it happens (R-PLACE-009).
    expect(view.place.returns).toEqual([]);
  });

  test("[R-PLACE-004] given no status and nothing to pay the fare with, then the assisted return is the way home", () => {
    const game = abroadGame();
    setPockets(game, { NGN: 0, GBP: 0, USD: 0, CAD: 0, AED: 0, EUR: 0 });
    const view = viewAfter(game, [{ type: "status/lose" }]);
    // Losing the visa leaves only the country's overstayer status, which is no permission to be there (R-PLACE-004).
    expect(view.status?.entry).toBe(UK.overstayer);
    expect(view.place.wayHome).toMatchObject({ paidFrom: null, shape: "assisted" });
    const hand = hands();
    const ask = goHomeAsk(view, hand);
    expect([ask?.title, ask?.line, ask?.cost, ask?.blocked]).toEqual([say("ui.world.go-home.title.assisted"), say("ui.world.go-home.line.assisted"), null, undefined]);
    ask?.act();
    expect(hand.go).toHaveBeenCalledTimes(1);
  });

  test("[R-PLACE-004] given a status held and no money for the fare, then there is no way home today and the button is shut", () => {
    const game = abroadGame();
    setPockets(game, { NGN: 0, GBP: 0, USD: 0, CAD: 0, AED: 0, EUR: 0 });
    const view = game.view();
    const ask = goHomeAsk(view, hands());
    expect(ask?.line).toBe(say("ui.world.go-home.line.none"));
    expect(ask?.blocked).toBe(say("ui.world.go-home.none"));
  });
});
