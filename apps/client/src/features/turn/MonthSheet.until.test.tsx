// Until news on the Month sheet (docs/rules/world.md R-WORLD-028): beside End month at home, the main
// button abroad, where the quiet months go by it (the pacing evaluation).
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { MonthSheet } from "./MonthSheet";
import { turnWords } from "./turn.words";

function main(): HTMLElement {
  const found = document.querySelector<HTMLElement>("[data-main='true']");
  if (found === null) throw new Error("No main button");
  return found;
}

describe("Until news on the Month sheet", () => {
  test("[R-WORLD-028] given a life at home, then End month is the main button and Until news is beside it", async () => {
    await renderWithView(<MonthSheet />, engineView("scenario.tunde"));
    expect(main().hasAttribute("data-month-end")).toBe(true);
    expect(main().className).toContain("btn-main");
    const until = screen.getByRole("button", { name: new RegExp(turnWords("ui.month.until-news")) });
    expect(until.dataset["main"]).toBe("false");
  });

  test("[R-WORLD-028] given a life abroad, then Until news is the main button and End month the second", async () => {
    await renderWithView(<MonthSheet />, abroadView());
    expect(main().hasAttribute("data-month-until")).toBe(true);
    expect(main().className).toContain("btn-main");
    const end = screen.getByRole("button", { name: new RegExp(turnWords("turn.month.end")) });
    expect(end.dataset["main"]).toBe("false");
    // The main button comes first.
    expect(main().compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("[R-WORLD-028] [R-TURN-003] given the sheet, when Until news is tapped, then the months end as turn/end commands, one at a time", async () => {
    const { authority, store } = await renderWithView(<MonthSheet />, { ...engineView("scenario.tunde"), report: null });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(turnWords("ui.month.until-news")) }));
    await waitFor(() => expect(store.getState().reportOpen).toBe(true));
    expect(authority.sent.length).toBeGreaterThan(0);
    expect(authority.sent.every((command) => command.type === "turn/end")).toBe(true);
  });
});
