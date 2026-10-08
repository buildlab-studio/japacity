// The road: docs/rules/road.md, R-ROAD-001 to 012, played through `step` on
// the real content. Where a test needs one outcome for certain it changes the
// content's rows or the pitch's shares; the whole chain under the real numbers
// is played under fixed seeds, and each seed's path is asserted step by step.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../../engine/check";
import { divFloor } from "../../engine/int";
import { checkInvariants } from "../../engine/invariants";
import type { Content, Id, OfferEntry, OfferState, ReadCtx, Requirement, RequirementResult, RouteEntry, RouteGateState, TermSpec } from "../../engine/types";
import { japacity } from "../../japacity/japacity.logic";
import { abroad } from "../../obligation/obligation.journey";
import { pressureChanceBp } from "../../offer/offer.logic";
import type { QualityEvent } from "../../quality/quality.events";
import { freeSlots } from "../../turn/turn.logic";
import type { Game } from "../../testing/play";
import type { LifeOptions } from "../route.journey";
import { applyEffects, readyLife, slot, UK, UNIT } from "../route.journey";
import { outcomeOf } from "./road";

const ROAD: Id<"route"> = "route.road";
const PARK: Id<"offer"> = "offer.road-park";
const RADIO: Id<"offer"> = "offer.road-radio";
const COUSIN: Id<"offer"> = "offer.road-cousin";
const PITCHES: Id<"offer">[] = [RADIO, PARK, COUSIN];
const RANSOM: Id<"offer"> = "offer.road-ransom-call";
const NIGHT: Id<"setpiece"> = "setpiece.road-night";
const TRUTH: Id<"setpiece"> = "setpiece.road-truth";
const AGENT_DEBT: Id<"obligation"> = "obligation.agent-debt";
const UPKEEP: Id<"obligation"> = "obligation.upkeep";
const ASK_AROUND: Id<"activity"> = "activity.ask-around";
const STANDING: Id<"quality"> = "quality.standing";
const MEANS: Id<"quality"> = "quality.family-means";
const STAKE: Id<"quality"> = "quality.family-stake";
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const AGE: Id<"quality"> = "quality.age-months";

const road: RouteEntry = content.route[ROAD]!;
const chain = road.road!.steps;
const ASSISTED = content.tuning.return.standing.assisted;
/** ₦100,000, the step R-ROAD-005 reads family means in. */
const MEANS_STEP = 100000 * UNIT;
/** Enough naira in cash for any deposit and the same again; the bank below the broke line, so the return earns no capital bonus. */
const CASH = 3000000 * UNIT;

type Road = Extract<RouteGateState, { gate: "road" }>;
type Row = { on: number; held: number; turned: number; lost: number; months?: [number, number] };
type Change = (used: Content) => Content;

const ON: Row = { on: 10000, held: 0, turned: 0, lost: 0 };
const HELD: Row = { on: 0, held: 10000, turned: 0, lost: 0 };
const TURNED: Row = { on: 0, held: 0, turned: 10000, lost: 0 };
const LOST: Row = { on: 0, held: 0, turned: 0, lost: 10000 };

// ---------------------------------------------------------------------------
// Content changes and the life
// ---------------------------------------------------------------------------

/** The road's rows, and where given their months, replaced by step id; steps not named keep the page's. */
function rows(byStep: Record<string, Row>): Change {
  return (used) => {
    const entry = used.route[ROAD]!;
    const steps = entry.road!.steps.map((step) => ({ ...step, ...byStep[step.id] }));
    return { ...used, route: { ...used.route, [ROAD]: { ...entry, road: { steps } } } };
  };
}

/** Every pitch with this fraud share, these kinds and, when given, a fixed deposit. */
function pitches(fraudBp: number, kinds: NonNullable<OfferEntry["kinds"]>, deposit?: TermSpec): Change {
  return (used) => {
    const offer = { ...used.offer };
    for (const id of PITCHES) {
      const entry = used.offer[id]!;
      offer[id] = { ...entry, fraudBp, kinds, terms: deposit === undefined ? entry.terms : { ...entry.terms, deposit } };
    }
    return { ...used, offer };
  };
}

const HONEST_ROAD = pitches(0, { fraud: 0, realish: 0, road: 10000 });
const HONEST_REALISH = pitches(0, { fraud: 0, realish: 10000, road: 0 });
const ALWAYS_FRAUD = pitches(10000, { fraud: 10000, realish: 0, road: 0 });

function all(...changes: Change[]): Change {
  return (used) => changes.reduce((acc, change) => change(acc), used);
}

/** Ada with her papers, ₦3,000,000 in cash and nothing in the naira bank, at home in month 0. */
function life(options: LifeOptions = {}): Game {
  return readyLife(content, { quiet: true, pockets: { NGN: { bank: 0, cash: CASH } }, ...options });
}

function gateOf(game: Game): Road {
  const gate = game.state.route[ROAD]!.gate;
  if (gate?.gate !== "road") throw new Error("The road route has no road gate.");
  return gate;
}

function cash(game: Game): number {
  return game.state.wallet.pockets.NGN.cash;
}

function quality(game: Game, id: Id<"quality">): number {
  return game.state.quality[id] ?? 0;
}

function offerOf(game: Game, entry: Id<"offer">): OfferState | undefined {
  return Object.values(game.state.offer.items).find((item) => item.entry === entry);
}

function owed(game: Game, entry: Id<"obligation">): number | null {
  const item = Object.values(game.state.obligation.items).find((open) => open.entry === entry);
  return item === undefined ? null : item.outstanding;
}

function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

function turn(game: Game) {
  if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
  return game.endTurn();
}

