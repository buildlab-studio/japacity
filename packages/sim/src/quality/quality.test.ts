import { content } from "@japacity/content";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { check } from "../engine/check";
import { checkInvariants } from "../engine/invariants";
import type { Registry } from "../engine/kind";
import { stepWith } from "../engine/step";
import type { Accepted, Content, Effect, Id, ReadCtx, State } from "../engine/types";
import { registry } from "../kinds";
import { miniContent } from "../testing/miniContent";
import { start } from "../testing/play";
import type { Game } from "../testing/play";
import type { QualityEvent } from "./quality.events";
import { qualityKind } from "./quality.logic";
import { UK_ROUTE } from "../testing/ids";

const tuning = content.tuning.quality;

/**
 * A registry where `offer/choose` carries out the given effects, so a test can
 * reach `quality/add` through the engine's own routing. It takes the place of
 * the offer kind's own `offer/choose`.
 */
function withEffects(effects: Effect[], source: string): Registry {
  return registry().map((kind) =>
    kind.kind !== "offer"
      ? kind
      : { ...kind, commands: { "offer/choose": (ctx) => ctx.apply(effects, { source, param: null, terms: {} }) } },
  );
}

/** Carries out effects on a game as one accepted command, and moves the game on. */
function applyEffects(game: Game, effects: Effect[], source = "offer.test.yes"): Accepted {
  const result = stepWith(
    withEffects(effects, source),
    game.state,
    { type: "offer/choose", offer: "x", choice: "y", basedOn: game.state.v },
    game.world(),
    game.content,
  );
  if (!result.ok) throw new Error(result.detail);
  game.state = result.state;
  return result;
}

function add(quality: Id<"quality">, amount: number): Effect {
  return { type: "quality/add", quality, amount };
}

