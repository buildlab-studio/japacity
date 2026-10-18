// Home's send-off the month the visa is granted (chapter:family-marks-the-grant), on the real
// content through the real kinds: a ready life on the UK study route, never refused, played to its
// decision month.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Id, OfferState } from "../engine/types";
import { ALWAYS_GRANTED, offeredSeed } from "../testing/place.journey";
import type { LifeOptions } from "../testing/route.journey";
import { answerFirst, applyEffects, readyLife, toApplied, uk, UNIT } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { quality } from "../testing/read";
import { rollOrder } from "./offer.logic";
import { NETWORK, STANDING, UK_ROUTE, WELLBEING } from "../testing/ids";

const SEND_OFF: Id<"offer"> = "offer.family-send-off";
const entry = content.offer[SEND_OFF];
if (entry === undefined) throw new Error(`The content has no ${SEND_OFF}.`);
const COST = content.tuning.chapter.sendOffNaira;

/** A ready life applied for, the month before its decision. Never refused. */
function applied(options: LifeOptions = {}): Game {
  const game = readyLife(content, { seed: offeredSeed(content), ...options, tuning: { ...ALWAYS_GRANTED, ...options.tuning } });
  toApplied(game);
  answerFirst(game);
  return game;
}

function sendOff(game: Game): OfferState | undefined {
  return Object.values(game.state.offer.items).find((item) => item.entry === SEND_OFF);
}

/** Played to the decision month's end: the visa granted and the send-off open. */
function granted(options: LifeOptions = {}): { game: Game; item: OfferState } {
  const game = applied(options);
  game.endTurn();
  const item = sendOff(game);
  if (item === undefined) throw new Error("The send-off did not open the month of the grant.");
  middling(game);
  return { game, item };
}

/** Qualities in the middle of their range, so no move is cut at an edge. */
function middling(game: Game): void {
  for (const [id, value] of [[WELLBEING, 50], [STANDING, 50], [NETWORK, 30]] as const) applyEffects(game, [{ type: "quality/add", quality: id, amount: value - quality(game, id) }]);
}

function naira(game: Game): { bank: number; cash: number } {
  const { bank, cash } = game.state.wallet.pockets.NGN;
  return { bank, cash };
}

function socialOut(game: Game): number {
  return game.state.wallet.totals.out.social?.NGN ?? 0;
}

/** The quality moves one choice of the send-off made, by its cause. */
function movedBy(events: readonly { type: string }[], choice: string): Record<string, number> {
  const moved: Record<string, number> = {};
  for (const event of events) {
    if (event.type !== "quality/changed") continue;
    const { quality: id, amount, source } = event as unknown as { quality: string; amount: number; source: string };
    if (source === `${SEND_OFF}.${choice}`) moved[id] = (moved[id] ?? 0) + amount;
  }
  return moved;
}