/** Opens a pitch as the motor park would, and returns it. */
function openPitch(game: Game, offer: Id<"offer"> = PARK): OfferState {
  applyEffects(game, [{ type: "offer/open", offer }]);
  const pitch = offerOf(game, offer);
  if (pitch === undefined) throw new Error(`${offer} did not open.`);
  return pitch;
}

/** The pitch opened and taken. Returns the deposit. */
function take(game: Game, offer: Id<"offer"> = PARK): number {
  const pitch = openPitch(game, offer);
  game.accept({ type: "offer/choose", offer: pitch.id, choice: "take" });
  return pitch.terms.deposit as number;
}

function answer(game: Game, question: string, reply: string) {
  return game.accept({ type: "setpiece/answer", question, answer: reply });
}

/** Taken, on the bus, and a month later the truth is asked. Returns the deposit. */
function toTruth(game: Game, offer: Id<"offer"> = PARK): number {
  const deposit = take(game, offer);
  answer(game, "night", "go");
  turn(game);
  expect(game.state.setpiece.open?.entry).toBe(TRUTH);
  return deposit;
}

/** Plays months until the chain ends or the life does. Returns each step the chain stood at, month by month. */
function playOut(game: Game, most = 60): string[] {
  const seen: string[] = [];
  for (let month = 0; month < most && !game.state.turn.ended; month += 1) {
    const step = gateOf(game).step ?? "none";
    seen.push(step);
    if (!chain.some((item) => item.id === step)) break;
    turn(game);
    expect(checkInvariants(game.state, game.content)).toEqual([]);
  }
  return seen;
}

/** The steps visited, each once, in order. */
function path(seen: string[]): string[] {
  return seen.filter((step, index) => step !== seen[index - 1]);
}

// ---------------------------------------------------------------------------
// R-ROAD-001: no checklist, no japacity, no routes-view entry, one switch
// ---------------------------------------------------------------------------

