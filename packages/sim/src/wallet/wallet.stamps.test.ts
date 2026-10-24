// The passbook's stamps in the rule's order (wallet:savings-stamps): the fixed stamps under the target or already reached, in their figures' order,
// and the target last, even when a stamp already reached stands above a target that came down.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Id, PlayerView } from "../engine/types";
import { applyEffects } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { CARE_ROUTE, UK_ROUTE } from "../testing/ids";

function passbook(game: Game): NonNullable<PlayerView["passbook"]> {
  const book = game.view().passbook;
  if (book === null) throw new Error("No passbook in the view.");
  return book;
}

/** A life with a way as its plan: heard of, then looked into. */
function planOn(game: Game, route: Id<"route">): Game {
  applyEffects(game, [{ type: "route/hear", route, via: "meetup" }]);
  game.accept({ type: "activity/now", activity: "activity.look-into-route", param: route });
  expect(game.view().plan.route).toBe(route);
  return game;
}

describe("the stamps' order", () => {
  test("[wallet:savings-stamps] given the first two fixed stamps reached on the master's plan, when the plan turns to health care, whose whole cost sits between them, then the stamps show both reached in their order and the target last", () => {
    const game = planOn(start({ content, scenario: "scenario.nurse", seed: "passbook-1", worldSeed: "passbook-world" }), UK_ROUTE);
    const [million, twoAndHalf] = content.tuning.wallet.stamps;
    const target = passbook(game).target!.total;
    expect(target).toBeGreaterThan(twoAndHalf!);
    applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: twoAndHalf! - passbook(game).held + 10000000, reason: "gift" }]);
    game.endTurn();
    expect((game.state.wallet.stamps ?? []).map((stamp) => stamp.at)).toEqual([million, twoAndHalf]);
    applyEffects(game, [{ type: "route/hear", route: CARE_ROUTE, via: "meetup" }]);
    game.accept({ type: "activity/now", activity: "activity.look-into-route", param: CARE_ROUTE });
    game.accept({ type: "chapter/lean", route: CARE_ROUTE });
    expect(game.view().plan.route).toBe(CARE_ROUTE);
    const book = passbook(game);
    expect(book.target!.total).toBeLessThan(twoAndHalf!);
    expect(book.stamps.map((stamp) => ({ at: stamp.at, target: stamp.target, reached: stamp.month !== null }))).toEqual([
      { at: million, target: false, reached: true },
      { at: twoAndHalf, target: false, reached: true },
      { at: book.target!.total, target: true, reached: false },
    ]);
  });
});
