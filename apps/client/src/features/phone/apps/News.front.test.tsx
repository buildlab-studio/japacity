// The front of News on the phone (news:stages-move-forward-only, news:changed-stages-delivered-once; director:one-era-at-a-time; lottery.md
// lottery:draw-result-on-front-page), each assertion against the News app: the era with its months, the last Friday draw, the empty line, the stories and
// where each was heard. The era's months are said as months ago and from now, never a month's number (world:top-band-is-lively-pill).
import { content, text } from "@japacity/content";
import type { LotteryResult, PlayerView } from "@japacity/sim";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, engineView, richAbroadView, richView } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { newsSource } from "../../../shared/ui/NewsSource";
import { formatMoney } from "../../../shared/words/format";
import { blurbOf, inMonths, monthsAgo, nameOf, say } from "../../../shared/words/text";
import { drawnWords, News } from "./News";

const RESULT: LotteryResult = {
  draw: 6,
  revealed: "cd".repeat(32),
  beaconRound: 1006,
  beaconRandomness: "ef".repeat(32),
  listHash: "01".repeat(32),
  count: 300,
  odds: content.tuning.lottery.odds,
  jackpot: 24_000_000,
  winners: [
    { tier: "jackpot", tickets: [17], amount: 24_000_000 },
    { tier: "mid", tickets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], amount: 5_000_000 },
    { tier: "small", tickets: [20, 21, 22, 23, 24, 25], amount: 50_000 },
  ],
  nextJackpot: 20_000_000,
};

function online(last: LotteryResult | null): PlayerView {
  const view = engineView("scenario.tunde");
  return {
    ...view,
    lottery: {
      ticket: 20_000,
      maxTickets: 5,
      draw: 7,
      closesTick: 112,
      onSale: true,
      tickets: 0,
      numbers: null,
      jackpot: 20_000_000,
      rolledOver: false,
      odds: content.tuning.lottery.odds,
      fingerprint: "ab".repeat(32),
      last,
    },
  };
}

const stories = () => [...document.querySelectorAll<HTMLElement>("[data-story]")];

describe("the draw on the front of News", () => {
  test("[lottery:draw-result-on-front-page] given a drawn draw whose jackpot was hit, when the news is read, then the front page gives the jackpot it stood at, that it was hit, and how many tickets won, and no ticket number or code", async () => {
    await renderWithView(<News />, online(RESULT));
    const line = document.querySelector<HTMLElement>("[data-news-drawn]")!;
    expect(line.textContent).toContain(say("ui.news.drawn", { draw: 6, jackpot: formatMoney(24_000_000, "NGN"), winners: 17 }));
    expect(line.textContent).not.toMatch(/1, 2, 3/);
    expect(line.textContent).not.toContain(RESULT.listHash);
  });

  test("[lottery:draw-result-on-front-page] given a draw whose jackpot nobody hit, or one with no ticket sold, when the news is read, then the line says it rolls over, or that nobody won", () => {
    const missed: LotteryResult = { ...RESULT, winners: [{ tier: "jackpot", tickets: [], amount: 24_000_000 }, ...RESULT.winners.slice(1)], nextJackpot: 24_600_000 };
    expect(drawnWords(missed)).toBe(say("ui.news.drawn-rolled", { draw: 6, jackpot: formatMoney(24_000_000, "NGN"), winners: 16 }));
    const empty: LotteryResult = { ...RESULT, count: 0, winners: RESULT.winners.map((tier) => ({ ...tier, tickets: [] })) };
    expect(drawnWords(empty)).toBe(say("ui.news.drawn-none", { draw: 6 }));
  });

  test("[lottery:draw-result-on-front-page] given no draw drawn yet or the game offline, when the news is read, then there is no draw line", async () => {
    await renderWithView(<News />, online(null));
    expect(document.querySelector("[data-news-drawn]")).toBeNull();
    expect(screen.getByText(say("ui.news.title"))).toBeDefined();
  });
});