function read(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

function changes(result: Accepted): QualityEvent[] {
  return result.events.filter((event): event is QualityEvent => event.type === "quality/changed");
}

/** Ada has no job, so she has three free slots. Hunting a job changes no quality. */
function ada(): Game {
  return start({ content, scenario: "scenario.ada" });
}

const huntTeacher = { activity: "activity.job-hunt" as const, param: "activity.job-teacher" };

/**
 * R-ACTIVITY-015: the hunt changes no quality and is an act done at once that fills no slot. A month with no
 * wellbeing activity is three empty slots, which rest; under this content
 * the rest is worth nothing.
 */
const restless: Content = { ...content, tuning: { ...content.tuning, quality: { ...tuning, wellbeingRest: 0 } } };

function adaRestless(): Game {
  return start({ content: restless, scenario: "scenario.ada" });
}

describe("ranges", () => {
  test("[R-QUALITY-001] given a quality near the top, when a gain would pass the top, then it stops at the top", () => {
    const game = ada();
    const entry = content.quality["quality.network"]!;
    const before = game.state.quality["quality.network"]!;
    const result = applyEffects(game, [add("quality.network", entry.max + 50)]);
    expect(game.state.quality["quality.network"]).toBe(entry.max);
    expect(changes(result)).toEqual([
      { type: "quality/changed", quality: "quality.network", amount: entry.max - before, source: "offer.test.yes" },
    ]);
  });

  test("[R-QUALITY-001] given a quality near the bottom, when a loss would pass the bottom, then it stops at the bottom", () => {
    const game = ada();
    const entry = content.quality["quality.wellbeing"]!;
    const before = game.state.quality["quality.wellbeing"]!;
    const result = applyEffects(game, [add("quality.wellbeing", -(before + 30))]);
    expect(game.state.quality["quality.wellbeing"]).toBe(entry.min);
    expect(changes(result)).toEqual([
      { type: "quality/changed", quality: "quality.wellbeing", amount: entry.min - before, source: "offer.test.yes" },
    ]);
  });

  test("[R-QUALITY-001] given a quality with a small range, when it is pushed past both ends, then it stops at each end", () => {
    const game = ada();
    const entry = content.quality["quality.edu-grade"]!;
    applyEffects(game, [add("quality.edu-grade", 9)]);
    expect(game.state.quality["quality.edu-grade"]).toBe(entry.max);
    applyEffects(game, [add("quality.edu-grade", -9)]);
    expect(game.state.quality["quality.edu-grade"]).toBe(entry.min);
  });

  const changeable = Object.keys(content.quality).filter((id) => id !== "quality.age-months") as Id<"quality">[];

  test.prop([fc.array(fc.record({ quality: fc.constantFrom(...changeable), amount: fc.integer({ min: -300, max: 300 }) }), { maxLength: 40 })], {
    numRuns: 50,
  })(
    "[R-QUALITY-001] [R-QUALITY-002] given any sequence of quality/add effects, when carried out, then every quality stays in range and the events add up to the change",
    (adds) => {
      const game = ada();
      const before = { ...game.state.quality };
      const result = applyEffects(game, adds.map((item) => add(item.quality, item.amount)));
      for (const entry of Object.values(content.quality)) {
        const value = game.state.quality[entry.id]!;
        expect(value).toBeGreaterThanOrEqual(entry.min);
        expect(value).toBeLessThanOrEqual(entry.max);
        const applied = changes(result)
          .filter((event) => event.quality === entry.id)
          .reduce((sum, event) => sum + event.amount, 0);
        expect(applied).toBe(value - before[entry.id]!);
      }
      expect(checkInvariants(game.state, content)).toEqual([]);
    },
  );
});

describe("changes are events", () => {
  test("[R-QUALITY-002] given a gain, when it is carried out, then one event names the quality, the amount applied and the source", () => {
    const game = ada();
    const result = applyEffects(game, [add("quality.tech", 4)], "offer.recruiter-message.do-it");
    expect(changes(result)).toEqual([{ type: "quality/changed", quality: "quality.tech", amount: 4, source: "offer.recruiter-message.do-it" }]);
  });

  test("[R-QUALITY-002] given a change of zero, when it is carried out, then no event is recorded", () => {
    const game = ada();
    expect(changes(applyEffects(game, [add("quality.tech", 0)]))).toEqual([]);
  });

  test("[R-QUALITY-002] given a quality at the top, when a gain is carried out, then nothing applies and no event is recorded", () => {
    const game = ada();
    applyEffects(game, [add("quality.standing", 500)]);
    const result = applyEffects(game, [add("quality.standing", 3)]);
    expect(changes(result)).toEqual([]);
    expect(game.state.quality["quality.standing"]).toBe(content.quality["quality.standing"]!.max);
  });
});

describe("age", () => {
  test("[R-QUALITY-003] given a character, when three months are played, then age goes up by exactly three", () => {
    const game = ada();
    const before = game.state.quality["quality.age-months"]!;
    game.endTurn();
    game.endTurn([huntTeacher]);
    game.endTurn([]);
    expect(game.state.quality["quality.age-months"]).toBe(before + 3);
  });

  test("[R-QUALITY-003] given an effect that adds to age, when it is carried out, then age does not change", () => {
    const game = ada();
    const before = game.state.quality["quality.age-months"]!;
    const result = applyEffects(game, [add("quality.age-months", 12), add("quality.age-months", -12)]);
    expect(changes(result)).toEqual([]);
    expect(game.state.quality["quality.age-months"]).toBe(before);
  });

  test("[R-QUALITY-003] given a turn, when it resolves, then age moves in the month phase with the same event shape as any change", () => {
    const game = ada();
    const result = game.endTurn([huntTeacher, huntTeacher, huntTeacher]);
    expect(changes(result)).toContainEqual({ type: "quality/changed", quality: "quality.age-months", amount: 1, source: "month" });
  });
});

describe("wellbeing drift", () => {
  const to = tuning.wellbeingDriftTo;
  const step = tuning.wellbeingDrift;
  const cases: [string, number, number][] = [
    ["far below", to - 20, to - 20 + step],
    ["one step below", to - step, to],
    ["less than a step below", to - 1, to],
    ["at the target", to, to],
    ["less than a step above", to + 1, to],
    ["one step above", to + step, to],
    ["far above", to + 20, to + 20 - step],
  ];

  test.each(cases)("[R-QUALITY-004] given wellbeing %s the target, when a month passes with no wellbeing activity, then it moves toward the target and stops there", (_name, start, after) => {
    const game = adaRestless();
    applyEffects(game, [add("quality.wellbeing", start - game.state.quality["quality.wellbeing"]!)]);
    expect(game.state.quality["quality.wellbeing"]).toBe(start);
    const result = game.endTurn();
    expect(game.state.quality["quality.wellbeing"]).toBe(after);
    const drift = changes(result).filter((event) => event.quality === "quality.wellbeing");
    expect(drift).toEqual(after === start ? [] : [{ type: "quality/changed", quality: "quality.wellbeing", amount: after - start, source: "month" }]);
  });

  test("[R-QUALITY-004] given the content, when the drift is read, then it is 2 toward 60", () => {
    expect([to, step]).toEqual([60, 2]);
  });
});

describe("the soft cap on skills", () => {
  function setTech(game: Game, value: number) {
    applyEffects(game, [add("quality.tech", value - game.state.quality["quality.tech"]!)]);
    expect(game.state.quality["quality.tech"]).toBe(value);
  }

  test("[R-QUALITY-005] given a skill one under the soft cap, when it gains, then the gain is whole", () => {
    const game = ada();
    setTech(game, tuning.skillSoftAt - 1);
    applyEffects(game, [add("quality.tech", 4)]);
    expect(game.state.quality["quality.tech"]).toBe(tuning.skillSoftAt + 3);
  });

  test("[R-QUALITY-005] given a skill exactly at the soft cap, when it gains 4, then it gains 2", () => {
    const game = ada();
    setTech(game, tuning.skillSoftAt);
    const result = applyEffects(game, [add("quality.tech", 4)]);
    expect(game.state.quality["quality.tech"]).toBe(tuning.skillSoftAt + 2);
    expect(changes(result)).toEqual([{ type: "quality/changed", quality: "quality.tech", amount: 2, source: "offer.test.yes" }]);
  });

  test("[R-QUALITY-005] given a skill above the soft cap, when it gains an odd amount, then the half is rounded up", () => {
    const game = ada();
    setTech(game, tuning.skillSoftAt + 5);
    applyEffects(game, [add("quality.tech", 3)]);
    expect(game.state.quality["quality.tech"]).toBe(tuning.skillSoftAt + 7);
    applyEffects(game, [add("quality.tech", 1)]);
    expect(game.state.quality["quality.tech"]).toBe(tuning.skillSoftAt + 8);
  });

  test("[R-QUALITY-005] given a skill above the soft cap, when it loses, then the loss is never halved", () => {
    const game = ada();
    setTech(game, tuning.skillSoftAt + 5);
    applyEffects(game, [add("quality.tech", -4)]);
    expect(game.state.quality["quality.tech"]).toBe(tuning.skillSoftAt + 1);
  });

  test("[R-QUALITY-005] given a quality outside the skills group above the soft cap, when it gains, then the gain is whole", () => {
    const game = ada();
    expect(content.quality["quality.network"]!.group).not.toBe("skills");
    applyEffects(game, [add("quality.network", tuning.skillSoftAt + 10 - game.state.quality["quality.network"]!)]);
    applyEffects(game, [add("quality.network", 4)]);
    expect(game.state.quality["quality.network"]).toBe(tuning.skillSoftAt + 14);
  });

  test("[R-QUALITY-005] given a skill near its top above the soft cap, when it gains, then it is halved first and then stops at the top", () => {
    const game = ada();
    setTech(game, 99);
    const result = applyEffects(game, [add("quality.tech", 6)]);
    expect(game.state.quality["quality.tech"]).toBe(100);
    expect(changes(result)).toEqual([{ type: "quality/changed", quality: "quality.tech", amount: 1, source: "offer.test.yes" }]);
  });

  test("[R-QUALITY-005] given the content, when the soft cap is read, then it is 70", () => {
    expect(tuning.skillSoftAt).toBe(70);
  });
});

describe("report lines", () => {
  test("[R-QUALITY-006] given a gain to a quality that counts toward a route, when it is reported, then the line carries the route", () => {
    const game = ada();
    const result = applyEffects(game, [add("quality.english", 6)]);
    expect(content.quality["quality.english"]!.counts).toEqual([UK_ROUTE]);
    expect(result.lines).toEqual([
      {
        key: "line.quality.gain",
        params: { quality: "quality.english", points: 6, value: game.state.quality["quality.english"]!, source: "offer.test.yes" },
        tone: "good",
        attention: false,
        counts: [UK_ROUTE],
      },
    ]);
  });

  test("[R-QUALITY-006] given a gain to a quality that counts toward nothing, when it is reported, then the line carries no route", () => {
    const game = ada();
    const result = applyEffects(game, [add("quality.tech", 2)]);
    expect(result.lines).toMatchObject([{ key: "line.quality.gain", tone: "good", counts: [] }]);
  });

  test("[R-QUALITY-006] given a loss to a quality that counts toward a route, when it is reported, then the line is bad and carries no route", () => {
    const game = ada();
    const result = applyEffects(game, [add("quality.english", -6)]);
    expect(result.lines).toEqual([
      {
        key: "line.quality.loss",
        params: { quality: "quality.english", points: 6, value: game.state.quality["quality.english"]!, source: "offer.test.yes" },
        tone: "bad",
        attention: false,
        counts: [],
      },
    ]);
  });

  test("[R-QUALITY-006] given standing and wellbeing changes, when they are reported, then each has a line", () => {
    const game = ada();
    const result = applyEffects(game, [add("quality.standing", -4), add("quality.wellbeing", 3)]);
    expect(result.lines.map((line) => [line.key, line.params.quality, line.tone])).toEqual([
      ["line.quality.loss", "quality.standing", "bad"],
      ["line.quality.gain", "quality.wellbeing", "good"],
    ]);
  });

  test("[R-QUALITY-006] given a job's monthly loss, when it is reported, then it is one quiet line", () => {
    const game = start({ content, scenario: "scenario.tunde" });
    const result = game.endTurn([]);
    const worn = result.lines.filter((line) => line.key === "line.quality.worn");
    expect(worn).toEqual([
      { key: "line.quality.worn", params: { quality: "quality.wellbeing", points: 5, value: expect.any(Number) as number, source: game.state.activity.job }, tone: "plain", attention: false, counts: [] },
    ]);
  });

  test("[R-QUALITY-006] [R-QUALITY-004] given a quality that counts toward a route, when the month phase raises it, then the drift line carries the route", () => {
    const wellbeing = content.quality["quality.wellbeing"]!;
    const counted: Content = { ...restless, quality: { ...content.quality, [wellbeing.id]: { ...wellbeing, counts: [UK_ROUTE] } } };
    const game = start({ content: counted, scenario: "scenario.ada" });
    applyEffects(game, [add("quality.wellbeing", tuning.wellbeingDriftTo - 10 - game.state.quality["quality.wellbeing"]!)]);
    const result = game.endTurn();
    const drift = result.lines.filter((line) => line.key === "line.quality.drift");
    expect(drift).toEqual([
      { key: "line.quality.drift", params: { quality: "quality.wellbeing", points: tuning.wellbeingDrift, value: tuning.wellbeingDriftTo - 10 + tuning.wellbeingDrift, source: "month" }, tone: "plain", attention: false, counts: [UK_ROUTE] },
    ]);
  });

  test("[R-QUALITY-003] [R-QUALITY-004] given a month, when it is reported, then age has no line and the drift is a plain line", () => {
    const game = adaRestless();
    const result = game.endTurn();
    const quality = result.lines.filter((line) => line.key.startsWith("line.quality."));
    expect(quality).toEqual([
      { key: "line.quality.drift", params: { quality: "quality.wellbeing", points: 2, value: 68, source: "month" }, tone: "plain", attention: false, counts: [] },
    ]);
  });

  test("[R-TEXT-005] [R-QUALITY-002] given a month at the meetup, when its moves are reported, then each line carries the act that caused it, so the words can say what the act did", () => {
    const game = start({ content, scenario: "scenario.zainab" });
    const result = game.endTurn([{ activity: "activity.meetup", param: null }]);
    const moves = result.lines.filter((line) => line.key.startsWith("line.quality.") && line.params.source === "activity.meetup");
    expect(moves.map((line) => line.params.quality).sort()).toEqual(["quality.network", "quality.wellbeing"]);
    // Every move names its cause: an act, an answer or the month.
    expect(result.lines.filter((line) => ["line.quality.gain", "line.quality.loss", "line.quality.worn", "line.quality.drift"].includes(line.key)).every((line) => typeof line.params.source === "string")).toBe(true);
  });

  test("[R-QUALITY-002] given a hidden quality, when it changes, then the event is recorded and no line shows it", () => {
    const game = start({ content: miniContent, scenario: "scenario.plain" });
    const result = applyEffects(game, [add("quality.hidden", 2)]);
    expect(changes(result)).toHaveLength(1);
    expect(result.lines).toEqual([]);
  });
});

describe("requirements", () => {
  test("[R-QUALITY-001] given a quality, when quality/min is judged, then it is met at the value and above, with have and need", () => {
    const game = ada();
    const tech = game.state.quality["quality.tech"]!;
    expect(check(read(game), { type: "quality/min", quality: "quality.tech", value: tech })).toEqual({ met: true, have: tech, need: tech });
    expect(check(read(game), { type: "quality/min", quality: "quality.tech", value: tech + 1 })).toEqual({ met: false, have: tech, need: tech + 1 });
  });

  test("[R-QUALITY-001] given a quality, when quality/max is judged, then it is met at the value and below, with have and need", () => {
    const game = ada();
    const stake = game.state.quality["quality.family-stake"]!;
    expect(check(read(game), { type: "quality/max", quality: "quality.family-stake", value: stake })).toEqual({ met: true, have: stake, need: stake });
    applyEffects(game, [add("quality.family-stake", 1)]);
    expect(check(read(game), { type: "quality/max", quality: "quality.family-stake", value: 0 })).toEqual({ met: false, have: 1, need: 0 });
  });
});

describe("invariants", () => {
  function broken(change: (state: State) => State, using: Content = content): string[] {
    const game = ada();
    return qualityKind.invariants?.(change(game.state), using) ?? [];
  }

  test("[R-QUALITY-001] given a state from play, when the invariants are checked, then nothing is wrong", () => {
    const game = ada();
    for (let i = 0; i < 6; i += 1) game.endTurn();
    expect(qualityKind.invariants?.(game.state, content)).toEqual([]);
  });

  test("[R-QUALITY-001] given a quality out of range, a missing one or an extra one, when the invariants are checked, then each is named", () => {
    expect(broken((state) => ({ ...state, quality: { ...state.quality, "quality.tech": 101 } }))).toHaveLength(1);
    expect(broken((state) => {
      const quality = { ...state.quality };
      delete quality["quality.tech"];
      return { ...state, quality };
    })).toHaveLength(1);
    expect(broken((state) => ({ ...state, quality: { ...state.quality, "quality.ghost": 1 } }))).toHaveLength(1);
    expect(broken((state) => ({ ...state, quality: { ...state.quality, "quality.tech": Number("1.5") } }))).toHaveLength(1);
  });
});
