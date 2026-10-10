// The fish racks at Makoko (docs/rules/activity.md R-ACTIVITY-017): the child of the water's work at hand, a main
// job for anyone who lives in Makoko's room, with the rent small enough that most of the pay stays. Real content,
// real draws, the lives played from the prologue as the tiles play them (R-PROLOGUE-012).
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Accepted, BaseEvent, Id } from "../engine/types";
import { ALWAYS_GRANTED, offeredSeed } from "../place/place.journey";
import { applyEffects, readyLife, toDecision } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";

const RACKS: Id<"activity"> = "activity.job-fish-racks";
const HUNT: Id<"activity"> = "activity.job-hunt";
const MAKOKO = "place.makoko";
/** The child of the water's tile: commerce at school, work after it, the counter's savings, and the room on the lagoon. */
const WATER = ["begin", "commercial", "work", "save", "makoko"];
/** The shop worker's tile: the same years, and the family house to sleep in. */
const SHOP_WORKER = ["begin", "commercial", "work", "save", "family-house"];
const SEEDS = 20;
/** Most seeds: three in four. */
const MOST = 15;

/** Plays the prologue down `answers` where each is open, else the first open answer. */
function sixteen(seed: string, answers: readonly string[]): Game {
  const game = start({ content, scenario: "scenario.prologue", seed });
  for (let guard = 0; guard < 60 && game.state.prologue.open; guard += 1) {
    const card = game.view().prologue;
    if (card === null) throw new Error(`${seed}: the prologue is open with no card.`);
    const allowed = card.answers.filter((answer) => answer.allowed).map((answer) => answer.id);
    const answer = answers.find((id) => allowed.includes(id)) ?? allowed[0];
    if (answer === undefined) throw new Error(`${seed}: ${card.step} has no open answer.`);
    game.accept({ type: "prologue/choose", step: card.step, answer });
  }
  return game;
}

function hunted(game: Game): readonly string[] {
  return game.view().activities.find((option) => option.id === HUNT)?.params ?? [];
}

function naira(game: Game): number {
  const pocket = game.state.wallet.pockets.NGN;
  return pocket.bank + pocket.cash;
}

function salaries(result: Accepted): number[] {
  return result.events
    .filter((event): event is BaseEvent & { reason: string; amount: number; currency: string } => event.type === "wallet/credited" && (event as unknown as { reason: string }).reason === "salary")
    .filter((event) => event.currency === "NGN")
    .map((event) => event.amount);
}

/** A month's hunt for the racks and, when it lands, the job taken. True when the racks are the job held after. */
function huntRacks(game: Game): boolean {
  game.endTurn([{ activity: HUNT, param: RACKS }]);
  const offer = game.view().offers.find((open) => open.entry === "offer.job");
  if (offer === undefined) return false;
  game.accept({ type: "offer/choose", offer: offer.id, choice: "accept" });
  return game.state.activity.job === RACKS;
}

describe("the fish racks at Makoko", () => {
  test("[R-ACTIVITY-017] [R-PROLOGUE-012] given the child of the water in Makoko's room, when the first month's hunt goes to the racks, then the racks are on the board from the first month and hire on most seeds", () => {
    let hired = 0;
    for (let at = 0; at < SEEDS; at += 1) {
      const game = sixteen(`racks-${String(at)}`, WATER);
      expect(game.state.home.place).toBe(MAKOKO);
      expect(game.state.activity.job).toBeNull();
      expect(hunted(game)).toContain(RACKS);
      if (huntRacks(game)) hired += 1;
    }
    expect(hired).toBeGreaterThanOrEqual(MOST);
    expect(content.activity[RACKS]).toMatchObject({ slot: "main", where: "home" });
  });

  test("[R-ACTIVITY-017] [R-HOME-002] given the racks held in Makoko, when a month is worked, then the pay lands as salary, it covers the room's rent, and the month leaves naira over to save", () => {
    const pay = content.activity[RACKS]?.pay;
    if (pay === null || pay === undefined || typeof pay.amount !== "number") throw new Error("The racks pay nothing.");
    expect(pay.currency).toBe("NGN");
    expect(pay.amount).toBeGreaterThan(content.tuning.home.makokoUpkeep);
    for (let at = 0; at < SEEDS; at += 1) {
      const game = sixteen(`racks-${String(at)}`, WATER);
      if (!huntRacks(game)) continue;
      const before = naira(game);
      const worked = game.endTurn([]);
      expect(salaries(worked)).toEqual([pay.amount]);
      // The racks and the room, nothing else in the month: what stays is the saving.
      if (worked.events.some((event) => event.type === "offer/opened" || event.type === "home/evicted")) continue;
      expect(naira(game)).toBeGreaterThan(before);
      return;
    }
    throw new Error("No seed gave a quiet month at the racks.");
  });

  test("[R-ACTIVITY-017] [R-ACTIVITY-010] given the racks held, when the character flies, then the racks end with the flight and pay nothing after", () => {
    const game = readyLife(content, { seed: offeredSeed(content), tuning: ALWAYS_GRANTED });
    toDecision(game);
    applyEffects(game, [{ type: "activity/start-job", job: RACKS }]);
    expect(game.state.activity.job).toBe(RACKS);
    const flight = game.accept({ type: "route/depart", route: "route.uk-masters" });
    expect(game.state.activity.job).toBeNull();
    expect(flight.events).toContainEqual({ type: "activity/job-ended", job: RACKS, why: "moved" });
    expect(salaries(game.endTurn())).toEqual([]);
  });

  test("[R-ACTIVITY-017] given every fixed life and the shop worker at the family house, when the hunt is listed, then none of them sees the racks", () => {
    const lives = [...Object.keys(content.scenario).filter((id) => id !== "scenario.prologue").map((scenario) => start({ content, scenario: scenario as Id<"scenario"> })), sixteen("racks-0", SHOP_WORKER)];
    for (const game of lives) {
      expect(game.state.home.place).not.toBe(MAKOKO);
      expect(hunted(game)).not.toContain(RACKS);
    }
  });
});
