// The price of sleeping under the bridge: streets:sleeping-under-the-bridge and
// streets:sex-optional-with-neutral-path, played through the harness with the real content.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { checkContent } from "../engine/content";
import { divFloor } from "../engine/int";
import { characterRandom } from "../engine/random";
import type { Accepted, BaseEvent, Content, Id, OfferEntry, OfferState, Requirement } from "../engine/types";
import { slot } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { finishPrologue, start } from "../testing/play";
import { setPockets } from "../testing/wallet";
import type { WalletEvent } from "../wallet/wallet.events";
import type { OfferEvent } from "./offer.events";
import { rollOrder } from "./offer.logic";
import { BRIDGE_MOSQUITOES, BRIDGE_NIGHT, BRIDGE_OFFERS, BRIDGE_THEFT, bridgeProblems, SLEEP_ROUGH } from "./offer.street";

const { street } = content.tuning;
const SEEDS = Array.from({ length: 400 }, (_unused, index) => `bridge-${String(index)}`);

/**
 * The real content with one of the bridge's offers alone among the offers that
 * are rolled, so its own chance can be read draw for draw: with the others in
 * the pool, the limit of two new offers a month and the entries rolled before it
 * would move what it shows.
 */
function alone(id: Id<"offer">): Content {
  const rolled = new Set(rollOrder(content).map((entry) => entry.id));
  const kept = Object.fromEntries(Object.entries(content.offer).filter(([key]) => !rolled.has(key as Id<"offer">)));
  return { ...content, offer: { ...kept, [id]: content.offer[id]! } };
}

function life(pool: Content, seed: string, scenario: Id<"scenario"> = "scenario.ada"): Game {
  return start({ content: pool, scenario, seed });
}

function openedIn(result: Accepted, id: Id<"offer">): OfferState | undefined {
  return result.events.filter((event): event is BaseEvent & OfferEvent => event.type === "offer/opened").flatMap((event) => (event.type === "offer/opened" && event.item.entry === id ? [event.item] : []))[0];
}

/** The first seed whose night under the bridge opens this offer alone. */
function seedOpening(id: Id<"offer">): string {
  const pool = alone(id);
  const found = SEEDS.find((seed) => openedIn(life(pool, seed).endTurn([slot(SLEEP_ROUGH)]), id) !== undefined);
  if (found === undefined) throw new Error(`${id} never opened`);
  return found;
}

