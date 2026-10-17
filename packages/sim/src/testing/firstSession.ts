// The first session (docs/rules/guides.md R-GUIDE-014), as the simulation's own
// tests play it: every starting life, the prologue's paths among them, played
// for its first three months after the prologue toward the current chapter's
// unmet items, and the first early win found. Nothing in the simulation
// imports this file.
import type { Content, Id, PlayerView, ReportLine, Requirement, SlotPick } from "../engine/types";
import { legalCommands } from "./legal";
import type { Game, Loose } from "./play";
import { start } from "./play";

export const FIRST_SESSION_MONTHS = 3;

/** A starting life: a scenario, and for the prologue the answers that build it. */
export interface StartingLife {
  name: string;
  scenario: Id<"scenario">;
  /** Prologue answers by step id; a step not named takes its first allowed answer. */
  answers: Record<string, string>;
}

export interface FirstSession {
  life: StartingLife;
  /** The prologue's answers in order, as `step:answer`. Empty for a fixed life. */
  path: string[];
  months: { slots: SlotPick[]; lines: ReportLine[] }[];
  /** The month (1 to 3) and the line of the first early win, or null. */
  earlyWin: { month: number; line: ReportLine } | null;
}

/** Pay from a job or a gig, or a hunt that lands. */
const PAY = new Set([
  "line.activity.salary",
  "line.activity.salary-first-foreign",
  "line.activity.salary-first-abroad",
  "line.activity.side-pay",
  "line.activity.gig",
  "line.activity.overtime",
  "line.activity.hunt-hired",
]);
const MET = new Set(["line.chapter.closed", "line.goal.done"]);
const HEARD = new Set(["line.route.heard", "line.route.looked-into"]);
const REST: Id<"activity"> = "activity.rest";

/** R-GUIDE-014: a good line that follows from the player's choice. A route heard counts only in a month not left to rest. */
export function isEarlyWin(line: ReportLine, slots: readonly SlotPick[]): boolean {
  if (line.tone !== "good") return false;
  if (PAY.has(line.key) || MET.has(line.key)) return true;
  return HEARD.has(line.key) && slots.some((slot) => slot.activity !== REST);
}

function pick(view: PlayerView, activity: string, param?: string): SlotPick | null {
  const option = view.activities.find((entry) => entry.id === activity && entry.allowed && entry.affordable);
  if (option === undefined) return null;
  if (option.params === null) return { activity: option.id, param: null };
  const chosen = param === undefined ? option.params[0] : option.params.find((entry) => entry === param);
  return chosen === undefined ? null : { activity: option.id, param: chosen };
}

function activitiesWith(content: Content, types: readonly string[], route?: string): string[] {
  return Object.values(content.activity)
    .filter((activity) => activity.effects.some((effect) => types.includes(effect.type) && (route === undefined || !("route" in effect) || effect.route === route)))
    .map((activity) => activity.id);
}

function towards(view: PlayerView, content: Content, requirement: Requirement): SlotPick | null {
  const first = (ids: readonly string[], param?: string) => ids.map((id) => pick(view, id, param)).find((found) => found !== null) ?? null;
  if (requirement.type === "job/any") return first(activitiesWith(content, ["activity/hunt"]));
  if (requirement.type !== "route/state") return null;
  const route = view.routes.find((entry) => entry.id === requirement.route);
  if (route?.state === "unknown") return first(activitiesWith(content, ["route/hear"], requirement.route));
  if (route?.state === "heard") return first(activitiesWith(content, ["route/look-into"]), requirement.route);
  return null;
}

/** The month's picks: one for each unmet item of the current chapter an activity can serve, in order, then rest. */
function nextStep(view: PlayerView, content: Content): SlotPick[] {
  const chapter = view.chapter.current === null ? undefined : content.chapter[view.chapter.current];
  const picks: SlotPick[] = [];
  for (const item of chapter?.items ?? []) {
    if (picks.length >= view.freeSlots) break;
    if (view.chapter.items.find((entry) => entry.id === item.id)?.met !== false) continue;
    const next = towards(view, content, item.requirement);
    if (next !== null && !picks.some((held) => held.activity === next.activity)) picks.push(next);
  }
  return picks;
}

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

function closeSetpiece(game: Game): void {
  for (let guard = 0; guard < 20 && game.view().setpiece !== null; guard += 1) {
    const answer = legalCommands(game.view()).find((command): command is Extract<Loose, { type: "setpiece/answer" }> => command.type === "setpiece/answer");
    if (answer === undefined) throw new Error("A set piece is open with no allowed answer.");
    game.accept(answer);
  }
}

/** Plays a starting life's prologue, then its first three months, and finds its early win. */
export function playFirstSession(life: StartingLife, content: Content, seed = "first-session", worldSeed = "first-session-world"): FirstSession {
  const game = start({ scenario: life.scenario, content, seed, worldSeed });
  const path = playPrologue(game, life);
  const months: FirstSession["months"] = [];
  let earlyWin: FirstSession["earlyWin"] = null;
  for (let month = 1; month <= FIRST_SESSION_MONTHS; month += 1) {
    closeSetpiece(game);
    const slots = nextStep(game.view(), content);
    const { lines } = game.endTurn(slots);
    months.push({ slots, lines });
    const line = lines.find((found) => isEarlyWin(found, slots));
    if (earlyWin === null && line !== undefined) earlyWin = { month, line };
  }
  return { life, path, months, earlyWin };
}

/**
 * Every starting life: each fixed scenario, and for the prologue one life for
 * each answer of each step, the rest of its path by first allowed answers.
 */
export function startingLives(content: Content): StartingLife[] {
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
