// The prologue through step, on the real steps in content: docs/rules/prologue.md.
import { AUTHORITY_COMMANDS } from "../engine/step";
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { allMet } from "../engine/check";
import { checkInvariants } from "../engine/invariants";
import type { Registry } from "../engine/kind";
import { applyEvent, newState } from "../engine/state";
import type { BaseEvent, CommandType, Content, Id, ScenarioEntry, World } from "../engine/types";
import { hiddenPaths } from "../engine/view";
import { registry } from "../kinds";
import type { QualityEvent } from "../quality/quality.events";
import { legalCommands } from "../testing/legal";
import type { Game, Loose } from "../testing/play";
import { start } from "../testing/play";
import { standInWorld } from "../world/standIn";
import type { PrologueEvent } from "./prologue.events";
import { gradeOf, parentsEducatedBp, PROLOGUE_SOURCE } from "./prologue.logic";

const PROLOGUE: Id<"scenario"> = "scenario.prologue";
const AGE: Id<"quality"> = "quality.age-months";
const FIRST = "draw";

/**
 * The prologue's starting life as a fixture, the same as `prologueScenario` in
 * the content's prologue folder: every quality at its minimum, which for age is
 * sixteen. The real content does not list it among its lives yet.
 */
const fixture: ScenarioEntry = { id: PROLOGUE, prologue: true, qualities: {}, job: null, tenure: {}, siblings: 0, pockets: {}, documents: [], obligations: [] };
const withPrologue: Content = { ...content, scenario: { ...content.scenario, [PROLOGUE]: content.scenario[PROLOGUE] ?? fixture } };

/**
 * R-QUALITY-003 lets only the month move age, so the real quality kind
 * drops the prologue's `quality/add` on age and R-PROLOGUE-004 cannot hold. The
 * age rules are tested with the quality kind given the one exception the
 * prologue needs: age moves when the prologue is the cause.
 */
function ageMoves(kinds: Registry): Registry {
  return kinds.map((kind) => {
    const add = kind.effects?.["quality/add"];
    if (kind.kind !== "quality" || add === undefined) return kind;
    return {
      ...kind,
      effects: {
        ...kind.effects,
        "quality/add": (ctx, effect, cause) => {
          if (effect.type === "quality/add" && effect.quality === AGE && cause.source === PROLOGUE_SOURCE && effect.amount !== 0) {
            const moved: QualityEvent = { type: "quality/changed", quality: AGE, amount: effect.amount, source: cause.source };
            return [moved];
          }
          return add(ctx, effect, cause);
        },
      },
    };
  });
}

const AGE_KINDS = ageMoves(registry());

function newGame(seed: string, kinds: Registry = AGE_KINDS, worldAt?: (tick: number) => World): Game {
  return start({ scenario: PROLOGUE, seed, content: withPrologue, kinds, ...(worldAt === undefined ? {} : { worldAt }) });
}

function stepOf(game: Game): string {
  const step = game.state.prologue.step;
  if (step === null) throw new Error("The prologue has no step open.");
  return step;
}

function choose(game: Game, answer: string) {
  return game.accept({ type: "prologue/choose", step: stepOf(game), answer });
}

/** Answers the current step with the first of `wanted` that is allowed now. */
function pick(game: Game, ...wanted: string[]) {
  const answers = game.view().prologue?.answers ?? [];
  const found = wanted.find((id) => answers.some((answer) => answer.id === id && answer.allowed));
  if (found === undefined) throw new Error(`None of ${wanted.join(", ")} is allowed at ${stepOf(game)}.`);
  return choose(game, found);
}

/** The first seed from `prefix-0` on whose game, after `play`, `holds` is true. */
function seedWhere(prefix: string, play: (game: Game) => void, holds: (game: Game) => boolean, kinds: Registry = AGE_KINDS): Game {
  for (let index = 0; index < 400; index += 1) {
    const game = newGame(`${prefix}-${String(index)}`, kinds);
    play(game);
    if (holds(game)) return game;
  }
  throw new Error(`No seed from ${prefix} gives what the test needs.`);
}

