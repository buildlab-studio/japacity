// The waiting months' cards say what each act counts toward (docs/rules/activity.md R-ACTIVITY-013): the
// sheet a thing opens (world.md R-WORLD-005, R-WORLD-006) shows the card with its route in words.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { countsWords } from "../../shared/words/profile";
import { ActivityPicker } from "./ActivityView";

const ACTS = ["activity.open-source", "activity.tech-posts", "activity.conference-talk", "activity.be-noticed", "activity.nurse-certification", "activity.masters-at-home"] as const;

function cardOf(id: string): HTMLElement {
  const name = say(`${id}.name`);
  const card = [...document.querySelectorAll("[data-activity-picker] > li")].find((item) => item.querySelector("h3")?.textContent === name);
  if (card === undefined) throw new Error(`No card for ${id}`);
  return card as HTMLElement;
}

describe("what each act counts toward", () => {
  test("[R-ACTIVITY-013] [R-WORLD-005] [R-WORLD-006] given each of the waiting months' acts on the sheet its thing opens, when its card is read, then it says in words the route it counts toward", async () => {
    const view = viewAfter(newGame("scenario.zainab"), [{ type: "quality/add", quality: "quality.network", amount: 10 }]);
    await renderWithView(<ActivityPicker only={[...ACTS]} />, view);
    for (const id of ACTS) {
      const routes = content.activity[id as Id<"activity">]?.counts ?? [];
      expect(routes.length).toBeGreaterThan(0);
      const line = cardOf(id).querySelector("[data-counts]")?.textContent ?? "";
      expect(line).toBe(countsWords(id));
      expect(line.startsWith("Counts toward: ")).toBe(true);
      for (const route of routes) expect(line).toContain(say(`ui.counts.route.${route}`));
    }
  });

  test("[R-ACTIVITY-013] given the master's and the developer's acts, when their lines are read, then the master's counts toward Canada's points and open source toward the talent route", () => {
    expect(countsWords("activity.masters-at-home")).toBe("Counts toward: Canada's points");
    expect(countsWords("activity.open-source")).toBe("Counts toward: the talent route");
    expect(countsWords("activity.nurse-certification")).toBe("Counts toward: care work in the UK");
    expect(countsWords("activity.be-noticed")).toBe("Counts toward: the study visa and Canada's points");
  });

  test("[R-ACTIVITY-013] given an act that counts toward no route, when its card is read, then it says nothing about counting", async () => {
    // Rest is in no picker (R-TURN-006), so time with family stands for an act that counts toward nothing.
    await renderWithView(<ActivityPicker only={["activity.family-time"]} />, newGame("scenario.ada").view());
    expect(countsWords("activity.family-time")).toBeNull();
    expect(cardOf("activity.family-time").querySelector("[data-counts]")).toBeNull();
  });
});
