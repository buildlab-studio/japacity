// The Calendar's line for each country's pass (place:country-pass-covers-ways, world:ride-abroad-and-workplace): Calgary's
// transit pass and Dubai's zone pass say what they cover, as London's bus pass does; Italy has no pass.
import type { Id, PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { landedGame } from "../../shared/testing/fixtures";
import { passWords } from "./Calendar";

const PASSES: Readonly<Record<string, Id<"activity">>> = { "country.canada": "activity.transit-pass-canada", "country.uae": "activity.transit-pass-uae" };

/** A life landed in the country with its money in hand, and, when asked, this month's pass bought. */
function landed(country: Id<"country">, pass = false): PlayerView {
  const game = landedGame(country, 50_000);
  const act = PASSES[country];
  if (pass && act !== undefined) game.accept({ type: "activity/now", activity: act, param: null });
  return game.view();
}

describe("the Calendar's pass abroad", () => {
  test("[place:country-pass-covers-ways] [world:ride-abroad-and-workplace] given a life in Calgary or Dubai, when the month's pass is bought, then the Calendar says what it covers is free till the month ends, and before it says nothing; Italy has no pass", () => {
    expect(passWords(landed("country.canada"))).toBeNull();
    expect(passWords(landed("country.canada", true))).toBe("Transit pass bought: the bus and the CTrain are free till the month ends");
    expect(passWords(landed("country.uae"))).toBeNull();
    expect(passWords(landed("country.uae", true))).toBe("Zone pass bought: the bus and the metro are free till the month ends");
    expect(passWords(landed("country.italy"))).toBeNull();
  });
});
