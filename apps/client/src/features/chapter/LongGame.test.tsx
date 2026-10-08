import { content, text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, recordedGame, richAbroadView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { anyOptions } from "../../shared/words/requirement";
import { nameOf, say } from "../../shared/words/text";
import { ChapterView } from "./ChapterView";

const DONE: PlayerView["chapter"]["done"] = ["chapter.find-your-feet", "chapter.build-the-file", "chapter.decision-day", "chapter.send-off", "chapter.landing"];

describe("chapters 5 and 6, and after", () => {
  test("[R-CHAPTER-007] given Landing from the engine after the flight, then its items are content's words", async () => {
    const game = recordedGame("ada-careful");
    game.endTurn();
    const view = game.view();
    expect(view.chapter.current).toBe("chapter.landing");
    await renderWithView(<ChapterView />, view);
    for (const item of view.chapter.items) expect(screen.getByText(text[`chapter.landing.item.${item.id}`]!)).toBeDefined();
  });

  test("[R-CHAPTER-007] given Secure, then its one item lists its paths as any one of them", async () => {
    const view: PlayerView = { ...abroadView(), chapter: { current: "chapter.secure", items: [{ id: "secure", met: false }], done: DONE } };
    await renderWithView(<ChapterView />, view);
    const item = screen.getByText(text["chapter.secure.item.secure"]!).closest("li")!;
    const paths = within(item).getByText(say("ui.chapter.one-of")).closest("[data-one-of]") as HTMLElement;
    const options = anyOptions(content.chapter["chapter.secure"]!.items[0]!.requirement, { routes: view.routes });
    expect(options).toHaveLength(3);
    for (const option of options) expect(within(paths).getByText(option)).toBeDefined();
  });

  test("[R-CHAPTER-007] given every chapter done, then the long game takes its place with the open goals and their items met", async () => {
    const base = richAbroadView();
    const view: PlayerView = { ...base, chapter: { current: null, items: [], done: [...DONE, "chapter.secure"] } };
    await renderWithView(<ChapterView />, view);
    const long = document.querySelector("[data-long-game]") as HTMLElement;
    expect(within(long).getByText(say("ui.chapter.long-game"))).toBeDefined();
    for (const goal of base.goals.open) {
      expect(within(long).getByText(nameOf(goal.id))).toBeDefined();
      expect(within(long).getByText(say("ui.chapter.goal-items", { met: goal.items.filter((item) => item.met).length, total: goal.items.length }))).toBeDefined();
    }
  });
});
