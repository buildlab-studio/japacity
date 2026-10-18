// "Ask someone who went", shut in the first month (world:one-action-one-sheet, advice:someone-who-went-answers-free): its
// reason never reads "One of: With a partner or A few people who can help". The way to the word of someone who
// went is a person abroad or a wide enough circle, said in one plain line, the band never a figure (text:bands-not-figures). Real
// content, a developer's first month from sixteen.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { answersInOrder, archetypeOf, presetAnswer } from "../frontdoor/archetypes";
import { newGame } from "../testing/fixtures";
import { needsWords, requirementSentence } from "./requirement";

const FRIEND = "activity.ask-someone-who-went";
const LINE = "Someone you know abroad, or a wide enough circle";

function developerView() {
  const archetype = archetypeOf("developer")!;
  const game = newGame("scenario.prologue", "routes-desk");
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const answer = presetAnswer(archetype, prologue) ?? answersInOrder(archetype, prologue.step, prologue.answers).find((one) => one.allowed)?.id;
    if (answer === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
  return game.view();
}

describe("the word of someone who went, shut for now", () => {
  test("[world:one-action-one-sheet] [advice:someone-who-went-answers-free] given a developer's first month, when the shut reason of Ask someone who went is read, then it is one plain line: someone you know abroad, or a wide enough circle", () => {
    const view = developerView();
    const option = view.activities.find((each) => each.id === FRIEND);
    expect(option?.allowed).toBe(false);
    const missing = option?.missing ?? [];
    expect(missing.map((requirement) => requirementSentence(requirement, { routes: view.routes }))).toEqual([LINE]);
    expect(needsWords(missing, { routes: view.routes })).not.toMatch(/One of|partner|\d/);
    expect(needsWords(missing, { routes: view.routes }).toLowerCase()).toContain(LINE.toLowerCase());
  });

  test("[world:one-action-one-sheet] given the act's need on the real content, when it is read, then it is the person abroad or the network, so the line says both and nothing else", () => {
    const need = content.activity[FRIEND]?.requires.find((requirement) => requirement.type === "any");
    expect(need?.type === "any" ? need.of.map((inner) => inner.type).sort() : []).toEqual(["people/bond", "quality/min"]);
    expect(requirementSentence(need!)).toBe(LINE);
  });
});
