// The family group feed as the phone reads it (docs/rules/text.md R-TEXT-003): a small feed, at most one post a
// month, never a post keyed to bad news, the billing only once the family knows, each fixed life's aunt and cousin
// named from its own family. Every fixed life is read from the real engine and the real content.
import { badNews, content, familyNames, familyPosts, text, travelKnown } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { familyFeedLines } from "./feed";

const FIXED = Object.keys(familyNames) as Id<"scenario">[];
const MONTHS = Array.from({ length: 60 }, (_, month) => month);

function at(scenario: Id<"scenario">, month: number): PlayerView {
  return { ...engineView(scenario), month };
}

const postOf = (id: string) => familyPosts.find((post) => post.id === id)!;

describe("the family group feed", () => {
  test("[R-TEXT-003] given every fixed life over five years, when the feed is read each month, then no month carries more than one post, and the same month reads the same twice", () => {
    expect(FIXED.length).toBeGreaterThan(0);
    for (const scenario of FIXED) {
      for (const month of MONTHS) {
        const lines = familyFeedLines(at(scenario, month));
        expect(lines.length).toBeGreaterThan(0);
        expect(new Set(lines.map((line) => line.month)).size).toBe(lines.length);
        expect(familyFeedLines(at(scenario, month))).toEqual(lines);
      }
    }
  });

  test("[R-TEXT-003] given every post keyed to a moment, when the moment is read, then it is a report line with words and never bad news", () => {
    const keyed = familyPosts.filter((post) => post.after !== null);
    expect(keyed.length).toBeGreaterThan(0);
    expect(keyed.filter((post) => text[post.after!] === undefined).map((post) => post.after)).toEqual([]);
    expect(keyed.filter((post) => badNews(post.after!, text[post.after!] ?? "")).map((post) => post.after)).toEqual([]);
  });

  test("[R-TEXT-003] given a fixed life that has told no one it is travelling, when the feed is read in every month, then no billing post is in it; once the visa is granted, then billing is", () => {
    for (const scenario of FIXED) {
      for (const month of MONTHS) {
        const billing = familyFeedLines(at(scenario, month)).filter((line) => postOf(line.id).kind === "billing");
        expect(billing, `${scenario} month ${String(month)}`).toEqual([]);
      }
      const view = at(scenario, 12);
      const granted = { ...view, routes: view.routes.map((route, index) => (index === 0 ? { ...route, state: "granted" as const } : route)) };
      expect(familyFeedLines(granted).some((line) => postOf(line.id).kind === "billing")).toBe(true);
    }
    // Every billing post waits for a line after which the family knows.
    for (const post of familyPosts.filter((each) => each.kind === "billing")) expect(travelKnown).toContain(post.after);
  });

  test("[R-TEXT-003] given every fixed life, when its aunt's and its cousin's posts are read, then each is sent under the name of the life's own aunt and cousin", () => {
    for (const scenario of FIXED) {
      const names = familyNames[scenario]!;
      const senders = new Map<string, Set<string>>();
      for (const month of MONTHS) {
        for (const line of familyFeedLines(at(scenario, month))) {
          const from = postOf(line.id).from;
          senders.set(from, (senders.get(from) ?? new Set()).add(line.from));
        }
      }
      for (const relation of ["aunt", "cousin"] as const) {
        const shown = [...(senders.get(relation) ?? [])];
        expect(shown.length, `${scenario} ${relation}`).toBeGreaterThan(0);
        for (const from of shown) expect(from, `${scenario} ${relation}`).toContain(names[relation]);
      }
      // The aunt and the cousin are the life's own: no other fixed life shares them.
      for (const other of FIXED.filter((each) => each !== scenario)) {
        expect(familyNames[other]!.aunt).not.toBe(names.aunt);
        expect(familyNames[other]!.cousin).not.toBe(names.cousin);
      }
    }
    expect(FIXED.sort()).toEqual(Object.keys(content.scenario).filter((id) => id !== "scenario.prologue").sort());
  });
});
