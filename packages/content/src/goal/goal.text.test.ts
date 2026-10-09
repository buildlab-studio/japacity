// Each goal says its first thing to do (docs/rules/goal.md R-GOAL-003, "what you could do next"; the
// "A new goal: A clean file." and "A new goal: Your own door." said nothing a
// player could act on.
import { describe, expect, test } from "vitest";

import { content, text } from "../index";

describe("a goal's first thing to do", () => {
  test("[R-GOAL-003] given every goal in content, when its words are read, then each has a first line that names something to do, short, with no dash", () => {
    const goals = Object.keys(content.goal);
    expect(goals.length).toBeGreaterThan(0);
    const first = (goal: string): string => text[`${goal}.first`] ?? "";
    expect(goals.filter((goal) => first(goal) === "")).toEqual([]);
    expect(goals.filter((goal) => first(goal).split(" ").length > 14)).toEqual([]);
    expect(goals.filter((goal) => /[–—]/.test(first(goal)))).toEqual([]);
    expect(text["goal.clean-file.first"]).toBe("Pay every bill on time; a clean file opens a flat.");
  });
});