/** Plays the prologue to its end, answering with the allowed answer `choice` points at. */
function playOut(game: Game, choice: (index: number, allowed: number) => number = () => 0): string[] {
  const lines: string[] = [];
  for (let index = 0; game.state.prologue.open; index += 1) {
    if (index > 40) throw new Error("The prologue did not close in 40 answers.");
    const answers = (game.view().prologue?.answers ?? []).filter((answer) => answer.allowed);
    const answer = answers[choice(index, answers.length) % answers.length];
    if (answer === undefined) throw new Error(`No answer is allowed at ${stepOf(game)}.`);
    lines.push(...choose(game, answer.id).lines.map((line) => line.key));
  }
  return lines;
}

/** Begins, takes science and sits the exam until it passes, or until the second retake sends the character to work. */
function toCourse(game: Game): void {
  choose(game, "begin");
  pick(game, "science");
  choose(game, "jamb");
  while (game.state.prologue.step === "exam" || game.state.prologue.step === "retake") {
    if (game.state.prologue.step === "exam") choose(game, "study");
    else pick(game, "again", "work");
  }
}

/** A small deterministic spread of choices from a seed number. */
function spread(run: number): (index: number, allowed: number) => number {
  return (index, allowed) => (run * 7 + index * 13 + ((run * index) % 5)) % Math.max(allowed, 1);
}

function quality(game: Game, id: Id<"quality">): number {
  return game.state.quality[id] ?? Number.NaN;
}

/** Every command a player could send, one of each type the prologue does not let through. */
// The authority's own commands are refused earlier with not-yours, so they are not in the list.
const OTHERS: { [T in Exclude<CommandType, "prologue/choose" | (typeof AUTHORITY_COMMANDS)[number]>]: Loose } = {
  "turn/end": { type: "turn/end", slots: [] },
  "activity/quit": { type: "activity/quit" },
  "offer/choose": { type: "offer/choose", offer: "offer-1", choice: "yes" },
  "wallet/convert": { type: "wallet/convert", from: "NGN", to: "USD", amount: 100, via: "aboki" },
  "wallet/move": { type: "wallet/move", currency: "NGN", amount: 100, to: "bank" },
  "obligation/pay": { type: "obligation/pay", obligation: "obligation-1", amount: 100 },
  "route/pay-deposit": { type: "route/pay-deposit", route: "route.uk-masters", school: "school.northgate" },
  "route/depart": { type: "route/depart", route: "route.uk-masters" },
  "setpiece/answer": { type: "setpiece/answer", question: "q", answer: "a" },
  "wallet/remit": { type: "wallet/remit", currency: "GBP", amount: 100, channel: "app" },
  "status/renew": { type: "status/renew" },
  "return/home": { type: "return/home" },
  "place/ride": { type: "place/ride", from: "place.ojuelegba", to: "place.bode-thomas", way: "danfo" },
  "lottery/buy": { type: "lottery/buy", tickets: 1 },
  "people/invite": { type: "people/invite", slot: "partner" },
  "people/court": { type: "people/court", with: "person.a" },
  "people/propose": { type: "people/propose", bond: "bond-1", step: "partner" },
  "people/answer": { type: "people/answer", bond: "bond-1", step: "partner", yes: true },
  "people/withdraw": { type: "people/withdraw", bond: "bond-1" },
  "people/consent": { type: "people/consent", bond: "bond-1" },
  "people/end": { type: "people/end", bond: "bond-1" },
  "interview/answer": { type: "interview/answer", question: "q", option: "a" },
  "home/move": { type: "home/move", to: "place.makoko" },
  "chapter/lean": { type: "chapter/lean", route: "route.uk-masters" },
};

