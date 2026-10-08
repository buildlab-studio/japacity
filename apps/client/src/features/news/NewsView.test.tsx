import { text } from "@japacity/content";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { NewsView } from "./NewsView";

describe("news", () => {
  test("given none, then it says so", async () => {
    // The director opens with an era's story, so a view with no stories is pinned here.
    await renderWithView(<NewsView />, { ...engineView(), news: [] });
    expect(screen.getByText(say("ui.news.none"))).toBeDefined();
  });

  test("given stories, then each stage's headline and body come from content and stories for you are marked", async () => {
    await renderWithView(<NewsView />, richView());
    expect(screen.getByRole("heading", { name: text["news.uk-unis-recruit.in-force.head"]! })).toBeDefined();
    expect(screen.getByText(text["news.uk-unis-recruit.in-force.body"]!)).toBeDefined();
    expect(screen.getByRole("heading", { name: text["news.naira-float.rumour.head"]! })).toBeDefined();
    expect(screen.getAllByText(say("ui.news.for-you"))).toHaveLength(1);
    // What is in force comes before talk.
    const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(headings.indexOf(text["news.uk-unis-recruit.in-force.head"]!)).toBeLessThan(headings.indexOf(text["news.naira-float.rumour.head"]!));
  });
});
