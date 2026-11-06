// The brief's tiles have one look for each state (chapter:first-chapter-mission-card): a thing done recedes with its tick and "Done" in its
// place's stead, or where it happened when the years before met it; the thing now stands out; a thing to come is plain; and no tick
// stands as a badge in a tile's corner.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { say } from "../../../shared/words/text";
import type { Brief, BriefItem } from "./brief";
import { MissionCard } from "./BriefCards";

afterEach(() => cleanup());

const item = (id: string, state: Partial<BriefItem>): BriefItem => ({ id, words: id, place: `${id} place`, met: false, before: false, now: false, picture: "place.yaba", ...state });

const BRIEF: Brief = {
  chapter: "chapter.find-your-feet",
  base: "chapter.find-your-feet",
  title: "Work first, abeg",
  giver: { name: "Lanre", where: "the hub" },
  line: "Get work.",
  items: [item("heard", { met: true, before: true, place: "At a send-off" }), item("job", { now: true }), item("pay", {}), item("known", { met: true })],
  rewards: [],
  next: null,
  picture: "place.yaba",
};

describe("the brief's tiles", () => {
  test("[chapter:first-chapter-mission-card] given a brief with a thing met before it, one now, one to come and one done since, when the card shows, then each tile has its state's look, and a done tile says Done or where it happened beside its tick, never in a corner badge", () => {
    render(<MissionCard brief={BRIEF} onGo={() => undefined} />);
    const tiles = [...document.querySelectorAll<HTMLElement>("[data-brief-item]")];
    expect(tiles.map((tile) => tile.dataset["state"])).toEqual(["done", "now", "later", "done"]);
    const [before, now, later, done] = tiles as [HTMLElement, HTMLElement, HTMLElement, HTMLElement];
    expect(before.classList.contains("brief-step-done")).toBe(true);
    expect(before.hasAttribute("data-before")).toBe(true);
    expect(before.querySelector("[data-brief-tick]")?.textContent).toBe("At a send-off");
    // The tick's word for a screen reader beside where it happened.
    expect(within(before).getByRole("img", { name: say("ui.brief.done") })).toBeDefined();
    expect(done.querySelector("[data-brief-tick]")?.textContent).toBe(say("ui.brief.done"));
    expect(done.hasAttribute("data-before")).toBe(false);
    expect(now.classList.contains("brief-step-now")).toBe(true);
    expect(now.querySelector("[data-brief-tick]")).toBeNull();
    expect(later.classList.contains("brief-step-now") || later.classList.contains("brief-step-done")).toBe(false);
    expect(later.querySelector("[data-brief-tick]")).toBeNull();
    // No badge stands in a tile's corner: the tick is in the status line.
    for (const tile of tiles) expect(tile.querySelector(".absolute")).toBeNull();
    expect(screen.getByRole("button", { name: say("ui.brief.go") })).toBeDefined();
  });
});
