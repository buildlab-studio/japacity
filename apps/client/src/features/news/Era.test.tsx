import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, richAbroadView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { blurbOf, nameOf } from "../../shared/words/text";
import { NewsView } from "./NewsView";

// The director's rules are still pending in the rule list until the director runs in the stand-in world.
describe("the news front page", () => {
  test("given an era running, then the front page names it and says what it means", async () => {
    await renderWithView(<NewsView />, richAbroadView());
    expect(screen.getByText(nameOf("era.hard-line"))).toBeDefined();
    expect(screen.getByText(blurbOf("era.hard-line")!)).toBeDefined();
  });

  test("given no era from the world yet, then there is no front page", async () => {
    // The director always names an era, so the view is pinned here.
    const view = { ...abroadView(), era: null };
    expect(view.era).toBeNull();
    await renderWithView(<NewsView />, view);
    expect(document.querySelector("[data-era]")).toBeNull();
  });
});
