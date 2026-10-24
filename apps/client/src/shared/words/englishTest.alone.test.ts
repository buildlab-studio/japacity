// The English result and the centre's sheet with no route's band to meet (world:month-end-results-sheet, world:one-action-one-sheet,
// route:degree-meets-masters-english): with no plan, or a plan whose English is the degree, the result and the sheet say the band
// alone and name no route's figure; a plan that asks a band is told against its own.
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../testing/fixtures";
import { bandAsked, bandResultFor, englishOf, possibleBands, testChance } from "./englishTest";
import { formatBand } from "./format";
import { tidyLines } from "./lines";
import { say, words } from "./text";
import { toldOnResults } from "./told";

const issued = (band: number): ReportLine => ({ key: "line.document.issued-band", params: { document: "document.english-test", band }, tone: "good", attention: true, counts: [] });

describe("the English result with no band asked", () => {
  test("[world:month-end-results-sheet] given no plan, when a band of 5.0 is told on the results and in the month's lines, then it says the band alone, never a route's figure", () => {
    const view = newGame("scenario.nurse").view();
    expect(view.plan.route).toBeNull();
    expect(bandAsked(view)).toBeNull();
    const [tidy] = tidyLines([issued(50)]);
    const told = toldOnResults(tidy!, view);
    expect(told.key).toBe("line.document.issued-band");
    const said = words(told.key, told.params);
    expect(said).toMatch(/Band 5\.0\.$/);
    expect(said).not.toMatch(/route|needs|6\.0/);
  });

  test("[world:month-end-results-sheet] [route:degree-meets-masters-english] given the master's as the plan, whose English is the degree, when a band is told, then it says the band alone", () => {
    const view = viewAfter(newGame("scenario.graduate"), [{ type: "route/hear", route: "route.uk-masters", via: "meetup" }]);
    expect(view.plan.route).toBe("route.uk-masters");
    expect(bandAsked(view)).toBeNull();
    const told = bandResultFor(issued(55), view);
    expect(words(told.key, told.params)).not.toMatch(/route/);
  });

  test("[world:month-end-results-sheet] given the care route as the plan, when the engine's band line is told on the results, then it is told against care's own band", () => {
    const view = viewAfter(newGame("scenario.nurse"), [{ type: "route/hear", route: "route.uk-care", via: "meetup" }]);
    const told = toldOnResults(issued(50), view);
    expect(words(told.key, told.params)).toBe("Band 5.0. The route needs 5.5: study and sit again.");
  });
});

/** The band the middle draw of a sitting's noise gives from this much English: the band a sitting most likely gives. */
function likelyBand(english: number): number {
  const bands = possibleBands(english);
  return bands[(bands.length - 1) / 2]!;
}

describe("the centre's sheet with no band asked", () => {
  test("[world:one-action-one-sheet] given no plan, when the test's sheet reads its chance, then it says the band a sitting would likely give alone, names no route's figure and gives no advice to study first", () => {
    for (const english of [40, 55, 75]) {
      const game = newGame("scenario.graduate");
      const view = viewAfter(game, [{ type: "quality/add", quality: "quality.english", amount: english - englishOf(game.view()) }]);
      expect(view.plan.route).toBeNull();
      const chance = testChance(view);
      expect(chance.words).toBe(say("activity.sit-english-test.band-alone", { band: formatBand(likelyBand(english)) }));
      expect(chance.words).not.toMatch(/route|needs|long shot|fair chance|: likely/);
      expect(chance.study).toBeNull();
    }
    expect(testChance(viewAfter(newGame("scenario.graduate"), [])).words).not.toContain("Band 6.0");
  });

  test("[world:one-action-one-sheet] [route:degree-meets-masters-english] given the master's as the plan, whose English is the degree, when the test's sheet reads its chance, then it says the band alone", () => {
    const view = viewAfter(newGame("scenario.graduate"), [{ type: "route/hear", route: "route.uk-masters", via: "meetup" }]);
    expect(view.plan.route).toBe("route.uk-masters");
    expect(testChance(view).words).toBe(say("activity.sit-english-test.band-alone", { band: formatBand(likelyBand(englishOf(view))) }));
    expect(testChance(view).study).toBeNull();
  });
});
