// The official page, someone who went and the adviser: docs/rules/advice.md
// advice:four-ways-to-learn-route, advice:official-page-shows-checklist, advice:someone-who-went-answers-free and advice:licensed-adviser-is-truthful, played through the harness with the real content.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Accepted, NewsEntry, ReportLine, World } from "../engine/types";
import { applyEffects, readyContent, readyLife, slot, toHeard } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { standInWorld } from "../world/standIn";
import type { ActivityEvent } from "./activity.events";
import { ADVISER, adviserReading, changedTick, FRIEND, LEFT_TICK, wrongItem } from "./activity.advice";
import { LOOK_INTO, NETWORK, READY, UK_ROUTE } from "../testing/ids";

const advice = content.tuning.advice;

function linesOf(result: Accepted, prefix: string): ReportLine[] {
  return result.lines.filter((line) => line.key.startsWith(prefix));
}

function eventOf<T extends ActivityEvent["type"]>(result: Accepted, type: T): Extract<ActivityEvent, { type: T }> {
  const event = result.events.find((candidate) => candidate.type === type);
  if (event === undefined) throw new Error(`No ${type} event.`);
  return event as unknown as Extract<ActivityEvent, { type: T }>;
}

/** A ready life with the UK route heard, quiet, its network at `network`. */
function heard(network = 15): Game {
  const game = readyLife(content, { quiet: true, qualities: { [NETWORK]: network } });
  toHeard(game);
  return game;
}

/** The first story in content that touches the UK route and moves the era's variables. */
const UK_CHANGE: NewsEntry = (() => {
  const story = Object.values(content.news).find((entry) => entry.touches.includes(UK_ROUTE) && entry.standIn.sets.length > 0);
  if (story === undefined) throw new Error("No story changes the UK route's rules.");
  return story;
})();

/** A ready life whose world carries only the stories given, the UK route heard. */
function withNews(network: number, news: World["news"]): Game {
  const used = readyContent(content, { qualities: { [NETWORK]: network } });
  const game = start({ scenario: READY, content: used, worldAt: (tick) => ({ ...standInWorld("world-1", tick, used), news }) });
  toHeard(game);
  return game;
}

describe("the official page", () => {
  test("[advice:four-ways-to-learn-route] [advice:official-page-shows-checklist] given a heard route, when the official page is read, then the route is known, one slot is used, nothing is paid, and the line names only the route and says it is the official page", () => {
    const game = heard();
    const cashBefore = game.state.wallet.pockets.NGN.cash;
    const result = game.endTurn([slot(LOOK_INTO, UK_ROUTE)]);
    expect(game.state.route[UK_ROUTE]?.state).toBe("known");
    const line = result.lines.find((candidate) => candidate.key === "line.route.looked-into");
    expect(line?.params).toEqual({ route: UK_ROUTE });
    // advice:official-page-shows-checklist: no figure, percent or chance rides on the line.
    expect(Object.values(line?.params ?? {}).every((value) => typeof value === "string")).toBe(true);
    expect(text["line.route.looked-into"]).toMatch(/official page/);
    expect(text["line.route.looked-into"]).toMatch(/nothing about your own chances/);
    // The card says what the page is and names no chance; the result line is where the page's silence on chances is said.
    expect(text["activity.look-into-route.blurb"]).toMatch(/full list/);
    expect(text["activity.look-into-route.blurb"]).not.toMatch(/chance|likely|percent|%|\d/i);
    expect(content.activity[LOOK_INTO]).toMatchObject({ slot: "free", cost: [] });
    // Upkeep comes out of cash at month end; the page itself took nothing under a fee.
    expect(result.events.filter((event) => event.type === "wallet/debited" && (event as unknown as { reason: string }).reason.startsWith("fee-"))).toEqual([]);
    expect(game.state.wallet.pockets.NGN.cash).toBeLessThanOrEqual(cashBefore);
  });
});

describe("asking around at the park", () => {
  test("[advice:four-ways-to-learn-route] given the Gulf heard of, when the player asks around at the motor park, then the Gulf is known and the line says the drivers told it, never that a page was read", () => {
    const game = start({ content, scenario: "scenario.graduate", seed: "seed-1" });
    applyEffects(game, [{ type: "route/hear", route: "route.gulf-contract", via: "friend" }]);
    const result = game.endTurn([slot("activity.ask-around")]);
    expect(game.state.route["route.gulf-contract"]?.state).toBe("known");
    const keys = result.lines.filter((line) => line.key.startsWith("line.route.looked-into")).map((line) => [line.key, line.params]);
    expect(keys).toEqual([["line.route.looked-into-asked", { route: "route.gulf-contract" }]]);
    expect(text["line.route.looked-into-asked"]).toMatch(/^The drivers told you/);
    expect(text["line.route.looked-into-asked"]).not.toMatch(/read/);
  });
});