describe("a new prologue", () => {
  test("[R-PROLOGUE-001] given scenario.prologue, when a new state is built, then every quality is at its minimum but age at 192, with no money, job, documents or obligations, and the prologue open at step 0", () => {
    const state = newState(PROLOGUE, "seed", withPrologue);
    for (const entry of Object.values(withPrologue.quality)) {
      expect(state.quality[entry.id]).toBe(entry.id === AGE ? withPrologue.tuning.prologue.startAgeMonths : entry.min);
    }
    expect(state.quality[AGE]).toBe(192);
    for (const pocket of Object.values(state.wallet.pockets)) expect(pocket).toEqual({ bank: 0, cash: 0, locked: 0 });
    expect(state.activity.job).toBeNull();
    expect(state.document).toEqual({});
    expect(state.obligation.items).toEqual({});
    expect(state.prologue).toMatchObject({ open: true, step: FIRST, draw: null, choices: {}, lastOutcome: null, flags: [], gradeBase: 0 });
    expect(checkInvariants(state, withPrologue)).toEqual([]);
  });

  test.each(Object.keys(OTHERS) as (keyof typeof OTHERS)[])(
    "[R-PROLOGUE-001] given the prologue open, when %s is sent, then it is rejected with prologue-open",
    (type) => {
      const fresh = newGame("others");
      fresh.expectRejected(OTHERS[type], "prologue-open");
      // Mid-prologue too, with money in hand.
      const later = seedWhere("others-work", (game) => {
        choose(game, "begin");
        pick(game, "science");
        pick(game, "work");
      }, () => true);
      expect(later.state.wallet.pockets.NGN.cash).toBeGreaterThan(0);
      later.expectRejected(OTHERS[type], "prologue-open");
    },
  );

  test("[R-PROLOGUE-001] given the prologue open, when the authority grants turns or the player answers, then both are accepted", () => {
    const game = newGame("grant");
    game.grant(1);
    choose(game, "begin");
    expect(game.state.prologue.step).toBe("subjects");
  });

  test("[R-PROLOGUE-001] given the prologue closed, when the turn is ended, then the guard lets it through", () => {
    const game = newGame("closed");
    playOut(game);
    expect(game.state.prologue.open).toBe(false);
    game.endTurn();
    expect(game.state.turn.month).toBe(1);
  });
});

describe("step 0: the draw", () => {
  test("[R-PROLOGUE-002] given a new prologue, when it begins, then the draw is made on stream prologue and sets family means, network and standing", () => {
    const game = newGame("draw");
    expect(game.state.draws.prologue).toBeUndefined();
    const result = choose(game, "begin");
    const draw = game.state.prologue.draw;
    if (draw === null) throw new Error("No draw was made.");
    // Four draws: family means, town, siblings, parents.
    expect(game.state.draws.prologue).toBe(4);
    expect(result.events.map((event) => event.type)).toContain("prologue/drawn");
    expect(quality(game, "quality.family-means")).toBe(draw.familyMeans);
    expect(quality(game, "quality.network")).toBe((draw.town === "city" ? 15 : 5) + (draw.parentsEducated ? 10 : 0));
    expect(quality(game, "quality.standing")).toBe(50);
    expect(result.lines.map((line) => line.key)).toContain("line.prologue.drawn");
  });

  test("[R-PROLOGUE-002] given 200 seeds, when each prologue begins, then every draw is in its range and each side of each coin comes up", () => {
    const { familyMeans, siblings } = withPrologue.tuning.prologue;
    const seen = { city: 0, town: 0, educated: 0, not: 0, low: Number.MAX_SAFE_INTEGER, high: 0 };
    for (let run = 0; run < 200; run += 1) {
      const game = newGame(`draws-${String(run)}`, registry());
      choose(game, "begin");
      const draw = game.state.prologue.draw!;
      expect(draw.familyMeans).toBeGreaterThanOrEqual(familyMeans[0]);
      expect(draw.familyMeans).toBeLessThanOrEqual(familyMeans[1]);
      expect(draw.siblings).toBeGreaterThanOrEqual(siblings[0]);
      expect(draw.siblings).toBeLessThanOrEqual(siblings[1]);
      seen[draw.town] += 1;
      seen[draw.parentsEducated ? "educated" : "not"] += 1;
      seen.low = Math.min(seen.low, draw.familyMeans);
      seen.high = Math.max(seen.high, draw.familyMeans);
    }
    // City is 55%: between 80 and 140 of 200 by any fair reading.
    expect(seen.city).toBeGreaterThan(80);
    expect(seen.city).toBeLessThan(140);
    expect(seen.educated).toBeGreaterThan(0);
    expect(seen.not).toBeGreaterThan(0);
    expect(seen.low).toBeLessThan(familyMeans[0] + 5);
    expect(seen.high).toBeGreaterThan(familyMeans[1] - 5);
  });

  test("[R-PROLOGUE-002] given family means at the edges of its draw, when the parents' chance is read, then it is 2000 plus 60 a point", () => {
    expect(parentsEducatedBp(10, content.tuning.prologue)).toBe(2600);
    expect(parentsEducatedBp(80, content.tuning.prologue)).toBe(6800);
    expect(parentsEducatedBp(0, content.tuning.prologue)).toBe(2000);
  });
});

