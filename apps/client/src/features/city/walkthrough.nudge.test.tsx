// The first chapter's opening as the hand draws it (chapter:first-chapter-mission-card; world:world-fills-the-screen; docs/design/09-the-games-look.md
// section 4): the first brief is a mission card handed by a person at the hub, in their voice,
// with its things, the place of each and one button, Let's go; once carried, its chip stands under the band for a moment,
// then slides into the Phone thumb, whose Japa app takes a dot. A later chapter's card is the same mission card.
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { japaMark } from "../../shared/world/briefHanded";
import { say, words } from "../../shared/words/text";
import { TUCK_MS, TUCK_SLIDE_MS } from "./brief/brief";
import { City } from "./City";

const world = () => <City world results={(place) => <p data-results-for={place} />} />;

describe("the first brief", () => {
  test("[chapter:first-chapter-mission-card] [world:world-fills-the-screen] given a life that has not played a month, in the first chapter, when the world opens, then the first brief is a mission card from a person at the hub with its things and Let's go; carried, its chip stands under the band, then tucks into the phone and the Japa app takes a dot", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const view = engineView();
      expect(view.chapter.current).toBe("chapter.find-your-feet");
      await renderWithView(world(), view);
      const card = document.querySelector<HTMLElement>("[data-brief]");
      expect(card?.dataset["opening"]).toBe(view.chapter.current);
      // The person handing it, in their voice, and never the chapter's name as a heading.
      expect(card?.querySelector("[data-pill], [data-face]")?.textContent).toContain(say("chapter.find-your-feet.brief.giver"));
      expect(card?.querySelector("[data-brief-title]")?.textContent).toBe(say("chapter.find-your-feet.brief.title"));
      expect(card?.querySelector("[data-brief-title]")?.textContent).not.toBe("Find your feet");
      expect(card?.querySelectorAll("[data-brief-item]").length).toBe(view.chapter.items.length);
      expect(card?.querySelector("[data-brief-item][data-now='true']")?.getAttribute("data-brief-item")).toBe(view.chapter.items.find((item) => !item.met)?.id);
      // Nothing under the band while the card is up.
      expect(document.querySelector("[data-nudge]")).toBeNull();
      expect(japaMark(view.scenario)).toBe("");
      fireEvent.click(screen.getByRole("button", { name: say("ui.brief.go") }));
      expect(document.querySelector("[data-brief]")).toBeNull();
      expect(document.querySelector("[data-brief-chip]")?.getAttribute("data-brief-chip")).toBe("handed");
      expect(document.querySelector("[data-brief-chip]")?.textContent).toContain(say("chapter.find-your-feet.brief.title"));
      expect(japaMark(view.scenario)).toBe(view.chapter.current);
      act(() => {
        vi.advanceTimersByTime(TUCK_MS + TUCK_SLIDE_MS + 50);
      });
      expect(document.querySelector("[data-brief-chip]")).toBeNull();
      // The Japa app's mark is the brief carried, so its dot shows until it is opened (features/phone's own test).
      expect(japaMark(view.scenario)).toBe(view.chapter.current);
    } finally {
      vi.useRealTimers();
    }
  });

  test("[chapter:first-chapter-mission-card] given a life that has not played a month in a later chapter, when the world opens, then its brief is the same mission card, in the giver's words, with Let's go", async () => {
    const base = engineView();
    const view = { ...base, chapter: { ...base.chapter, current: "chapter.build-the-file" as const, done: ["chapter.find-your-feet" as const] } };
    await renderWithView(world(), view);
    const card = document.querySelector<HTMLElement>("[data-opening]");
    expect(card?.dataset["opening"]).toBe("chapter.build-the-file");
    expect(card?.textContent).toContain(words("chapter.build-the-file.open"));
    expect(card?.querySelector("[data-brief-title]")?.textContent).toBe(say("chapter.build-the-file.brief.title"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.brief.go") }));
    expect(document.querySelector("[data-opening]")).toBeNull();
  });
});
