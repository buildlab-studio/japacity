// Every job reads its own chance (activity:job-hunt-lands-offer): on the board and on the hunt's card, the job's chance
// word is the band of the chance its hunt draws at, and only a job at the hire cap reads "As good as certain". Every
// starting life and each archetype's tile, on the real content.
import { content } from "@japacity/content";
import { type Id, type PlayerView, qualityIn } from "@japacity/sim";
import { start } from "@japacity/sim/testing";
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

const REMOTE = "activity.job-remote-developer";
const TEACHER = "activity.job-teacher";
const BOOM = "news.remote-hiring-boom";
/** A stand-in world whose remote-hiring boom comes into force within the developer's first two years (director.md). */
const BOOM_WORLD = "world-9";

/** What the boom sets the remote job's bonus to while in force, from content. */
function boomBonus(): number {
  const set = content.news[BOOM as Id<"news">]?.standIn.sets.find((each) => each.var === "var.remote-hire-bonus");
  if (set === undefined) throw new Error("The boom sets no remote bonus in content.");
  return set.value;
}

/** The chance the hunt draws at for a job, from the rule: its own chance, the network's share and a bonus, under the cap. */
function drawnAt(view: PlayerView, job: string, bonus: number): number {
  const network = qualityIn(view, "quality.network");
  return Math.min(CAP, (content.activity[job as Id<"activity">]?.hireBp ?? 0) + content.tuning.quality.networkHireBp * network + bonus);
}

describe("the board's word in the remote-hiring boom", () => {
  test("[activity:job-hunt-lands-offer] [rate:latest-story-sets-variable] given the content's stories, when those that move the remote job's bonus are read, then each sets it and reverts it as it ends, and none adds to it, so the stories in force the view holds say the whole bonus", () => {
    const moving = Object.values(content.news).filter((entry) => entry.standIn.sets.some((each) => each.var === "var.remote-hire-bonus") || (entry.director?.adds ?? []).some((each) => each.var === "var.remote-hire-bonus"));
    expect(moving.map((entry) => entry.id)).toEqual([BOOM]);
    for (const entry of moving) {
      expect(entry.standIn.revert).toBe(true);
      expect((entry.director?.adds ?? []).some((each) => each.var === "var.remote-hire-bonus")).toBe(false);
    }
  });

  test("[activity:job-hunt-lands-offer] [director:world-variables-per-route] given the ready developer in a world whose remote-hiring boom comes into force, when the remote job's chance is read before, during and after it, then it is the chance the hunt draws at: the boom's bonus while it is in force and never outside it; the teacher's job never gains it", () => {
    const game = start({ content, scenario: "scenario.developer", worldSeed: BOOM_WORLD });
    const seen: string[] = [];
    for (let month = 0; month < 60; month += 1) {
      const view = game.view();
      const stage = view.news.find((story) => story.id === BOOM)?.stage ?? "none";
      const inForce = stage === "in-force";
      expect(game.world().vars["var.remote-hire-bonus"] ?? 0).toBe(inForce ? boomBonus() : 0);
      expect(chanceOf(view, REMOTE)).toBe(drawnAt(view, REMOTE, inForce ? boomBonus() : 0));
      expect(chanceOf(view, TEACHER)).toBe(drawnAt(view, TEACHER, 0));
      if (seen.at(-1) !== stage) seen.push(stage);
      if (stage === "ended") break;
      game.endTurn([]);
    }
    expect(seen).toContain("in-force");
    expect(seen.at(-1)).toBe("ended");
  });
});
