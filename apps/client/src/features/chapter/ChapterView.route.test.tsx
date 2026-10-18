// The chapter sheet shows the variant that stands in for a base (chapter:chapters-follow-lean-route).
import { text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { ChapterView } from "./ChapterView";

describe("the chapter sheet on a way out's file", () => {
  test("[chapter:chapters-follow-lean-route] given the Gulf file with the medical held, when the sheet shows, then its opening line and items are the Gulf's words, the medical ticked and the rest open", async () => {
    const base = engineView();
    const view: PlayerView = {
      ...base,
      chapter: {
        current: "chapter.build-the-file-gulf",
        items: [
          { id: "medical", met: true },
          { id: "agent", met: false },
          { id: "contract", met: false },
        ],
        done: ["chapter.find-your-feet"],
        closes: false,
        next: null,
      },
    };
    await renderWithView(<ChapterView />, view);
    expect(screen.getByRole("heading", { name: text["chapter.build-the-file-gulf.title"]! })).toBeDefined();
    expect(screen.getByText(text["chapter.build-the-file-gulf.open"]!)).toBeDefined();
    expect(screen.getByText("The medical").closest("li")?.getAttribute("data-met")).toBe("true");
    expect(screen.getByText("An agent with a real contract").closest("li")?.getAttribute("data-met")).toBe("false");
    expect(screen.getByText("The contract").closest("li")?.getAttribute("data-met")).toBe("false");
  });
});
