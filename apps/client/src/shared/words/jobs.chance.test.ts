// Every job reads its own chance (activity:job-hunt-lands-offer): on the board and on the hunt's card, the job's chance
// word is the band of the chance its hunt draws at, and only a job at the hire cap reads "As good as certain". Every
// starting life and each archetype's tile, on the real content.
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { ARCHETYPES, doorAnswer } from "../front-door/archetypes";
import { newGame } from "../testing/fixtures";
import { chanceOf, huntBand, jobCardWords } from "./jobs";
import { say } from "./text";

const HUNT = "activity.job-hunt" as Id<"activity">;
const SCENARIOS = Object.keys(content.scenario).filter((id) => id !== "scenario.prologue");
const CAP = content.tuning.quality.hireMaxBp;

function tileView(tile: string): PlayerView {
  const archetype = ARCHETYPES.find((each) => each.id === tile)!;
  const game = newGame("scenario.prologue", `chance-${tile}`);
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    game.accept({ type: "prologue/choose", step: prologue.step, answer: doorAnswer(archetype, prologue)! });
  }
  return game.view();
}

/** Each job on the board whose card does not say its own chance word, or says as good as certain below the cap. */
function wrongChances(view: PlayerView): string[] {
  const hunt = view.activities.find((option) => option.id === HUNT);
  if ((hunt?.params?.length ?? 0) === 0) return ["no job to hunt"];
  return (hunt?.params ?? []).filter((job) => {
    const band = huntBand(chanceOf(view, job));
    const words = jobCardWords(view, job);
    return (band === "certain") !== (chanceOf(view, job) >= CAP) || !words.includes(say(`jobs.chance.${band}`)) || (band !== "certain" && words.includes(say("jobs.chance.certain")));
  });
}

describe("every job reads its own chance", () => {
  test.each(SCENARIOS)("[activity:job-hunt-lands-offer] given %s before its first hunt, when the jobs' chances are read, then each job's card says its own chance word, and only a job at the hire cap says as good as certain", (scenario) => {
    expect(wrongChances(newGame(scenario as never, "chance-0").view())).toEqual([]);
  });

  test.each(ARCHETYPES.map((tile) => tile.id))("[activity:job-hunt-lands-offer] given the %s tile handed over, when the jobs' chances are read, then each job's card says its own chance word, and only a job at the hire cap says as good as certain", (tile) => {
    expect(wrongChances(tileView(tile))).toEqual([]);
  });

  test("[activity:job-hunt-lands-offer] given the nurse's tile before its first hunt, when the staff nurse's card is read, then it says likely, and the customer service job its own chance, not as good as certain", () => {
    const view = tileView("nurse");
    expect(huntBand(chanceOf(view, "activity.job-nurse"))).toBe("likely");
    expect(jobCardWords(view, "activity.job-nurse")).toContain(say("jobs.chance.likely"));
    expect(jobCardWords(view, "activity.job-customer-service")).not.toContain(say("jobs.chance.certain"));
  });
});
