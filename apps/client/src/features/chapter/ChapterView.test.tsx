import { text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { ChapterView } from "./ChapterView";

describe("the chapter", () => {
  test("given a new life, then the first chapter's title, opening line and items come from content", async () => {
    const view = engineView();
    await renderWithView(<ChapterView />, view);
    const current = view.chapter.current!;
    expect(screen.getByRole("heading", { name: text[`${current}.title`]! })).toBeDefined();
    expect(screen.getByText(text[`${current}.open`]!)).toBeDefined();
    for (const item of view.chapter.items) expect(screen.getByText(text[`${current}.item.${item.id}`]!)).toBeDefined();
  });

  test("given a met item and a done chapter, then the item is crossed out and the chapter is listed", async () => {
    const base = engineView();
    const view: PlayerView = {
      ...base,
      chapter: { current: "chapter.build-the-file", items: [{ id: "passport", met: true }, { id: "offer", met: false }], done: ["chapter.find-your-feet"], closes: false, next: null },
    };
    await renderWithView(<ChapterView />, view);
    expect(screen.getByText(text["chapter.build-the-file.item.passport"]!).closest("li")?.getAttribute("data-met")).toBe("true");
    expect(screen.getByText(text["chapter.build-the-file.item.offer"]!).closest("li")?.getAttribute("data-met")).toBe("false");
    expect(screen.getByText(text["chapter.find-your-feet.title"]!)).toBeDefined();
  });
});
