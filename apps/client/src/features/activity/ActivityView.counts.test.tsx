// The waiting months' acts say what each counts toward (activity:waiting-months-build-profile): the sheet a thing opens
// (world:things-are-tappable-models, world:one-action-one-sheet) shows each act, as a row among several or a card alone, with
// its route in words on a chip.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { countsRoutes, countsWords } from "../../shared/words/profile";
import { ActivityPicker } from "./ActivityView";

const ACTS = ["activity.open-source", "activity.tech-posts", "activity.conference-talk", "activity.be-noticed", "activity.nurse-certification", "activity.masters-at-home"] as const;

function cardOf(id: string): HTMLElement {
  const name = say(`${id}.name`);
  // A picker of several acts is rows, each named in its own line; an act alone is a card under its heading.
  const card = [...document.querySelectorAll("[data-activity-picker] li")].find((item) => (item.querySelector("[data-act-name]") ?? item.querySelector("h3"))?.textContent === name);
  if (card === undefined) throw new Error(`No card for ${id}`);
  return card as HTMLElement;
}

describe("what each act counts toward", () => {
  test("[activity:waiting-months-build-profile] [world:things-are-tappable-models] [world:one-action-one-sheet] [text:show-then-tell] given each of the waiting months' acts on the sheet its thing opens, when its card is read, then a chip with a plane says in words the route it counts toward, named Counts toward for a screen reader, and the card's line never says it", async () => {
    const view = viewAfter(newGame("scenario.developer"), [{ type: "quality/add", quality: "quality.network", amount: 10 }]);
    await renderWithView(<ActivityPicker only={[...ACTS]} />, view);
    for (const id of ACTS) {
      const routes = content.activity[id as Id<"activity">]?.counts ?? [];
      expect(routes.length).toBeGreaterThan(0);
      const chip = cardOf(id).querySelector("[data-counts]");
      const line = chip?.textContent ?? "";
      expect(line).toBe(countsRoutes(id));
      expect(chip?.classList.contains("sticker-chip")).toBe(true);
      expect(chip?.querySelector("svg.lucide-plane-takeoff")).not.toBeNull();
      expect(chip?.getAttribute("aria-label")).toBe(countsWords(id));
      expect(chip?.getAttribute("aria-label")?.startsWith("Counts toward: ")).toBe(true);
      expect(cardOf(id).textContent).not.toContain("Counts toward");
      for (const route of routes) expect(line.toLowerCase()).toContain(say(`ui.counts.route.${route}`).toLowerCase());
    }
  });

  test("[activity:waiting-months-build-profile] given the master's and the developer's acts, when their lines are read, then the master's counts toward Canada's points and open source toward the talent route", () => {
    expect(countsWords("activity.masters-at-home")).toBe("Counts toward: Canada's points");
    expect(countsWords("activity.open-source")).toBe("Counts toward: the talent route");
    expect(countsWords("activity.nurse-certification")).toBe("Counts toward: health care in the UK");
    expect(countsWords("activity.be-noticed")).toBe("Counts toward: the study visa and Canada's points");
    expect(countsRoutes("activity.nurse-certification")).toBe("Health care in the UK");
    expect(countsRoutes("activity.be-noticed")).toBe("The study visa and Canada's points");
  });

  test("[activity:waiting-months-build-profile] given an act that counts toward no route, when its card is read, then it says nothing about counting", async () => {
    // Rest is in no picker (turn:free-slots-per-month), so time with family stands for an act that counts toward nothing.
    await renderWithView(<ActivityPicker only={["activity.family-time"]} />, newGame("scenario.graduate").view());
    expect(countsWords("activity.family-time")).toBeNull();
    expect(countsRoutes("activity.family-time")).toBeNull();
    expect(cardOf("activity.family-time").querySelector("[data-counts]")).toBeNull();
  });
});