describe("answers", () => {
  test("[R-PROLOGUE-003] given the current step, when another step, an unknown answer or no open prologue is named, then it is rejected with not-legal", () => {
    const game = newGame("names");
    game.expectRejected({ type: "prologue/choose", step: "subjects", answer: "science" }, "not-legal");
    game.expectRejected({ type: "prologue/choose", step: FIRST, answer: "nonsense" }, "not-legal");
    game.expectRejected({ type: "prologue/choose", step: "nowhere", answer: "begin" }, "not-legal");
    playOut(game);
    expect(game.state.prologue.open).toBe(false);
    expect(game.expectRejected({ type: "prologue/choose", step: FIRST, answer: "begin" }, "not-legal").code).toBe("not-legal");
  });

  test("[R-PROLOGUE-003] given 300 random prologues, when every answer of every step is tried, then each is accepted exactly when its requires hold, and every answer with requires is seen both ways", () => {
    const allowedSeen = new Set<string>();
    const refusedSeen = new Set<string>();
    for (let run = 0; run < 300; run += 1) {
      const game = newGame(`requires-${String(run)}`);
      const choice = spread(run);
      for (let index = 0; game.state.prologue.open; index += 1) {
        const step = withPrologue.prologue[stepOf(game)]!;
        const read = { state: game.state, world: game.world(), content: withPrologue };
        const shown = game.view().prologue!.answers;
        expect(shown.map((answer) => answer.id)).toEqual(step.answers.map((answer) => answer.id));
        const allowed: string[] = [];
        for (const answer of step.answers) {
          const holds = allMet(read, answer.requires);
          expect(shown.find((given) => given.id === answer.id)?.allowed).toBe(holds);
          const at = `${step.id}.${answer.id}`;
          if (holds) {
            allowed.push(answer.id);
            if (answer.requires.length > 0) allowedSeen.add(at);
          } else {
            game.expectRejected({ type: "prologue/choose", step: step.id, answer: answer.id }, "not-legal");
            refusedSeen.add(at);
          }
        }
        choose(game, allowed[choice(index, allowed.length)]!);
      }
    }
    // The age step's requires are bounds on the start (18 to 29) that no path reaches, so its answers are only ever allowed (R-PROLOGUE-004).
    const withRequires = Object.values(withPrologue.prologue)
      .filter((step) => step.id !== "age")
      .flatMap((step) => step.answers.filter((answer) => answer.requires.length > 0).map((answer) => `${step.id}.${answer.id}`));
    expect(withRequires.length).toBeGreaterThanOrEqual(10);
    expect(withRequires.filter((at) => !allowedSeen.has(at))).toEqual([]);
    expect(withRequires.filter((at) => !refusedSeen.has(at))).toEqual([]);
  });

  test("[R-PROLOGUE-003] given the shop job after school, when it is chosen, then its cash arrives as gig money in the cash pocket", () => {
    const game = newGame("shop");
    choose(game, "begin");
    pick(game, "commercial");
    choose(game, "work");
    expect(game.state.wallet.pockets.NGN).toEqual({ bank: 0, cash: 30000000, locked: 0 });
    expect(game.state.wallet.totals.in.gig?.NGN).toBe(30000000);
    expect(quality(game, "quality.edu-level")).toBe(1);
    expect(game.state.prologue.step).toBe("shop");
  });

  test("[R-PROLOGUE-003] given a family with means of 60 or more, when the private university is chosen, then the family's money passes through as a flagged gift, with a grade base of 1", () => {
    const game = seedWhere("private", toCourse, (played) => played.state.prologue.step === "course" && quality(played, "quality.family-means") >= 60);
    pick(game, "computer-science");
    choose(game, "private");
    expect(game.state.prologue.gradeBase).toBe(1);
    expect(game.state.wallet.totals.in.gift?.NGN).toBe(250000000);
    expect(game.state.wallet.totals.out["fee-school"]?.NGN).toBe(250000000);
    expect(game.state.wallet.pockets.NGN.bank).toBe(0);
  });

  test("[R-PROLOGUE-003] given the exam, when it is answered, then its draw is made on stream prologue, shown on the next card, and decides the next step", () => {
    const steps = new Set<string>();
    for (let run = 0; run < 40; run += 1) {
      const game = newGame(`exam-${String(run)}`);
      choose(game, "begin");
      pick(game, "arts");
      choose(game, "jamb");
      const before = game.state.draws.prologue ?? 0;
      choose(game, "expo");
      expect(game.state.draws.prologue).toBe(before + 1);
      const outcome = game.state.prologue.lastOutcome;
      expect(outcome).not.toBeNull();
      expect(text[outcome!]).toBeTruthy();
      expect(game.view().prologue?.lastOutcome).toBe(outcome);
      expect(game.state.prologue.flags).toContain("cut-corner");
      const step = game.state.prologue.step!;
      steps.add(step);
      expect(outcome!.includes(".outcome.pass")).toBe(step === "course");
    }
    expect([...steps].sort()).toEqual(["course", "retake"]);
  });

  test("[R-PROLOGUE-003] given the school certificate fee, when a family under 30 answers after school, then standing falls by 2, and not for a family of 30", () => {
    const poor = seedWhere("waec-poor", (game) => {
      choose(game, "begin");
      pick(game, "science");
    }, (game) => quality(game, "quality.family-means") < 30);
    const before = quality(poor, "quality.standing");
    choose(poor, "jamb");
    expect(quality(poor, "quality.standing")).toBe(before - 2);
    const comfortable = seedWhere("waec-ok", (game) => {
      choose(game, "begin");
      pick(game, "science");
    }, (game) => quality(game, "quality.family-means") >= 30);
    const steady = quality(comfortable, "quality.standing");
    choose(comfortable, "jamb");
    expect(quality(comfortable, "quality.standing")).toBe(steady);
  });
});

