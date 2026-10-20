// A card says it costs nothing once (text:bands-not-figures): the tag
// says "No cost", so a free activity's line never opens on "Free." as well.
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../../shared/testing/fixtures";
import { blurbOf, say } from "../../shared/words/text";

describe("a free card", () => {
  test("[text:bands-not-figures] given every activity the card tags as costing nothing, when its line is read, then the line does not say free again", () => {
    const view = viewAfter(newGame("scenario.graduate"), [{ type: "route/hear", route: "route.uk-masters", via: "test" }]);
    const free = view.activities.filter((option) => option.cost.length === 0).map((option) => option.id);
    expect(free).toContain("activity.look-into-route");
    expect(say("ui.activity.free")).toBe("No cost");
    for (const id of [...free, "activity.ask-someone-who-went"]) expect(blurbOf(id) ?? "").not.toMatch(/^Free\b/);
  });
});
