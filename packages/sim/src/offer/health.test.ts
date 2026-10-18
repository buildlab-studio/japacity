// Health, locked slots and forced months: docs/rules/health.md R-HEALTH-001 to
// 003 and 005 to 007. R-HEALTH-004 (sick pay) is the activity kind's and is
// tested beside it. Lives play on the real content with the month's ordinary
// offers turned off, so wellbeing moves only as each test moves it.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { applyOverlay } from "../engine/overlay";
import type { Accepted, BaseEvent, Content, Effect, Id, OfferEntry, OfferView, SlotPick } from "../engine/types";
import { applyEffects, draw, seedWhere, slot } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { COURSE, COURSE_STEP } from "./health";

const health = content.tuning.health;
const DRIFT = content.tuning.quality.wellbeingDrift;
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const STANDING: Id<"quality"> = "quality.standing";
const RUN_DOWN: Id<"quality"> = "quality.run-down-months";
const FORCED_WAIT: Id<"quality"> = "quality.forced-wait";
const ILLNESS: Id<"offer"> = "offer.illness";
const WORSE: Id<"offer"> = "offer.illness-worse";
const BURIAL: Id<"offer"> = "offer.village-burial";
const COURT: Id<"offer"> = "offer.court-date";
/** A month-act for the slots a lock counts; the hunt that was here is now an act done at once (R-ACTIVITY-015) and fills no slot. */
const STUDY: SlotPick = slot("activity.learn-tech");
const CHANCE = 10000;

/**
 * The real content with no ordinary offer rolled, so nothing but the health roll opens one, and an empty slot's rest
 * worth nothing. R-ACTIVITY-015: the hunt moves no quality and is an act done at once, so the month's slots are
 * left empty and rest; with the rest at nothing they still move no quality.
 */
const quiet: Content = applyOverlay(content, { version: "health-quiet", tuning: { offer: { maxNewPerMonth: 0 }, quality: { wellbeingRest: 0 } } });

/** Wellbeing a month must start from to end, after the drift, at `after`. */
const before = (after: number): number => after - DRIFT;
const UNDER = health.runDownBelow - 1;

/** Enough naira for the upkeep of every month a test plays, so no missed charge moves wellbeing. */
const PLENTY = 5000000 * 100;

function life(seed = "seed-1"): Game {
  const game = start({ content: quiet, scenario: "scenario.ada", seed });
  give(game, PLENTY);
  return game;
}

function quality(game: Game, id: Id<"quality">): number {
  return game.state.quality[id] ?? 0;
}

function add(game: Game, id: Id<"quality">, amount: number): void {
  applyEffects(game, [{ type: "quality/add", quality: id, amount }]);
}

function healthDraws(game: Game): number {
  return game.state.draws.health ?? 0;
}

/**
 * Plays a month that ends with wellbeing at `after`: it starts two under it and
 * every free slot rests at nothing (see `quiet`), so only the drift moves it.
 */
function month(game: Game, after = UNDER): Accepted {
  add(game, WELLBEING, before(after) - quality(game, WELLBEING));
  const result = game.endTurn();
  expect(quality(game, WELLBEING)).toBe(after);
  return result;
}

function keys(result: Accepted): string[] {
  return result.lines.map((line) => line.key);
}

function openOf(game: Game, entry: Id<"offer">): OfferView | undefined {
  return game.view().offers.find((offer) => offer.entry === entry);
}

function mustOpen(game: Game, entry: Id<"offer">): OfferView {
  const found = openOf(game, entry);
  if (found === undefined) throw new Error(`${entry} is not open.`);
  return found;
}

function choose(game: Game, entry: Id<"offer">, choice: string): Accepted {
  return game.accept({ type: "offer/choose", offer: mustOpen(game, entry).id, choice });
}

interface Money {
  type: string;
  currency: string;
  amount: number;
  reason: string;
}

