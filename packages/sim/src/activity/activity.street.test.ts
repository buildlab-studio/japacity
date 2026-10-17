// The hidden places' activities at home: docs/rules/streets.md R-STREET-001 to
// 004 and 008, played through the harness with the real content.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Accepted, BaseEvent, Id, Reason } from "../engine/types";
import { applyEffects, slot } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import type { QualityEvent } from "../quality/quality.events";
import type { ActivityEvent } from "./activity.events";
import { hireChanceBp, paramsFor } from "./activity.logic";

const PHONE: Id<"activity"> = "activity.buy-phone";
const SALES: Id<"activity"> = "activity.job-phone-sales";
const APPRENTICE: Id<"activity"> = "activity.apprentice-repair";
const ROUGH: Id<"activity"> = "activity.sleep-rough";
const RUN: Id<"activity"> = "activity.morning-run";
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const NETWORK: Id<"quality"> = "quality.network";
const TECH: Id<"quality"> = "quality.tech";
const EDU: Id<"quality"> = "quality.edu-level";
const { street } = content.tuning;
const brokeLine = content.tuning.place.brokeLine;

interface Moved {
  type: string;
  currency: string;
  pocket: string;
  amount: number;
  reason: Reason;
}

function ada(): Game {
  return start({ content, scenario: "scenario.ada" });
}

/** The money moved under a reason in a result. */
function moved(result: Accepted, reason: Reason): Moved[] {
  return result.events.filter((event): event is BaseEvent & Moved => (event.type === "wallet/credited" || event.type === "wallet/debited") && (event as unknown as Moved).reason === reason);
}

/** What one source changed in a quality, as its events say. */
function changed(result: Accepted, quality: Id<"quality">, source: string): number[] {
  return result.events
    .filter((event): event is BaseEvent & QualityEvent => event.type === "quality/changed")
    .filter((event) => event.quality === quality && event.source === source)
    .map((event) => event.amount);
}

/** Sets a quality to a value through the effect that moves it. */
function setQuality(game: Game, quality: Id<"quality">, value: number): void {
  applyEffects(game, [{ type: "quality/add", quality, amount: value - (game.state.quality[quality] ?? 0) }]);
}

/** Sets naira cash and bank to these amounts, through the wallet's own effects. */
function setNaira(game: Game, cash: number, bank: number): void {
  const pocket = game.state.wallet.pockets.NGN;
  applyEffects(game, [
    { type: "money/take", currency: "NGN", pocket: "cash", amount: pocket.cash, reason: "mishap" },
    { type: "money/take", currency: "NGN", pocket: "bank", amount: pocket.bank, reason: "mishap" },
  ]);
  const effects = [
    ...(cash > 0 ? [{ type: "money/add", currency: "NGN", pocket: "cash", amount: cash, reason: "gift" } as const] : []),
    ...(bank > 0 ? [{ type: "money/add", currency: "NGN", pocket: "bank", amount: bank, reason: "gift" } as const] : []),
  ];
  applyEffects(game, effects);
}

/** Every debit in a result. */
function debits(result: Accepted): BaseEvent[] {
  return result.events.filter((event) => event.type === "wallet/debited");
}

/** A month with this slot beside the same month left to rest, in two copies of one life: what the slot alone moved shows as the difference. */
function againstRest(prepare: (game: Game) => void, pick: Id<"activity">): { played: Accepted; rested: Accepted } {
  const played = ada();
  const rested = ada();
  prepare(played);
  prepare(rested);
  return { played: played.endTurn([slot(pick)]), rested: rested.endTurn([]) };
}

function option(game: Game, id: Id<"activity">) {
  return game.view().activities.find((candidate) => candidate.id === id);
}

