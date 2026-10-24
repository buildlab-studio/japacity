// The English result with no route's band to meet (world:month-end-results-sheet, route:degree-meets-masters-english): with no plan, or a
// plan whose English is the degree, the result says the band alone and names no route's figure; a plan that asks a band is
// told against its own.
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../testing/fixtures";
import { bandAsked, bandResultFor } from "./englishTest";
import { tidyLines } from "./lines";
import { words } from "./text";
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
