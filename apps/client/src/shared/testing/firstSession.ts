// The first session (R-GUIDE-014): plays the first three months after the prologue of a
// starting life as the view's next step suggests, and finds the early win.
import { content as realContent } from "@japacity/content";
import type { Content, Id, Loose, PlayerView, ReportLine, Requirement, SlotPick } from "@japacity/sim";
import { legalCommands } from "@japacity/sim";
import { start, type Game } from "@japacity/sim/testing";

import { earlyWinIn } from "../../features/guide/earlyWin";
import { ownRouteOf } from "../words/sixteen";

export const FIRST_SESSION_TURNS = 3;

/** A starting life: a scenario, and for the prologue the answers that build the life. */
export interface StartingLife {
  name: string;
  scenario: Id<"scenario">;
  /** Prologue answers by step id; a step not named takes its first allowed answer. */
  answers: Record<string, string>;
}

interface FirstMonth {
  slots: SlotPick[];
  lines: ReportLine[];
}

export interface FirstSession {
  life: StartingLife;
  /** The answers the prologue took, in order, as `step:answer`. Empty for a fixed life. */
  path: string[];
  months: FirstMonth[];
  /** The month (1 to 3) and the line of the first early win, or null when none came. */
  earlyWin: { month: number; line: ReportLine } | null;
}

/** What the view suggests for the month: one pick per free slot. */
export type NextStep = (view: PlayerView, content: Content) => SlotPick[];

/** A pick for the activity, with its first param when it takes one, or null when it cannot be played now. */
function pick(view: PlayerView, activity: string, param?: string): SlotPick | null {
  const option = view.activities.find((entry) => entry.id === activity && entry.allowed && entry.affordable);
  if (option === undefined) return null;
  if (option.params === null) return { activity: option.id, param: null };
  const chosen = param === undefined ? option.params[0] : option.params.find((entry) => entry === param);
  return chosen === undefined ? null : { activity: option.id, param: chosen };
}

/** The activities whose effects include one of the given types. */
function activitiesWith(content: Content, types: readonly string[], route?: string): string[] {
  return Object.values(content.activity)
    .filter((activity) => activity.effects.some((effect) => types.includes(effect.type) && (route === undefined || !("route" in effect) || effect.route === route)))
    .map((activity) => activity.id);
}

/** A pick that works toward one chapter item, or null when no activity serves it now. */
function towards(view: PlayerView, content: Content, requirement: Requirement): SlotPick | null {
  const first = (ids: readonly string[], param?: string) => ids.map((id) => pick(view, id, param)).find((found) => found !== null) ?? null;
  if (requirement.type === "job/any") return first(activitiesWith(content, ["activity/hunt"]));
  // "Any route of your own effort" (the first chapter's heard and known): the first way that fits.
  if (requirement.type === "any") {
    // The life's own way out first (R-CHAPTER-009), then the page's order.
    const own = ownRouteOf(view);
    const ordered = [...requirement.of].sort((left, right) => Number(right.type === "route/state" && right.route === own) - Number(left.type === "route/state" && left.route === own));
    return ordered.map((one) => towards(view, content, one)).find((found) => found !== null) ?? null;
  }
  if (requirement.type !== "route/state") return null;
  const route = view.routes.find((entry) => entry.id === requirement.route);
  if (route?.state === "unknown") return first(activitiesWith(content, ["route/hear"], requirement.route));
  if (route?.state === "heard") return first(activitiesWith(content, ["route/look-into"]), requirement.route);
  return null;
}

/**
 * The view has no `nextStep` for a life at home (only the status abroad carries one), so the
 * next step is read from the current chapter: one pick for each unmet item an activity can serve,
 * in the chapter's order, then rest.
 */
export const chapterNextStep: NextStep = (view, content) => {
  const chapter = view.chapter.current === null ? undefined : content.chapter[view.chapter.current];
  const picks: SlotPick[] = [];
  for (const item of chapter?.items ?? []) {
    if (picks.length >= view.freeSlots) break;
    if (view.chapter.items.find((entry) => entry.id === item.id)?.met !== false) continue;
    const next = towards(view, content, item.requirement);
    if (next !== null && !picks.some((held) => held.activity === next.activity)) picks.push(next);
  }
  return picks;
};

/** Plays the prologue by the life's answers, or the first allowed one at a step it does not name. */
function playPrologue(game: Game, life: StartingLife): string[] {
  const path: string[] = [];
  for (let guard = 0; guard < 60 && game.state.prologue.open; guard += 1) {
    const card = game.view().prologue;
    if (card === null) break;
    const wanted = life.answers[card.step];
    const answer = card.answers.find((entry) => entry.allowed && entry.id === wanted) ?? card.answers.find((entry) => entry.allowed);
    if (answer === undefined) throw new Error(`${life.name}: the prologue step ${card.step} has no allowed answer.`);
    game.accept({ type: "prologue/choose", step: card.step, answer: answer.id });
    path.push(`${card.step}:${answer.id}`);
  }
  if (game.state.prologue.open) throw new Error(`${life.name}: the prologue did not close in 60 answers.`);
  return path;
}

/** Answers an open set piece with its first allowed answers, so the month can end. */
function closeSetpiece(game: Game): void {
  for (let guard = 0; guard < 20 && game.view().setpiece !== null; guard += 1) {
    const answer = legalCommands(game.view()).find((command): command is Extract<Loose, { type: "setpiece/answer" }> => command.type === "setpiece/answer");
    if (answer === undefined) throw new Error("A set piece is open with no allowed answer.");
    game.accept(answer);
  }
}

/** Plays a starting life's first three months after the prologue and finds its early win. */
export function playFirstSession(life: StartingLife, options: { content?: Content; seed?: string; worldSeed?: string; nextStep?: NextStep } = {}): FirstSession {
  const content = options.content ?? realContent;
  const nextStep = options.nextStep ?? chapterNextStep;
  const game = start({ scenario: life.scenario, content, seed: options.seed ?? "first-session", worldSeed: options.worldSeed ?? "first-session-world" });
  const path = playPrologue(game, life);
  const months: FirstMonth[] = [];
  let earlyWin: FirstSession["earlyWin"] = null;
  for (let month = 1; month <= FIRST_SESSION_TURNS; month += 1) {
    closeSetpiece(game);
    const slots = nextStep(game.view(), content);
    const { lines } = game.endTurn(slots);
    months.push({ slots, lines });
    const line = earlyWinIn(lines, slots);
    if (earlyWin === null && line !== null) earlyWin = { month, line };
  }
  return { life, path, months, earlyWin };
}

/**
 * Every starting life: each fixed scenario, and for the prologue one life for each answer of
 * each step, the rest of its path by first allowed answers. Two that would take the same path
 * are kept once. The prologue's paths multiply past ten thousand, so each answer is covered once,
 * which a test can play.
 */
export function startingLives(content: Content = realContent): StartingLife[] {
  const lives: StartingLife[] = [];
  for (const scenario of Object.values(content.scenario)) {
    if (scenario.prologue !== true) {
      lives.push({ name: scenario.id, scenario: scenario.id, answers: {} });
      continue;
    }
    lives.push({ name: `${scenario.id} first answers`, scenario: scenario.id, answers: {} });
    for (const step of Object.values(content.prologue)) {
      for (const answer of step.answers) lives.push({ name: `${scenario.id} ${step.id}:${answer.id}`, scenario: scenario.id, answers: { [step.id]: answer.id } });
    }
  }
  return lives;
}