describe("Computer Village: a phone", () => {
  test("[R-STREET-001] given a phone bought, when the month resolves, then it rides with the month in no slot, takes the tuning's price from cash under phone, and lifts wellbeing and network by the tuning's figures", () => {
    const game = ada();
    expect(content.activity[PHONE]?.slot).toBe("none");
    setNaira(game, street.phonePrice, 0);
    expect(option(game, PHONE)).toMatchObject({ allowed: true, cost: [{ currency: "NGN", amount: street.phonePrice }], affordable: true });
    const slots = game.view().freeSlots;
    // Every free slot rests and the phone still goes: it fills none.
    const result = game.endTurn([slot(PHONE)]);
    expect(moved(result, "phone")).toEqual([{ type: "wallet/debited", currency: "NGN", pocket: "cash", amount: street.phonePrice, reason: "phone" }]);
    expect(changed(result, WELLBEING, PHONE)).toEqual([street.phoneMood]);
    expect(changed(result, NETWORK, PHONE)).toEqual([street.phoneNetwork]);
    expect(result.events).toContainEqual({ type: "activity/rested", slots });
  });

  test("[R-STREET-001] [R-WALLET-018] given the bank one kobo short of the price and the rest in cash, when the phone is bought, then, the price being over the line for cash, the bank goes first and cash pays the kobo; with the naira short in both, the slot fails for its cost and nothing is paid", () => {
    const game = ada();
    expect(street.phonePrice).toBeGreaterThan(content.tuning.wallet.cashUpTo);
    setNaira(game, street.phonePrice * 2, street.phonePrice - 1);
    expect(option(game, PHONE)).toMatchObject({ allowed: true, affordable: true });
    const bought = game.endTurn([slot(PHONE)]);
    expect(moved(bought, "phone")).toEqual([
      { type: "wallet/debited", currency: "NGN", pocket: "bank", amount: street.phonePrice - 1, reason: "phone" },
      { type: "wallet/debited", currency: "NGN", pocket: "cash", amount: 1, reason: "phone" },
    ]);
    setNaira(game, street.phonePrice - 1, 0);
    expect(option(game, PHONE)).toMatchObject({ allowed: true, affordable: false });
    // R-ACTIVITY-015: the phone is bought at once, so with the naira short it is refused with cannot-afford
    // and nothing changes (the handle checks the state is untouched), where the slot failed for its cost.
    expect(game.expectRejected({ type: "activity/now", activity: PHONE, param: null }, "cannot-afford").code).toBe("cannot-afford");
  });

  test("[R-STREET-001] given a phone bought, when another is bought the next month, then it is a new phone: paid and lifted again", () => {
    const game = ada();
    for (let month = 0; month < 2; month += 1) {
      setNaira(game, street.phonePrice, 0);
      const result = game.endTurn([slot(PHONE)]);
      expect(moved(result, "phone")).toHaveLength(1);
      expect(changed(result, NETWORK, PHONE)).toEqual([street.phoneNetwork]);
    }
  });
});

describe("Computer Village: selling phones", () => {
  test("[R-STREET-002] given the sales job, when its entry is read, then it is a main-slot job paying the tuning's naira a month with the tuning's hire chance before the network bonus", () => {
    const entry = content.activity[SALES]!;
    expect(entry.slot).toBe("main");
    expect(entry.pay).toEqual({ currency: "NGN", amount: street.salesPay });
    expect(entry.hireBp).toBe(street.salesHireBp);
    expect(hireChanceBp(entry, 0, content.tuning.quality)).toBe(street.salesHireBp);
    expect(hireChanceBp(entry, 10, content.tuning.quality)).toBe(street.salesHireBp + 10 * content.tuning.quality.networkHireBp);
  });

  test("[R-STREET-002] given school to level 2, when the jobs to hunt are listed, then the sales job is among them; at level 1 it is not", () => {
    const game = ada();
    const hunt = content.activity["activity.job-hunt"]!;
    const listed = (): string[] => paramsFor({ state: game.state, world: game.world(), content }, hunt) ?? [];
    setQuality(game, EDU, 2);
    expect(listed()).toContain(SALES);
    setQuality(game, EDU, 1);
    expect(listed()).not.toContain(SALES);
  });

  test("[R-STREET-002] given the sales job hunted, landed and taken, when each month is worked, then it pays the tuning's naira, raises tech by 1 and lowers wellbeing by 1", () => {
    const game = ada();
    const hunted = game.endTurn([slot("activity.job-hunt", SALES)]);
    expect(hunted.events.find((event): event is BaseEvent & ActivityEvent => event.type === "activity/hunted")).toMatchObject({ job: SALES });
    const offer = game.view().offers.find((item) => item.entry === "offer.job");
    expect(offer?.terms.job).toBe(SALES);
    game.accept({ type: "offer/choose", offer: offer!.id, choice: "accept" });
    expect(game.state.activity.job).toBe(SALES);
    for (const tenure of [1, 2]) {
      const result = game.endTurn();
      expect(result.events).toContainEqual({ type: "activity/month-worked", job: SALES, tenure, pay: { currency: "NGN", amount: street.salesPay } });
      expect(changed(result, TECH, SALES)).toEqual([1]);
      expect(changed(result, WELLBEING, SALES)).toEqual([-1]);
    }
  });
});

