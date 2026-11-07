// One shut reason per act (advice:four-ways-to-learn-route, world:one-action-one-sheet): the adviser and the word of someone
// who went never say their reason twice, once over the button and again on it. The reason is said once, on the row picked;
// the one button in the foot is shut and says only "Not yet". Real content, a real life from sixteen.
import { fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ActivityPicker } from "./ActivityView";
import { answersInOrder, archetypeOf, presetAnswer } from "../../shared/front-door/archetypes";
import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { requirementSentence } from "../../shared/words/requirement";
import { say } from "../../shared/words/text";

const ADVISER = "activity.see-adviser";
const FRIEND = "activity.ask-someone-who-went";

/** A developer from sixteen, handed over: the tile's preset played on one seed. */
function developer(): ReturnType<typeof newGame> {
  const archetype = archetypeOf("developer")!;
  const game = newGame("scenario.prologue", "routes-desk");
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const answer = presetAnswer(archetype, prologue) ?? answersInOrder(archetype, prologue.step, prologue.answers).find((one) => one.allowed)?.id;
    if (answer === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
  return game;
}

function count(text: string, part: string): number {
  return text.split(part).length - 1;
}

describe("a shut card says why once", () => {
  test("[advice:four-ways-to-learn-route] [world:one-action-one-sheet] given a developer's first month with no way out heard of, when Ask about routes shows the adviser and someone who went, then each row picked says its reason once, the one button is shut and says only Not yet, and no second sentence says it again", async () => {
    const view = developer().view();
    await renderWithView(<ActivityPicker only={[ADVISER, FRIEND]} />, view);
    const rows = [...document.querySelectorAll<HTMLElement>("[data-act-row]")];
    expect(rows.map((row) => row.getAttribute("data-act-row"))).toEqual([ADVISER, FRIEND]);
    for (const id of [ADVISER, FRIEND]) {
      fireEvent.click(document.querySelector(`[data-act-row="${id}"]`)!);
      const option = view.activities.find((candidate) => candidate.id === id)!;
      expect(option.allowed).toBe(false);
      const text = document.querySelector("[data-activity-picker]")?.textContent ?? "";
      for (const requirement of option.missing) expect(count(text.toLowerCase(), requirementSentence(requirement, { routes: view.routes }).toLowerCase())).toBe(1);
      const button = document.querySelector<HTMLButtonElement>(`button[data-act-main="${id}"]`)!;
      expect(button.disabled).toBe(true);
      expect(button.querySelector("[data-after]")?.textContent).toBe(say("ui.needs.not-yet"));
      expect(text).not.toContain(say("ui.needs.route"));
      expect(text).not.toContain(say("ui.activity.no-route"));
    }
  });

  test("[advice:four-ways-to-learn-route] [world:one-action-one-sheet] given a developer's first month with no way out heard of, when the adviser's row is picked, then its reason reads as a person says it, Hear of a way out first, and Not yet is said once, on the shut button, never again over the reason", async () => {
    const view = developer().view();
    await renderWithView(<ActivityPicker only={[ADVISER, FRIEND]} />, view);
    fireEvent.click(document.querySelector(`[data-act-row="${ADVISER}"]`)!);
    const adviser = document.querySelector(`[data-act-row="${ADVISER}"]`)?.closest("li")?.textContent ?? "";
    expect(say("ui.req.any-route")).toBe("Hear of a way out first");
    expect(count(adviser, say("ui.req.any-route"))).toBe(1);
    expect(count(document.querySelector("[data-activity-picker]")?.textContent ?? "", say("ui.needs.not-yet"))).toBe(1);
  });
});