describe("the grade", () => {
  test("[R-PROLOGUE-003] given the grade draw, when it is worked out at its edges, then it is 2 plus the base, up 1 or down 1, and kept between 2 and 5", () => {
    expect(content.tuning.prologue.grade.base).toBe(2);
    expect(gradeOf(0, false, false, content.tuning.prologue)).toBe(2);
    expect(gradeOf(0, true, false, content.tuning.prologue)).toBe(3);
    // Down from the floor stays at the floor.
    expect(gradeOf(0, false, true, content.tuning.prologue)).toBe(2);
    expect(gradeOf(1, false, true, content.tuning.prologue)).toBe(2);
    expect(gradeOf(2, true, false, content.tuning.prologue)).toBe(5);
    // Up from the top stays at the top.
    expect(gradeOf(3, true, false, content.tuning.prologue)).toBe(5);
    expect(gradeOf(3, false, false, content.tuning.prologue)).toBe(5);
    expect(gradeOf(3, true, true, content.tuning.prologue)).toBe(5);
  });

  test("[R-PROLOGUE-003] given 60 degrees, when the results are out, then edu-level is 3 and the grade is the base plus at most one, both ways seen", () => {
    const grades = new Set<number>();
    for (let run = 0; run < 60; run += 1) {
      const game = newGame(`grade-${String(run)}`);
      toCourse(game);
      if (stepOf(game) !== "course") continue;
      while (stepOf(game) !== "graduation") playStep(game);
      const base = game.state.prologue.gradeBase;
      const result = choose(game, game.view().prologue!.answers.find((answer) => answer.allowed)!.id);
      const grade = quality(game, "quality.edu-grade");
      expect(quality(game, "quality.edu-level")).toBe(3);
      expect(grade).toBeGreaterThanOrEqual(Math.min(2 + base, 5));
      expect(grade).toBeLessThanOrEqual(Math.min(3 + base, 5));
      expect(result.events).toContainEqual({ type: "prologue/graded", grade });
      grades.add(grade - base);
    }
    expect([...grades].sort()).toEqual([2, 3]);
  });
});

/** Answers the current step with its first allowed answer. */
function playStep(game: Game) {
  const answer = game.view().prologue!.answers.find((given) => given.allowed);
  if (answer === undefined) throw new Error(`No answer is allowed at ${stepOf(game)}.`);
  return choose(game, answer.id);
}

