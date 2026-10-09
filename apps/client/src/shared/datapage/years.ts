// The age the data page prints before a life begins (prologue.md R-PROLOGUE-009): a tile's own age, read from
// content by walking its cards as the tile answers them, and a ready life's own from its scenario.
import { content } from "@japacity/content";
import type { Id, PrologueStep } from "@japacity/sim";

import { type Archetype, presetAnswer } from "../frontdoor/archetypes";

const AGE = "quality.age-months";
const YEAR = 12;
const DETOUR = "strike-drag";
/** The cards a tile's age is counted up to: the age card where content has one, else the last. */
const STOP = "age";

/** The outcome a draw most often gives; on a tie the first, so a strike's months count, as the tile's "about" counts them. */
function likeliest<O extends { bp: number }>(outcomes: readonly O[]): O | undefined {
  return outcomes.reduce<O | undefined>((best, one) => (best === undefined || one.bp > best.bp ? one : best), undefined);
}

/** A tile's own age in months when its cards are done: each card answered as the tile answers it, each draw its likeliest way. */
export function middleMonths(archetype: Archetype): number {
  let months = content.tuning.prologue.startAgeMonths;
  let at: string | null = "draw";
  for (let guard = 0; guard < 40 && at !== null && at !== STOP; guard += 1) {
    const step: PrologueStep | undefined = content.prologue[at];
    if (step === undefined) break;
    const all = step.answers.map((answer) => ({ id: answer.id, allowed: true }));
    const id = presetAnswer(archetype, { step: at, answers: all }) ?? archetype.leaning[at] ?? step.answers[0]?.id;
    const answer = step.answers.find((one) => one.id === id) ?? step.answers[0];
    if (answer === undefined) break;
    const outcome = answer.draw === null ? undefined : likeliest(answer.draw);
    months += step.months;
    at = outcome?.next ?? answer.next ?? step.next;
    if (at === DETOUR) {
      months += content.prologue[DETOUR]?.months ?? 0;
      at = content.prologue[DETOUR]?.next ?? null;
    }
  }
  return months;
}

/** A ready life's own age in months. */
export function readyMonths(scenario: Id<"scenario">): number {
  return content.scenario[scenario]?.qualities[AGE] ?? content.tuning.prologue.startAgeMonths;
}

/** The years the page prints for an age in months: "about", rounded as the tiles round it. */
export function aboutYears(months: number): number {
  return Math.round(months / YEAR);
}
