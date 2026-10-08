import { text } from "@japacity/content";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { lowerFirst, say } from "../../shared/words/text";
import { JapacityView } from "./JapacityView";

describe("japacity", () => {
  test("given no route, then it says so", async () => {
    await renderWithView(<JapacityView />, engineView());
    expect(screen.getByText(say("ui.japacity.none"))).toBeDefined();
  });

  test("given no route, when the header shows the figure, then it says so in words and never shows a dash pair", async () => {
    await renderWithView(<JapacityView compact />, engineView());
    const figure = document.querySelector<HTMLElement>("[data-japacity-figure]")!;
    expect(figure.textContent).toBe(say("ui.japacity.none-short"));
    expect(figure.textContent).not.toContain("--");
  });

  test("given a route, then the number is shown big with the route's name from content", async () => {
    await renderWithView(<JapacityView />, richView());
    expect(screen.getByText("64")).toBeDefined();
    expect(screen.getByText(say("ui.japacity.of", { route: lowerFirst(text["route.uk-masters.name"]!) }))).toBeDefined();
  });

  test("given a route, then the percent sign is set in the body face, which has the glyph", async () => {
    await renderWithView(<JapacityView />, richView());
    const sign = screen.getByText("%");
    expect(sign.className).toContain("font-sans");
  });
});
