import { describe, expect, test } from "vitest";

import { miniContent } from "../testing/miniContent";
import { checkContent } from "./content";
import { applyOverlay } from "./overlay";

describe("[R-ENGINE-017] the overlay", () => {
  test("[R-ENGINE-017] given an overlay of a few numbers, when applied, then those change and nothing else does", () => {
    const over = applyOverlay(miniContent, { tuning: { route: { refusalBaseBp: 1200 } }, school: { "school.mini": { offerBp: 5000 } } });
    expect(over.tuning.route.refusalBaseBp).toBe(1200);
    expect(over.tuning.route.refusalMinBp).toBe(miniContent.tuning.route.refusalMinBp);
    expect(over.school["school.mini"]?.offerBp).toBe(5000);
    expect(over.school["school.mini"]?.tuition).toBe(miniContent.school["school.mini"]?.tuition);
    expect(over.quality).toEqual(miniContent.quality);
    expect(checkContent(over)).toEqual([]);
  });

  test("[R-ENGINE-017] given an overlay, when applied, then the defaults are untouched", () => {
    const before = JSON.stringify(miniContent);
    applyOverlay(miniContent, { tuning: { turn: { cap: 99 } } });
    expect(JSON.stringify(miniContent)).toBe(before);
  });

  test("[R-ENGINE-017] given an empty overlay, when applied, then the content is equal to the defaults", () => {
    expect(applyOverlay(miniContent, {})).toEqual(miniContent);
  });

  test("[R-ENGINE-017] given an overlay that replaces a list, when applied, then the list is replaced whole", () => {
    const over = applyOverlay(miniContent, { route: { "route.mini": { schools: [] } } });
    expect(over.route["route.mini"]?.schools).toEqual([]);
  });
});
