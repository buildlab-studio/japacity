// The sure first hunt's chance word tells the truth (activity:job-hunt-lands-offer, guide:early-win-in-three-turns): the job the sure hunt
// lands when the draw misses reads "As good as certain", since a hunt for it cannot miss it; every other job reads its own chance, since
// the sure hunt may land the sure job in its place. Every starting life, on the real content.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { ARCHETYPES, doorAnswer } from "../front-door/archetypes";
import { newGame } from "../testing/fixtures";
import { chanceOf, huntBand, jobCardWords, shownBand, sureJobOf } from "./jobs";
import { say } from "./text";

const HUNT = "activity.job-hunt" as Id<"activity">;
const SCENARIOS = Object.keys(content.scenario).filter((id) => id !== "scenario.prologue");
const SEEDS = ["sure-1", "sure-2", "sure-3", "sure-4", "sure-5", "sure-6"];

describe("the sure hunt says sure", () => {
  test.each(SCENARIOS)("[activity:job-hunt-lands-offer] [guide:early-win-in-three-turns] given %s before its first hunt, when the jobs' chances are read, then the job the sure hunt lands reads as good as certain on its card, and every other job its own chance", (scenario) => {
    const view = newGame(scenario as never, "sure-0").view();
    const hunt = view.activities.find((option) => option.id === HUNT);
    expect(hunt?.sure).toBe(true);
    const sure = sureJobOf(view, "main");
    expect(sure).not.toBeNull();
    for (const job of hunt?.params ?? []) {
      const slot = content.activity[job as Id<"activity">]?.slot;
      const certain = slot !== undefined && sureJobOf(view, slot) === job;
      expect(shownBand(view, job)).toBe(certain ? "certain" : huntBand(chanceOf(view, job)));
      expect(jobCardWords(view, job)).toContain(say(`jobs.chance.${shownBand(view, job)}`));
    }
    expect(shownBand(view, sure!)).toBe("certain");
  });

  test.each(SCENARIOS)("[activity:job-hunt-lands-offer] [guide:early-win-in-three-turns] given %s, when the job read as certain is hunted in the first month over many seeds, then the hunt lands that job every time", (scenario) => {
    for (const seed of SEEDS) {
      const game = newGame(scenario as never, seed);
      const sure = sureJobOf(game.view(), "main");
      expect(sure).not.toBeNull();
      game.endTurn([{ activity: HUNT, param: sure }]);
      const offer = game.view().offers.find((open) => open.entry === "offer.job");
      expect(offer?.terms["job"]).toBe(sure);
      expect(sureJobOf(game.view(), "main")).toBeNull();
    }
  }, 60_000);

  test("[activity:job-hunt-lands-offer] given the nurse's tile before its first hunt, when the clinic's card for the staff nurse's job is read, then it says that job's own chance, since a miss lands the sure job instead, and the sure job's card says as good as certain", () => {
    const nurse = ARCHETYPES.find((tile) => tile.id === "nurse")!;
    const game = newGame("scenario.prologue", "sure-nurse");
    for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
      const prologue = game.view().prologue!;
      game.accept({ type: "prologue/choose", step: prologue.step, answer: doorAnswer(nurse, prologue)! });
    }
    const view = game.view();
    const sure = sureJobOf(view, "main");
    expect(sure).not.toBe("activity.job-nurse");
    expect(shownBand(view, "activity.job-nurse")).toBe(huntBand(chanceOf(view, "activity.job-nurse")));
    expect(shownBand(view, sure!)).toBe("certain");
  });
});
