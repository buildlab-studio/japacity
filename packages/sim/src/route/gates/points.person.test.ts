import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Content, Id, PersonFacts } from "../../engine/types";
import type { Game } from "../../testing/play";
import type { LifeOptions } from "../../testing/route.journey";
import { BOND, facts, joint, life, setPeople, sibling } from "../../testing/person.journey";
import { readOf } from "../../testing/read";
import { invites, pointsParts, pointsScore, pointsScoreAlone, pointsScoreWith, siblingPoints, spouseFactors } from "./points";
import { CANADA_ROUTE } from "../../testing/ids";

const BONUS = content.points["points.canada"]!.siblingBonus;
const YEAR = 12;

/** The graduate at 25 with a bachelor's and band 7.0. */
const GRADUATE: LifeOptions = { qualities: { "quality.age-months": 25 * YEAR, "quality.edu-level": 3 } };

/** A spouse with a bachelor's and band 7.0 who has not worked in Canada. */
const SPOUSE = facts({ eduLevel: 3, englishBand: 70 });

function leading(spouse: PersonFacts = SPOUSE, options: LifeOptions = GRADUATE): Game {
  const game = life(content, options);
  joint(game, CANADA_ROUTE, "me", { stage: "married", facts: spouse });
  return game;
}

/** The score the route's view shows. */
function score(game: Game): number | null {
  const gate = game.view().routes.find((view) => view.id === CANADA_ROUTE)?.gate;
  return gate?.gate === "points" ? gate.points : null;
}

describe("person:canada-spouse-points: the lead's score with a spouse", () => {
  test("[person:canada-spouse-points] given the graduate leading the points route with a spouse who has a bachelor's and band 7.0, when the score is read, then it uses the with-spouse columns and adds the spouse's 28", () => {
    const game = leading();
    const { transfer } = pointsParts(readOf(game), CANADA_ROUTE);
    // Alone: 110 for 25, 120 for a bachelor's, 31 for each ability at band 7.0.
    expect(pointsScoreAlone(readOf(game), CANADA_ROUTE)).toBe(110 + 120 + 4 * 31 + transfer);
    // With a spouse: 100, 112, 29 each, and the spouse's 8 for a bachelor's and 5 for each ability.
    expect(spouseFactors(readOf(game), CANADA_ROUTE, SPOUSE)).toBe(8 + 4 * 5);
    expect(pointsScoreWith(readOf(game), CANADA_ROUTE, SPOUSE)).toBe(100 + 112 + 4 * 29 + transfer + 28);
    expect(pointsScore(readOf(game), CANADA_ROUTE)).toBe(pointsScoreWith(readOf(game), CANADA_ROUTE, SPOUSE));
    expect(score(game)).toBe(pointsScoreWith(readOf(game), CANADA_ROUTE, SPOUSE));
  });

  test("[person:canada-spouse-points] given a joint on the points route either way round, when the people view is read, then it shows the score alone and the score with this partner, so the couple can choose who leads", () => {
    for (const lead of ["me", "them"] as const) {
      const game = life(content, GRADUATE);
      joint(game, CANADA_ROUTE, lead, { stage: "married", facts: SPOUSE });
      expect(game.view().people.joint).toEqual({
        bond: BOND,
        route: CANADA_ROUTE,
        lead,
        myScore: pointsScoreAlone(readOf(game), CANADA_ROUTE),
        theirScore: pointsScoreWith(readOf(game), CANADA_ROUTE, SPOUSE),
      });
    }
  });

  test("[person:canada-spouse-points] given a joint on the points route whose partner's facts are not known, or a joint on a route without points, when the people view is read, then only what can be scored shows", () => {
    const unknown = life(content, GRADUATE);
    joint(unknown, CANADA_ROUTE, "me", { stage: "married", facts: null });
    expect(unknown.view().people.joint).toMatchObject({ myScore: pointsScoreAlone(readOf(unknown), CANADA_ROUTE), theirScore: null });
    const skilled = life(content, GRADUATE);
    joint(skilled, "route.uk-skilled", "me", { stage: "married", facts: SPOUSE });
    expect(skilled.view().people.joint).toMatchObject({ myScore: null, theirScore: null });
  });

  test("[person:canada-spouse-points] given no joint, a joint the partner leads, or a bond that has ended, when the score is read, then the graduate scores alone", () => {
    const alone = life(content, GRADUATE);
    const theirs = life(content, GRADUATE);
    joint(theirs, CANADA_ROUTE, "them", { stage: "married", facts: SPOUSE });
    const ended = leading();
    setPeople(ended, (slice) => ({ ...slice, bonds: { [BOND]: { ...slice.bonds[BOND]!, stage: "ended" } } }));
    for (const game of [alone, theirs, ended]) expect(pointsScore(readOf(game), CANADA_ROUTE)).toBe(pointsScoreAlone(readOf(game), CANADA_ROUTE));
  });

  test("[person:canada-spouse-points] given a spouse's school and band at each step of the table, when their factors are read, then each step scores as the page's table", () => {
    const game = leading();
    const factors = (over: Partial<PersonFacts>): number => spouseFactors(readOf(game), CANADA_ROUTE, facts({ englishBand: null, ...over }));
    expect([1, 2, 3, 4, 5].map((eduLevel) => factors({ eduLevel }))).toEqual([2, 7, 8, 10, 10]);
    expect([45, 50, 55, 60, 65, 70, 80].map((englishBand) => factors({ eduLevel: 0, englishBand }))).toEqual([0, 4, 4, 12, 12, 20, 20]);
  });

  test("[person:canada-spouse-points] given a spouse working in Canada 11, 12, 23, 24 and 60 months, and one at home, when the Canadian work is read, then a year counts from twelve months there", () => {
    const game = leading();
    const work = (monthsInCountry: number): number =>
      spouseFactors(readOf(game), CANADA_ROUTE, facts({ eduLevel: 0, englishBand: null, where: "abroad", country: "country.canada", job: "activity.job-teacher", monthsInCountry }));
    expect([11, 12, 23, 24, 60].map(work)).toEqual([0, 5, 5, 7, 10]);
    expect(spouseFactors(readOf(game), CANADA_ROUTE, facts({ eduLevel: 0, englishBand: null, monthsInCountry: 60 }))).toBe(0);
  });

  test("[person:canada-spouse-points] given a cap of 30 and a spouse who would score 40, when the factors are read, then they are 30", () => {
    const capped = (base: Content): Content => {
      const table = base.points["points.canada-spouse"]!;
      return { ...base, points: { ...base.points, "points.canada-spouse": { ...table, spouse: { ...table.spouse!, cap: 30 } } } };
    };
    const game = life(capped(content), GRADUATE);
    const best = facts({ eduLevel: 5, englishBand: 80, where: "abroad", country: "country.canada", job: "activity.job-teacher", monthsInCountry: 60 });
    expect(spouseFactors(readOf(leading(best)), CANADA_ROUTE, best)).toBe(40);
    expect(spouseFactors(readOf(game), CANADA_ROUTE, best)).toBe(30);
  });
});

