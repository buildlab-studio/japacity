import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Content, Id, PersonFacts } from "../../engine/types";
import type { Game } from "../../testing/play";
import type { LifeOptions } from "../route.journey";
import { BOND, CANADA, facts, joint, life, readOf, setPeople, sibling } from "./people.journey";
import { invites, pointsParts, pointsScore, pointsScoreAlone, pointsScoreWith, siblingPoints, spouseFactors } from "./points";

const used = content;
const BONUS = content.points["points.canada"]!.siblingBonus;
const YEAR = 12;

/** Ada at 25 with a bachelor's and band 7.0. */
const ADA: LifeOptions = { qualities: { "quality.age-months": 25 * YEAR, "quality.edu-level": 3 } };

/** A spouse with a bachelor's and band 7.0 who has not worked in Canada. */
const SPOUSE = facts({ eduLevel: 3, englishBand: 70 });

function leading(spouse: PersonFacts = SPOUSE, options: LifeOptions = ADA): Game {
  const game = life(used, options);
  joint(game, CANADA, "me", { stage: "married", facts: spouse });
  return game;
}

/** The score the route's view shows. */
function score(game: Game): number | null {
  const gate = game.view().routes.find((view) => view.id === CANADA)?.gate;
  return gate?.gate === "points" ? gate.points : null;
}

describe("R-PEOPLE-030: the lead's score with a spouse", () => {
  test("[R-PEOPLE-030] given Ada leading the points route with a spouse who has a bachelor's and band 7.0, when the score is read, then it uses the with-spouse columns and adds the spouse's 28", () => {
    const game = leading();
    const { transfer } = pointsParts(readOf(game), CANADA);
    // Alone: 110 for 25, 120 for a bachelor's, 31 for each ability at band 7.0.
    expect(pointsScoreAlone(readOf(game), CANADA)).toBe(110 + 120 + 4 * 31 + transfer);
    // With a spouse: 100, 112, 29 each, and the spouse's 8 for a bachelor's and 5 for each ability.
    expect(spouseFactors(readOf(game), CANADA, SPOUSE)).toBe(8 + 4 * 5);
    expect(pointsScoreWith(readOf(game), CANADA, SPOUSE)).toBe(100 + 112 + 4 * 29 + transfer + 28);
    expect(pointsScore(readOf(game), CANADA)).toBe(pointsScoreWith(readOf(game), CANADA, SPOUSE));
    expect(score(game)).toBe(pointsScoreWith(readOf(game), CANADA, SPOUSE));
  });

  test("[R-PEOPLE-030] given no joint, a joint the partner leads, or a bond that has ended, when the score is read, then Ada scores alone", () => {
    const alone = life(used, ADA);
    const theirs = life(used, ADA);
    joint(theirs, CANADA, "them", { stage: "married", facts: SPOUSE });
    const ended = leading();
    setPeople(ended, (slice) => ({ ...slice, bonds: { [BOND]: { ...slice.bonds[BOND]!, stage: "ended" } } }));
    for (const game of [alone, theirs, ended]) expect(pointsScore(readOf(game), CANADA)).toBe(pointsScoreAlone(readOf(game), CANADA));
  });

  test("[R-PEOPLE-030] given a spouse's school and band at each step of the table, when their factors are read, then each step scores as the page's table", () => {
    const game = leading();
    const factors = (over: Partial<PersonFacts>): number => spouseFactors(readOf(game), CANADA, facts({ englishBand: null, ...over }));
    expect([1, 2, 3, 4, 5].map((eduLevel) => factors({ eduLevel }))).toEqual([2, 7, 8, 10, 10]);
    expect([45, 50, 55, 60, 65, 70, 80].map((englishBand) => factors({ eduLevel: 0, englishBand }))).toEqual([0, 4, 4, 12, 12, 20, 20]);
  });

  test("[R-PEOPLE-030] given a spouse working in Canada 11, 12, 23, 24 and 60 months, and one at home, when the Canadian work is read, then a year counts from twelve months there", () => {
    const game = leading();
    const work = (monthsInCountry: number): number =>
      spouseFactors(readOf(game), CANADA, facts({ eduLevel: 0, englishBand: null, where: "abroad", country: "country.canada", job: "activity.job-teacher", monthsInCountry }));
    expect([11, 12, 23, 24, 60].map(work)).toEqual([0, 5, 5, 7, 10]);
    expect(spouseFactors(readOf(game), CANADA, facts({ eduLevel: 0, englishBand: null, monthsInCountry: 60 }))).toBe(0);
  });

  test("[R-PEOPLE-030] given a cap of 30 and a spouse who would score 40, when the factors are read, then they are 30", () => {
    const capped = (base: Content): Content => {
      const table = base.points["points.canada-spouse"]!;
      return { ...base, points: { ...base.points, "points.canada-spouse": { ...table, spouse: { ...table.spouse!, cap: 30 } } } };
    };
    const game = life(capped(used), ADA);
    const best = facts({ eduLevel: 5, englishBand: 80, where: "abroad", country: "country.canada", job: "activity.job-teacher", monthsInCountry: 60 });
    expect(spouseFactors(readOf(leading(best)), CANADA, best)).toBe(40);
    expect(spouseFactors(readOf(game), CANADA, best)).toBe(30);
  });
});