describe("the bridge's price: when it opens", () => {
  test.each([
    [BRIDGE_THEFT, street.theftBp],
    [BRIDGE_MOSQUITOES, street.mosquitoBp],
    [BRIDGE_NIGHT, street.harassBp],
  ] as const)("[streets:sleeping-under-the-bridge] given a night under the bridge over many seeds, when %s is drawn on the offer stream, then it opens exactly when the draw falls under its chance of %i", (id, chanceBp) => {
    const entry = content.offer[id]!;
    expect(entry.chanceBp).toBe(chanceBp);
    expect(entry.group).toBe("life");
    expect(entry.bad).toBe(true);
    const pool = alone(id);
    let opened = 0;
    for (const seed of SEEDS) {
      const game = life(pool, seed);
      const expected = characterRandom(seed, { ...game.state.draws }).chance("offer", chanceBp);
      const result = game.endTurn([slot(SLEEP_ROUGH)]);
      expect({ seed, opened: openedIn(result, id) !== undefined }).toEqual({ seed, opened: expected });
      if (expected) opened += 1;
    }
    // Four hundred nights land within five points of the chance.
    expect(Math.abs(divFloor(opened * 10000, SEEDS.length) - chanceBp)).toBeLessThan(500);
  });

  test("[streets:sleeping-under-the-bridge] given every seed and the whole offer pool, when a month is rested or spent at the stadium instead of under the bridge, then none of the bridge's offers ever opens", () => {
    for (const seed of SEEDS.slice(0, 120)) {
      const game = life(content, seed);
      for (const slots of [[], [slot("activity.morning-run")]]) {
        const result = game.endTurn(slots);
        for (const id of BRIDGE_OFFERS) expect(openedIn(result, id)).toBeUndefined();
      }
    }
  });

  test("[streets:sleeping-under-the-bridge] [luck:luck-never-reads-money] given the content check, when it reads the bridge's offers, then none reads money; a planted money condition, inside not or any, a missing night under the bridge or an offer not bad fails it", () => {
    expect(bridgeProblems(content)).toEqual([]);
    expect(checkContent(content).filter((problem) => problem.includes("streets:"))).toEqual([]);
    const theft = content.offer[BRIDGE_THEFT]!;
    const planted = (entry: OfferEntry): Content => ({ ...content, offer: { ...content.offer, [BRIDGE_THEFT]: entry } });
    const money: Requirement = { type: "money/min", currency: "NGN", amount: 1 };
    const reads = `${BRIDGE_THEFT}: the bridge's price reads money (streets:sleeping-under-the-bridge, luck:luck-never-reads-money).`;
    expect(checkContent(planted({ ...theft, when: [...theft.when, { type: "not", of: money }] }))).toContain(reads);
    expect(checkContent(planted({ ...theft, when: [...theft.when, { type: "any", of: [{ type: "wallet/total", flow: "out", reason: "mishap", currency: "NGN", amount: 1 }] }] }))).toContain(reads);
    expect(checkContent(planted({ ...theft, when: [] }))).toContain(`${BRIDGE_THEFT}: opens in a month the character did not sleep rough (streets:sleeping-under-the-bridge).`);
    expect(checkContent(planted({ ...theft, bad: false }))).toContain(`${BRIDGE_THEFT}: is not a bad offer of the life group (streets:sleeping-under-the-bridge).`);
  });
});