function paid(result: Accepted, reason: string): number {
  return result.events
    .filter((event): event is BaseEvent & Money => event.type === "wallet/debited" && (event as unknown as Money).reason === reason)
    .reduce((sum, event) => sum + event.amount, 0);
}

function changed(result: Accepted, id: Id<"quality">): number[] {
  return result.events
    .filter((event) => event.type === "quality/changed" && (event as unknown as { quality: string }).quality === id)
    .map((event) => (event as unknown as { amount: number }).amount);
}

function naira(game: Game): number {
  return game.state.wallet.pockets.NGN.bank + game.state.wallet.pockets.NGN.cash;
}

function give(game: Game, amount: number): void {
  applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount, reason: "gift" }]);
}

function emptyNaira(game: Game): void {
  const { bank, cash } = game.state.wallet.pockets.NGN;
  const effects: Effect[] = [];
  if (bank > 0) effects.push({ type: "money/take", currency: "NGN", pocket: "bank", amount: bank, reason: "mishap" });
  if (cash > 0) effects.push({ type: "money/take", currency: "NGN", pocket: "cash", amount: cash, reason: "mishap" });
  applyEffects(game, effects);
}

function entryOf(id: Id<"offer">): OfferEntry {
  const entry = content.offer[id];
  if (entry === undefined) throw new Error(`There is no ${id} in content.`);
  return entry;
}

/** The nth draw on `health` for a seed falls under the chance. */
const hits = (seed: string, n: number, chanceBp: number): boolean => draw(seed, "health", n, CHANCE) < chanceBp;

/** Three months run down: the warning comes at the second, and the third rolls illness on the first health draw. */
function toIllness(game: Game): Accepted {
  month(game);
  month(game);
  return month(game);
}

/** A seed whose first health draw opens the illness and whose second decides the relapse as asked. */
function illSeed(relapseBp: number, relapses: boolean): string {
  return seedWhere((seed) => hits(seed, 0, health.illnessBp) && hits(seed, 1, relapseBp) === relapses);
}

describe("the run-down warning", () => {
  test("[R-HEALTH-001] given wellbeing under the line at one month's end, when the next month ends at the line, then no warning is given and the count is back to zero", () => {
    const game = life();
    expect(keys(month(game))).not.toContain("line.quality.run-down");
    expect(quality(game, RUN_DOWN)).toBe(1);
    expect(keys(month(game, health.runDownBelow))).not.toContain("line.quality.run-down");
    expect(quality(game, RUN_DOWN)).toBe(0);
    expect(keys(month(game))).not.toContain("line.quality.run-down");
  });

  test("[R-HEALTH-001] given wellbeing under the line at the month phase of two months in a row, when the second ends, then the warning line is given with attention, once", () => {
    const game = life();
    month(game);
    const second = month(game);
    const warning = second.lines.filter((line) => line.key === "line.quality.run-down");
    expect(warning).toEqual([
      { key: "line.quality.run-down", params: { quality: WELLBEING, value: UNDER, below: health.runDownBelow }, tone: "bad", attention: true, counts: [] },
    ]);
    expect(second.state.turn.report?.attention).toBe(true);
    // Still under the month after: the warning stands but is not given again.
    expect(keys(month(game))).not.toContain("line.quality.run-down");
  });

  test("[R-HEALTH-001] given wellbeing at the line for two months, when they end, then there is no warning", () => {
    const game = life();
    month(game, health.runDownBelow);
    expect(keys(month(game, health.runDownBelow))).not.toContain("line.quality.run-down");
    expect(quality(game, RUN_DOWN)).toBe(0);
  });

  test("[R-HEALTH-001] given the warning, when it is given, then nothing else happens yet: no health draw and no illness", () => {
    const game = life();
    month(game);
    month(game);
    expect(healthDraws(game)).toBe(0);
    expect(openOf(game, ILLNESS)).toBeUndefined();
  });
});