describe("age", () => {
  test("[R-PROLOGUE-004] given the apprenticeship path, when it is played to the end, then the character is about 22 with capital in cash, no degree and a network in the market", () => {
    const game = seedWhere("apprentice", (played) => {
      choose(played, "begin");
      pick(played, "arts");
    }, (played) => played.view().prologue!.answers.find((answer) => answer.id === "apprentice")?.allowed === true);
    choose(game, "apprentice");
    choose(game, "spare-parts");
    choose(game, "stay");
    choose(game, "settle");
    expect(game.state.prologue.step).toBe("friend");
    choose(game, "nowhere");
    // The age step: the age as the path reached it (R-PROLOGUE-004).
    choose(game, "as-is");
    choose(game, "family-house");
    // 192 + 12 + 6 + 72 + 1: six years under the master.
    expect(quality(game, AGE)).toBe(283);
    expect(quality(game, AGE)).toBeGreaterThanOrEqual(264);
    expect(game.state.wallet.pockets.NGN.cash).toBeGreaterThanOrEqual(40000000);
    expect(quality(game, "quality.edu-level")).toBe(1);
    expect(quality(game, "quality.edu-grade")).toBe(0);
    expect(quality(game, "quality.network")).toBeGreaterThanOrEqual(20);
    expect(game.state.prologue.open).toBe(false);
  });

  test("[R-PROLOGUE-004] given the strike draw, when the strike comes, then the side-skill card is reached eight months older than when it does not", () => {
    const ageAtSideSkill = (game: Game): number => {
      pick(game, "computer-science");
      choose(game, "federal");
      choose(game, "wait");
      if (game.state.prologue.step === "strike-drag") choose(game, "back");
      expect(game.state.prologue.step).toBe("side-skill");
      return quality(game, AGE);
    };
    const passedFirstTime = (game: Game) => game.state.prologue.step === "course" && game.state.prologue.choices["retake"] === undefined;
    const struck = seedWhere("strike", toCourse, (game) => {
      if (!passedFirstTime(game)) return false;
      ageAtSideSkill(game);
      return game.state.prologue.choices["strike-drag"] !== undefined;
    });
    const spared = seedWhere("no-strike", toCourse, (game) => {
      if (!passedFirstTime(game)) return false;
      ageAtSideSkill(game);
      return game.state.prologue.choices["strike-drag"] === undefined;
    });
    expect(struck.state.prologue.lastOutcome).toBeNull();
    expect(quality(struck, AGE) - quality(spared, AGE)).toBe(8);
    expect(withPrologue.prologue["strike-drag"]?.months).toBe(8);
  });

  test("[R-PROLOGUE-004] given 200 random prologues, when each closes, then age is between 216 and 336 months, the age step counted", () => {
    for (let run = 0; run < 200; run += 1) {
      const game = newGame(`ages-${String(run)}`);
      playOut(game, spread(run));
      expect(quality(game, AGE)).toBeGreaterThanOrEqual(216);
      expect(quality(game, AGE)).toBeLessThanOrEqual(336);
    }
  });
});

function isHeadline(event: BaseEvent): event is Extract<PrologueEvent, { type: "prologue/headline" }> {
  return event.type === "prologue/headline";
}

