import { text } from "@japacity/content";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say, sayCount } from "../../shared/words/text";
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

  test("given a held paper two months from running out, then it warns with the month", async () => {
    const rich = richView();
    const documents = [{ id: "document.tb-certificate" as const, state: "held" as const, readyMonth: null, expiresMonth: rich.month + 2, value: null, onItsWay: null }];
    await renderWithView(<DocumentView />, { ...rich, documents });
    expect(screen.getByText(sayCount("ui.document.expires-soon", 2, { months: 2, month: rich.month + 2 }))).toBeDefined();
  });

  test("[R-DOCUMENT-008] given a held paper two months from running out with a new copy on its way, then it says when the new copy comes and does not warn", async () => {
    const rich = richView();
    const documents = [{ id: "document.tb-certificate" as const, state: "held" as const, readyMonth: rich.month + 1, expiresMonth: rich.month + 2, value: null, onItsWay: rich.month + 1 }];
    await renderWithView(<DocumentView />, { ...rich, documents });
    expect(screen.getByText(say("ui.document.pending", { month: rich.month + 1 }))).toBeDefined();
    expect(screen.queryByText(sayCount("ui.document.expires-soon", 2, { months: 2, month: rich.month + 2 }))).toBeNull();
  });

  test("given a held paper far from running out, then there is no warning", async () => {
    const rich = richView();
    await renderWithView(<DocumentView />, rich);
    expect(screen.queryByText(/Runs out/)).toBeNull();
  });
});
