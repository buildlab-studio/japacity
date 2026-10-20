// The clinic's talk as the city says it (world:top-band-is-lively-pill, world:map-is-painted-lagos): a nurse at work
// on the ward hears the ward beside the TB test, and the place reads by its name alone.
import { describe, expect, test } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { heardWords, placeName } from "./city.words";
import { heardHere } from "./overheard";

const CLINIC = "place.tb-clinic";

describe("the clinic in the city's words", () => {
  test("[world:top-band-is-lively-pill] [world:map-is-painted-lagos] given a life in Lagos at the clinic, when its talk is heard, then the ward's lines are there beside the test's, and the band names it the clinic", () => {
    const heard = heardHere(newGame("scenario.graduate").view(), CLINIC).map((line) => heardWords(line.key, line.params));
    expect(heard).toEqual(expect.arrayContaining(["Ward three is short tonight.", "Breathe in and hold. Thank you."]));
    expect(placeName(CLINIC)).toBe("the clinic");
  });
});
