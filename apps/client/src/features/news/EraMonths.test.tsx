import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nameOf, say, sayCount } from "../../shared/words/text";
import { NewsView } from "./NewsView";

describe("the era's months on the front page", () => {
  test("[R-DIRECTOR-002] given the engine's era, then the front page names it with the month it began and the month it is due to end", async () => {
    const view = abroadView(1);
    const era = view.era!;
    await renderWithView(<NewsView />, view);
    expect(screen.getByText(nameOf(era.id))).toBeDefined();
    const left = era.untilMonth - view.month;
    const months = document.querySelector("[data-era-months]")?.textContent;
    expect(months).toBe(`${say("ui.news.era-since", { month: era.sinceMonth + 1 })} ${sayCount("ui.news.era-until", left, { month: era.untilMonth, months: left })}`);
  });

  test("[R-DIRECTOR-002] given an era that began before the life, then it says so rather than a month before the first", async () => {
    const base = abroadView();
    const view = { ...base, era: { ...base.era!, sinceMonth: -3 } };
    await renderWithView(<NewsView />, view);
    expect(document.querySelector("[data-era-months]")?.textContent).toContain(say("ui.news.era-before"));
  });
});