describe("person:canada-sibling-bonus: a sibling in Canada", () => {
  test("[person:canada-sibling-bonus] given a sibling resident in Canada aged exactly 18, and one a month younger, when the score is read, then only the first adds the bonus", () => {
    const adult = life(content, GRADUATE);
    const base = pointsScore(readOf(adult), CANADA_ROUTE);
    sibling(adult, "sib-1", { where: "abroad", country: "country.canada", status: "status.ca-resident", ageMonths: 18 * YEAR });
    expect(siblingPoints(readOf(adult), CANADA_ROUTE)).toBe(BONUS);
    expect(pointsScore(readOf(adult), CANADA_ROUTE)).toBe(base + BONUS);
    const young = life(content, GRADUATE);
    sibling(young, "sib-1", { where: "abroad", country: "country.canada", status: "status.ca-resident", ageMonths: 18 * YEAR - 1 });
    expect(siblingPoints(readOf(young), CANADA_ROUTE)).toBe(0);
  });

  test("[person:canada-sibling-bonus] given two siblings who are citizens, one in the UK, and one with no status, when the bonus is read, then it is counted once, and only for Canada with residence or citizenship", () => {
    const two = life(content, GRADUATE);
    sibling(two, "sib-1", { where: "abroad", country: "country.canada", status: "status.ca-citizen" });
    sibling(two, "sib-2", { where: "abroad", country: "country.canada", status: "status.ca-resident" });
    expect(siblingPoints(readOf(two), CANADA_ROUTE)).toBe(BONUS);
    const elsewhere = life(content, GRADUATE);
    sibling(elsewhere, "sib-1", { where: "abroad", country: "country.uk", status: "status.uk-settled" });
    sibling(elsewhere, "sib-2", { where: "abroad", country: "country.canada", status: "status.ca-overstayer" });
    expect(siblingPoints(readOf(elsewhere), CANADA_ROUTE)).toBe(0);
  });

  test("[person:canada-sibling-bonus] given a cut-off exactly the bonus above the graduate's score, when the world's draw looks, then the life is invited with the sibling and not without", () => {
    const probe = life(content, GRADUATE);
    const cutoff = pointsScore(readOf(probe), CANADA_ROUTE) + BONUS;
    const vars = (): Record<Id<"var">, number> => ({ "var.ca-cutoff": cutoff });
    const without = life(content, { ...GRADUATE, vars });
    expect(invites(readOf(without), CANADA_ROUTE)).toBe(false);
    const withSibling = life(content, { ...GRADUATE, vars });
    sibling(withSibling, "sib-1", { where: "abroad", country: "country.canada", status: "status.ca-resident" });
    expect(invites(readOf(withSibling), CANADA_ROUTE)).toBe(true);
  });
});
