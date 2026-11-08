import type { Requirement } from "@japacity/sim";
import { GoalEntrySchema, type Proof, type Same } from "@japacity/sim/schemas";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";

/** Every requirement type in the contract. */
const REQUIREMENT_TYPES = [
  "quality/min",
  "quality/max",
  "job/any",
  "job/none",
  "job/is",
  "activity/tenure",
  "document/held",
  "document/absent",
  "document/pending",
  "document/genuine",
  "route/state",
  "route/offer",
  "route/deposit",
  "route/funds",
  "route/unexplained-max",
  "money/min",
  "money/can-pay",
  "var/min",
  "var/max",
  "month/min",
  "chapter/done",
  "chapter/plan",
  "status/course-done",
  "place/is",
  "status/is",
  "status/clock-under",
  "credit/min",
  "goal/done",
  "era/is",
  "obligation/has",
  "obligation/defaulted-lately",
  "route/gate-step",
  "activity/local-tenure",
  "activity/played",
  "setpiece/answered",
  "wallet/total",
  "place/returned",
  "place/months-here",
  "place/banned",
  "setpiece/answered-with",
  "prologue/answered",
  "world/lottery",
  "people/bond",
  "people/sibling-abroad",
  "people/joint",
  "home/host",
  "not",
  "any",
] as const;

/** Fails to compile if the contract gains or loses a requirement type without this list following. */
export type RequirementTypesListed = Proof<Same<(typeof REQUIREMENT_TYPES)[number], Requirement["type"]>>;

/** Every requirement inside a list, the ones under `not` and `any` included. */
function flatten(requirements: Requirement[]): Requirement[] {
  return requirements.flatMap((requirement) => {
    if (requirement.type === "not") return [requirement, ...flatten([requirement.of])];
    if (requirement.type === "any") return [requirement, ...flatten(requirement.of)];
    return [requirement];
  });
}

const goals = Object.values(content.goal);

describe("life goals", () => {
  test("[engine:content-checked-before-play] given every goal, when it is checked against its schema, then it parses and its key is its id", () => {
    expect(goals).toHaveLength(10);
    for (const [key, goal] of Object.entries(content.goal)) {
      expect(GoalEntrySchema.safeParse(goal).error?.issues ?? []).toEqual([]);
      expect(goal.id).toBe(key);
    }
  });

  test("[engine:content-checked-before-play] given every goal, when its requirements are read, then each is of a type the contract has and the lists are not empty", () => {
    const known: readonly string[] = REQUIREMENT_TYPES;
    const unknown = goals.flatMap((goal) =>
      flatten([...goal.openIf, ...goal.doneIf])
        .filter((requirement) => !known.includes(requirement.type))
        .map((requirement) => `${goal.id} ${requirement.type}`),
    );
    expect(unknown).toEqual([]);
    expect(goals.filter((goal) => goal.openIf.length === 0 || goal.doneIf.length === 0).map((goal) => goal.id)).toEqual([]);
  });

  test("[engine:content-checked-before-play] given a goal with a requirement type the contract does not have, when it is read, then the type is found", () => {
    const made = { type: "goal/sent-home", amount: 1 } as unknown as Requirement;
    const known: readonly string[] = REQUIREMENT_TYPES;
    expect(flatten([{ type: "any", of: [made] }]).filter((requirement) => !known.includes(requirement.type))).toEqual([made]);
  });

  test("[engine:content-checked-before-play] given every goal, when its reward is read, then it only moves standing and wellbeing, as goal.md says", () => {
    const others = goals.flatMap((goal) =>
      goal.reward.filter((effect) => effect.type !== "quality/add" || !["quality.standing", "quality.wellbeing"].includes(effect.quality)),
    );
    expect(others).toEqual([]);
  });

  test("[engine:content-checked-before-play] given the goals, when figures from goal.md are read back, then each matches the page", () => {
    expect(content.goal["goal.first-car"]).toMatchObject({ where: "abroad", openIf: [{ type: "credit/min", value: 20 }] });
    expect(content.goal["goal.clean-file"]?.doneIf).toEqual([{ type: "credit/min", value: 60 }]);
    expect(content.goal["goal.settled"]?.reward).toEqual([
      { type: "quality/add", quality: "quality.standing", amount: 10 },
      { type: "quality/add", quality: "quality.wellbeing", amount: 8 },
    ]);
    expect(content.goal["goal.the-house"]?.openIf).toEqual([{ type: "money/min", currency: "NGN", amount: 500000000, pocket: "bank" }]);
    expect(content.goal["goal.second-route"]?.where).toBe("home");
    expect(content.goal["goal.home-with-capital"]?.where).toBe("any");
  });

  test("[engine:content-checked-before-play] given every goal, when its words are looked up, then it has a name and a blurb", () => {
    const missing = goals.flatMap((goal) => [`${goal.id}.name`, `${goal.id}.blurb`]).filter((key) => (text[key] ?? "").trim() === "");
    expect(missing).toEqual([]);
  });
});
