// One rent for the room (docs/rules/prologue.md R-PROLOGUE-013, home.md R-HOME-010): the door and Bills never name two
// figures for the same room. The door says the move-in with its fees, the figure Bills asks, and the year's rent after it, from the same tuning.
import { content } from "@japacity/content";
import { int } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { homeFigures } from "./ScenarioView";

describe("the room's move-in on the door", () => {
  test("[R-PROLOGUE-013] [R-HOME-010] given the room in Ojuelegba, when the door's line and Bills' move are read, then the door's move-in is the year's rent with the agent's and the agreement's fees, the figure Bills asks, and its year after is the rent alone", () => {
    const { rentYear, feesBp, upkeep } = content.tuning.home.compound;
    const movein = rentYear + int.bp(rentYear, feesBp);
    const door = homeFigures("compound-room");
    expect(door.now).toBe(movein);
    expect(door.rentYear).toBe(rentYear);
    const bills = newGame("scenario.ada").view().home.moves.find((move) => move.to === "place.compound-room");
    expect(bills?.now).toBe(movein);
    const line = say("ui.door.home.costs.compound-room", { amount: formatMoney(door.monthly, "NGN"), rent: formatMoney(rentYear, "NGN"), movein: formatMoney(door.now, "NGN") });
    expect(line).toBe(`${formatMoney(movein, "NGN")} to move in, then ${formatMoney(rentYear, "NGN")} a year · living ${formatMoney(upkeep, "NGN")} a month`);
  });
});
