// The situation in plain words, as a person would say it (the third play review, findings 19, 21 and
// 24): no raw key, no "free slots", no quality as a bare figure, and a first screen that says the
// game is about leaving. On the real content and the real engine.
import { content, text } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ScenarioView } from "../../features/scenario/ScenarioView";
import { legalCommands } from "../../../../../packages/sim/src/testing/legal";
import { newGame } from "../testing/fixtures";
import { renderWithView } from "../testing/render";
import { tidyLines } from "./lines";
import { valueWords } from "./quality";
import { bandWords, say, words } from "./text";
import { uiText } from "./ui";

/** The lines of the prologue's first answer: the draw, as the first screen tells it. */
function firstAnswer(): ReportLine[] {
  const game = newGame("scenario.prologue");
  const [first] = legalCommands(game.view());
  if (first === undefined) throw new Error("The prologue opens with no answer.");
  return game.accept(first).lines;
}

describe("the situation in plain words", () => {
  test("[R-TURN-009] [R-ACTIVITY-010] given a side job's lock, when its lines are read, then they name the side job in words, never its key", () => {
    const locked = words("line.turn.locked", { slots: 1, why: "side-job" });
    const unlocked = words("line.turn.unlocked", { why: "side-job" });
    expect(locked).toBe("Your side job takes some of your time this month.");
    expect(unlocked).toBe("Your time is your own again. Your side job no longer takes it.");
    for (const said of [locked, unlocked]) expect(said).not.toContain("side-job");
  });

  test("[R-PROLOGUE-002] [R-PROLOGUE-008] given the prologue's draw, when its first lines are read, then each quality is told by its band in a sentence, never as a figure", () => {
    const lines = firstAnswer().filter((line) => line.key === "line.quality.gain");
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const said = words(line.key, line.params);
      expect(said).not.toMatch(/\d/);
      const { quality, value } = line.params;
      if (typeof quality !== "string" || typeof value !== "number") throw new Error("A quality line without its quality.");
      expect(said).toBe(`${bandWords(quality, value) ?? ""}.`);
    }
    const means = lines.find((line) => line.params.quality === "quality.family-means");
    expect(["Your family has nothing spare.", "Your family gets by.", "Your family has a little behind it.", "Your family is comfortable."]).toContain(words(means?.key ?? "", means?.params));
  });

  test("[R-PROLOGUE-008] given a quality with bands, when its value is shown, then the band is said at each edge and no figure shows", () => {
    const { min, max } = content.quality["quality.family-means"] ?? { min: 0, max: 100 };
    expect(valueWords("quality.family-means", min)).toBe(say("ui.band.quality.family-means.0"));
    expect(valueWords("quality.family-means", 25)).toBe(say("ui.band.quality.family-means.0"));
    expect(valueWords("quality.family-means", 26)).toBe(say("ui.band.quality.family-means.1"));
    expect(valueWords("quality.family-means", max)).toBe(say("ui.band.quality.family-means.3"));
    // A quality with named levels keeps its names.
    expect(valueWords("quality.edu-grade", 4)).toBe(text["quality.edu-grade.value.4"]);
  });

  test("[R-WORLD-007] given the month's words, then none says free slots or upkeep, and a quiet month and the job hunt say the time in things to do", () => {
    const shown = [say("ui.month.slots", { used: 1, slots: 3 }), say("ui.month.rest"), say("ui.job.none"), say("ui.month.no-slots"), words("line.activity.rested", { slots: 2 }), text["obligation.upkeep.name"] ?? ""];
    for (const said of shown) {
      expect(said).not.toMatch(/free slot/i);
      expect(said).not.toMatch(/upkeep/i);
    }
    expect(say("ui.month.slots", { used: 1, slots: 3 })).toBe("1 of 3 things planned");
    expect(say("ui.job.none")).toContain("Time for three things this month");
    expect(text["obligation.upkeep.name"]).toBe("Living costs");
    const rested = tidyLines([{ key: "line.activity.rested", params: { slots: 2 }, tone: "plain", attention: false, counts: [] }]);
    expect(words(rested[0]?.key ?? "", rested[0]?.params)).not.toMatch(/\d/);
  });

  test("given the share card's labels, then they say what a person would: ready to go and how home sees you", () => {
    expect(say("share.japacity")).toBe("Ready to go");
    expect(say("share.standing")).toBe("How home sees you");
    expect(Object.values(uiText).some((said) => /Japacity so far/.test(said))).toBe(false);
  });

  test("given the first screen, when a life is picked, then the line under Who are you? names leaving", async () => {
    await renderWithView(<ScenarioView />, newGame("scenario.ada").view());
    expect(screen.getByRole("heading", { name: say("ui.life.title") })).toBeDefined();
    const intro = say("ui.life.intro");
    expect(screen.getByText(intro)).toBeDefined();
    expect(intro).toMatch(/out of the country/);
    expect(intro.split(/\.\s/)).toHaveLength(1);
  });
});