describe("someone who went", () => {
  test("[advice:someone-who-went-answers-free] given the network one under the bar and at the bar, when the friend is asked, then under it is not legal and at it the route is known through the friend", () => {
    const under = heard(advice.networkToAsk - 1);
    under.expectRejected({ type: "turn/end", slots: [slot(FRIEND, UK_ROUTE)] }, "not-legal");
    const at = heard(advice.networkToAsk);
    const result = at.endTurn([slot(FRIEND, UK_ROUTE)]);
    expect(at.state.route[UK_ROUTE]?.state).toBe("known");
    expect(result.lines.find((line) => line.key === "line.route.looked-into-told")?.params).toEqual({ route: UK_ROUTE });
    expect(content.activity[FRIEND]).toMatchObject({ cost: [], param: "route", slot: "none" });
  });

  test("[advice:someone-who-went-answers-free] [turn:free-slots-per-month] given every free slot filled, when the friend is asked as well, then the turn is accepted, the friend fills no slot, and no slot rests", () => {
    const game = heard(advice.networkToAsk);
    const rest = slot("activity.rest");
    const free = game.view().freeSlots;
    expect(free).toBeGreaterThan(0);
    game.expectRejected({ type: "turn/end", slots: [...Array.from({ length: free }, () => rest), rest] }, "not-legal");
    const result = game.endTurn([...Array.from({ length: free }, () => rest), slot(FRIEND, UK_ROUTE)]);
    expect(game.state.route[UK_ROUTE]?.state).toBe("known");
    expect(result.events.find((event) => event.type === "activity/rested")).toBeUndefined();
    expect(game.view().activities.some((option) => option.id === FRIEND)).toBe(true);
  });

  test("[advice:someone-who-went-answers-free] given no change to the route's rules, when the friend is asked, then they tell every item of the checklist as it stood when they left, and none is wrong", () => {
    const game = heard(advice.networkToAsk);
    const result = game.endTurn([slot(FRIEND, UK_ROUTE)]);
    const told = eventOf(result, "activity/word-of-mouth");
    expect(told.items).toEqual(content.route[UK_ROUTE]!.checklist.map((item) => item.id));
    expect(told.wrong).toBeNull();
    expect(linesOf(result, "line.activity.went-item")).toHaveLength(told.items.length);
    expect(linesOf(result, "line.activity.went-told")[0]?.params).toEqual({ route: UK_ROUTE });
    expect(linesOf(result, "line.activity.went-out-of-date")).toEqual([]);
  });

  test("[advice:someone-who-went-answers-free] given the route's rules changed after the friend left, when they are asked, then one item is wrong, said like the others, and marked out of date only when the player meets it", () => {
    const game = withNews(advice.networkToAsk, [{ id: UK_CHANGE.id, stage: "in-force", since: 1 }]);
    const read = { state: game.state, world: game.world(), content: game.content };
    expect(changedTick(read, UK_ROUTE)).toBe(LEFT_TICK + 1);
    const wrong = wrongItem(read, content.route[UK_ROUTE]!);
    expect(wrong).not.toBeNull();
    const result = game.endTurn([slot(FRIEND, UK_ROUTE)]);
    const told = eventOf(result, "activity/word-of-mouth");
    expect(told.wrong).toBe(wrong);
    expect(linesOf(result, "line.activity.went-item")).toHaveLength(told.items.length);
    expect(linesOf(result, "line.activity.went-out-of-date")).toHaveLength(told.metWrong ? 1 : 0);
    // A story that came into force before the friend left changes nothing they say.
    expect(wrongItem({ ...read, world: { ...read.world, news: [{ id: UK_CHANGE.id, stage: "in-force", since: 0 }] } }, content.route[UK_ROUTE]!)).toBeNull();
  });
});