describe("headlines and the friend", () => {
  const eraStories = Object.values(withPrologue.era).map((era) => era.story);

  test("[R-PROLOGUE-005] given the stand-in world, which has no story before tick 0, when a prologue is played, then two headlines pass, the era pool's first two, and they change nothing", () => {
    const game = newGame("headlines");
    const headlines: string[] = [];
    let state = game.state;
    while (game.state.prologue.open) {
      const result = playStep(game);
      for (const event of result.events) {
        if (!isHeadline(event)) continue;
        headlines.push(event.story);
        // Flavour only: the slice and every other part of the state are as they were.
        expect(applyEvent(state, event, withPrologue)).toEqual(state);
      }
      state = game.state;
      const lines = result.lines.filter((line) => line.key === "line.prologue.headline");
      expect(lines.length).toBe(result.events.filter((event) => event.type === "prologue/headline").length);
    }
    expect(game.world().news.filter((story) => story.since < 0)).toEqual([]);
    expect(headlines).toEqual(eraStories.slice(0, 2));
  });

  test("[R-PROLOGUE-005] given a world with stories announced before tick 0, when a prologue is played, then its headlines are those stories", () => {
    const worldAt = (tick: number): World => {
      const world = standInWorld("world-1", tick, withPrologue);
      return {
        ...world,
        news: [
          { id: "news.naira-float", stage: "in-force", since: -30 },
          { id: "news.uk-refusals-up", stage: "rumour", since: -20 },
          { id: "news.dollar-scarcity", stage: "announced", since: -10 },
          ...world.news,
        ],
      };
    };
    const game = newGame("old-news", AGE_KINDS, worldAt);
    const headlines: string[] = [];
    while (game.state.prologue.open) {
      for (const line of playStep(game).lines) {
        const story = line.params.story;
        if (line.key === "line.prologue.headline" && typeof story === "string") headlines.push(story);
      }
    }
    // A rumour is not yet a headline.
    expect(headlines).toEqual(["news.naira-float", "news.dollar-scarcity"]);
  });

  test("[R-PROLOGUE-005] given the send-off at step 10, when the player listens to the UK crowd after a degree, then the master's route is heard through a friend", () => {
    const game = seedWhere("friend", toCourse, (played) => played.state.prologue.step === "course");
    while (game.state.prologue.step !== "friend") playStep(game);
    expect(game.state.route["route.uk-masters"]?.state).toBe("unknown");
    const result = choose(game, "uk");
    expect(game.state.route["route.uk-masters"]?.state).toBe("heard");
    expect(result.events).toContainEqual(expect.objectContaining({ type: "route/moved", route: "route.uk-masters", to: "heard" }));
    // No chance was drawn for it: the offer stream is untouched.
    expect(game.state.draws.offer).toBeUndefined();
  });
});

/** What is wrong with a closed prologue as a starting life, by R-SCENARIO-001 to 003 and R-PROLOGUE-006. Empty when nothing is. */
function startProblems(game: Game, label: string): string[] {
  const { state } = game;
  const problems: string[] = [];
  const say = (wrong: boolean, what: string) => {
    if (wrong) problems.push(`${label}: ${what}`);
  };
  say(state.prologue.open || state.prologue.step !== null, "the prologue is still open");
  problems.push(...checkInvariants(state, withPrologue).map((broken) => `${label}: ${broken}`));
  // R-SCENARIO-002: nothing open, and the routes unknown but for one heard at the send-off.
  say(Object.keys(state.offer.items).length > 0, "an offer is open");
  say(state.setpiece.open !== null, "a set piece is open");
  for (const [id, route] of Object.entries(state.route)) say(route.state !== "unknown" && route.state !== "heard", `${id} is ${route.state}`);
  // R-PROLOGUE-006: the upkeep the last answer chose is the only obligation.
  const home = withPrologue.prologue["home"]?.answers.find((answer) => answer.id === state.prologue.choices["home"]);
  const upkeep = home?.effects.find((effect) => effect.type === "obligation/open");
  const wanted = upkeep?.type === "obligation/open" && typeof upkeep.amount === "number" ? upkeep.amount : null;
  const owed = Object.values(state.obligation.items).map((item) => `${item.entry} ${String(item.amount)}`);
  say(owed.join(",") !== `obligation.upkeep ${String(wanted)}`, `owes ${owed.join(", ")}`);
  say(state.turn.banked !== withPrologue.tuning.turn.start, `the bank holds ${String(state.turn.banked)} turns`);
  say(state.turn.month !== 0, "a month has passed");
  const view = game.view();
  say(view.prologue !== null, "the view still shows the prologue");
  say(hiddenPaths(view).length > 0, "the view shows a hidden field");
  // R-SCENARIO-003: a turn ends at once with every slot resting.
  const ended = game.send({ type: "turn/end", slots: [] });
  say(!ended.ok, "the first turn cannot be ended resting");
  problems.push(...checkInvariants(game.state, withPrologue).map((broken) => `${label}, a month on: ${broken}`));
  return problems;
}

