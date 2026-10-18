// No simulation number in a player's words (text:bands-not-figures): a quality is
// said by its band, never its figure. The talent file read "Tech skill at 75 or more" and the board "₦90,000 at
// tech 50", while no screen ever shows a tech number. Walked over the real content: every quality, every
// requirement on one, every side job's tier and every route's checklist.
import { content } from "@japacity/content";
import type { Requirement } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../testing/fixtures";
import { payLiftWords } from "./jobs";
import { liftWords, tierWords } from "./profile";
import { AGE } from "./quality";
import { checklistWords, requirementSentence } from "./requirement";
import { hasWords, nameOf, say, words } from "./text";

/** Every quality the player is shown, but age: a person's age in years is no simulation number. */
const SHOWN = Object.values(content.quality).filter((entry) => entry.shown && entry.id !== AGE);

function escape(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The names a quality goes by in words: its name, and the name's first word ("Tech skill", "tech"). */
function namesOf(quality: string): string[] {
  const name = nameOf(quality);
  return [name, name.split(" ")[0] ?? name];
}

/** True when a digit follows one of a quality's names, alone or after "at", "of" or a colon. */
function saysAFigure(said: string): boolean {
  return Object.keys(content.quality).some((quality) => namesOf(quality).some((name) => new RegExp(`\\b${escape(name)}\\b(:| at| of)?\\s*\\d`, "i").test(said)));
}

/** Every requirement on a quality anywhere in content, found by walking the tables. */
function qualityGates(): Requirement[] {
  const found: Requirement[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (typeof value === "object" && value !== null) {
      const record = value as Record<string, unknown>;
      if ((record.type === "quality/min" || record.type === "quality/max") && typeof record.quality === "string") found.push(record as unknown as Requirement);
      Object.values(record).forEach(walk);
    }
  };
  walk(content);
  return found;
}

describe("qualities in words, never numbers", () => {
  test("[text:bands-not-figures] given every quality the player is shown, when it moves to any value, then its line says no figure", () => {
    expect(SHOWN.length).toBeGreaterThan(0);
    const figures: string[] = [];
    for (const entry of SHOWN) {
      for (let value = entry.min; value <= entry.max; value += 1) {
        for (const key of ["line.quality.gain", "line.quality.loss", "line.quality.drift"]) {
          const said = words(key, { quality: entry.id, points: 1, value });
          if (/\d/.test(said)) figures.push(said);
        }
      }
    }
    expect(figures).toEqual([]);
  });

  test("[text:bands-not-figures] given every requirement on a quality the player is shown in content, when it is said, then no figure follows the quality's name", () => {
    // A hidden quality (the health counters) gates only the draws; the player sees the warning and the offers, never the gate.
    const shown = new Set<string>(SHOWN.map((entry) => entry.id));
    const gates = qualityGates().filter((gate) => "quality" in gate && shown.has(gate.quality));
    expect(gates.length).toBeGreaterThan(0);
    expect(gates.map((gate) => requirementSentence(gate)).filter(saysAFigure)).toEqual([]);
  });

  test("[text:bands-not-figures] [activity:side-jobs-pay-by-tier] given every side job's tier in content, when what lifts the pay is said, then it is the band the tier opens at, never a figure", () => {
    const tiers = Object.values(content.activity).flatMap((entry) => entry.tiers ?? []);
    expect(tiers.length).toBeGreaterThan(0);
    for (const tier of tiers) {
      const said = tierWords(tier);
      expect(said).not.toMatch(/\d+ *$/);
      expect(saysAFigure(said)).toBe(false);
    }
  });

  test("[text:bands-not-figures] [activity:side-jobs-pay-by-tier] given weekend tutoring under its tech tier, when the board says its pay, then the tier's pay is said with the band it opens at", () => {
    const view = newGame("scenario.ada").view();
    expect(liftWords(view, "activity.weekend-tutoring")).toBe(`${say("ui.tier.lift", { next: "₦90,000", band: "your tech is good" })}`);
    expect(payLiftWords("activity.weekend-tutoring", view)).toBe("₦60,000 a month; ₦90,000 once your tech is good");
  });

  test("[text:bands-not-figures] [world:phone-holds-what-phones-hold] given every route's checklist in content, when its items are said, then none says a quality's figure, and the talent file asks for strong tech", () => {
    const said = Object.values(content.route).flatMap((route) => route.checklist.map((item) => checklistWords(route.id, item.id)));
    expect(said.length).toBeGreaterThan(0);
    expect(said.filter(saysAFigure)).toEqual([]);
    expect(said.filter((each) => !hasWords(each) && /^route\./.test(each))).toEqual([]);
    expect(checklistWords("route.uk-talent", "tech")).toBe("Strong tech");
  });

  test("[text:bands-not-figures] given every chapter's items in content, when they are said, then none says a quality's figure", () => {
    const said = Object.values(content.chapter).flatMap((chapter) => chapter.items.map((item) => words(`${chapter.id}.item.${item.id}`)));
    expect(said.length).toBeGreaterThan(0);
    expect(said.filter(saysAFigure)).toEqual([]);
  });
});
