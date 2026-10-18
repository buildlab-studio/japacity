// The trader's own shop: a life from sixteen that came out of the master's years with
// the settlement opens a shop of her own, a main job no hunt lists (docs/rules/activity.md R-ACTIVITY-001, the
// job held and paid each month; prologue.md R-PROLOGUE-011, the life read as lived). Real content, real draws.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp, mulDiv } from "../engine/int";
import type { Id, Requirement } from "../engine/types";
import type { Game } from "../testing/play";
import { playPrologueBy, start } from "../testing/play";
import { naira, salaries } from "../testing/read";
import { HUNT } from "../testing/ids";

const OPEN: Id<"activity"> = "activity.open-shop";
const SHOP: Id<"activity"> = "activity.run-shop";
const FIRST_CHAPTER = "chapter.find-your-feet";
/** The trader's tile: commerce at school, the master's yard, spare parts, the six years served, the settlement, and nobody abroad. */
const TRADER = ["begin", "commercial", "apprentice", "spare-parts", "stay", "settle", "nowhere"];
const MONTHS_PER_YEAR = 12;

/** The naira the shop's act asks to have in hand: the capital that stocks a shop, from its own entry. */
function capital(): number {
  const needs = content.activity[OPEN]?.requires.find((requirement): requirement is Extract<Requirement, { type: "money/min" }> => requirement.type === "money/min" && requirement.currency === "NGN");
  if (needs === undefined || typeof needs.amount !== "number") throw new Error("The shop's act asks for no capital in naira.");
  return needs.amount;
}

/** Plays the prologue down `answers` where each is open, else the first open answer. */
function sixteen(seed: string, answers: readonly string[]): Game {
  const game = start({ content, scenario: "scenario.prologue", seed });
  playPrologueBy(game, answers);
  return game;
}

/** A trader from the tile whose master settled her fairly or better: the first seed whose draw gave the capital. */
function trader(): Game {
  for (let at = 0; at < 30; at += 1) {
    const game = sixteen(`shop-${String(at)}`, TRADER);
    if (game.state.quality["quality.edu-level"] === 1 && naira(game) >= capital()) return game;
  }
  throw new Error("No trader with the settlement in thirty seeds.");
}

function allowed(game: Game, id: Id<"activity">): boolean | undefined {
  return game.view().activities.find((option) => option.id === id)?.allowed;
}

describe("the trader's own shop", () => {
  test("[R-ACTIVITY-016] [R-ACTIVITY-001] [R-PROLOGUE-011] given a trader from sixteen with the master's settlement, when she takes the shop's act, then she runs her own shop, the first chapter's job item is met, and no hunt ever lists the shop", () => {
    const game = trader();
    expect(game.view().chapter.current).toBe(FIRST_CHAPTER);
    expect(allowed(game, OPEN)).toBe(true);
    expect(game.view().activities.find((option) => option.id === HUNT)?.params ?? []).not.toContain(SHOP);
    expect(content.activity[SHOP]).toMatchObject({ slot: "main", hireBp: null });

    game.endTurn([{ activity: OPEN, param: null }]);
    expect(game.state.activity.job).toBe(SHOP);
    expect(game.view().chapter.items.find((item) => item.id === "job")?.met).toBe(true);
    // Open once: the act is not offered again while the shop runs, and the hunt still never lists it.
    expect(allowed(game, OPEN)).toBe(false);
    expect(game.view().activities.find((option) => option.id === HUNT)?.params ?? []).not.toContain(SHOP);
  });

  test("[R-ACTIVITY-016] [R-ACTIVITY-001] given the shop open, when the months pass, then each month's takings land in the bank as its pay, a little more with each month the shop has stood", () => {
    const game = trader();
    game.endTurn([{ activity: OPEN, param: null }]);
    const pay = content.activity[SHOP]?.pay;
    if (pay === undefined || pay === null || typeof pay.amount !== "number" || pay.currency !== "NGN") throw new Error("The shop pays no naira figure.");
    const base = pay.amount;
    const growth = bp(base, content.tuning.activity.raiseBp);
    const seen: number[] = [];
    for (let month = 0; month <= MONTHS_PER_YEAR; month += 1) {
      const takings = salaries(game.endTurn());
      expect(takings, `month ${String(month + 1)} in the shop`).toEqual([base + mulDiv(growth, month, MONTHS_PER_YEAR)]);
      seen.push(takings[0] ?? 0);
    }
    // The first month pays the entry's figure; a year on, the takings have grown by the share tuning gives.
    expect(seen[0]).toBe(base);
    expect(seen.at(-1)).toBe(base + growth);
    expect(game.view().chapter.items.find((item) => item.id === "pay")?.met ?? game.view().chapter.done.includes(FIRST_CHAPTER)).toBe(true);
  });

  test("[R-ACTIVITY-016] [R-ACTIVITY-001] given every fixed life and a graduate from sixteen, when the activities are read, then the shop's act is offered to none of them", () => {
    const fixed = Object.values(content.scenario).filter((scenario) => scenario.prologue !== true);
    expect(fixed.length).toBeGreaterThan(0);
    const offered = fixed.filter((scenario) => allowed(start({ content, scenario: scenario.id }), OPEN) !== false).map((scenario) => scenario.id);
    expect(offered).toEqual([]);
    const graduate = sixteen("shop-graduate", ["begin", "science", "jamb", "study"]);
    expect(graduate.state.quality["quality.edu-level"]).toBeGreaterThanOrEqual(3);
    expect(allowed(graduate, OPEN)).toBe(false);
  });
});