describe("the close", () => {
  test("[R-PROLOGUE-006] [R-SCENARIO-001] [R-SCENARIO-002] [R-SCENARIO-003] given 200 random prologues, when each is played from the legal list to its end, then each is a legal starting life", () => {
    const closes = new Set<string>();
    const problems: string[] = [];
    for (let run = 0; run < 200; run += 1) {
      let last: string[] = [];
      const game = newGame(`legal-${String(run)}`);
      const choice = spread(run);
      for (let index = 0; game.state.prologue.open; index += 1) {
        const legal = legalCommands(game.view());
        expect(legal.every((command) => command.type === "prologue/choose")).toBe(true);
        const command = legal[choice(index, legal.length)];
        if (command === undefined) throw new Error("Nothing legal while the prologue is open.");
        last = game.accept(command).events.map((event) => event.type);
      }
      closes.add(game.state.prologue.choices["home"] ?? "");
      problems.push(...startProblems(game, `run ${String(run)}`));
      expect(last.at(-2)).toBe("prologue/closed");
    }
    expect(problems).toEqual([]);
    expect([...closes].sort()).toEqual(["family-house", "room"]);
  });

  test("[R-PROLOGUE-006] given 200 random prologues on the quality kind as it stands, when each closes, then each is still a legal starting life", () => {
    const problems: string[] = [];
    for (let run = 0; run < 200; run += 1) {
      const game = newGame(`legal-real-${String(run)}`, registry());
      playOut(game, spread(run));
      problems.push(...startProblems(game, `run ${String(run)}`));
    }
    expect(problems).toEqual([]);
  });

  test("[R-PROLOGUE-006] given the authority grants turns during the prologue, when it closes, then the bank is at the start", () => {
    const game = newGame("bank");
    game.grant(3);
    choose(game, "begin");
    game.grant(5);
    playOut(game);
    expect(game.state.turn.banked).toBe(withPrologue.tuning.turn.start);
  });
});

describe("the fixed lives", () => {
  const fixed = (Object.keys(content.scenario) as Id<"scenario">[]).filter((id) => id !== PROLOGUE);

  test.each(fixed)("[R-PROLOGUE-007] given %s, when a new state is built, then the prologue is closed with no steps recorded and cannot be answered", (life) => {
    const game = start({ scenario: life, content });
    expect(game.state.prologue).toEqual({ open: false, step: null, draw: null, choices: {}, lastOutcome: null, flags: [], gradeBase: 0 });
    expect(game.view().prologue).toBeNull();
    game.expectRejected({ type: "prologue/choose", step: FIRST, answer: "begin" }, "not-legal");
    expect(legalCommands(game.view()).some((command) => command.type === "prologue/choose")).toBe(false);
    game.endTurn();
  });
});

describe("the view", () => {
  test("[R-PROLOGUE-008] given a new prologue, when it is viewed, then it shows the opening card with no draw, as nothing is drawn yet", () => {
    const game = newGame("view");
    const view = game.view();
    expect(view.prologue).toEqual({ step: FIRST, answers: [{ id: "begin", allowed: true }], lastOutcome: null, draw: null });
    expect(hiddenPaths(view)).toEqual([]);
  });

  test("[R-PROLOGUE-008] given the draw and some answers, when viewed, then the card, its answers, the draw and the life so far show as they stand", () => {
    const game = newGame("view-later");
    choose(game, "begin");
    pick(game, "commercial");
    choose(game, "work");
    const view = game.view();
    expect(view.prologue?.step).toBe("shop");
    expect(view.prologue?.draw).toEqual(game.state.prologue.draw);
    expect(view.prologue?.answers.map((answer) => answer.id)).toEqual(["stay", "save"]);
    expect(view.qualities.find((held) => held.id === "quality.edu-level")?.value).toBe(1);
    expect(view.pockets.NGN.cash).toBe(30000000);
    expect(text[`prologue.${view.prologue!.step}.card`]).toBeTruthy();
    expect(hiddenPaths(view)).toEqual([]);
  });
});

describe("the prologue's fees", () => {
  test("[R-PROLOGUE-003] [R-ENGINE-017] given the private university, when its answer is read, then the session passed through the account is the tuning's figure", () => {
    const answer = content.prologue.university?.answers.find((candidate) => candidate.id === "private");
    const session = content.tuning.prologue.privateSession;
    expect(answer?.effects).toEqual(
      expect.arrayContaining([
        { type: "money/add", currency: "NGN", pocket: "bank", amount: session, reason: "gift", flagged: true },
        { type: "money/take", currency: "NGN", pocket: "bank", amount: session, reason: "fee-school" },
      ]),
    );
  });
});
