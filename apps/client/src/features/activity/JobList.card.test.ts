// The racks' card (docs/rules/activity.md R-ACTIVITY-017, world.md R-WORLD-006): "Work the racks"
// opened the hunt's card with the hunt's own words, "You send applications and follow up on every lead", and "Likely"
// at the bar every hunt stops at. A job named on its card speaks in its own words where content has them (`<job>.card`,
// else the job's blurb), and the chance at the bar is said as it is: as good as certain. Real content, the child of the
// water played from the front door.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { answersInOrder, archetypeOf, presetAnswer } from "../../shared/frontdoor/archetypes";
import { newGame } from "../../shared/testing/fixtures";
import { chanceOf, huntBand, jobCardLine } from "./JobList";
import { jobsWords } from "./jobs.words";

const RACKS = "activity.job-fish-racks";
const HUNT = "activity.job-hunt";

/** Plays an archetype's tile on one seed: its preset answers while allowed, else the answer that suits it. */
function play(id: string, seed: string): ReturnType<typeof newGame> {
  const archetype = archetypeOf(id);
  if (archetype === null) throw new Error(`No ${id} tile.`);
  const game = newGame("scenario.prologue", seed);
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const open = presetAnswer(archetype, prologue) ?? answersInOrder(archetype, prologue.step, prologue.answers).find((answer) => answer.allowed)?.id;
    if (open === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer: open });
  }
  return game;
}

describe("the racks' card", () => {
  test("[R-ACTIVITY-017] [R-WORLD-006] given the child of the water at the racks, when the hunt's card names the racks, then it speaks in the racks' own words, never the hunt's applications", () => {
    const view = play("water", "racks-nudge-0").view();
    expect(view.activities.find((option) => option.id === HUNT)?.params).toContain(RACKS);
    const line = jobCardLine(view, HUNT, RACKS);
    expect(line).toContain(text[`${RACKS}.card`] ?? text[`${RACKS}.blurb`] ?? "no words");
    expect(line).not.toContain(text[`${HUNT}.blurb`]);
  });

  test("[R-ACTIVITY-017] [R-ACTIVITY-005] given the racks at the bar every hunt stops at, when their chance is said, then it is as good as certain, and one point under the bar is likely", () => {
    const view = play("water", "racks-nudge-0").view();
    const bar = content.tuning.quality.hireMaxBp;
    expect(chanceOf(view, RACKS)).toBe(bar);
    expect(huntBand(bar)).toBe("certain");
    expect(huntBand(bar - 1)).toBe("likely");
    expect(jobsWords("jobs.chance.certain")).toBe("As good as certain");
    expect(jobCardLine(view, HUNT, RACKS)).toContain("As good as certain");
    expect(jobCardLine(view, HUNT, RACKS)).not.toContain(jobsWords("jobs.chance.likely"));
  });

  test("[R-WORLD-006] given every main job on the real content, when a card names it, then its words are its own where content has them, else the hunt's", () => {
    const view = play("water", "racks-nudge-0").view();
    for (const entry of Object.values(content.activity)) {
      if (entry === undefined || entry.slot !== "main" || entry.hireBp === null) continue;
      const own = text[`${entry.id}.card`] ?? text[`${entry.id}.blurb`] ?? text[`${HUNT}.blurb`];
      expect(jobCardLine(view, HUNT, entry.id).startsWith(own!)).toBe(true);
    }
  });
});
