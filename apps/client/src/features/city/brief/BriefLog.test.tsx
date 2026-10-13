// The road's log on the phone (the plan 16): the brief carried first with its things ticked
// as the world ticks them, the briefs done stamped behind it in their givers' closing words, the next faint at the foot.
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { engineView } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { say, words } from "../../../shared/words/text";
import { BriefLog, briefLog } from "./BriefLog";

const FIRST = "chapter.find-your-feet" as Id<"chapter">;
const SECOND = "chapter.build-the-file" as Id<"chapter">;

/** The first brief done and the second carried, its first thing in. */
function secondCarried(): PlayerView {
  const view = engineView();
  const items = (content.chapter[SECOND]?.items ?? []).map((item, index) => ({ id: item.id, met: index === 0 }));
  return { ...view, chapter: { current: SECOND, items, done: [FIRST], closes: false, next: null } };
}

describe("the road's log", () => {
  test("[R-WORLD-019] [R-WORLD-003] given the second brief carried with one thing in and the first done, when the log is read, then the carried brief leads with its things ticked as the world ticks them, the first stands stamped in its giver's closing words, and the next is faint", async () => {
    const view = secondCarried();
    const log = briefLog(view);
    expect(log.carried?.chapter).toBe(SECOND);
    expect(log.done.map((brief) => brief.chapter)).toEqual([FIRST]);
    expect(log.done[0]?.line).toBe(words(`${FIRST}.close`));
    expect(log.next?.chapter).toBe("chapter.decision-day");
    await renderWithView(<BriefLog />, view);
    const cards = [...document.querySelectorAll<HTMLElement>("[data-brief-log]")];
    expect(cards.map((card) => card.getAttribute("data-brief-log"))).toEqual(["carried", "done", "next"]);
    const carried = cards[0]!;
    expect(carried.textContent).toContain(say(`${SECOND}.brief.title`));
    expect(carried.textContent).toContain(say(`${SECOND}.brief.giver`));
    expect([...carried.querySelectorAll("[data-brief-log-item]")].map((item) => item.getAttribute("data-met"))).toEqual(view.chapter.items.map((item) => String(item.met)));
    expect(carried.querySelectorAll("[data-dot]")).toHaveLength(view.chapter.items.length);
    const done = cards[1]!;
    expect(done.querySelector("[data-brief-log-stamp]")?.textContent).toBe(say("ui.brief.done"));
    expect(done.textContent).toContain(say(`${FIRST}.brief.title`));
    expect(done.textContent).toContain(words(`${FIRST}.close`));
    expect(cards[2]!.className).toContain("opacity-60");
    // Nothing in the log reads as a checklist to work through: no checkbox, no "step", "item" or "task".
    expect(document.querySelector("input[type='checkbox']")).toBeNull();
    expect(document.querySelector("[data-brief-log-list]")?.textContent).not.toMatch(/\b(step|item|task|chapter)\b/i);
  });

  test("[R-WORLD-019] given the first brief carried, when the log shows, then it carries that brief and the next, and nothing stamped", async () => {
    const view = engineView();
    await renderWithView(<BriefLog />, view);
    const cards = [...document.querySelectorAll<HTMLElement>("[data-brief-log]")];
    expect(cards.map((card) => card.getAttribute("data-brief-log"))).toEqual(["carried", "next"]);
    expect(cards[0]?.getAttribute("data-brief-log-chapter")).toBe(view.chapter.current);
  });

  test("[R-WORLD-019] given no brief carried and none done, when the log shows, then it shows nothing", async () => {
    const view = engineView();
    await renderWithView(<BriefLog />, { ...view, chapter: { current: null, items: [], done: [], closes: false, next: null } });
    expect(document.querySelector("[data-brief-log-list]")).toBeNull();
  });
});