describe("the road is never a route on the board", () => {
  test("[R-ROAD-001] given a character on the road, when the view is read, then the routes view has no road and japacity has no figure from it", () => {
    const game = life({ change: HONEST_ROAD });
    toTruth(game);
    answer(game, "truth", "pay");
    expect(game.state.place.where).toBe("road");
    const view = game.view();
    expect(view.routes.map((route) => route.id)).not.toContain(ROAD);
    expect(view.routes.length).toBe(Object.keys(content.route).length - 1);
    expect(view.japacity.route).not.toBe(ROAD);
  });

  test("[R-ROAD-001] given the road's route forced past its window into applying, when japacity is worked out, then the road still never counts", () => {
    const game = life();
    const held = game.state.route[ROAD]!;
    game.state = { ...game.state, route: { ...game.state.route, [ROAD]: { ...held, state: "applying" } } };
    expect(japacity(readOf(game)).route).not.toBe(ROAD);
    expect(japacity(readOf(game)).percent).toBeNull();
  });

  test("[R-ROAD-001] given the content switch off, when the motor park is asked and the pitches would be certain, then no pitch ever opens", () => {
    const certain: Change = (used) => {
      const offer = { ...used.offer };
      for (const id of PITCHES) offer[id] = { ...used.offer[id]!, chanceBp: 10000 };
      return { ...used, offer, tuning: { ...used.tuning, road: { ...used.tuning.road, enabled: false } } };
    };
    const game = life({ change: certain });
    turn(game);
    game.endTurn([slot(ASK_AROUND)]);
    for (let month = 0; month < 6; month += 1) turn(game);
    for (const id of PITCHES) expect(game.state.offer.timesOpened[id]).toBeUndefined();
  });

  test("[R-ROAD-001] given the switch on and a certain pitch, when the same months pass at home, then the pitch opens: the switch is what stopped it", () => {
    const certain: Change = (used) => ({ ...used, offer: { ...used.offer, [RADIO]: { ...used.offer[RADIO]!, chanceBp: 10000 } } });
    const game = life({ change: certain });
    for (let month = 0; month < 8 && game.state.offer.timesOpened[RADIO] === undefined; month += 1) turn(game);
    expect(game.state.offer.timesOpened[RADIO]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// R-ROAD-002: the pitch and its pressure
// ---------------------------------------------------------------------------

describe("the pitch", () => {
  const radio = content.offer[RADIO]!;
  const pressure = radio.pressure!;
  const judgeOf =
    (game: Game) =>
    (requirement: Requirement): RequirementResult =>
      check(readOf(game), requirement);
  const chanceOf = (game: Game) => pressureChanceBp(readOf(game), radio, judgeOf(game));

  test("[R-ROAD-002] given every pitch, when its name, title, body and choices are read, then nothing says desert, sea, road, boat or danger", () => {
    for (const id of PITCHES) {
      const keys = [`${id}.name`, `${id}.title`, `${id}.body`, ...content.offer[id]!.choices.map((choice) => `${id}.choice.${choice.id}`)];
      for (const key of keys) {
        expect(text[key]).toBeTruthy();
        expect(text[key]?.toLowerCase()).not.toMatch(/desert|\bsea\b|\broad\b|boat|danger/);
      }
    }
  });

  test("[R-ROAD-002] given a character with nothing pressing (standing 60, age under 31, no refusal, no default, no strong route), when the chance is read, then it is the entry's own", () => {
    const game = life({ qualities: { [AGE]: 30 * 12 + 11, [STANDING]: 30 } });
    expect(chanceOf(game)).toBe(radio.chanceBp);
  });

  test("[R-ROAD-002] given standing at 29 and then 30, when the chance is read, then only under 30 adds the low-standing figure", () => {
    expect(chanceOf(life({ qualities: { [STANDING]: 29 } }))).toBe(radio.chanceBp + pressure.lowStandingBp);
    expect(chanceOf(life({ qualities: { [STANDING]: 30 } }))).toBe(radio.chanceBp);
  });

  test("[R-ROAD-002] given an age of 30 years 11 months, 31 years and 35 years, when the chance is read, then each whole year over 30 adds its figure", () => {
    expect(chanceOf(life({ qualities: { [AGE]: 30 * 12 + 11 } }))).toBe(radio.chanceBp);
    expect(chanceOf(life({ qualities: { [AGE]: 31 * 12 } }))).toBe(radio.chanceBp + pressure.perYearOver30Bp);
    expect(chanceOf(life({ qualities: { [AGE]: 35 * 12 } }))).toBe(radio.chanceBp + 5 * pressure.perYearOver30Bp);
  });

  test("[R-ROAD-002] given one and then two earlier refusals, and a loan in default, when the chance is read, then each refusal and the default add theirs", () => {
    const game = life();
    const uk = game.state.route[UK]!;
    game.state = { ...game.state, route: { ...game.state.route, [UK]: { ...uk, refusals: 1 } } };
    expect(chanceOf(game)).toBe(radio.chanceBp + pressure.refusalBp);
    game.state = { ...game.state, route: { ...game.state.route, [UK]: { ...uk, refusals: 2 } } };
    expect(chanceOf(game)).toBe(radio.chanceBp + 2 * pressure.refusalBp);
    applyEffects(game, [{ type: "obligation/open", obligation: "obligation.quick-loan", principal: 100000 * UNIT }]);
    const loan = Object.values(game.state.obligation.items).find((item) => item.entry === "obligation.quick-loan")!;
    game.state = { ...game.state, obligation: { items: { ...game.state.obligation.items, [loan.id]: { ...loan, state: "defaulted" } } } };
    expect(chanceOf(game)).toBe(radio.chanceBp + 2 * pressure.refusalBp + pressure.defaultBp);
  });

  test("[R-ROAD-002] given a known formal route at a figure of 59 and then 60, when the chance is read, then only 60 or more takes the strong-route figure off", () => {
    const at = (weight: number): Change => (used) => {
      const uk = used.route[UK]!;
      const checklist = [
        { id: "met", weight, requirement: { type: "month/min", value: 0 } as Requirement, partial: false },
        { id: "unmet", weight: 100 - weight, requirement: { type: "month/min", value: 9999 } as Requirement, partial: false },
      ];
      return { ...used, route: { ...used.route, [UK]: { ...uk, checklist } } };
    };
    const known = (game: Game): Game => {
      game.state = { ...game.state, route: { ...game.state.route, [UK]: { ...game.state.route[UK]!, state: "known" } } };
      return game;
    };
    const park = content.offer[PARK]!;
    const parkChance = (game: Game) => pressureChanceBp(readOf(game), park, judgeOf(game));
    expect(parkChance(known(life({ change: at(59) })))).toBe(park.chanceBp);
    expect(parkChance(known(life({ change: at(60) })))).toBe(park.chanceBp - pressure.strongRouteBp);
  });

  test("[R-ROAD-002] given a strong route and no pressure on a pitch whose chance is below the figure, when the chance is read, then it stops at 0", () => {
    const game = life();
    game.state = { ...game.state, route: { ...game.state.route, [UK]: { ...game.state.route[UK]!, state: "granted" } } };
    expect(pressureChanceBp(readOf(game), content.offer[COUSIN]!, judgeOf(game))).toBe(0);
  });

  test("[R-ROAD-002] given a curious character at home, when the free slot asks around at the motor park, then the park's pitch is open that same month", () => {
    const game = life();
    const result = game.endTurn([slot(ASK_AROUND)]);
    expect(offerOf(game, PARK)).toBeDefined();
    expect(result.lines.some((line) => line.key === "line.offer.opened" && line.params.offer === PARK)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// R-ROAD-003: taking the pitch
// ---------------------------------------------------------------------------

describe("taking the pitch", () => {
  test("[R-ROAD-003] given an honest pitch, when it is taken, then the deposit leaves cash as fee-agent, one draw on `road` splits it, and the night meeting opens", () => {
    const game = life({ change: HONEST_ROAD });
    const before = cash(game);
    const draws = game.state.draws.road ?? 0;
    const pitch = openPitch(game);
    const result = game.accept({ type: "offer/choose", offer: pitch.id, choice: "take" });
    const deposit = pitch.terms.deposit as number;
    expect(cash(game)).toBe(before - deposit);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "wallet/debited", currency: "NGN", pocket: "cash", amount: deposit, reason: "fee-agent" }));
    expect(game.state.draws.road).toBe(draws + 1);
    expect(game.state.setpiece.open?.entry).toBe(NIGHT);
    expect(game.state.setpiece.open?.route).toBeNull();
    expect(gateOf(game)).toEqual({ gate: "road", step: "night", monthsHere: 0, debt: deposit });
  });

  test("[R-ROAD-003] given the kinds at their ends, when the pitch is taken, then all real-ish keeps a real-ish connection hidden and all road keeps none, and the view shows neither", () => {
    const realish = life({ change: HONEST_REALISH });
    take(realish);
    expect(realish.state.route[ROAD]!.secret.sponsorFraud).toBe(true);
    const roadOnly = life({ change: HONEST_ROAD });
    take(roadOnly);
    expect(roadOnly.state.route[ROAD]!.secret.sponsorFraud).toBe(false);
    expect(JSON.stringify(realish.view())).not.toContain("realish");
    expect(JSON.stringify(realish.view())).not.toContain("secret");
  });

  test("[R-ROAD-003] given a fraud, when it is taken, then the deposit is gone, no draw on `road` is made, nothing opens, and a month later one line says so", () => {
    const game = life({ change: ALWAYS_FRAUD });
    const before = cash(game);
    const draws = game.state.draws.road ?? 0;
    const deposit = take(game);
    expect(cash(game)).toBe(before - deposit);
    expect(game.state.draws.road ?? 0).toBe(draws);
    expect(game.state.setpiece.open).toBeNull();
    expect(game.state.place.where).toBe("home");
    const month = turn(game);
    expect(month.lines.filter((line) => line.key === "line.route.road-fraud")).toHaveLength(1);
    expect(gateOf(game).step).toBe("over");
    expect(game.view().card).toBeNull();
    const after = turn(game);
    expect(after.lines.filter((line) => line.key.startsWith("line.route.road-"))).toEqual([]);
  });

  test("[R-ROAD-003] given a pitch taken with too little cash for the deposit, when it is chosen, then it is refused with cannot-afford and nothing moves", () => {
    const game = life({ change: HONEST_ROAD, pockets: { NGN: { bank: CASH, cash: 0 } } });
    const pitch = openPitch(game);
    game.expectRejected({ type: "offer/choose", offer: pitch.id, choice: "take" }, "cannot-afford");
    expect(gateOf(game).step).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// R-ROAD-004: the night meeting
// ---------------------------------------------------------------------------

describe("the night meeting", () => {
  test("[R-ROAD-004] given the night meeting, when the character turns back, then standing falls 2, the deposit stays gone, the chain closes, and nothing else changes", () => {
    const game = life({ change: HONEST_ROAD });
    take(game);
    const standing = quality(game, STANDING);
    const money = cash(game);
    answer(game, "night", "turn-back");
    expect(quality(game, STANDING)).toBe(standing - 2);
    expect(cash(game)).toBe(money);
    expect(game.state.setpiece.open).toBeNull();
    expect(game.state.place.where).toBe("home");
    expect(gateOf(game).step).toBe("turned-back");
    turn(game);
    expect(gateOf(game).step).toBe("over");
    expect(game.state.setpiece.open).toBeNull();
  });

  test("[R-ROAD-004] given the night meeting, when the character goes, then the turn is not blocked and the truth is asked in the month that follows", () => {
    const game = life({ change: HONEST_ROAD });
    take(game);
    game.expectRejected({ type: "turn/end", slots: [] }, "setpiece-open");
    answer(game, "night", "go");
    expect(gateOf(game).step).toBe("truth");
    expect(game.state.setpiece.open).toBeNull();
    turn(game);
    expect(game.state.setpiece.open?.entry).toBe(TRUTH);
  });

  test("[R-ROAD-004] given every set piece of the chain, when its answers are read, then each keeps one that leaves the road", () => {
    for (const id of [NIGHT, TRUTH]) {
      const answers = content.setpiece[id]!.questions.flatMap((question) => question.answers);
      const leaves = answers.filter((item) =>
        item.effects.some((effect) => effect.type === "route/road-step" && (effect.step === "exit" || effect.step === "turned-back")),
      );
      expect(leaves.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("[R-ROAD-004] given another set piece already open when the pitch is taken, when the months pass, then the night meeting opens once the first is answered", () => {
    const game = life({ change: HONEST_ROAD });
    applyEffects(game, [{ type: "setpiece/open", setpiece: "setpiece.december", route: null }]);
    take(game);
    expect(game.state.setpiece.open?.entry).toBe("setpiece.december");
    for (let guard = 0; guard < 5 && game.state.setpiece.open !== null; guard += 1) {
      const question = game.view().setpiece!.question!;
      // The last allowed answer: a spending answer the pocket cannot cover is not allowed (R-SETPIECE-003).
      answer(game, question.id, question.allowed.at(-1)!);
    }
    turn(game);
    expect(game.state.setpiece.open?.entry).toBe(NIGHT);
  });
});

// ---------------------------------------------------------------------------
// R-ROAD-005: the truth
// ---------------------------------------------------------------------------

describe("the truth", () => {
  test("[R-ROAD-005] given the truth, when the character pays, then the deposit again leaves cash as fee-agent, the character is on the road, the home obligations stop, the job at home ends and there are no free slots", () => {
    const game = life({ change: HONEST_ROAD });
    const deposit = toTruth(game);
    const money = cash(game);
    expect(owed(game, UPKEEP)).not.toBeNull();
    const result = answer(game, "truth", "pay");
    expect(cash(game)).toBe(money - deposit);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "wallet/debited", currency: "NGN", pocket: "cash", amount: deposit, reason: "fee-agent" }));
    expect(game.state.place.where).toBe("road");
    expect(owed(game, UPKEEP)).toBeNull();
    expect(game.state.activity.job).toBeNull();
    expect(gateOf(game)).toEqual({ gate: "road", step: chain[0]!.id, monthsHere: 0, debt: 0 });
    expect(game.view().freeSlots).toBe(0);
    expect(freeSlots(game.state, game.content)).toBe(0);
    game.expectRejected({ type: "turn/end", slots: [slot("activity.rest")] }, "not-legal");
    turn(game);
    expect(game.state.turn.month).toBeGreaterThan(1);
  });

  test("[R-ROAD-005] given a job at home, when the character pays at the truth, then the job ends", () => {
    const working: Change = (used) => ({ ...used, scenario: { ...used.scenario, "scenario.ready": { ...used.scenario["scenario.ready"]!, job: "activity.job-teacher" } } });
    const game = life({ change: all(HONEST_ROAD, working) });
    expect(game.state.activity.job).toBe("activity.job-teacher");
    toTruth(game);
    answer(game, "truth", "pay");
    expect(game.state.activity.job).toBeNull();
  });

  test("[R-ROAD-005] given less cash than they ask, when the character pays, then cash is emptied and the rest opens as the agent's debt in naira", () => {
    const game = life({ change: all(HONEST_ROAD, pitches(0, { fraud: 0, realish: 0, road: 10000 }, 500000 * UNIT)) });
    toTruth(game);
    const short = 200000 * UNIT;
    applyEffects(game, [{ type: "money/take", currency: "NGN", pocket: "cash", amount: cash(game) - short, reason: "mishap" }]);
    answer(game, "truth", "pay");
    expect(cash(game)).toBe(0);
    expect(owed(game, AGENT_DEBT)).toBe(500000 * UNIT - short);
    expect(game.state.place.where).toBe("road");
  });

  test("[R-ROAD-005] given a deposit of ₦150,000, when the family is called, then cash is untouched, family means fall 1, the stake is 1 and standing falls 5", () => {
    const game = life({ change: pitches(0, { fraud: 0, realish: 0, road: 10000 }, 150000 * UNIT) });
    toTruth(game);
    const money = cash(game);
    const means = quality(game, MEANS);
    const standing = quality(game, STANDING);
    answer(game, "truth", "call-home");
    expect(cash(game)).toBe(money);
    expect(quality(game, MEANS)).toBe(means - 1);
    expect(quality(game, STAKE)).toBe(1);
    expect(quality(game, STANDING)).toBe(standing - 5);
    expect(game.state.place.where).toBe("road");
  });

  test("[R-ROAD-005] given a deposit one kobo under ₦100,000 and one of ₦800,000, when the family is called, then means fall 0 and then 8", () => {
    const under = life({ change: pitches(0, { fraud: 0, realish: 0, road: 10000 }, MEANS_STEP - 1) });
    toTruth(under);
    const before = quality(under, MEANS);
    answer(under, "truth", "call-home");
    expect(quality(under, MEANS)).toBe(before);
    const big = life({ change: pitches(0, { fraud: 0, realish: 0, road: 10000 }, 8 * MEANS_STEP) });
    toTruth(big);
    const was = quality(big, MEANS);
    answer(big, "truth", "call-home");
    expect(quality(big, MEANS)).toBe(was - 8);
  });

  test("[R-ROAD-005] given the truth, when the character takes the exit, then standing falls 4, the money is gone, the character is at home and the chain ends", () => {
    const game = life({ change: HONEST_ROAD });
    toTruth(game);
    const money = cash(game);
    const standing = quality(game, STANDING);
    answer(game, "truth", "exit");
    expect(quality(game, STANDING)).toBe(standing - 4);
    expect(cash(game)).toBe(money);
    expect(game.state.place.where).toBe("home");
    expect(game.state.place.returns).toEqual([]);
    expect(gateOf(game).step).toBe("exit");
    expect(owed(game, UPKEEP)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// R-ROAD-006: the chain
// ---------------------------------------------------------------------------

/** Sets out under the page's numbers with the given seed, pays at the truth, and plays the chain to its end. */
function setOut(seed: string): { game: Game; seen: string[] } {
  const game = life({ seed });
  const pitch = openPitch(game);
  if (pitch.secret.fraud) throw new Error(`${seed} draws a fraud.`);
  game.accept({ type: "offer/choose", offer: pitch.id, choice: "take" });
  answer(game, "night", "go");
  turn(game);
  answer(game, "truth", "pay");
  return { game, seen: playOut(game) };
}

describe("the chain under the page's numbers", () => {
  test("[R-ROAD-006] [R-ROAD-009] given seed-6, when the chain is played, then it crosses the desert, the compound, the coast and the sea, one step a month, and arrives", () => {
    const { game, seen } = setOut("seed-6");
    expect(path(seen)).toEqual(["desert", "compound", "coast", "sea", "arrived"]);
    expect(seen.filter((step) => step === "sea")).toHaveLength(1);
    expect(game.state.place).toMatchObject({ where: "abroad", country: "country.italy" });
  });

  test("[R-ROAD-006] given seed-70, when the chain is played, then the compound takes 0 months and is passed by", () => {
    const { seen } = setOut("seed-70");
    expect(path(seen)).toEqual(["desert", "coast", "sea", "arrived"]);
  });

  test("[R-ROAD-006] [R-ROAD-007] given seed-0, when the chain is played, then the desert turns the character back and the exit brings them home", () => {
    const { game, seen } = setOut("seed-0");
    expect(path(seen)).toEqual(["desert", "exit"]);
    expect(game.state.place.where).toBe("home");
  });

  test("[R-ROAD-006] [R-ROAD-008] given seed-50, when the chain is played, then the desert is the ending", () => {
    const { game, seen } = setOut("seed-50");
    expect(path(seen)).toEqual(["desert"]);
    expect(gateOf(game).step).toBe("lost");
    expect(game.state.turn.ended).toBe(true);
  });

  test("[R-ROAD-006] given the desert's 2 to 4 months and every other row at `on`, when many seeds set out, then the desert lasts 2, 3 or 4 months and each length comes up", () => {
    const lengths = new Set<number>();
    for (let index = 0; index < 24; index += 1) {
      const game = life({ seed: `seed-${String(index)}`, change: all(HONEST_ROAD, rows({ desert: ON, compound: ON, coast: ON, sea: ON })) });
      toTruth(game);
      answer(game, "truth", "pay");
      const seen = playOut(game);
      const desert = seen.filter((step) => step === "desert").length;
      expect(desert).toBeGreaterThanOrEqual(chain[0]!.months[0]);
      expect(desert).toBeLessThanOrEqual(chain[0]!.months[1]);
      lengths.add(desert);
    }
    expect([...lengths].sort()).toEqual([2, 3, 4]);
  });

  test("[R-ROAD-006] given the step rows at their ends, when a roll is read, then the last roll under `on` moves on, the first at `on` is held, and the halving gives its half of `held` to `on`", () => {
    const compound = chain.find((step) => step.id === "compound")!;
    expect(outcomeOf(compound, false, 0)).toBe("on");
    expect(outcomeOf(compound, false, compound.on - 1)).toBe("on");
    expect(outcomeOf(compound, false, compound.on)).toBe("held");
    expect(outcomeOf(compound, false, compound.on + compound.held - 1)).toBe("held");
    expect(outcomeOf(compound, false, compound.on + compound.held)).toBe("turned");
    expect(outcomeOf(compound, false, 10000 - compound.lost - 1)).toBe("turned");
    expect(outcomeOf(compound, false, 10000 - compound.lost)).toBe("lost");
    expect(outcomeOf(compound, false, 9999)).toBe("lost");
    const half = divFloor(compound.held, 2);
    expect(outcomeOf(compound, true, compound.on + half - 1)).toBe("on");
    expect(outcomeOf(compound, true, compound.on + half)).toBe("held");
    expect(outcomeOf(compound, true, compound.on + compound.held - 1)).toBe("held");
    expect(outcomeOf(compound, true, compound.on + compound.held)).toBe("turned");
  });

  test("[R-ROAD-006] given a real-ish connection, when it is played under the page's numbers, then it is still the road: the same steps and the same ends", () => {
    const game = life({ seed: "seed-3" });
    const pitch = openPitch(game);
    game.accept({ type: "offer/choose", offer: pitch.id, choice: "take" });
    expect(game.state.route[ROAD]!.secret.sponsorFraud).toBe(true);
    answer(game, "night", "go");
    turn(game);
    answer(game, "truth", "pay");
    expect(path(playOut(game))).toEqual(["desert", "compound", "coast", "sea", "arrived"]);
  });

  test("[R-ROAD-006] given a month on the road, when it resolves, then the chain draws only on `road` and never on `visa` or `school`", () => {
    const game = life({ change: HONEST_ROAD });
    toTruth(game);
    answer(game, "truth", "pay");
    const before = { ...game.state.draws };
    turn(game);
    expect(game.state.draws.visa ?? 0).toBe(before.visa ?? 0);
    expect(game.state.draws.school ?? 0).toBe(before.school ?? 0);
  });
});

describe("held, and the call home", () => {
  /** On the road at the compound, held there: the ransom call is open. */
  function heldAtCompound(): Game {
    const game = life({ change: all(HONEST_ROAD, rows({ desert: ON, compound: { ...HELD, months: [1, 1] } })) });
    toTruth(game);
    answer(game, "truth", "pay");
    for (let month = 0; month < 12 && offerOf(game, RANSOM) === undefined; month += 1) turn(game);
    expect(gateOf(game).step).toBe("compound");
    expect(offerOf(game, RANSOM)).toBeDefined();
    return game;
  }

  test("[R-ROAD-006] given the compound's `held`, when it comes, then the ransom call goes to the family and the agent's debt opens in naira for its sum", () => {
    const game = heldAtCompound();
    const call = offerOf(game, RANSOM)!;
    const sum = call.terms.sum as number;
    expect(owed(game, AGENT_DEBT)).toBe(sum);
    expect(content.obligation[AGENT_DEBT]!.currency).toBe("NGN");
    expect(game.state.turn.report?.lines.some((line) => line.key === "line.route.road-held")).toBe(true);
  });

  test("[R-ROAD-006] given the ransom call, when the family pays, then family means and standing fall and the debt stays what the men say", () => {
    const game = heldAtCompound();
    const call = offerOf(game, RANSOM)!;
    const debt = owed(game, AGENT_DEBT);
    const means = quality(game, MEANS);
    const standing = quality(game, STANDING);
    game.accept({ type: "offer/choose", offer: call.id, choice: "pay" });
    expect(quality(game, MEANS)).toBeLessThan(means);
    expect(quality(game, STANDING)).toBeLessThan(standing);
    expect(owed(game, AGENT_DEBT)).toBe(debt);
  });

  test("[R-ROAD-006] given the ransom call, when nobody can pay, then the sum is added to the debt and wellbeing falls 10", () => {
    const game = heldAtCompound();
    const call = offerOf(game, RANSOM)!;
    const sum = call.terms.sum as number;
    const wellbeing = quality(game, WELLBEING);
    const result = game.accept({ type: "offer/choose", offer: call.id, choice: "cannot" });
    expect(owed(game, AGENT_DEBT)).toBe(2 * sum);
    expect(quality(game, WELLBEING)).toBe(wellbeing - 10);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "obligation/grown", amount: sum }));
  });

  test("[R-ROAD-006] given a held month, when the next month comes, then the outcome is drawn again at once, and each held month brings another call", () => {
    const game = life({ change: all(HONEST_ROAD, rows({ desert: HELD })) });
    toTruth(game);
    answer(game, "truth", "pay");
    const calls: number[] = [];
    for (let month = 0; month < 10; month += 1) {
      turn(game);
      if (offerOf(game, RANSOM)?.openedMonth === game.state.turn.month) calls.push(game.state.turn.month);
    }
    expect(calls.length).toBeGreaterThanOrEqual(6);
    for (let index = 1; index < calls.length; index += 1) expect(calls[index]).toBe(calls[index - 1]! + 1);
    // Away from the compound a held month opens no debt.
    expect(owed(game, AGENT_DEBT)).toBeNull();
  });

  test("[R-ROAD-006] given a ransom call nobody answers and a compound that lets go the month after, when that month ends, then the call lapses into `cannot` and the sum is added to the debt", () => {
    const halfHeld: Change = rows({ desert: { ...ON, months: [1, 1] }, compound: { on: 5000, held: 5000, turned: 0, lost: 0, months: [1, 1] } });
    for (let index = 0; index < 40; index += 1) {
      const game = life({ seed: `seed-${String(index)}`, change: all(HONEST_ROAD, halfHeld) });
      toTruth(game);
      answer(game, "truth", "pay");
      for (let month = 0; month < 4 && offerOf(game, RANSOM) === undefined && gateOf(game).step !== "coast"; month += 1) turn(game);
      const call = offerOf(game, RANSOM);
      if (call === undefined || gateOf(game).step !== "compound") continue;
      const sum = call.terms.sum as number;
      const result = turn(game);
      if (gateOf(game).step === "compound") continue;
      expect(result.events).toContainEqual(expect.objectContaining({ type: "offer/lapsed", entry: RANSOM, choice: "cannot" }));
      expect(owed(game, AGENT_DEBT)).toBe(2 * sum);
      return;
    }
    throw new Error("No seed in 40 holds the compound once and then lets go.");
  });
});

// ---------------------------------------------------------------------------
// R-ROAD-007: the exit, at every step
// ---------------------------------------------------------------------------

describe("the way out", () => {
  // One month at each step before, so none is passed by.
  const before = (index: number): Record<string, Row> => Object.fromEntries(chain.slice(0, index).map((step) => [step.id, { ...ON, months: [1, 1] }]));

  for (const [index, step] of chain.entries()) {
    test(`[R-ROAD-007] given the character turned back at the ${step.id}, when the exit comes, then it is the assisted return: home, standing by R-RETURN-002, the house takes them back and the debt follows`, () => {
      const game = life({ change: all(HONEST_ROAD, rows({ ...before(index), [step.id]: { ...TURNED, months: [1, 1] } })) });
      toTruth(game);
      answer(game, "truth", "pay");
      applyEffects(game, [{ type: "obligation/open", obligation: AGENT_DEBT, principal: 700000 * UNIT }]);
      const seen: string[] = [];
      let last = turn(game);
      seen.push(chain[0]!.id);
      for (let month = 0; month < 10 && chain.some((item) => item.id === gateOf(game).step); month += 1) {
        seen.push(gateOf(game).step!);
        last = turn(game);
      }
      seen.push(gateOf(game).step!);
      expect(path(seen)).toEqual([...chain.slice(0, index + 1).map((item) => item.id), "exit"]);
      expect(game.state.place.where).toBe("home");
      expect(game.state.place.returns.at(-1)).toMatchObject({ shape: "assisted", country: null });
      expect(game.view().place.returns[0]).toMatchObject({ shape: "assisted", country: null });
      // The return's own standing, apart from anything else the month brought (a request at home lapsing).
      type Changed = Extract<QualityEvent, { type: "quality/changed" }>;
      const changes = last.events.filter((event): event is Changed => event.type === "quality/changed");
      const fromReturn = changes.filter((event) => event.quality === STANDING && event.source === ROAD).reduce((sum, event) => sum + event.amount, 0);
      expect(fromReturn).toBe(ASSISTED);
      expect(owed(game, AGENT_DEBT)).toBe(700000 * UNIT);
      expect(owed(game, UPKEEP)).not.toBeNull();
      expect(game.view().freeSlots).toBeGreaterThan(0);
      const back = game.state.turn.report!.lines;
      expect(back.some((line) => line.key === "line.route.road-turned")).toBe(true);
    });
  }

  test("[R-ROAD-007] [R-PLACE-004] given a character abroad with no status, when the authority sends them home as assisted, then it is what return/home does with no fare", () => {
    const game = abroad(content);
    applyEffects(game, [{ type: "status/lose" }]);
    const pounds = game.state.wallet.pockets.GBP;
    applyEffects(game, [{ type: "place/return", shape: "assisted" }]);
    expect(game.state.place.where).toBe("home");
    expect(game.state.place.returns.at(-1)).toMatchObject({ shape: "assisted", country: "country.uk" });
    expect(game.state.wallet.pockets.GBP).toEqual(pounds);
  });

  test("[R-ROAD-007] given a character at home, when the authority's return comes, then nothing happens", () => {
    const game = life();
    const standing = quality(game, STANDING);
    applyEffects(game, [{ type: "place/return", shape: "assisted" }]);
    expect(game.state.place.where).toBe("home");
    expect(quality(game, STANDING)).toBe(standing);
  });

  test("[R-ROAD-007] given the exit's words, when content is read, then the anti-trafficking agency and the migration agency are named in the card's text", () => {
    expect(text["road.exit.title"]).toBeTruthy();
    expect(text["road.exit.body"]).toMatch(/anti-trafficking agency/);
    expect(text["road.exit.body"]).toMatch(/migration agency/);
  });
});

// ---------------------------------------------------------------------------
// R-ROAD-008: the ending
// ---------------------------------------------------------------------------

describe("the ending", () => {
  test("[R-ROAD-008] given `lost` at the sea, when it comes, then the life is over: every command is refused with ended, the view carries the ending card, and turns may still be granted", () => {
    const game = life({ change: all(HONEST_ROAD, rows({ desert: ON, compound: ON, coast: ON, sea: LOST })) });
    toTruth(game);
    answer(game, "truth", "pay");
    const seen = playOut(game);
    expect(path(seen).at(-1)).toBe("sea");
    expect(game.state.turn.ended).toBe(true);
    expect(gateOf(game).step).toBe("lost");
    const card = game.view().card;
    expect(card).toMatchObject({ kind: "lost", route: ROAD, percent: null, topActivities: [] });
    expect(card?.months).toBe(seen.length);
    game.expectRejected({ type: "turn/end", slots: [] }, "ended");
    game.expectRejected({ type: "wallet/move", currency: "NGN", amount: 1, to: "bank" }, "ended");
    game.grant(1);
    expect(game.view().card?.kind).toBe("lost");
    expect(game.state.turn.report!.lines.some((line) => line.key === "line.route.road-lost")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// R-ROAD-009: the far shore
// ---------------------------------------------------------------------------

describe("the far shore", () => {
  test("[R-ROAD-009] given `on` from the sea, when it comes, then the character is in Italy without papers, works for cash only, keeps the debt, and may go home only by the assisted return", () => {
    const game = life({ change: all(HONEST_ROAD, rows({ desert: ON, compound: ON, coast: ON, sea: ON })) });
    toTruth(game);
    answer(game, "truth", "pay");
    applyEffects(game, [{ type: "obligation/open", obligation: AGENT_DEBT, principal: 900000 * UNIT }]);
    playOut(game);
    expect(gateOf(game).step).toBe("arrived");
    expect(game.state.place).toMatchObject({ where: "abroad", country: "country.italy" });
    expect(game.state.status.current?.entry).toBe("status.eu-irregular");
    expect(game.view().status?.work).toBe("cash");
    expect(owed(game, AGENT_DEBT)).toBe(900000 * UNIT);
    applyEffects(game, [{ type: "money/take", currency: "NGN", pocket: "any", amount: game.state.wallet.pockets.NGN.cash + game.state.wallet.pockets.NGN.bank, reason: "mishap" }]);
    game.accept({ type: "return/home" });
    expect(game.state.place.returns.at(-1)).toMatchObject({ shape: "assisted", country: "country.italy" });
  });
});

// ---------------------------------------------------------------------------
// R-ROAD-010: nothing earned
// ---------------------------------------------------------------------------

describe("nothing is earned on the road", () => {
  test("[R-ROAD-010] given a whole chain to the far shore, when every month's report is read, then japacity never moves, no line is big or good, no goal is done, and the sim marks the place as the road", () => {
    const game = life({ change: all(HONEST_ROAD, rows({ desert: ON, compound: ON, coast: ON, sea: ON })) });
    toTruth(game);
    const done = game.view().goals.done;
    answer(game, "truth", "pay");
    let japacityBefore = game.view().japacity;
    for (let month = 0; month < 30 && gateOf(game).step !== "arrived"; month += 1) {
      expect(game.view().place.where).toBe("road");
      const result = turn(game);
      const roadLines = result.lines.filter((line) => line.key.startsWith("line.route.road-"));
      for (const line of roadLines) {
        expect(line.big ?? false).toBe(false);
        expect(line.tone).not.toBe("good");
      }
      expect(result.state.turn.report!.japacityAfter).toBe(result.state.turn.report!.japacityBefore);
      expect(game.view().japacity).toEqual(japacityBefore);
      japacityBefore = game.view().japacity;
    }
    expect(game.view().goals.done).toEqual(done);
  });
});

// ---------------------------------------------------------------------------
// R-ROAD-011: the real-story card
// ---------------------------------------------------------------------------

describe("the real-story card", () => {
  test("[R-ROAD-011] given a chain under way, when the view is read, then there is no card; when it ends by the exit, then the real-story card is there for that month and gone the next", () => {
    const game = life({ change: all(HONEST_ROAD, rows({ desert: TURNED })) });
    toTruth(game);
    answer(game, "truth", "pay");
    expect(game.view().card).toBeNull();
    playOut(game);
    const card = game.view().card;
    expect(card).toMatchObject({ kind: "real-story", route: ROAD, percent: null });
    expect(card?.standing).toBe(quality(game, STANDING));
    turn(game);
    expect(game.view().card).toBeNull();
  });

  test("[R-ROAD-011] given the night turned back, the truth's exit and the far shore, when each ends, then each shows the real-story card", () => {
    const back = life({ change: HONEST_ROAD });
    take(back);
    answer(back, "night", "turn-back");
    expect(back.view().card?.kind).toBe("real-story");
    const exit = life({ change: HONEST_ROAD });
    toTruth(exit);
    answer(exit, "truth", "exit");
    expect(exit.view().card?.kind).toBe("real-story");
    const shore = life({ change: all(HONEST_ROAD, rows({ desert: ON, compound: ON, coast: ON, sea: ON })) });
    toTruth(shore);
    answer(shore, "truth", "pay");
    playOut(shore);
    expect(shore.view().card?.kind).toBe("real-story");
  });

  test("[R-ROAD-011] given the card's words, when content is read, then it carries a title, a line and credits, and no more", () => {
    expect(text["road.real-story.title"]).toBeTruthy();
    expect(text["road.real-story.line"]).toBeTruthy();
    const credits = Object.keys(text).filter((key) => key.startsWith("road.real-story.credit."));
    expect(credits.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// R-ROAD-012: reach and order
// ---------------------------------------------------------------------------

describe("who the pitches reach", () => {
  test("[R-ROAD-012] given every starting life, when the pitches' conditions are judged at home, then nothing on the profile locks them", () => {
    for (const scenario of Object.keys(content.scenario) as Id<"scenario">[]) {
      if (scenario === "scenario.ready") continue;
      const game = readyLife(content, { from: scenario, quiet: true });
      for (const id of PITCHES) {
        const when = content.offer[id]!.when;
        expect(when.every((requirement) => check(readOf(game), requirement).met)).toBe(true);
      }
    }
  });

  test("[R-ROAD-012] given a chain under way or a character on the road, when the pitches' conditions are judged, then none holds", () => {
    const game = life({ change: HONEST_ROAD });
    take(game);
    const holds = (): boolean => PITCHES.some((id) => content.offer[id]!.when.every((requirement) => check(readOf(game), requirement).met));
    expect(holds()).toBe(false);
    answer(game, "night", "go");
    expect(holds()).toBe(false);
    turn(game);
    answer(game, "truth", "pay");
    expect(holds()).toBe(false);
  });

  test("[R-ROAD-012] given a pitch opened before a family request, when the offers are viewed, then the pitch comes last", () => {
    const game = life();
    openPitch(game, RADIO);
    applyEffects(game, [{ type: "offer/open", offer: "offer.nepa-bill" }]);
    const order = game.view().offers.map((offer) => offer.entry);
    expect(order).toEqual(["offer.nepa-bill", RADIO]);
  });
});
