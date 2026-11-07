// The racks' card (activity:fish-racks-at-makoko, world:one-action-one-sheet): "Work the racks"
// never opens with the hunt's own words, "You send applications and follow up on every lead", or "Likely" at the
// bar every hunt stops at. A job named on its card speaks in its own words where content has them (`<job>.card`,
// else the job's blurb), its pay and its chance as chips beside them (text:show-then-tell), and the chance at the bar is said
// as it is: as good as certain. Real content, the child of the water played from the front door.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { answersInOrder, archetypeOf, presetAnswer } from "../../shared/front-door/archetypes";
import { newGame } from "../../shared/testing/fixtures";
import { factWords } from "../../shared/ui/Facts";
import { jobFacts } from "../../shared/words/facts";
import { chanceOf, huntBand } from "../../shared/words/jobs";
import { say } from "../../shared/words/text";

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
  test("[activity:fish-racks-at-makoko] [world:one-action-one-sheet] given the child of the water at the racks, when the hunt's card names the racks, then it speaks in the racks' own words, never the hunt's applications", () => {
    const view = play("water", "racks-nudge-0").view();
    expect(view.activities.find((option) => option.id === HUNT)?.params).toContain(RACKS);
    const { line } = jobFacts(view, HUNT, RACKS);
    expect(line).toBe(text[`${RACKS}.card`] ?? text[`${RACKS}.blurb`] ?? "no words");
    expect(line).not.toContain(text[`${HUNT}.blurb`]);
  });

  test("[activity:fish-racks-at-makoko] [activity:job-hunt-lands-offer] given the racks at the bar every hunt stops at, when their chance is said, then it is as good as certain, and one point under the bar is likely", () => {
    const view = play("water", "racks-nudge-0").view();
    const bar = content.tuning.quality.hireMaxBp;
    expect(chanceOf(view, RACKS)).toBe(bar);
    expect(huntBand(bar)).toBe("certain");
    expect(huntBand(bar - 1)).toBe("likely");
    expect(say("jobs.chance.certain")).toBe("As good as certain");
    const chance = jobFacts(view, HUNT, RACKS).facts.find((fact) => fact.kind === "chance");
    expect(chance === undefined ? null : factWords(chance)).toBe("As good as certain");
  });

  test("[world:one-action-one-sheet] [text:show-then-tell] given every main job on the real content, when a card names it, then its line is its own words where content has them, else the hunt's, and never says the pay or the chance its chips say", () => {
    const view = play("water", "racks-nudge-0").view();
    for (const entry of Object.values(content.activity)) {
      if (entry === undefined || entry.slot !== "main" || entry.hireBp === null) continue;
      const own = text[`${entry.id}.card`] ?? text[`${entry.id}.blurb`] ?? text[`${HUNT}.blurb`];
      const { line, facts } = jobFacts(view, HUNT, entry.id);
      expect(line).toBe(own);
      for (const fact of facts) expect(line ?? "").not.toContain(factWords(fact));
    }
  });

  test("[world:one-action-one-sheet] [text:show-then-tell] given the racks' card, when its facts are read, then they stand in their one order: the pay, the chance, then when it pays", () => {
    const view = play("water", "racks-nudge-0").view();
    expect(jobFacts(view, HUNT, RACKS).facts.map((fact) => fact.kind)).toEqual(["pay", "chance", "when"]);
    expect(factWords(jobFacts(view, HUNT, RACKS).facts[2]!)).toBe(text[`${RACKS}.when`]);
  });
});