describe("illness", () => {
  test("[R-HEALTH-002] given the warning, when the month after it ends still under the line, then illness is rolled once on `health` and opens when the draw falls under the chance", () => {
    const sick = illSeed(health.relapseChemistBp, true);
    const well = seedWhere((seed) => !hits(seed, 0, health.illnessBp));
    const game = life(sick);
    toIllness(game);
    expect(healthDraws(game)).toBe(1);
    const offer = mustOpen(game, ILLNESS);
    expect(offer.expiresMonth).toBe(game.state.turn.month + 1);

    const spared = life(well);
    toIllness(spared);
    expect(healthDraws(spared)).toBe(1);
    expect(openOf(spared, ILLNESS)).toBeUndefined();
    // The next month under the line rolls again.
    month(spared);
    expect(healthDraws(spared)).toBe(2);
  });

  test("[R-HEALTH-002] given the warning, when wellbeing ends the next month at the line, then illness is not rolled, and the warning must come again before it is", () => {
    const game = life(illSeed(health.relapseChemistBp, true));
    month(game);
    month(game);
    month(game, health.runDownBelow);
    expect(healthDraws(game)).toBe(0);
    month(game);
    const again = month(game);
    expect(keys(again)).toContain("line.quality.run-down");
    expect(healthDraws(game)).toBe(0);
    month(game);
    expect(healthDraws(game)).toBe(1);
  });

  test("[R-HEALTH-002] given an illness, when the hospital is chosen, then it pays the hospital as a mishap, locks one slot for the next month, heals 20 and draws no relapse", () => {
    const game = life(illSeed(health.relapseChemistBp, true));
    toIllness(game);
    const sickAt = quality(game, WELLBEING);
    const taken = choose(game, ILLNESS, "hospital");
    expect(paid(taken, "mishap")).toBe(health.hospital);
    expect(changed(taken, WELLBEING)).toEqual([20]);
    expect(quality(game, WELLBEING)).toBe(sickAt + 20);
    expect(game.view().locks).toEqual([{ slots: 1, untilMonth: game.state.turn.month, why: "illness" }]);
    expect(game.view().freeSlots).toBe(content.tuning.turn.freeSlotsNoJob - 1);
    const draws = healthDraws(game);
    game.endTurn();
    expect(healthDraws(game)).toBe(draws);
    expect(openOf(game, WORSE)).toBeUndefined();
    expect(game.view().locks).toEqual([]);
  });

  test("[R-HEALTH-002] given an illness, when the chemist is chosen, then it pays the chemist, adds 8, and the next month draws the relapse at the chemist's chance: at a seed under it the worse turn opens", () => {
    const game = life(illSeed(health.relapseChemistBp, true));
    toIllness(game);
    const taken = choose(game, ILLNESS, "chemist");
    expect(paid(taken, "mishap")).toBe(health.chemist);
    expect(changed(taken, WELLBEING)).toEqual([8]);
    expect(game.view().locks).toEqual([]);
    expect(openOf(game, WORSE)).toBeUndefined();
    game.endTurn();
    expect(healthDraws(game)).toBe(2);
    expect(mustOpen(game, WORSE).terms.hospital).toBe(health.hospitalWorse);
  });

  test("[R-HEALTH-002] given an illness treated at the chemist, when the relapse draw falls at or over the chance, then nothing opens and the illness is over", () => {
    const game = life(illSeed(health.relapseChemistBp, false));
    toIllness(game);
    choose(game, ILLNESS, "chemist");
    game.endTurn();
    expect(healthDraws(game)).toBe(2);
    expect(openOf(game, WORSE)).toBeUndefined();
    expect(quality(game, COURSE)).toBe(COURSE_STEP.none);
  });

  test("[R-HEALTH-002] given an illness, when it is ignored, then one slot is locked for the next month, wellbeing falls 15, and the relapse is drawn at ignoring's chance", () => {
    for (const relapses of [true, false]) {
      const game = life(illSeed(health.relapseIgnoreBp, relapses));
      toIllness(game);
      const taken = choose(game, ILLNESS, "ignore");
      expect(paid(taken, "mishap")).toBe(0);
      expect(changed(taken, WELLBEING)).toEqual([-15]);
      expect(game.view().locks).toEqual([{ slots: 1, untilMonth: game.state.turn.month, why: "illness" }]);
      game.endTurn();
      expect(healthDraws(game)).toBe(2);
      expect(openOf(game, WORSE) !== undefined).toBe(relapses);
    }
  });

  test("[R-HEALTH-002] given an illness left unanswered, when the next month is played, then it lapses into ignore: the slot is locked from then and the relapse is drawn the same month", () => {
    const game = life(illSeed(health.relapseIgnoreBp, true));
    toIllness(game);
    const lapsed = game.endTurn();
    expect(lapsed.events).toContainEqual(expect.objectContaining({ type: "offer/lapsed", entry: ILLNESS, choice: "ignore" }));
    expect(changed(lapsed, WELLBEING)).toContain(-15);
    expect(game.view().locks).toEqual([{ slots: 1, untilMonth: game.state.turn.month, why: "illness" }]);
    expect(healthDraws(game)).toBe(2);
    mustOpen(game, WORSE);
  });

  test("[R-HEALTH-002] [R-HEALTH-001] given the run-down counter and the illness record, when they are read, then they are hidden qualities and never shown", () => {
    for (const id of [RUN_DOWN, COURSE, FORCED_WAIT]) expect(content.quality[id]?.shown).toBe(false);
    const game = life();
    month(game);
    expect(game.view().qualities.map((item) => item.id)).not.toContain(RUN_DOWN);
  });
});