describe("the bridge's price: what each does", () => {
  // The bank covers the month's upkeep, which is taken bank first (decision 0014) and would otherwise take the cash too (decision 0013).
  const BANK = content.scenario["scenario.ada"]!.obligations[0]!.amount + street.theftNaira * 4;
  /** A life that rests one month and so tells how much cash it holds when the offers come up the month after. */
  function cashAtComeUp(seed: string, cash: number): number {
    const twin = life(alone(BRIDGE_THEFT), seed);
    setPockets(twin, { NGN: { cash, bank: BANK } });
    twin.endTurn();
    return twin.state.wallet.pockets.NGN.cash;
  }

  test("[streets:sleeping-under-the-bridge] [wallet:no-pocket-below-zero] given the theft drawn, when the cash in hand is the tuning's figure, then it all goes from cash as it opens; one kobo less and nothing is taken; each is told by its own line", () => {
    const seed = seedOpening(BRIDGE_THEFT);
    for (const [short, line] of [
      [0, `${BRIDGE_THEFT}.taken`],
      [1, `${BRIDGE_THEFT}.nothing`],
    ] as const) {
      // The month's own movements before the offers come up are the same whether the night is rough or not.
      // Cash enough for the upkeep (taken cash first, obligation:charges-paid-whole-or-missed) and then some, so the month's movements are linear in the cash.
      const base = content.scenario["scenario.ada"]!.obligations[0]!.amount + street.theftNaira * 2;
      const cash = base + (street.theftNaira - short) - cashAtComeUp(seed, base);
      expect(cashAtComeUp(seed, cash)).toBe(street.theftNaira - short);
      const game = life(alone(BRIDGE_THEFT), seed);
      setPockets(game, { NGN: { cash, bank: BANK } });
      const result = game.endTurn([slot(SLEEP_ROUGH)]);
      const item = openedIn(result, BRIDGE_THEFT);
      expect(item?.terms.lost).toBe(line);
      expect(text[`${line}.name`]).toBeDefined();
      const taken = result.events.filter((event): event is BaseEvent & WalletEvent => event.type === "wallet/debited").filter((event) => event.type === "wallet/debited" && event.reason === "mishap");
      expect(taken).toEqual(short === 0 ? [{ type: "wallet/debited", currency: "NGN", pocket: "cash", amount: street.theftNaira, reason: "mishap" }] : []);
      expect(game.state.wallet.pockets.NGN.cash).toBe(short === 0 ? 0 : street.theftNaira - 1);
      // Carrying on takes nothing more.
      const before = game.state.wallet.pockets.NGN;
      game.accept({ type: "offer/choose", offer: item!.id, choice: "carry-on" });
      expect(game.state.wallet.pockets.NGN).toEqual(before);
    }
  });

  test("[streets:sleeping-under-the-bridge] [health:low-wellbeing-warns-first] given the mosquitoes, when the player carries on, then one more run-down month is on the counter; left to lapse, the same", () => {
    const seed = seedOpening(BRIDGE_MOSQUITOES);
    const bitten = (): { game: Game; item: OfferState } => {
      const game = life(alone(BRIDGE_MOSQUITOES), seed);
      return { game, item: openedIn(game.endTurn([slot(SLEEP_ROUGH)]), BRIDGE_MOSQUITOES)! };
    };
    const added = { type: "quality/changed", quality: "quality.run-down-months", amount: 1, source: `${BRIDGE_MOSQUITOES}.carry-on` };
    const answered = bitten();
    const counter = answered.game.state.quality["quality.run-down-months"]!;
    expect(answered.game.accept({ type: "offer/choose", offer: answered.item.id, choice: "carry-on" }).events).toContainEqual(added);
    expect(answered.game.state.quality["quality.run-down-months"]).toBe(counter + 1);
    const lapsed = bitten();
    expect(lapsed.game.endTurn().events).toContainEqual(added);
  });

  test("[streets:sleeping-under-the-bridge] given a bad night, when the player carries on, then wellbeing falls by the tuning's figure", () => {
    const seed = seedOpening(BRIDGE_NIGHT);
    const game = life(alone(BRIDGE_NIGHT), seed);
    const item = openedIn(game.endTurn([slot(SLEEP_ROUGH)]), BRIDGE_NIGHT)!;
    const result = game.accept({ type: "offer/choose", offer: item.id, choice: "carry-on" });
    expect(result.events).toContainEqual({ type: "quality/changed", quality: "quality.wellbeing", amount: -street.harassMood, source: `${BRIDGE_NIGHT}.carry-on` });
  });
});

describe("the bad night by the character's sex", () => {
  test("[streets:sex-optional-with-neutral-path] [streets:sleeping-under-the-bridge] given a woman, a man and the prologue's life that does not say, when the bad night opens, then its line is harassment, a fight, and trouble in the night, each with words", () => {
    const pool = alone(BRIDGE_NIGHT);
    const lines: Record<string, string> = {};
    for (const scenario of ["scenario.ada", "scenario.tunde", "scenario.prologue"] as const) {
      // The first night under the bridge, in the first seed whose draw opens it for this life.
      const opened = SEEDS.map((seed) => {
        const game = life(pool, seed, scenario);
        finishPrologue(game);
        setPockets(game, { NGN: { cash: 0, bank: 1 } });
        return openedIn(game.endTurn([slot(SLEEP_ROUGH)]), BRIDGE_NIGHT);
      }).find((item) => item !== undefined);
      lines[scenario] = String(opened?.terms.night);
    }
    expect(content.scenario["scenario.ada"]?.sex).toBe("f");
    expect(content.scenario["scenario.tunde"]?.sex).toBe("m");
    expect(content.scenario["scenario.prologue"]?.sex).toBeUndefined();
    expect(lines).toEqual({ "scenario.ada": `${BRIDGE_NIGHT}.woman`, "scenario.tunde": `${BRIDGE_NIGHT}.man`, "scenario.prologue": `${BRIDGE_NIGHT}.anyone` });
    for (const key of Object.values(lines)) expect(text[`${key}.name`]?.length).toBeGreaterThan(0);
    expect(text[`${BRIDGE_NIGHT}.body`]).toBe("{night}");
  });
});
