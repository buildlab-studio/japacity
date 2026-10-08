// The content check (R-ENGINE-014): keys equal ids, ids are well formed, every
// id mentioned anywhere exists, every number is whole. The Zod schemas check
// shape; this checks what a schema cannot see across tables.
import { directorFairness } from "../world/fairness";
import type { Content, KindName } from "./types";
import { placeChecks } from "../place/place.check";
import { checkLotteryContent } from "../lottery/lottery.draw";

const CONTENT_KINDS = [
  "quality",
  "activity",
  "document",
  "school",
  "route",
  "setpiece",
  "obligation",
  "offer",
  "chapter",
  "var",
  "news",
  "scenario",
  "country",
  "status",
  "goal",
  "era",
  "points",
] as const satisfies readonly KindName[];

type ContentKind = (typeof CONTENT_KINDS)[number];

const ID = new RegExp(`^(${CONTENT_KINDS.join("|")})\\.[a-z0-9]+(?:-[a-z0-9]+)*$`);

function walk(value: unknown, path: string, visit: (value: unknown, path: string) => void): void {
  visit(value, path);
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${String(index)}]`, visit));
    return;
  }
  for (const [key, inner] of Object.entries(value)) walk(inner, `${path}.${key}`, visit);
}

/** Sentences describing what is wrong with the content. Empty when it is sound. */
export function checkContent(content: Content): string[] {
  const problems: string[] = [];
  const known = new Set<string>();
  for (const kind of CONTENT_KINDS) {
    for (const [key, entry] of Object.entries(content[kind] as Record<string, { id: string }>)) {
      if (!ID.test(key) || !key.startsWith(`${kind}.`)) problems.push(`${kind}: the key ${key} is not a well-formed ${kind} id.`);
      if (entry.id !== key) problems.push(`${kind}: the entry under ${key} has the id ${entry.id}.`);
      known.add(key);
    }
  }
  walk(content, "content", (value, path) => {
    if (typeof value === "number" && !Number.isSafeInteger(value)) problems.push(`${path} is ${String(value)}, not a whole number.`);
    if (typeof value === "string" && ID.test(value) && !known.has(value)) problems.push(`${path} names ${value}, which does not exist.`);
    // The renames table's keys are ids this version no longer has (R-SERVER-022); its values must exist.
    if (value !== null && typeof value === "object" && !Array.isArray(value) && path !== "content.renames") {
      for (const key of Object.keys(value)) {
        if (ID.test(key) && !known.has(key)) problems.push(`${path} has the key ${key}, which names nothing.`);
      }
    }
  });
  for (const route of Object.values(content.route)) {
    // The road has no checklist and no japacity (R-ROAD-001).
    if (route.gate === "road") continue;
    const total = route.checklist.reduce((sum, item) => sum + item.weight, 0);
    if (total !== 100) problems.push(`${route.id}: checklist weights add up to ${String(total)}, not 100 (R-JAPACITY-004).`);
  }
  for (const story of Object.values(content.news)) {
    if (story.standIn.forceLag < 2) problems.push(`${story.id}: comes into force ${String(story.standIn.forceLag)} ticks after announcement, under 2 (R-NEWS-002).`);
  }
  // R-DIRECTOR-007: the director's stories and eras are fair to every player.
  problems.push(...directorFairness(content));
  problems.push(...placeChecks(content));
  problems.push(...checkLotteryContent(content));
  return problems;
}

export type { ContentKind };
