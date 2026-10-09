// The archetypes on the real content (prologue.md R-PROLOGUE-010): each preset is played on fresh lives
// over many seeds, the draws falling as they fall. A preset answer is sent while it is allowed; any other
// card shows, and the player takes the answer that suits the archetype, or the first open one.
import { content } from "@japacity/content";
import { allMet } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { answersInOrder, ARCHETYPES, type Archetype, presetAnswer } from "./archetypes";

const PROLOGUE = "scenario.prologue";
const FIRST_CHAPTER = "chapter.find-your-feet";
const SEEDS = 60;

/** The steps every life passes the same way, which are no archetype's own choice. */
const THROUGH = new Set(["draw", "university", "strike-drag", "graduation", "settlement"]);

interface Played {
  /** Every card the player saw, in order. */
  shown: string[];
  /** Cards shown because the preset's answer was shut, not because the archetype left them open. */
  shut: string[];
  /** True when every step the archetype chose was answered as it chose: the draws kept the life on its path. */
  kept: boolean;
  game: ReturnType<typeof newGame>;
}

function play(archetype: Archetype, seed: string): Played {
  const game = newGame(PROLOGUE, seed);
  const shown: string[] = [];
  const shut: string[] = [];
  const sent = new Set<string>();
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const preset = presetAnswer(archetype, prologue);
    if (preset !== null) {
      game.accept({ type: "prologue/choose", step: prologue.step, answer: preset });
      sent.add(prologue.step);
      continue;
    }
    shown.push(prologue.step);
    if ((archetype.preset[prologue.step] ?? []).length > 0) shut.push(prologue.step);
    const open = answersInOrder(archetype, prologue.step, prologue.answers).find((answer) => answer.allowed);
    if (open === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer: open.id });
  }
  const kept = Object.keys(archetype.preset).every((step) => THROUGH.has(step) || sent.has(step));
  return { shown, shut, kept, game };
}

describe("the archetypes", () => {
  test("[R-PROLOGUE-010] given every archetype, then there are six, and every step and answer it names exists on its step", () => {
    expect(ARCHETYPES.map((archetype) => archetype.id)).toEqual(["developer", "nurse", "accountant", "writer", "trader", "shop-worker"]);
    for (const archetype of ARCHETYPES) {
      for (const [step, answers] of Object.entries(archetype.preset)) {
        const entry = content.prologue[step];
        expect(entry, `${archetype.id}: ${step}`).toBeDefined();
        for (const answer of answers) expect(entry?.answers.some((candidate) => candidate.id === answer), `${archetype.id}: ${step}.${answer}`).toBe(true);
      }
      for (const [step, answer] of Object.entries(archetype.leaning)) expect(content.prologue[step]?.answers.some((candidate) => candidate.id === answer), `${archetype.id}: ${step}.${answer}`).toBe(true);
      for (const route of archetype.routes) expect(content.route[route], `${archetype.id}: ${route}`).toBeDefined();
    }
  });

  test("[R-PROLOGUE-010] given every archetype on fresh lives over many seeds, when its preset is played, then each preset answer is sent while it is allowed, and only a card the archetype leaves open or one whose preset answer is shut shows", () => {
    for (const archetype of ARCHETYPES) {
      let shutSeen = 0;
      for (let at = 0; at < SEEDS; at += 1) {
        const { shown, shut, kept, game } = play(archetype, `${archetype.id}-${String(at)}`);
        expect(game.state.prologue.open, `${archetype.id} ${String(at)}`).toBe(false);
        shutSeen += shut.length;
        for (const step of shown) expect(archetype.preset[step] === undefined || shut.includes(step), `${archetype.id} ${String(at)}: ${step} showed`).toBe(true);
        // On its own path, the draw, the subjects, the course and the service are never a card.
        if (kept)
          for (const step of ["draw", "subjects", "course", "service", "strike-drag", "graduation", "settlement"]) expect(shown, `${archetype.id} ${String(at)}`).not.toContain(step);
      }
      // A degree preset is always allowed; the trader's master is shut to a city family that can pay for school.
      if (archetype.id === "trader") expect(shutSeen).toBeGreaterThan(0);
      else expect(shutSeen, archetype.id).toBe(0);
    }
  });

  test("[R-PROLOGUE-010] given every archetype over many seeds, when its prologue closes on its own path, then the life is in the first chapter and at least one route the tile names is heard or can be heard", () => {
    for (const archetype of ARCHETYPES) {
      let kept = 0;
      for (let at = 0; at < SEEDS; at += 1) {
        const played = play(archetype, `${archetype.id}-${String(at)}`);
        const { game } = played;
        const view = game.view();
        expect(view.chapter.current).toBe(FIRST_CHAPTER);
        // Two failed exams send a degree life to the shop counter, and a city family keeps a child from the master: off the path, the tile's promise is not the life's.
        if (!played.kept) continue;
        kept += 1;
        const read = { state: game.state, world: game.world(), content };
        const reached = archetype.routes.filter((id) => {
          const state = view.routes.find((route) => route.id === id)?.state;
          return (state !== undefined && state !== "unknown") || allMet(read, content.route[id]?.hearIf ?? []);
        });
        expect(reached.length, `${archetype.id} ${String(at)}`).toBeGreaterThan(0);
      }
      expect(kept, archetype.id).toBeGreaterThan(SEEDS / 3);
    }
  });

  test("[R-PROLOGUE-010] given every archetype but the shop worker and the trader, then a route of its own effort is reached without the road", () => {
    const ownEffort = new Set(["route.uk-masters", "route.uk-skilled", "route.uk-talent", "route.uk-care", "route.canada-points", "route.gulf-contract", "route.road"]);
    for (const archetype of ARCHETYPES) {
      expect(archetype.routes.some((route) => ownEffort.has(route)), archetype.id).toBe(true);
      if (archetype.id === "trader" || archetype.id === "shop-worker") continue;
      for (let at = 0; at < 10; at += 1) {
        const { game, kept } = play(archetype, `${archetype.id}-${String(at)}`);
        if (!kept) continue;
        const read = { state: game.state, world: game.world(), content };
        const reached = archetype.routes.filter((id) => id !== "route.road" && allMet(read, content.route[id]?.hearIf ?? []));
        expect(reached.length, `${archetype.id} ${String(at)}`).toBeGreaterThan(0);
      }
    }
  });
});
