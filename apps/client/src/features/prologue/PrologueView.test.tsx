import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "../../app/App";
import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { gameAuthority, newGame } from "../../shared/testing/fixtures";
import { formatNumber } from "../../shared/words/format";
import { requirementSentence } from "../../shared/words/requirement";
import { say, sayCount, words } from "../../shared/words/text";
import { drawSentences, PrologueView, whyNot } from "./PrologueView";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";
import { playerMonth } from "../../shared/words/format";

const PROLOGUE = "scenario.prologue";

type Draw = NonNullable<NonNullable<PlayerView["prologue"]>["draw"]>;
type Pick = (allowed: readonly string[]) => string;

function card(): HTMLElement {
  const found = document.querySelector<HTMLElement>("[data-prologue-card]");
  if (found === null) throw new Error("No prologue card on screen.");
  return found;
}

/**
 * Plays a life from sixteen through the screen: on every card the card's words
 * and every answer show, an answer not open is greyed with its reason, and the
 * chosen answer is pressed. Returns the steps seen, in order.
 */
async function walk(seed: string, pick: Pick): Promise<{ steps: string[]; greyed: string[]; game: ReturnType<typeof newGame> }> {
  const game = newGame(PROLOGUE, seed);
  const store = createGameStore(gameAuthority(game));
  await store.getState().refresh();
  render(<App store={store} />);
  const steps: string[] = [];
  const greyed: string[] = [];
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue;
    if (prologue === null) throw new Error("The prologue is open with no card in the view.");
    steps.push(prologue.step);
    expect(await screen.findByRole("heading", { name: words(`prologue.${prologue.step}.card`) })).toBeDefined();
    for (const answer of prologue.answers) {
      const button = within(card()).getByRole("button", { name: words(`prologue.${prologue.step}.answer.${answer.id}`) });
      expect(button.hasAttribute("disabled"), `${prologue.step}.${answer.id}`).toBe(!answer.allowed);
      if (!answer.allowed) {
        greyed.push(`${prologue.step}.${answer.id}`);
        const shown = card().querySelector(`[data-answer='${answer.id}']`)?.textContent ?? "";
        // The reason is the situation in content's words, never the requirement's threshold.
        const requires = content.prologue[prologue.step]?.answers.find((entry) => entry.id === answer.id)?.requires ?? [];
        expect(requires.length).toBeGreaterThan(0);
        for (const reason of whyNot(prologue.step, answer.id)) expect(shown).toContain(reason);
        for (const requirement of requires) expect(shown).not.toContain(requirementSentence(requirement));
      }
    }
    if (prologue.draw !== null) {
      const life = document.querySelector("[data-draw]")?.textContent ?? "";
      for (const sentence of drawSentences(prologue.draw)) expect(life).toContain(sentence);
    }
    const allowed = prologue.answers.filter((answer) => answer.allowed).map((answer) => answer.id);
    const chosen = pick(allowed);
    const v = game.state.v;
    fireEvent.click(within(card()).getByRole("button", { name: words(`prologue.${prologue.step}.answer.${chosen}`) }));
    await waitFor(() => expect(store.getState().view?.v).toBeGreaterThan(v));
  }
  return { steps, greyed, game };
}

describe("the prologue screen", () => {
  test("[prologue:view-shows-step-card] given a new life from sixteen, when it opens, then the opening card shows with its one answer and nothing drawn yet", async () => {
    const game = newGame(PROLOGUE);
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    render(
      <GameProvider store={store}>
        <PrologueView />
      </GameProvider>,
    );
    expect(screen.getByRole("heading", { name: words("prologue.draw.card") })).toBeDefined();
    expect(within(card()).getByRole("button", { name: words("prologue.draw.answer.begin") })).toBeDefined();
    expect(screen.getByText(say("ui.prologue.not-drawn"))).toBeDefined();
    expect(document.querySelector("[data-prologue-outcome]")).toBeNull();
    expect(screen.getByText(say("ui.profile.age", { years: 16 }))).toBeDefined();
  });

  test("[prologue:view-shows-step-card] given a life from sixteen, when every card is answered with the first answer open, then each card, answer and draw shows in words, and the handover opens month 1", async () => {
    const { steps, game } = await walk("prologue-first", (allowed) => allowed[0] ?? "");
    expect(steps[0]).toBe("draw");
    expect(steps.at(-1)).toBe("home");
    expect(game.state.prologue.open).toBe(false);

    expect(await screen.findByRole("heading", { name: words("line.prologue.closed") })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.prologue.start", { month: 1 }) }));
    // The world opens on month 1 (world:world-fills-the-screen): its band, with no month number on it (world:top-band-is-a-pill).
    await waitFor(() => expect(document.querySelector("[data-band] [data-band-month]")).not.toBeNull());
    expect(playerMonth(game.view().month)).toBe(1);
  });

  test("[prologue:view-shows-step-card] given a life from sixteen, when every card is answered with the last answer open, then a second path is walked to the handover", async () => {
    const { steps } = await walk("prologue-last", (allowed) => allowed.at(-1) ?? "");
    expect(steps).toContain("draw");
    expect(steps.at(-1)).toBe("home");
    expect(await screen.findByRole("heading", { name: words("line.prologue.closed") })).toBeDefined();
  });

  test("[prologue:steps-offer-legal-answers] given cards with answers whose requirements do not hold, then each is greyed with its reason and cannot be pressed", async () => {
    const { greyed } = await walk("prologue-first", (allowed) => allowed[0] ?? "");
    // The walk checks each greyed answer's reason; this life must have met at least one.
    expect(greyed.length).toBeGreaterThan(0);
  });

  test("[prologue:family-draw-on-first-answer] given a draw, then it reads as sentences: the family's means as words at each edge, never a bare figure", () => {
    const strained = content.tuning.prologue.waecStrain.under;
    // A private university is open from these means: the family is comfortable.
    const privately = content.prologue.university?.answers.find((answer) => answer.id === "private")?.requires[0];
    const comfortable = privately?.type === "quality/min" ? privately.value : 0;
    expect(comfortable).toBeGreaterThan(strained);
    const base: Draw = { familyMeans: strained, town: "city", siblings: 1, parentsEducated: false };
    const means = (familyMeans: number) => drawSentences({ ...base, familyMeans })[1];
    expect(means(strained - 1)).toBe(say("ui.prologue.means.low"));
    expect(means(strained)).toBe(say("ui.prologue.means.middle"));
    expect(means(comfortable - 1)).toBe(say("ui.prologue.means.middle"));
    expect(means(comfortable)).toBe(say("ui.prologue.means.high"));
    expect(drawSentences(base)).toEqual([
      say("ui.prologue.town.city"),
      say("ui.prologue.means.middle"),
      sayCount("ui.prologue.siblings", 1, { count: 1 }),
      say("ui.prologue.parents.not"),
    ]);
    expect(drawSentences({ ...base, siblings: 4, town: "town", parentsEducated: true })).toEqual([
      say("ui.prologue.town.town"),
      say("ui.prologue.means.middle"),
      say("ui.prologue.siblings", { count: 4 }),
      say("ui.prologue.parents.educated"),
    ]);
    for (const sentence of drawSentences(base)) expect(sentence).not.toContain(formatNumber(strained));
  });
});
