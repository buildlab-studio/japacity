// Every piece of news names where it was heard, a small icon and a word, and a rumour is marked as a rumour, so
// talk never reads like a changed rule.
import { content, text } from "@japacity/content";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { newsSource } from "../../shared/ui/NewsSource";
import { say } from "../../shared/words/text";
import { NewsView } from "./NewsView";

describe("where a story comes from", () => {
  test("[R-NEWS-004] given every story at every stage past its rumour, when its source is read, then it is one of the five and has a word", () => {
    for (const entry of Object.values(content.news)) {
      for (const stage of ["announced", "in-force"] as const) {
        const source = newsSource(entry.id, stage);
        expect(["radio", "paper", "official", "street", "person"]).toContain(source.kind);
        expect(source.word.trim()).not.toBe("");
        expect(source.word).not.toMatch(/^ui\.|^news\./);
      }
    }
  });

  test("[R-NEWS-004] given a story told by a person, when its source is read, then the word is the person's name", () => {
    expect(newsSource("news.uk-unis-recruit", "in-force")).toEqual({ kind: "person", word: text["news.uk-unis-recruit.in-force.source"] });
    expect(text["news.uk-unis-recruit.in-force.source"]).toBe("Tolu");
  });

  test("[R-NEWS-001] [R-NEWS-004] given a rumour, when its source is read, then it is marked a rumour with its own word", () => {
    expect(newsSource("news.uk-living-rise", "rumour")).toEqual({ kind: "rumour", word: say("ui.news.source.rumour") });
  });

  test("[R-NEWS-004] given the wide screen's News, when stories show, then each carries its source mark", async () => {
    await renderWithView(<NewsView />, richView());
    const marks = [...document.querySelectorAll<HTMLElement>("[data-source]")];
    expect(marks.length).toBe(richView().news.length);
    expect(marks.map((mark) => mark.dataset.source)).toContain("rumour");
    expect(screen.queryByText("In force")).toBeNull();
  });
});