describe("the worse turn", () => {
  /** A life whose chemist visit relapsed: the worse turn is open. */
  function worse(): Game {
    const game = life(illSeed(health.relapseChemistBp, true));
    toIllness(game);
    choose(game, ILLNESS, "chemist");
    game.endTurn();
    mustOpen(game, WORSE);
    return game;
  }

  test("[R-HEALTH-003] given the worse turn and the money, when the hospital is chosen, then it pays the scan and admission as a mishap and locks two slots for two months; `cannot` is not legal", () => {
    const game = worse();
    give(game, health.hospitalWorse);
    game.expectRejected({ type: "offer/choose", offer: mustOpen(game, WORSE).id, choice: "cannot" }, "not-legal");
    expect(mustOpen(game, WORSE).choices).toEqual([
      { id: "hospital", allowed: true, pick: null },
      { id: "cannot", allowed: false, pick: null },
    ]);
    const taken = choose(game, WORSE, "hospital");
    expect(paid(taken, "mishap")).toBe(health.hospitalWorse);
    const month0 = game.state.turn.month;
    expect(game.view().locks).toEqual([{ slots: 2, untilMonth: month0 + 1, why: "illness" }]);
    game.endTurn();
    expect(game.view().locks).toEqual([{ slots: 2, untilMonth: month0 + 1, why: "illness" }]);
    game.endTurn();
    expect(game.view().locks).toEqual([]);
  });

  test("[R-HEALTH-003] given the worse turn and no money for it, when `cannot` is chosen, then two slots are locked for three months and standing falls 5; the hospital cannot be paid", () => {
    const game = worse();
    emptyNaira(game);
    game.expectRejected({ type: "offer/choose", offer: mustOpen(game, WORSE).id, choice: "hospital" }, "cannot-afford");
    const standing = quality(game, STANDING);
    const taken = choose(game, WORSE, "cannot");
    expect(changed(taken, STANDING)).toEqual([-5]);
    expect(quality(game, STANDING)).toBe(standing - 5);
    expect(game.view().locks).toEqual([{ slots: 2, untilMonth: game.state.turn.month + 2, why: "illness" }]);
  });

  test("[R-HEALTH-003] given the worse turn answered either way, when the next month is played, then wellbeing returns to 40", () => {
    for (const choice of ["hospital", "cannot"]) {
      const game = worse();
      if (choice === "hospital") give(game, health.hospitalWorse);
      else emptyNaira(game);
      choose(game, WORSE, choice);
      add(game, WELLBEING, before(12) - quality(game, WELLBEING));
      const next = game.endTurn();
      // The month's own changes come first (with no money, a missed upkeep too); the return to 40 is the last.
      const moves = next.events.filter((event) => event.type === "quality/changed" && (event as unknown as { quality: string }).quality === WELLBEING);
      expect(moves.at(-1)).toMatchObject({ source: "health" });
      expect(quality(game, WELLBEING)).toBe(40);
      expect(quality(game, COURSE)).toBe(COURSE_STEP.none);
    }
  });

  test("[R-HEALTH-003] given the worse turn left unanswered with the money for the hospital, when it lapses, then the family nurses you all the same: the long lock, standing -5 and wellbeing to 40", () => {
    const game = worse();
    give(game, health.hospitalWorse);
    const standing = quality(game, STANDING);
    const lapsed = game.endTurn();
    expect(lapsed.events).toContainEqual(expect.objectContaining({ type: "offer/lapsed", entry: WORSE, choice: null }));
    expect(paid(lapsed, "mishap")).toBe(0);
    expect(quality(game, STANDING)).toBe(standing - 5);
    expect(quality(game, WELLBEING)).toBe(40);
    expect(game.view().locks).toEqual([{ slots: 2, untilMonth: game.state.turn.month + 2, why: "illness" }]);
  });

  test("[R-HEALTH-003] given the worse turn left unanswered with no money, when it lapses, then `cannot` applies as its lapse choice", () => {
    const game = worse();
    emptyNaira(game);
    const lapsed = game.endTurn();
    expect(lapsed.events).toContainEqual(expect.objectContaining({ type: "offer/lapsed", entry: WORSE, choice: "cannot" }));
    expect(game.view().locks).toEqual([{ slots: 2, untilMonth: game.state.turn.month + 2, why: "illness" }]);
    expect(quality(game, WELLBEING)).toBe(40);
  });
});

