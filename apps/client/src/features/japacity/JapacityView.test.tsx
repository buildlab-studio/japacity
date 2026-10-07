import { text } from "@japacity/content";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { JapacityView } from "./JapacityView";

describe("japacity", () => {
  test("given no route, then it says so", async () => {
    await renderWithView(<JapacityView />, engineView());
    expect(screen.getByText(say("ui.japacity.none"))).toBeDefined();
  });

  test("given a route, then the number is shown big with the route's name from content", async () => {
    await renderWithView(<JapacityView />, richView());
    expect(screen.getByText("64")).toBeDefined();
    expect(screen.getByText(say("ui.japacity.of", { route: text["route.uk-masters.name"]! }))).toBeDefined();
  });
});
