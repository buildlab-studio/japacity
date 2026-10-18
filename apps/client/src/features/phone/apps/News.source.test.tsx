// News on the phone names where each story was heard, and marks a rumour as a rumour (docs/rules/news.md R-NEWS-001,
// R-NEWS-004).
import { content } from "@japacity/content";
import type { NewsStage } from "@japacity/sim";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { abroadView } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { newsSource } from "../../../shared/ui/NewsSource";
import { say } from "../../../shared/words/text";
import { PhoneApps } from "../PhoneApps";
import { reloadSeen } from "../seen";

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

describe("where a story comes from, on the phone", () => {
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
});
