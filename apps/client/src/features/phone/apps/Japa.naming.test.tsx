// The Japa app names its way out once: the header names the route, so the figure
// under it does not name it again.
import { toKnown } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { newGame } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { nameOf, runningName, say } from "../../../shared/words/text";
import { Japa } from "./Japa";

const UK = "route.uk-masters";

describe("one naming of the way out", () => {
  test("[world:phone-holds-what-phones-hold] given the UK master's looked into, when Japa shows its figure, then the route is named in the header and not again under the figure", async () => {
    const game = newGame("scenario.graduate");
    toKnown(game);
    const view = game.view();
    expect(view.japacity.route).toBe(UK);
    await renderWithView(<Japa />, view);
    expect(document.querySelector("[data-japa-route]")?.textContent).toBe(nameOf(UK));
    expect(document.body.textContent).not.toContain(say("ui.japacity.of", { route: runningName(UK) }));
  });
});