describe("the era on the front of News", () => {
  test("given an era running, then the front page names it and says what it means", async () => {
    await renderWithView(<News />, richAbroadView());
    expect(screen.getByText(nameOf("era.hard-line"))).toBeDefined();
    expect(screen.getByText(blurbOf("era.hard-line")!)).toBeDefined();
  });

  test("given no era from the world yet, then there is no front page", async () => {
    // The director always names an era, so the view is pinned here.
    const view = { ...abroadView(), era: null };
    expect(view.era).toBeNull();
    await renderWithView(<News />, view);
    expect(document.querySelector("[data-era]")).toBeNull();
  });

  test("[director:one-era-at-a-time] given the engine's era, then the front page names it with the month it began and the month it is due to end", async () => {
    const view = abroadView(1);
    const era = view.era!;
    await renderWithView(<News />, view);
    expect(screen.getByText(nameOf(era.id))).toBeDefined();
    const months = document.querySelector("[data-era-months]")?.textContent;
    expect(months).toBe(`${say("phone.news.era.since", { when: monthsAgo(era.sinceMonth, view.month).toLowerCase() })} ${say("phone.news.era.until", { when: inMonths(era.untilMonth, view.month) })}`);
    expect(months).not.toMatch(/\bmonth \d/i);
    // The chip wraps inside the era's card rather than running out of it.
    expect(document.querySelector("[data-era-months]")?.className).toContain("chip-wrap");
  });

  test("[director:one-era-at-a-time] given an era that began before the life, then it says so rather than a month before the first", async () => {
    const base = abroadView();
    const view = { ...base, era: { ...base.era!, sinceMonth: -3 } };
    await renderWithView(<News />, view);
    expect(document.querySelector("[data-era-months]")?.textContent).toContain(say("ui.news.era-before"));
  });
});

describe("the stories in News", () => {
  test("given none, then it says so", async () => {
    // The director opens with an era's story, so a view with no stories is pinned here.
    await renderWithView(<News />, { ...engineView(), news: [], era: null, lottery: null });
    expect(screen.getByText(say("ui.news.none"))).toBeDefined();
  });

  test("given no stories under the front page's era, then the empty line never says no news has reached you", async () => {
    const view = { ...engineView(), news: [] };
    expect(view.era).not.toBeNull();
    await renderWithView(<News />, view);
    expect(screen.queryByText(say("ui.news.none"))).toBeNull();
    expect(screen.getByText(say("ui.news.none-else"))).toBeDefined();
  });

  test("given stories, then each stage's headline and body come from content and stories for you are marked", async () => {
    await renderWithView(<News />, richView());
    expect(screen.getByText(text["news.uk-unis-recruit.in-force.head"]!)).toBeDefined();
    expect(screen.getByText(text["news.uk-unis-recruit.in-force.body"]!)).toBeDefined();
    expect(screen.getByText(text["news.naira-float.rumour.head"]!)).toBeDefined();
    expect(stories().filter((story) => story.textContent?.includes(say("ui.news.for-you")) === true)).toHaveLength(1);
    // What is in force comes before talk.
    const order = stories().map((story) => story.dataset.story);
    expect(order.indexOf("news.uk-unis-recruit")).toBeLessThan(order.indexOf("news.naira-float"));
  });
});

describe("where a story comes from", () => {
  test("[news:changed-stages-delivered-once] given every story at every stage past its rumour, when its source is read, then it is one of the five and has a word", () => {
    for (const entry of Object.values(content.news)) {
      for (const stage of ["announced", "in-force"] as const) {
        const source = newsSource(entry.id, stage);
        expect(["radio", "paper", "official", "street", "person"]).toContain(source.kind);
        expect(source.word.trim()).not.toBe("");
        expect(source.word).not.toMatch(/^ui\.|^news\./);
      }
    }
  });

  test("[news:changed-stages-delivered-once] given a story told by a person, when its source is read, then the word is the person's name", () => {
    expect(newsSource("news.uk-unis-recruit", "in-force")).toEqual({ kind: "person", word: text["news.uk-unis-recruit.in-force.source"] });
    expect(text["news.uk-unis-recruit.in-force.source"]).toBe("Tolu");
  });

  test("[news:stages-move-forward-only] [news:changed-stages-delivered-once] given a rumour, when its source is read, then it is marked a rumour with its own word", () => {
    expect(newsSource("news.uk-living-rise", "rumour")).toEqual({ kind: "rumour", word: say("ui.news.source.rumour") });
  });

  test("[news:changed-stages-delivered-once] given News on the phone, when stories show, then each carries its source mark", async () => {
    await renderWithView(<News />, richView());
    const marks = [...document.querySelectorAll<HTMLElement>("[data-source]")];
    expect(marks.length).toBe(richView().news.length);
    expect(marks.map((mark) => mark.dataset.source)).toContain("rumour");
    expect(screen.queryByText("In force")).toBeNull();
  });
});
