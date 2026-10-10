// The Calendar says in one line when the room's year of rent is taken at this month's end and the money held is
// short of it (docs/rules/home.md R-HOME-010).
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { newGame, setPockets } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { Calendar } from "./Calendar";

const YEAR = content.tuning.home.compound.rentYear;

/** Ada in the room from month 0, played to the month whose end takes the year's rent, then left holding `held`. */
function roomAtRent(held: number) {
  const game = newGame();
  setPockets(game, { NGN: 5_000_000_00 });
  game.accept({ type: "home/move", to: "place.compound-room" });
  while (game.view().home.roomRent!.dueIn > 0) {
    setPockets(game, { NGN: 5_000_000_00 });
    if (game.state.turn.banked < 1) game.grant(content.tuning.turn.cap);
    game.endTurn();
  }
  setPockets(game, { NGN: held });
  return game.view();
}

function rentLine(): string | null {
  return document.querySelector("[data-month-rent-short]")?.textContent ?? null;
}

describe("the rent line", () => {
  test("[R-HOME-010] given the room's year due at this month's end and a kobo short of it held, when the Calendar shows, then one line says the rent due and what is held", async () => {
    const view = roomAtRent(YEAR - 1);
    await renderWithView(<Calendar />, view);
    expect(rentLine()).toBe(`Rent ${formatMoney(YEAR, "NGN")} due this month. You hold ${formatMoney(YEAR - 1, "NGN")}.`);
  });

  test("[R-HOME-010] given the room's year due and all of it held, when the Calendar shows, then no rent line shows", async () => {
    await renderWithView(<Calendar />, roomAtRent(YEAR));
    expect(rentLine()).toBeNull();
  });

  test("[R-HOME-010] given the room's year a month away and nothing held, when the Calendar shows, then no rent line shows: Coming up says it", async () => {
    const game = newGame();
    setPockets(game, { NGN: 5_000_000_00 });
    game.accept({ type: "home/move", to: "place.compound-room" });
    setPockets(game, { NGN: 0 });
    await renderWithView(<Calendar />, game.view());
    expect(rentLine()).toBeNull();
  });
});