describe("the gap and the cap", () => {
  test("[R-HEALTH-005] given an illness closed by the chemist with no relapse, when months pass run down, then illness is not rolled again until the gap has passed since it could last have closed", () => {
    const game = life(illSeed(health.relapseChemistBp, false));
    toIllness(game);
    const opened = game.state.turn.month;
    choose(game, ILLNESS, "chemist");
    // The relapse draw is the second; nothing else draws until the gap is over.
    const closed = opened + entryOf(ILLNESS).expiresAfter;
    while (game.state.turn.month < closed + health.gapMonths - 1) {
      month(game);
      expect(healthDraws(game)).toBe(2);
    }
    month(game);
    expect(game.state.turn.month).toBe(closed + health.gapMonths);
    expect(healthDraws(game)).toBe(3);
  });

  test("[R-HEALTH-005] given the hospital chosen for an illness, when months pass run down, then no forced month comes for twelve: no illness roll and no burial, and both may come in the twelfth", () => {
    const game = life(illSeed(health.relapseChemistBp, true));
    toIllness(game);
    const chosen = game.state.turn.month;
    choose(game, ILLNESS, "hospital");
    expect(quality(game, FORCED_WAIT)).toBe(12);
    while (game.state.turn.month < chosen + 11) {
      month(game);
      expect(healthDraws(game)).toBe(1);
      applyEffects(game, [{ type: "offer/open", offer: BURIAL }]);
      expect(openOf(game, BURIAL)).toBeUndefined();
    }
    month(game);
    expect(quality(game, FORCED_WAIT)).toBe(0);
    expect(healthDraws(game)).toBe(2);
    applyEffects(game, [{ type: "offer/open", offer: BURIAL }]);
    mustOpen(game, BURIAL);
  });

  test("[R-HEALTH-005] given a burial attended, when the months after it are run down, then illness waits for the forced-month cap, while the warning still comes first", () => {
    const game = life(seedWhere((seed) => hits(seed, 0, health.illnessBp)));
    applyEffects(game, [{ type: "offer/open", offer: BURIAL }]);
    const chosen = game.state.turn.month;
    choose(game, BURIAL, "go");
    const warned: number[] = [];
    while (game.state.turn.month < chosen + 11) {
      if (keys(month(game)).includes("line.quality.run-down")) warned.push(game.state.turn.month);
      expect(healthDraws(game)).toBe(0);
    }
    expect(warned).toEqual([chosen + 2]);
    month(game);
    expect(healthDraws(game)).toBe(1);
    mustOpen(game, ILLNESS);
  });

  test("[R-HEALTH-005] given every forced-month entry, when its choices are read, then each choice that locks a slot also fills the wait, and only those do", () => {
    const forced = [ILLNESS, WORSE, BURIAL, COURT];
    const wait = content.quality[FORCED_WAIT]?.max;
    expect(wait).toBe(12);
    for (const id of forced) {
      for (const choice of entryOf(id).choices) {
        const locks = choice.effects.some((effect) => effect.type === "turn/lock");
        const fills = choice.effects.some((effect) => effect.type === "quality/add" && effect.quality === FORCED_WAIT && effect.amount === wait);
        expect([id, choice.id, fills]).toEqual([id, choice.id, locks]);
      }
    }
  });
});

