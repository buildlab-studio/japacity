// Fairness: docs/rules/director.md R-DIRECTOR-007. A story may move only the
// world's variables, so it cannot lower a quality, remove a document or close
// an obligation the player chose, and a recorded visa application keeps the
// rules it was sent under (R-ROUTE-014). These checks hold stories to that
// shape, and hold every era to an end, a name and an era that may follow it.
import type { Content, Id, NewsEntry, Requirement } from "../engine/types";
import { isWorldRequirement } from "./director";

/** The fields a story may carry. Anything else could reach past the world's variables. `source` is only where News says it was heard. */
const STORY_FIELDS: readonly string[] = ["id", "touches", "hear", "director", "standIn", "source"] satisfies (keyof NewsEntry)[];

const WINDOW_MAX = 2;
const SCALE_MAX = 100;

/** Requirement types in a story's needs that read a character rather than the world. */
function characterReads(requirements: readonly Requirement[]): string[] {
  return requirements.flatMap((requirement): string[] => {
    if (!isWorldRequirement(requirement)) return [requirement.type];
    if (requirement.type === "not") return characterReads([requirement.of]);
    if (requirement.type === "any") return characterReads(requirement.of);
    return [];
  });
}

function storyProblems(story: NewsEntry, content: Content): string[] {
  const problems: string[] = [];
  const extra = Object.keys(story).filter((key) => !STORY_FIELDS.includes(key));
  if (extra.length > 0) problems.push(`${story.id}: carries ${extra.join(", ")}; a story may move only the world's variables (R-DIRECTOR-007).`);
  const reads = characterReads(story.director?.needs ?? []);
  if (reads.length > 0) problems.push(`${story.id}: its needs read a character (${reads.join(", ")}); they may read only the world (R-DIRECTOR-007).`);
  const changes: { var: Id<"var">; value: number; set: boolean }[] = [
    ...story.standIn.sets.map((set) => ({ ...set, set: true })),
    ...(story.director?.adds ?? []).map((add) => ({ ...add, set: false })),
  ];
  for (const change of changes) {
    if (content.var[change.var] === undefined) {
      problems.push(`${story.id}: changes ${change.var}, which is not a world variable (R-DIRECTOR-007).`);
      continue;
    }
    if (!change.set) continue;
    if (change.var.endsWith("-window") && (change.value < 0 || change.value > WINDOW_MAX)) {
      problems.push(`${story.id}: sets ${change.var} to ${String(change.value)}; a window is 0, 1 or 2 (R-DIRECTOR-001).`);
    }
    if ((change.var.endsWith("-surge") || change.var.endsWith("-strictness")) && (change.value < 0 || change.value > SCALE_MAX)) {
      problems.push(`${story.id}: sets ${change.var} to ${String(change.value)}, outside 0 to 100 (R-DIRECTOR-001).`);
    }
  }
  if (story.standIn.endsAfter !== null && story.standIn.endsAfter < 1) {
    problems.push(`${story.id}: ends ${String(story.standIn.endsAfter)} ticks after it comes into force; a story in force lasts at least a tick (R-DIRECTOR-004).`);
  }
  return problems;
}

function eraProblems(content: Content, words: Readonly<Record<string, string>> | undefined): string[] {
  const problems: string[] = [];
  const eras = Object.values(content.era);
  for (const era of eras) {
    const [min, max] = era.ticks;
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 1 || max < min) {
      problems.push(`${era.id}: lasts ${String(min)} to ${String(max)} ticks; an era needs an end of at least one tick (R-DIRECTOR-007).`);
    }
    if (content.news[era.story] === undefined) problems.push(`${era.id}: its story ${era.story} is not in content (R-DIRECTOR-002).`);
    if (words !== undefined && (words[`${era.id}.name`] ?? "") === "") problems.push(`${era.id}: has no name (R-DIRECTOR-007).`);
    // An era marked once may run only once, so it cannot be the only way on.
    const next = eras.filter((other) => other.id !== era.id && !other.once && (other.after[era.id] ?? 0) > 0);
    if (next.length === 0) problems.push(`${era.id}: no era that may run again follows it, so the world could stop after it (R-DIRECTOR-007).`);
  }
  return problems;
}

/**
 * Sentences describing what breaks R-DIRECTOR-007 in the content. Empty when
 * it is fair. Pass the words to check that every era has a name.
 */
export function directorFairness(content: Content, words?: Readonly<Record<string, string>>): string[] {
  return [...Object.values(content.news).flatMap((story) => storyProblems(story, content)), ...eraProblems(content, words)];
}
