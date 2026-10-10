// Every piece of news names where it was heard, a small icon and a word, and a rumour is marked as a rumour, so
// talk never reads like a changed rule.
import { content, text } from "@japacity/content";
import type { NewsStage } from "@japacity/sim";
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { abroadView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { PhoneApps } from "../phone/PhoneApps";
import { reloadSeen } from "../phone/seen";
import { NewsView } from "./NewsView";
import { newsSource } from "./source";

beforeEach(() => {
  localStorage.clear();
  reloadSeen();
});

const story = (id: string, stage: NewsStage) => ({ id: id as keyof typeof content.news, stage, since: 0, forYou: false });

async function phoneStories(news: ReturnType<typeof story>[]): Promise<HTMLElement[]> {
  const view = abroadView();
  await renderWithView(<PhoneApps onClose={() => undefined} area="Peckham" now={() => new Date(2026, 9, 10, 12, 5)} talk={null} />, { ...view, news: news.map((one) => ({ ...one, since: view.month })) });
  fireEvent.click(document.querySelector<HTMLElement>('[data-app="news"]')!);
  return [...document.querySelectorAll<HTMLElement>("[data-story]")];
}

const markOf = (element: HTMLElement | undefined) => element?.querySelector<HTMLElement>("[data-source]") ?? null;

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

  test("[R-NEWS-004] given News on the phone with a story announced, one told by a person and a rumour, when it opens, then each shows its icon and its word, and none shows the stage's system word", async () => {
    const shown = await phoneStories([story("news.naira-float", "announced"), story("news.uk-unis-recruit", "in-force"), story("news.uk-living-rise", "rumour")]);
    const [announced, person, rumour] = ["news.naira-float", "news.uk-unis-recruit", "news.uk-living-rise"].map((id) => shown.find((element) => element.dataset.story === id));
    expect(markOf(announced)?.dataset.source).toBe(newsSource("news.naira-float", "announced").kind);
    expect(markOf(announced)?.textContent).toBe(newsSource("news.naira-float", "announced").word);
    expect(markOf(announced)?.querySelector("svg")).not.toBeNull();
    expect(markOf(person)?.dataset.source).toBe("person");
    expect(markOf(person)?.textContent).toBe("Tolu");
    expect(markOf(rumour)?.dataset.source).toBe("rumour");
    expect(markOf(rumour)?.textContent).toBe(say("ui.news.source.rumour"));
    expect(markOf(rumour)?.querySelector("svg")).not.toBeNull();
    for (const shown of [announced, person, rumour]) expect(shown?.textContent).not.toMatch(/Announced|In force/);
  });

  test("[R-NEWS-004] given the wide screen's News, when stories show, then each carries its source mark", async () => {
    await renderWithView(<NewsView />, richView());
    const marks = [...document.querySelectorAll<HTMLElement>("[data-source]")];
    expect(marks.length).toBe(richView().news.length);
    expect(marks.map((mark) => mark.dataset.source)).toContain("rumour");
    expect(screen.queryByText("In force")).toBeNull();
  });
});