describe("Computer Village: the apprentice", () => {
  test("[R-STREET-003] given tech under the bar, when the apprenticeship is played, then it costs nothing, raises tech by the tuning's figure and lowers wellbeing by 1", () => {
    expect(option(ada(), APPRENTICE)).toMatchObject({ allowed: true, cost: [] });
    const { played, rested } = againstRest(() => undefined, APPRENTICE);
    expect(changed(played, TECH, APPRENTICE)).toEqual([street.apprenticeTech]);
    expect(changed(played, WELLBEING, APPRENTICE)).toEqual([-1]);
    expect(debits(played)).toEqual(debits(rested));
  });

  test("[R-STREET-003] given tech one under the bar, when the apprenticeship is sent, then it is allowed; at the bar it is not and the turn is rejected with not-legal", () => {
    const game = ada();
    setQuality(game, TECH, street.apprenticeUntil - 1);
    expect(option(game, APPRENTICE)?.allowed).toBe(true);
    setQuality(game, TECH, street.apprenticeUntil);
    expect(option(game, APPRENTICE)?.allowed).toBe(false);
    game.expectRejected({ type: "turn/end", slots: [slot(APPRENTICE)] }, "not-legal");
  });
});

describe("the bridge: sleeping rough", () => {
  test("[R-STREET-004] given naira cash and bank together one kobo under the broke line, when sleeping rough is sent, then it is allowed; at the line it is rejected with not-legal", () => {
    const game = ada();
    setNaira(game, 1, brokeLine - 2);
    expect(option(game, ROUGH)).toMatchObject({ allowed: true, cost: [] });
    setNaira(game, 1, brokeLine - 1);
    expect(option(game, ROUGH)?.allowed).toBe(false);
    game.expectRejected({ type: "turn/end", slots: [slot(ROUGH)] }, "not-legal");
  });

  test("[R-STREET-004] given money locked as shown funds, when the broke line is read, then the locked money does not count", () => {
    const game = ada();
    setNaira(game, 0, 0);
    applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: brokeLine * 2, reason: "gift", locked: true }]);
    expect(option(game, ROUGH)?.allowed).toBe(true);
  });

  test("[R-STREET-004] given a night under the bridge, when the month resolves, then it costs nothing and gives the rest an empty slot gives", () => {
    const slots = ada().view().freeSlots;
    // The naira held kept in the bank, so the theft the night may draw (its own price, tested in offer.street.test.ts)
    // finds no cash on either side: the living costs do not empty the cash first (R-WALLET-018).
    const inBank = (game: Game): void => {
      const { bank, cash } = game.state.wallet.pockets.NGN;
      setNaira(game, 0, bank + cash);
    };
    const { played, rested } = againstRest((game) => {
      setQuality(game, WELLBEING, 40);
      inBank(game);
    }, ROUGH);
    expect(changed(played, WELLBEING, ROUGH)).toEqual([content.tuning.quality.wellbeingRest]);
    expect(changed(rested, WELLBEING, "rest")).toEqual([content.tuning.quality.wellbeingRest * slots]);
    expect(debits(played)).toEqual(debits(rested));
  });
});

describe("the stadium", () => {
  test("[R-STREET-008] given a morning run, when the month resolves, then it costs nothing and lifts wellbeing by the tuning's figure", () => {
    expect(option(ada(), RUN)).toMatchObject({ allowed: true, cost: [] });
    const { played, rested } = againstRest((game) => setQuality(game, WELLBEING, 40), RUN);
    expect(changed(played, WELLBEING, RUN)).toEqual([street.runMood]);
    expect(debits(played)).toEqual(debits(rested));
  });

  test("[R-STREET-008] [R-CITY-010] given the places at home, when what the stadium stages is read, then it is the morning run and nothing else", () => {
    expect(content.place["place.national-stadium"]?.stages).toEqual([RUN]);
  });
});
