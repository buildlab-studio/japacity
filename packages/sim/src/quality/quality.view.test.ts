import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { start } from "../testing/play";
import { qualityIn } from "./quality.logic";

describe("a quality read from the view", () => {
  test("[quality:body-belly-and-energy] given a view, when a quality is read from its list, then the body reads as the state holds it and a quality the view does not list reads 0", () => {
    const game = start({ content, scenario: "scenario.nurse" });
    const view = game.view();
    expect(qualityIn(view, "quality.belly")).toBe(game.state.quality["quality.belly"]);
    expect(qualityIn(view, "quality.energy")).toBe(game.state.quality["quality.energy"]);
    expect(qualityIn(view, "quality.not-a-quality")).toBe(0);
    expect(qualityIn({}, "quality.belly")).toBe(0);
  });
});
