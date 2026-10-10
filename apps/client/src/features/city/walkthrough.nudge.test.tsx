// The first chapter's opening (docs/rules/chapter.md R-CHAPTER-011; world.md R-WORLD-001, R-WORLD-033): no card before
// play. Its title stands over the world for about two seconds, with nothing to press, while the nudge under the band
// gives the first step; a later chapter keeps its opening card, one line and Go.
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nameOf, say, words } from "../../shared/words/text";
import { City, TITLE_MS } from "./City";
import { nudgeOf } from "./nudge";

const world = () => <City world month={<p>month</p>} results={(place) => <p data-results-for={place} />} />;

describe("the first chapter's title", () => {
  test("[R-CHAPTER-011] [R-WORLD-001] given a life that has not played a month, in the first chapter, when the world opens, then its title stands over the world with no card and no button, the nudge gives the first step, and the title goes by itself after about two seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const view = engineView();
      expect(view.chapter.current).toBe("chapter.find-your-feet");
      await renderWithView(world(), view);
      const title = document.querySelector<HTMLElement>("[data-opening-title]");
      expect(title?.dataset["opening"]).toBe(view.chapter.current);
      expect(title?.textContent).toBe(nameOf(view.chapter.current!));
      expect(title?.querySelector("button")).toBeNull();
      expect(title?.className).toContain("pointer-events-none");
      expect(screen.queryByRole("button", { name: say("ui.opening.go") })).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
      // The nudge stands under the band with the first step while the title shows.
      expect(document.querySelector("[data-nudge]")?.textContent).toContain(say(nudgeOf(view).key));
      expect(TITLE_MS).toBeGreaterThanOrEqual(1500);
      expect(TITLE_MS).toBeLessThanOrEqual(2500);
      act(() => {
        vi.advanceTimersByTime(TITLE_MS - 100);
      });
      expect(document.querySelector("[data-opening-title]")).not.toBeNull();
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(document.querySelector("[data-opening]")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test("[R-CHAPTER-011] given a life that has not played a month in a later chapter, when the world opens, then the chapter keeps its opening card, one line and Go", async () => {
    const base = engineView();
    const view = { ...base, chapter: { ...base.chapter, current: "chapter.build-the-file" as const, done: ["chapter.find-your-feet" as const] } };
    await renderWithView(world(), view);
    const card = document.querySelector<HTMLElement>("[data-opening]");
    expect(card?.dataset["opening"]).toBe("chapter.build-the-file");
    expect(document.querySelector("[data-opening-title]")).toBeNull();
    expect(card?.textContent).toContain(words("chapter.build-the-file.open"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.opening.go") }));
    expect(document.querySelector("[data-opening]")).toBeNull();
  });
});