describe("R-PEOPLE-031: a sibling in Canada", () => {
  test("[R-PEOPLE-031] given a sibling resident in Canada aged exactly 18, and one a month younger, when the score is read, then only the first adds the bonus", () => {
    const adult = life(used, ADA);
    const base = pointsScore(readOf(adult), CANADA);
    sibling(adult, "sib-1", { where: "abroad", country: "country.canada", status: "status.ca-resident", ageMonths: 18 * YEAR });
    expect(siblingPoints(readOf(adult), CANADA)).toBe(BONUS);
    expect(pointsScore(readOf(adult), CANADA)).toBe(base + BONUS);
    const young = life(used, ADA);
    sibling(young, "sib-1", { where: "abroad", country: "country.canada", status: "status.ca-resident", ageMonths: 18 * YEAR - 1 });
    expect(siblingPoints(readOf(young), CANADA)).toBe(0);
  });

  test("[R-PEOPLE-031] given two siblings who are citizens, one in the UK, and one with no status, when the bonus is read, then it is counted once, and only for Canada with residence or citizenship", () => {
    const two = life(used, ADA);
    sibling(two, "sib-1", { where: "abroad", country: "country.canada", status: "status.ca-citizen" });
    sibling(two, "sib-2", { where: "abroad", country: "country.canada", status: "status.ca-resident" });
    expect(siblingPoints(readOf(two), CANADA)).toBe(BONUS);
    const elsewhere = life(used, ADA);
    sibling(elsewhere, "sib-1", { where: "abroad", country: "country.uk", status: "status.uk-settled" });
    sibling(elsewhere, "sib-2", { where: "abroad", country: "country.canada", status: "status.ca-overstayer" });
    expect(siblingPoints(readOf(elsewhere), CANADA)).toBe(0);
  });

  test("[R-PEOPLE-031] given a cut-off exactly the bonus above Ada's score, when the world's draw looks, then she is invited with the sibling and not without", () => {
    const probe = life(used, ADA);
    const cutoff = pointsScore(readOf(probe), CANADA) + BONUS;
    const vars = (): Record<Id<"var">, number> => ({ "var.ca-cutoff": cutoff });
    const without = life(used, { ...ADA, vars });
    expect(invites(readOf(without), CANADA)).toBe(false);
    const withSibling = life(used, { ...ADA, vars });
    sibling(withSibling, "sib-1", { where: "abroad", country: "country.canada", status: "status.ca-resident" });
    expect(invites(readOf(withSibling), CANADA)).toBe(true);
  });
});
