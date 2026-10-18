// One shut reason per card (advice:four-ways-to-learn-route, world:one-action-one-sheet): the adviser's card and the word
// of someone who went never say their reason twice, once over the button and again on it. The reason is said once, on the card; the button is shut and
// says only "Not yet". Real content, a real life from sixteen.
import { describe, expect, test } from "vitest";

import { ActivityPicker } from "./ActivityView";
import { answersInOrder, archetypeOf, presetAnswer } from "../../shared/frontdoor/archetypes";
import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { requirementSentence } from "../../shared/words/requirement";
import { nameOf, say } from "../../shared/words/text";

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
  test("[advice:four-ways-to-learn-route] [world:one-action-one-sheet] given a developer's first month with no way out heard of, when Ask about routes shows the adviser and someone who went, then each card says its reason once, its button is shut and says only Not yet, and no second sentence says it again", async () => {
    const view = developer().view();
    await renderWithView(<ActivityPicker only={[ADVISER, FRIEND]} />, view);
    const cards = [...document.querySelectorAll<HTMLElement>("[data-activity-picker] > li")];
    expect(cards).toHaveLength(2);
    for (const [card, id] of cards.map((card, index) => [card, [ADVISER, FRIEND][index]!] as const)) {
      const option = view.activities.find((candidate) => candidate.id === id)!;
      expect(option.allowed).toBe(false);
      const text = card.textContent ?? "";
      for (const requirement of option.missing) expect(count(text.toLowerCase(), requirementSentence(requirement, { routes: view.routes }).toLowerCase())).toBe(1);
      const button = card.querySelector<HTMLButtonElement>(`button[aria-label="${nameOf(id)}"]`)!;
      expect(button.disabled).toBe(true);
      expect(button.querySelector("[data-after]")?.textContent).toBe(say("ui.needs.not-yet"));
      expect(text).not.toContain(say("ui.needs.route"));
      expect(text).not.toContain(say("ui.activity.no-route"));
    }
  });

  test("[advice:four-ways-to-learn-route] [world:one-action-one-sheet] given a developer's first month with no way out heard of, when the adviser's card shows, then its reason reads as a person says it, Hear of a way out first, and Not yet is said once, on the shut button, never again over the reason", async () => {
    const view = developer().view();
    await renderWithView(<ActivityPicker only={[ADVISER, FRIEND]} />, view);
    const cards = [...document.querySelectorAll<HTMLElement>("[data-activity-picker] > li")];
    const adviser = cards[0]!.textContent ?? "";
    expect(say("ui.req.any-route")).toBe("Hear of a way out first");
    expect(count(adviser, say("ui.req.any-route"))).toBe(1);
    for (const card of cards) expect(count(card.textContent ?? "", say("ui.needs.not-yet"))).toBe(1);
  });
});
