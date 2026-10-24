// One band for the route (world:one-action-one-sheet): the band is the plan's route's own, from its content, on the
// file, the centre's sheet and the result, so the care file's 4.0 is never told as the master's 6.0.
import { content, text } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../testing/fixtures";
import { formatBand } from "./format";
import { tidyLines } from "./lines";
import { bandNeeded, routeBand, testChance } from "./englishTest";
import { words } from "./text";
import { toldOnResults } from "./told";

const PAPER = "document.english-test";
const CARE = "route.uk-care";

describe("one band for the route", () => {
  test("[world:one-action-one-sheet] given every route whose file asks for an English result, when the file's words are read, then the band they say is the route's own from its content", () => {
    const asking = Object.keys(content.route).filter((route) => routeBand(route) !== null);
    expect(asking).toEqual(expect.arrayContaining([CARE, "route.uk-skilled", "route.canada-points"]));
    // route:degree-meets-masters-english: the master's English is the degree, so its file asks no band.
    expect(routeBand("route.uk-masters")).toBeNull();
    for (const route of asking) {
      const said = text[`${route}.item.english`] ?? "";
      expect({ route, said: said.includes(`band ${formatBand(routeBand(route)!)} `) }).toEqual({ route, said: true });
    }
    expect(routeBand(CARE)).toBe(55);
  });

  test("[world:one-action-one-sheet] [world:month-end-results-sheet] given the nurse whose plan is health care, when the centre's sheet and its result are read, then both say the care route's band, never the master's 6.0, and with no plan the result says the band alone", () => {
    const game = newGame("scenario.nurse");
    viewAfter(game, [{ type: "route/hear", route: CARE, via: "meetup" }]);
    const view = game.view();
    expect(view.plan.route).toBe(CARE);
    expect(bandNeeded(view)).toBe(routeBand(CARE));
    expect(testChance(view).words.startsWith(`Band ${formatBand(routeBand(CARE)!)} this sitting:`)).toBe(true);
    const issued = (band: number): ReportLine => ({ key: "line.document.issued-band", params: { document: PAPER, band }, tone: "good", attention: true, counts: [] });
    // A 5.5 meets care's 5.5: told on the results and in News as meeting it; a 5.0 is short of it.
    const [met] = tidyLines([issued(55)]);
    const told = toldOnResults(met!, view);
    expect(words(told.key, told.params)).toMatch(/Band 5\.5\. That meets the route's 5\.5\.$/);
    expect(told.tone).toBe("good");
    const [tidy] = tidyLines([issued(50)]);
    expect(words(toldOnResults(tidy!, view).key, toldOnResults(tidy!, view).params)).toBe("Band 5.0. The route needs 5.5: study and sit again.");
    // With no plan, the result says the band alone and names no route's figure.
    const none = toldOnResults(tidy!, newGame("scenario.nurse").view());
    expect(words(none.key, none.params)).toBe(words("line.document.issued-band", tidy!.params));
    expect(words(none.key, none.params)).not.toMatch(/route/);
  });
});