describe("home's send-off, the month of the grant", () => {
  test("[chapter:family-marks-the-grant] given the entry, when it is read, then it opens at home while the story's route is granted, certain and never by chance, at most once, lapsing into dinner after two months, and the party costs the tuning's figure", () => {
    expect(entry.when).toEqual([{ type: "route/state", route: UK_ROUTE, in: ["granted"] }]);
    expect(entry.where ?? "home").toBe("home");
    expect(entry.chanceBp).toBe(10000);
    expect(entry.maxTimes).toBe(1);
    expect(entry.expiresAfter).toBe(2);
    expect(entry.onExpire).toBe("dinner");
    expect(entry.fraudBp).toBe(0);
    expect(entry.choices.map((choice) => choice.id)).toEqual(["party", "dinner", "skip"]);
    expect(entry.terms).toEqual({ cost: COST });
    expect(COST).toBe(150000 * UNIT);
  });

  test("[chapter:family-marks-the-grant] given a life played to its decision, when the months pass, then the send-off is never open before the grant, opens at the end of the month the visa is granted, and once only", () => {
    const game = applied();
    expect(game.state.offer.timesOpened[SEND_OFF]).toBeUndefined();
    expect(uk(game).state).toBe("applying");
    const decision = game.endTurn();
    expect(uk(game).state).toBe("granted");
    const opened = decision.events.filter((event) => event.type === "offer/opened" && (event as unknown as { item: OfferState }).item.entry === SEND_OFF);
    expect(opened).toHaveLength(1);
    const item = sendOff(game);
    expect(item?.openedMonth).toBe(game.state.turn.month);
    expect(item?.terms.cost).toBe(COST);
    // Still granted, months on: it lapses once and never comes again.
    for (let month = 0; month < 6; month += 1) game.endTurn();
    expect(uk(game).state).toBe("granted");
    expect(sendOff(game)).toBeUndefined();
    expect(game.state.offer.timesOpened[SEND_OFF]).toBe(1);
  });

  test("[chapter:family-marks-the-grant] given the send-off open, when the party is chosen, then its cost leaves the naira by transfer, the bank first, wellbeing is up 6, standing 4 and network 3, and the results line is the party's", () => {
    const { game, item } = granted();
    const before = { money: naira(game), social: socialOut(game), wellbeing: quality(game, WELLBEING), standing: quality(game, STANDING), network: quality(game, NETWORK) };
    expect(before.money.bank).toBeGreaterThanOrEqual(COST);
    const result = game.accept({ type: "offer/choose", offer: item.id, choice: "party" });
    expect(naira(game)).toEqual({ bank: before.money.bank - COST, cash: before.money.cash });
    expect(socialOut(game)).toBe(before.social + COST);
    expect(quality(game, WELLBEING)).toBe(before.wellbeing + 6);
    expect(quality(game, STANDING)).toBe(before.standing + 4);
    expect(quality(game, NETWORK)).toBe(before.network + 3);
    const taken = result.lines.find((line) => line.key === "line.offer.taken");
    expect(taken?.params).toEqual({ offer: SEND_OFF, choice: "party" });
    expect(text[`${SEND_OFF}.said.party`]).toMatch(/aunties.*neighbours/);
    expect(sendOff(game)).toBeUndefined();
  });

  test("[chapter:family-marks-the-grant] given less in the bank than the party costs, when it is chosen, then the bank goes first and cash pays the rest", () => {
    const short = 50000 * UNIT;
    const { game, item } = granted();
    // Draw the bank down to cash until less than the party costs is left in it.
    game.accept({ type: "wallet/move", currency: "NGN", amount: naira(game).bank - short, to: "cash" });
    expect(naira(game).bank).toBe(short);
    const cash = naira(game).cash;
    game.accept({ type: "offer/choose", offer: item.id, choice: "party" });
    expect(naira(game)).toEqual({ bank: 0, cash: cash - (COST - short) });
  });

  test("[chapter:family-marks-the-grant] given the send-off open, when dinner is chosen, then nothing is paid, wellbeing is up 3 and standing 2, and its line is the dinner's", () => {
    const { game, item } = granted();
    const before = { money: naira(game), wellbeing: quality(game, WELLBEING), standing: quality(game, STANDING), network: quality(game, NETWORK) };
    const result = game.accept({ type: "offer/choose", offer: item.id, choice: "dinner" });
    expect(naira(game)).toEqual(before.money);
    expect(quality(game, WELLBEING)).toBe(before.wellbeing + 3);
    expect(quality(game, STANDING)).toBe(before.standing + 2);
    expect(quality(game, NETWORK)).toBe(before.network);
    expect(result.lines.find((line) => line.key === "line.offer.taken")?.params).toEqual({ offer: SEND_OFF, choice: "dinner" });
    expect(text[`${SEND_OFF}.said.dinner`]).toBeDefined();
  });

  test("[chapter:family-marks-the-grant] given the send-off open, when it is skipped, then standing is down 2 and nothing else moves", () => {
    const { game, item } = granted();
    const before = { money: naira(game), wellbeing: quality(game, WELLBEING), standing: quality(game, STANDING), network: quality(game, NETWORK) };
    const result = game.accept({ type: "offer/choose", offer: item.id, choice: "skip" });
    expect(naira(game)).toEqual(before.money);
    expect(quality(game, STANDING)).toBe(before.standing - 2);
    expect(quality(game, WELLBEING)).toBe(before.wellbeing);
    expect(quality(game, NETWORK)).toBe(before.network);
    expect(result.lines.find((line) => line.key === "line.offer.taken")?.params).toEqual({ offer: SEND_OFF, choice: "skip" });
    expect(text[`${SEND_OFF}.said.skip`]).toBeDefined();
  });

  test("[chapter:family-marks-the-grant] given the send-off left unanswered, when its two months pass, then it lapses into dinner, with dinner's line", () => {
    const { game, item } = granted();
    // Answerable for two months: it lapses as the second ends.
    expect(item.expiresMonth).toBe(item.openedMonth + entry.expiresAfter);
    for (let month = 1; month < entry.expiresAfter; month += 1) {
      game.endTurn();
      expect(sendOff(game)).toBeDefined();
    }
    const social = socialOut(game);
    middling(game);
    const end = game.endTurn();
    const lapsed = end.events.find((event) => event.type === "offer/lapsed" && (event as unknown as { entry: string }).entry === SEND_OFF) as unknown as { choice: string | null } | undefined;
    expect(lapsed?.choice).toBe("dinner");
    expect(end.lines.find((line) => line.key === "line.offer.lapsed")?.params).toEqual({ offer: SEND_OFF, choice: "dinner" });
    expect(movedBy(end.events, "dinner")).toEqual({ [WELLBEING]: 3, [STANDING]: 2 });
    // Dinner is free.
    expect(socialOut(game)).toBe(social);
    expect(sendOff(game)).toBeUndefined();
    expect(game.state.offer.timesOpened[SEND_OFF]).toBe(1);
  });

  test("[chapter:family-marks-the-grant] given each choice, when its effects are read, then they are money and qualities only: nothing else in the simulation changes, so the flight still waits on the held funds", () => {
    const kinds = new Set(entry.choices.flatMap((choice) => choice.effects.map((effect) => effect.type)));
    expect([...kinds].sort()).toEqual(["money/take", "quality/add"]);
    expect(entry.choices.every((choice) => choice.fraudEffects === null && choice.pick === null && choice.requires.length === 0)).toBe(true);
    const party = entry.choices.find((choice) => choice.id === "party");
    expect(party?.effects[0]).toEqual({ type: "money/take", currency: "NGN", pocket: "transfer", amount: { term: "cost" }, reason: "social" });
  });

  test("[chapter:family-marks-the-grant] [offer:come-up-rolls-in-order] given the month's rolls, when their order is read, then the send-off is rolled first of all, so the grant month's loan offers never take both of the month's places before it", () => {
    expect(rollOrder(content)[0]?.id).toBe(SEND_OFF);
  });

  test("[chapter:family-marks-the-grant] given the house in content, when what it stages is read, then the send-off is staged there", () => {
    expect(content.place["place.family-house"]?.stages).toContain(SEND_OFF);
  });

describe("no funds loan after the grant", () => {
  test("[route:departure-pays-flight] given the visa granted, when months pass, then offer.held-funds never opens again", () => {
    const { game } = granted();
    for (let month = 0; month < 6; month += 1) {
      game.endTurn();
      expect(game.view().offers.some((offer) => offer.entry === "offer.held-funds")).toBe(false);
    }
    const when = content.offer["offer.held-funds"]?.when ?? [];
    expect(when.some((need) => need.type === "not" && need.of.type === "route/state" && need.of.in.includes("granted"))).toBe(true);
  });
});
});
