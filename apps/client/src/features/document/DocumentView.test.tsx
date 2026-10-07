import { text } from "@japacity/content";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { DocumentView } from "./DocumentView";

describe("papers", () => {
  test("given none, then it says so", async () => {
    await renderWithView(<DocumentView />, engineView());
    expect(screen.getByText(say("ui.document.none"))).toBeDefined();
  });

  test("given held and pending papers, then each is named from content with its state", async () => {
    await renderWithView(<DocumentView />, richView());
    expect(screen.getByText(text["document.passport.name"]!).closest("li")?.getAttribute("data-state")).toBe("held");
    expect(screen.getByText(say("ui.document.pending", { month: 12 }))).toBeDefined();
    expect(screen.getByText(say("ui.document.band", { band: "6.5" }))).toBeDefined();
  });
});