describe("forced months that say so a month ahead", () => {
  test("[R-HEALTH-006] given the village burial at home, when `go` is taken, then it pays the trip and the next month is played with one slot fewer, and the slot is back after", () => {
    const game = life();
    applyEffects(game, [{ type: "offer/open", offer: BURIAL }]);
    const taken = choose(game, BURIAL, "go");
    expect(paid(taken, "family")).toBe(60000 * 100);
    expect(game.view().locks).toEqual([{ slots: 1, untilMonth: game.state.turn.month, why: "burial" }]);
    const slots = content.tuning.turn.freeSlotsNoJob;
    game.expectRejected({ type: "turn/end", slots: Array.from({ length: slots }, () => STUDY) }, "not-legal");
    game.endTurn(Array.from({ length: slots - 1 }, () => STUDY));
    expect(game.view().locks).toEqual([]);
    expect(game.view().freeSlots).toBe(slots);
  });

  test("[R-HEALTH-006] given the village burial, when money is sent or nobody goes, then no slot is locked and standing falls 3 or 10", () => {
    for (const [choice, cost, loss] of [
      ["send-money", 100000 * 100, -3],
      ["absent", 0, -10],
    ] as const) {
      const game = life();
      applyEffects(game, [{ type: "offer/open", offer: BURIAL }]);
      const taken = choose(game, BURIAL, choice);
      expect(paid(taken, "family")).toBe(cost);
      expect(changed(taken, STANDING)).toEqual([loss]);
      expect(game.view().locks).toEqual([]);
      expect(quality(game, FORCED_WAIT)).toBe(0);
    }
  });

  test("[R-HEALTH-006] given the village burial, when it is left unanswered, then it lapses into `absent`", () => {
    const game = life();
    applyEffects(game, [{ type: "offer/open", offer: BURIAL }]);
    const lapsed = game.endTurn();
    expect(lapsed.events).toContainEqual(expect.objectContaining({ type: "offer/lapsed", entry: BURIAL, choice: "absent" }));
  });

  test("[R-HEALTH-006] given standing under 20 or a life abroad, when the burial is opened, then it does not open", () => {
    const low = life();
    add(low, STANDING, 19 - quality(low, STANDING));
    applyEffects(low, [{ type: "offer/open", offer: BURIAL }]);
    expect(openOf(low, BURIAL)).toBeUndefined();
    const away = life();
    applyEffects(away, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    applyEffects(away, [{ type: "offer/open", offer: BURIAL }]);
    expect(openOf(away, BURIAL)).toBeUndefined();
  });

  test("[R-HEALTH-006] given a loan held abroad, when the court date opens and is attended, then one slot is locked for the next month; with no loan it does not open", () => {
    const game = life();
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    applyEffects(game, [{ type: "offer/open", offer: COURT }]);
    expect(openOf(game, COURT)).toBeUndefined();
    applyEffects(game, [{ type: "obligation/open", obligation: "obligation.car-shortfall", principal: 120000 }]);
    applyEffects(game, [{ type: "offer/open", offer: COURT }]);
    choose(game, COURT, "attend");
    expect(game.view().locks).toEqual([{ slots: 1, untilMonth: game.state.turn.month, why: "court" }]);
    expect(quality(game, FORCED_WAIT)).toBe(12);
  });

  /** A quick loan taken at home, then the life flown to the UK; `defaulted` lets it lapse into default first. */
  function loanAbroad(defaulted: boolean): Game {
    const game = life();
    applyEffects(game, [{ type: "obligation/open", obligation: "obligation.quick-loan", principal: 5000000 }]);
    const loan = (): string | undefined => Object.values(game.state.obligation.items).find((item) => item.entry === "obligation.quick-loan")?.state;
    if (defaulted) {
      emptyNaira(game);
      for (let month = 0; month < 4 && loan() !== "defaulted"; month += 1) game.endTurn();
      expect(loan()).toBe("defaulted");
      give(game, PLENTY);
    }
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    expect(loan()).toBe(defaulted ? "defaulted" : "active");
    return game;
  }

  test("[R-HEALTH-006] given a loan from home still paid on time and no car shortfall, when the court date is asked for abroad, then it does not open", () => {
    const game = loanAbroad(false);
    applyEffects(game, [{ type: "offer/open", offer: COURT }]);
    expect(openOf(game, COURT)).toBeUndefined();
  });

  test("[R-HEALTH-006] given a loan in default, when the court date is asked for abroad, then it opens", () => {
    const game = loanAbroad(true);
    applyEffects(game, [{ type: "offer/open", offer: COURT }]);
    expect(openOf(game, COURT)).toBeDefined();
  });

  test("[R-HEALTH-006] given each entry that says so a month ahead, when its `lockNext` is read, then a choice locks exactly that and every lock among its choices is that one", () => {
    const ahead = Object.values(content.offer).filter((entry) => entry.lockNext !== undefined);
    expect(ahead.map((entry) => entry.id).sort()).toEqual([COURT, BURIAL]);
    for (const entry of ahead) {
      const locks = entry.choices.flatMap((choice) => choice.effects.filter((effect) => effect.type === "turn/lock"));
      expect(locks.length).toBeGreaterThan(0);
      for (const found of locks) expect(found).toEqual({ type: "turn/lock", ...entry.lockNext });
    }
  });
});

describe("the view", () => {
  test("[R-HEALTH-007] given the warning, when the view is read, then it shows while it stands and goes when wellbeing is back over the line", () => {
    const game = life();
    expect(game.view()).toMatchObject({ runDown: false });
    month(game);
    expect(game.view()).toMatchObject({ runDown: false });
    month(game);
    expect(game.view()).toMatchObject({ runDown: true });
    month(game);
    expect(game.view()).toMatchObject({ runDown: true });
    month(game, health.runDownBelow);
    expect(game.view()).toMatchObject({ runDown: false });
  });

  test("[R-HEALTH-007] given an illness, when the view is read before the choice, then the offer shows both prices, and after the hospital the lock shows with its reason and last month", () => {
    const game = life(illSeed(health.relapseChemistBp, true));
    toIllness(game);
    const offer = mustOpen(game, ILLNESS);
    expect(offer.terms).toEqual({ hospital: health.hospital, chemist: health.chemist });
    expect(offer.choices.map((choice) => [choice.id, choice.allowed])).toEqual([
      ["hospital", naira(game) >= health.hospital],
      ["chemist", true],
      ["ignore", true],
    ]);
    choose(game, ILLNESS, "hospital");
    expect(game.view().locks).toEqual([{ slots: 1, untilMonth: game.state.turn.month, why: "illness" }]);
  });
});
