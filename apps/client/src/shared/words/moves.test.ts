// What an act did to the person, in a person's words (docs/rules/text.md R-TEXT-005): News
// said "Network up. Wellbeing up." at the meetup, "Tech skill up. Wellbeing down." for the project, "Wellbeing
// settles. You feel well." and "Care skill up." every month. No line names a quality or which way it went.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { slot } from "../../../../../packages/sim/src/route/route.journey";
import { newGame } from "../testing/fixtures";
import { tidyLines } from "./lines";
import { hasWords, nameOf, say, words } from "./text";
import { newsLines } from "./told";

/** The words a system would use for a quality's move, never a person's (R-TEXT-005's pattern). */
const SYSTEM = /\b(?:up|down|wellbeing|skill|settles)\b/i;
const MOVES = ["line.quality.gain", "line.quality.loss", "line.quality.worn", "line.quality.drift"];
const SHOWN = Object.values(content.quality).filter((entry) => entry !== undefined && entry.shown && entry.id !== "quality.age-months");
/** Qualities whose name is the thing a person names ("Your English slipped", "your portfolio", "land"): only these may be said. */
const PERSON_NAMED: ReadonlySet<string> = new Set(["quality.english", "quality.portfolio", "quality.land"]);

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"] = "plain"): ReportLine {
  return { key, params, tone, attention: false, counts: [] };
}

describe("a quality's move in a person's words", () => {
  test("[R-TEXT-005] given every quality the player is shown and every way it moves, when the line is told, then it says no figure, no up or down, and never the quality's name", () => {
    const said: string[] = [];
    for (const entry of SHOWN) {
      // A quality told by a named level ("Education: Master's degree") says the level a person names, not a move.
      const levelled = hasWords(`${entry.id}.value.${String(entry.min)}`) || PERSON_NAMED.has(entry.id);
      for (let value = entry.min; value <= entry.max; value += 1) {
        for (const key of MOVES) {
          const told = words(key, { quality: entry.id, points: value === 1 ? 2 : 1, value, source: "activity.rest-of-life" });
          if (/\d/.test(told) || SYSTEM.test(told) || (!levelled && told.toLowerCase().includes(nameOf(entry.id).toLowerCase()))) said.push(`${entry.id} ${key} ${String(value)}: ${told}`);
        }
      }
    }
    expect(said).toEqual([]);
  });

  test("[R-TEXT-005] given the month's drift toward rest, when it is told, then it says where the person is against rest, from below, at rest or from above", () => {
    const rest = content.tuning.quality.wellbeingDriftTo;
    const drift = (value: number) => words("line.quality.drift", { quality: "quality.wellbeing", points: 2, value, source: "month" });
    expect(drift(rest - 4)).toBe(say("line.quality.told.quality.wellbeing.drift.below"));
    expect(drift(rest)).toBe(say("line.quality.told.quality.wellbeing.drift.rest"));
    expect(drift(rest + 4)).toBe(say("line.quality.told.quality.wellbeing.drift.above"));
  });

  test("[R-TEXT-005] given a developer's month at the meetup and on her project, when News tells it, then each act's moves are one line in its own words, and no move says a quality or a direction", () => {
    const game = newGame("scenario.zainab");
    const met = game.accept({ type: "activity/now", activity: "activity.meetup", param: null });
    const month = game.endTurn([slot("activity.build-portfolio")]);
    const told = newsLines(met.lines, month.lines, game.view());
    const shown = told.map((each) => words(each.key, each.params));
    expect(shown).toContain(say("line.quality.from.activity.meetup"));
    expect(say("line.quality.from.activity.meetup")).toBe("You know more people at the hub now.");
    expect(shown).toContain("Late nights on the project.");
    expect(shown.filter((each) => each === say("line.quality.from.activity.meetup"))).toHaveLength(1);
    // Every move of the month, told: none in a system's words.
    const moved = [...met.lines, ...month.lines].filter((each) => MOVES.includes(each.key));
    expect(moved.length).toBeGreaterThan(2);
    expect(shown.filter((each) => SYSTEM.test(each) || each.includes(nameOf("quality.network")) || each.includes(nameOf("quality.tech")))).toEqual([]);
  });

  test("[R-TEXT-005] given an answer told in the offer's own words, and a rest, when the month is tidied, then what they moved is not told again", () => {
    expect(hasWords("offer.harvest.said.give")).toBe(true);
    const lines = [
      line("line.offer.taken", { offer: "offer.harvest", choice: "give" }),
      line("line.quality.gain", { quality: "quality.standing", points: 3, value: 50, source: "offer.harvest.give" }, "good"),
      line("line.quality.gain", { quality: "quality.wellbeing", points: 2, value: 62, source: "offer.harvest.give" }, "good"),
      line("line.activity.rested", { slots: 1 }),
      line("line.quality.gain", { quality: "quality.wellbeing", points: 4, value: 66, source: "activity.rest" }, "good"),
      line("line.quality.gain", { quality: "quality.network", points: 2, value: 40, source: "offer.aso-ebi.plain" }, "good"),
    ];
    const tidy = tidyLines(lines);
    expect(tidy.map((each) => each.key)).toEqual(["offer.harvest.said.give", "line.activity.rested", "line.quality.gain"]);
    // An answer with no words of its own keeps its moves, told by the quality.
    expect(words(tidy[2]!.key, tidy[2]!.params)).toBe(say("line.quality.told.quality.network.gain"));
  });
});