describe("the licensed adviser", () => {
  test("[advice:free-ways-pointed-first] given every starting life, when its cash is read, then the adviser's fee is above it", () => {
    for (const scenario of Object.values(content.scenario)) {
      expect({ life: scenario.id, cash: scenario.pockets.NGN?.cash ?? 0 }).toEqual({ life: scenario.id, cash: expect.any(Number) as number });
      expect(scenario.pockets.NGN?.cash ?? 0).toBeLessThan(advice.adviserFee);
    }
  });

  test("[advice:licensed-adviser-is-truthful] given a heard route and the fee, when the adviser is seen, then the fee is paid by transfer under the adviser's reason, the route is known, and her lines say what is missing and at least how many months", () => {
    const game = heard();
    const read = { state: game.state, world: game.world(), content };
    const expected = adviserReading(read);
    const result = game.endTurn([slot(ADVISER)]);
    const debit = result.events.find((event) => event.type === "wallet/debited" && (event as unknown as { reason: string }).reason === "fee-advice") as unknown as { pocket: string; amount: number } | undefined;
    expect(debit).toMatchObject({ pocket: "bank", amount: advice.adviserFee });
    expect(game.state.route[UK_ROUTE]?.state).toBe("known");
    expect(result.lines.find((line) => line.key === "line.route.looked-into-advised")?.params).toEqual({ route: UK_ROUTE });
    const advised = eventOf(result, "activity/advised");
    expect(advised.routes).toEqual(expected);
    const uk = advised.routes.find((reading) => reading.route === UK_ROUTE)!;
    // A heard route has no school offer yet, so it never fits.
    expect(uk.fits).toBe(false);
    expect(uk.missing).toContain("offer");
    expect(uk.months).toBeGreaterThanOrEqual(1);
    expect(linesOf(result, "line.activity.adviser-missing")[0]?.params).toEqual({ route: UK_ROUTE, count: uk.missing.length, months: uk.months });
    expect(linesOf(result, "line.activity.adviser-item")).toHaveLength(uk.missing.length);
    expect(text["line.activity.adviser-missing"]).toMatch(/at least \{months\} months/);
  });

  test("[advice:licensed-adviser-is-truthful] given a paper being made and a school answer due, when the adviser reads the file, then the months away are the longest wait among the missing items", () => {
    const game = readyLife(content, { quiet: true, documents: [] });
    toHeard(game);
    applyEffects(game, [{ type: "document/request", document: "document.transcript" }]);
    const read = { state: game.state, world: game.world(), content };
    const due = game.state.document["document.transcript"]!.readyMonth!;
    const uk = adviserReading(read).find((reading) => reading.route === UK_ROUTE)!;
    expect(uk.missing).toContain("transcript");
    expect(uk.months).toBeGreaterThanOrEqual(due - game.state.turn.month);
  });

  test("[advice:licensed-adviser-is-truthful] given cash one naira short of the fee and the rest in the bank, when the adviser is seen, then cash goes first and the bank pays the rest (decision 0014); with the naira short in both, the slot fails and nothing is paid", () => {
    const game = readyLife(content, { quiet: true, pockets: { NGN: { bank: 5000000 * 100, cash: advice.adviserFee - 100 } } });
    toHeard(game);
    const result = game.endTurn([slot(ADVISER)]);
    expect(result.events.some((event) => event.type === "activity/slot-failed")).toBe(false);
    // The month's upkeep goes first and takes the cash, so the fee comes from what is left: cash first, the bank for the rest, the whole fee.
    const debits = result.events.filter((event) => event.type === "wallet/debited" && (event as unknown as { reason: string }).reason === "fee-advice") as unknown as { pocket: string; amount: number }[];
    expect(debits.reduce((sum, debit) => sum + debit.amount, 0)).toBe(advice.adviserFee);
    expect(debits.every((debit) => debit.pocket === "cash" || debit.pocket === "bank")).toBe(true);
    expect(game.state.route[UK_ROUTE]?.state).toBe("known");
    const poor = readyLife(content, { quiet: true, pockets: { NGN: { bank: 50, cash: advice.adviserFee - 100 } } });
    toHeard(poor);
    // activity:now-acts-and-month-acts: the adviser is seen at once, so with the naira short the visit is refused with
    // cannot-afford and nothing changes, where the slot failed.
    expect(poor.expectRejected({ type: "activity/now", activity: ADVISER, param: null }, "cannot-afford").code).toBe("cannot-afford");
    expect(poor.state.route[UK_ROUTE]?.state).toBe("heard");
  });
});

