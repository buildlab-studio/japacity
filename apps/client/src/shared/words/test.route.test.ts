// One band for the route (docs/rules/world.md R-WORLD-006): the care
// file said "English result at band 4.0 or better", the centre's sheet "Band 6.0 this sitting: likely" and the result
// "That meets the route's 6.0." The band is the plan's route's own, from its content, on the file, the sheet and the result.
import { content, text } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../testing/fixtures";
import { formatBand } from "./format";
import { tidyLines } from "./lines";
import { bandNeeded, routeBand, testChance } from "./test";
import { words } from "./text";
import { toldOnResults } from "./told";

const PAPER = "document.english-test";
const CARE = "route.uk-care";

describe("one band for the route", () => {
  test("[R-WORLD-006] given every route whose file asks for an English result, when the file's words are read, then the band they say is the route's own from its content", () => {
    const asking = Object.keys(content.route).filter((route) => routeBand(route) !== null);
    expect(asking).toEqual(expect.arrayContaining(["route.uk-masters", CARE, "route.uk-skilled", "route.canada-points"]));
    for (const route of asking) {
      const said = text[`${route}.item.english`] ?? "";
      expect({ route, said: said.includes(`band ${formatBand(routeBand(route)!)} `) }).toEqual({ route, said: true });
    }
    expect(routeBand(CARE)).toBe(40);
  });

  test("[R-WORLD-006] [R-WORLD-008] given the nurse whose plan is care work, when the centre's sheet and her result are read, then both say the care route's band, never the master's 6.0", () => {
    const game = newGame("scenario.ngozi");
    viewAfter(game, [{ type: "route/hear", route: CARE, via: "meetup" }]);
    const view = game.view();
    expect(view.plan.route).toBe(CARE);
    expect(bandNeeded(view)).toBe(routeBand(CARE));
    expect(testChance(view).words.startsWith(`Band ${formatBand(routeBand(CARE)!)} this sitting:`)).toBe(true);
    const issued = (band: number): ReportLine => ({ key: "line.document.issued-band", params: { document: PAPER, band }, tone: "good", attention: true, counts: [] });
    // A 5.0 is short of the master's 6.0 and meets care's 4.0: told on the results and in News as meeting it.
    const [tidy] = tidyLines([issued(50)]);
    const told = toldOnResults(tidy!, view);
    expect(words(told.key, told.params)).toMatch(/Band 5\.0\. That meets the route's 4\.0\.$/);
    expect(told.tone).toBe("good");
    // With no plan, the chapter's 6.0 stands, as before.
    const none = toldOnResults(tidy!, newGame("scenario.ngozi").view());
    expect(words(none.key, none.params)).toBe("Band 5.0. The route needs 6.0: study and sit again.");
  });
});
