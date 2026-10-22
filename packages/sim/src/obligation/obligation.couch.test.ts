import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Id, PersonFacts } from "../engine/types";
import { applyAs, life, sibling } from "../testing/person.journey";
import type { Game } from "../testing/play";

const used = content;
const ROOM: Id<"obligation"> = "obligation.rent-room-canada";
const UPKEEP: Id<"obligation"> = "obligation.upkeep-canada";
const COUCH = content.tuning.people.couchMonths;
const IN_CANADA: Partial<PersonFacts> = { where: "abroad", country: "country.canada", status: "status.canada-resident" };

/** The graduate with Canadian money for rent and upkeep, a sibling with these facts, then the move to Canada. */
function arrives(siblingFacts: Partial<PersonFacts> | null): Game {
  const game = life(used, { pockets: { NGN: { bank: 200000000, cash: 150000000 }, CAD: { bank: 2000000, cash: 0 } } });
  if (siblingFacts !== null) sibling(game, "sib-1", siblingFacts);
  applyAs(game, [{ type: "place/move", to: "abroad", country: "country.canada" }]);
  return game;
}

function holds(game: Game, obligation: Id<"obligation">): boolean {
  return Object.values(game.state.obligation.items).some((item) => item.entry === obligation);
}

function rentPaid(game: Game): number {
  return game.state.wallet.totals.out.rent?.CAD ?? 0;
}

describe("person:sibling-couch-delays-rent: the couch", () => {
  test("[person:sibling-couch-delays-rent] given a sibling living in Canada, when the graduate arrives, then upkeep opens at once and the room only after the couch's months, none of them charged rent", () => {
    const game = arrives(IN_CANADA);
    expect(holds(game, UPKEEP)).toBe(true);
    expect(holds(game, ROOM)).toBe(false);
    for (let month = 1; month < COUCH; month += 1) {
      game.endTurn();
      expect(holds(game, ROOM)).toBe(false);
    }
    game.endTurn();
    expect(holds(game, ROOM)).toBe(true);
    expect(rentPaid(game)).toBe(0);
    game.endTurn();
    expect(rentPaid(game)).toBe(content.obligation[ROOM]!.amount);
  });

  test("[person:sibling-couch-delays-rent] given no sibling, a sibling in the UK, or one still at home, when the graduate arrives in Canada, then the room opens at once", () => {
    for (const facts of [null, { where: "abroad", country: "country.uk", status: "status.uk-settled" }, { where: "home" }] as (Partial<PersonFacts> | null)[]) {
      const game = arrives(facts);
      expect(holds(game, ROOM)).toBe(true);
    }
  });

  test("[person:sibling-couch-delays-rent] given the couch over and the room open, when rent is closed by other means later, then the couch never reopens it", () => {
    const game = arrives(IN_CANADA);
    for (let month = 0; month < COUCH; month += 1) game.endTurn();
    applyAs(game, [{ type: "obligation/close", obligationType: "rent" }]);
    game.endTurn();
    game.endTurn();
    expect(holds(game, ROOM)).toBe(false);
  });
});
