// The passbook (wallet:passbook-against-plan-cost, wallet:savings-stamps, wallet:saving-pace and wallet:roads-to-the-target; docs/design/08-the-lived-month.md
// section 2, item 3): the money held for the road against the plan's whole cost, the stamps, the pace and the roads,
// worked by the simulation. The tests also cite the rules it rests on: the Bank's figure (world:phone-holds-what-phones-hold), the months kept
// (wallet:months-kept-counted), the side job (activity:side-job-holds-a-slot), the circle (luck:savings-circle-holds-pot), the scholarship (luck:japa-luck-in-existing-systems), moments for the
// systems built on top (moment:new-moments-join-same-way), determinism and the saves (engine:same-inputs-same-result, engine:no-fractions-in-simulation, engine:state-is-plain-data, server:upgrade-state-is-pure).
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { divCeil, divFloor, valueInKobo } from "../engine/int";
import { upgradeState } from "../engine/state";
import type { BaseEvent, Currency, FlatSave, ForeignCurrency, Id, PlayerView, ReportLine, State } from "../engine/types";
import { viewFor } from "../engine/view";
import { lifeSaves } from "../goldens/lives.data";
import { applyEffects } from "../testing/route.journey";
import { simulatedLifeSaves } from "../simulated-play/lives.data";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import type { WalletEvent } from "./wallet.events";
import { CARE_ROUTE, GULF_ROUTE, UK_ROUTE } from "../testing/ids";

/** The road's own costs: the target counts them, so the pace leaves them out. */
const ROAD_FEES: readonly string[] = ["fee-document", "fee-test", "fee-school", "fee-visa", "fee-surcharge", "flight"];
/** What a month's net leaves out (wallet:months-kept-counted). */
const NOT_THE_MONTHS: readonly string[] = ["move", "convert", "held-funds", "held-funds-return"];
const SAVES: Record<string, FlatSave> = { ...lifeSaves, ...simulatedLifeSaves };

function official(view: Pick<PlayerView, "rates">): Record<ForeignCurrency, number> {
  return Object.fromEntries(Object.entries(view.rates).map(([currency, rate]) => [currency, rate.official])) as Record<ForeignCurrency, number>;
}

/** An amount of any money in kobo at the view's official rate. */
function kobo(view: Pick<PlayerView, "rates">, amount: number, currency: Currency): number {
  return valueInKobo(amount, currency, official(view));
}

/** What the engine prices an act at now, every price in kobo. */
function priceOf(view: PlayerView, activity: string): number {
  const option = view.activities.find((each) => each.id === activity);
  if (option === undefined) throw new Error(`No act ${activity} in the view.`);
  return option.cost.reduce((sum, cost) => sum + kobo(view, cost.amount, cost.currency), 0);
}

function passbook(game: Game): NonNullable<PlayerView["passbook"]> {
  const book = game.view().passbook;
  if (book === null) throw new Error("No passbook in the view.");
  return book;
}

function nurse(seed = "passbook-1"): Game {
  return start({ content, scenario: "scenario.nurse", seed, worldSeed: "passbook-world" });
}

/** A life with a way as its plan: heard of, then looked into. */
function planOn(game: Game, route: Id<"route">): Game {
  applyEffects(game, [{ type: "route/hear", route, via: "meetup" }]);
  game.accept({ type: "activity/now", activity: "activity.look-into-route", param: route });
  expect(game.view().plan.route).toBe(route);
  return game;
}

function road(game: Game, kind: string) {
  return passbook(game).roads.find((each) => each.road === kind);
}

function linesOf(lines: readonly ReportLine[], key: string): ReportLine[] {
  return lines.filter((line) => line.key === key);
}

/** A recorded life replayed into a game handle, the first `commands` of it, or all. */
function replay(name: string, commands?: number): Game {
  const save = SAVES[name];
  if (save === undefined) throw new Error(`No recorded life ${name}.`);
  const game = start({ content, scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed });
  for (const { command, tick, sender } of save.commands.slice(0, commands)) {
    game.tick = tick;
    game.accept(command, sender);
  }
  return game;
}

describe("[wallet:passbook-against-plan-cost] the money held for the road and the plan's whole cost", () => {
  test("[wallet:passbook-against-plan-cost] [world:phone-holds-what-phones-hold] given a life at home, when the passbook is read, then it holds the bank and the cash of every money at the official rate, and never the locked money", () => {
    const game = nurse();
    const before = game.view();
    const { NGN } = before.pockets;
    expect(passbook(game).held).toBe(NGN.bank + NGN.cash);
    applyEffects(game, [
      { type: "money/add", currency: "USD", pocket: "bank", amount: 50000, reason: "gift" },
      { type: "money/add", currency: "NGN", pocket: "bank", amount: 300000000, reason: "held-funds", locked: true },
    ]);
    const view = game.view();
    expect(view.pockets.NGN.locked).toBe(before.pockets.NGN.locked + 300000000);
    expect(passbook(game).held).toBe(NGN.bank + NGN.cash + kobo(view, 50000, "USD"));
  });

  test("[wallet:passbook-against-plan-cost] [world:phone-holds-what-phones-hold] given no plan, or a plan only heard of, when the passbook is read, then there is no target; once the way is looked into, there is", () => {
    const game = nurse();
    expect(passbook(game).target).toBeNull();
    applyEffects(game, [{ type: "route/hear", route: CARE_ROUTE, via: "meetup" }]);
    expect(game.view().plan.route).toBe(CARE_ROUTE);
    expect(passbook(game).target).toBeNull();
    game.accept({ type: "activity/now", activity: "activity.look-into-route", param: CARE_ROUTE });
    expect(passbook(game).target?.route).toBe(CARE_ROUTE);
  });

  test("[wallet:passbook-against-plan-cost] [world:phone-holds-what-phones-hold] [document:who-sits-the-english-test] given the nurse whose plan is health care, when the passbook is read, then the target is every paper the life still needs, the English counted once by the cheaper way, the visa's fee and the flight, all in naira", () => {
    const game = planOn(nurse(), CARE_ROUTE);
    const view = game.view();
    const target = passbook(game).target!;
    // The life holds its passport and licence; the verification, the English, the TB test, the police paper and the visa are ahead.
    // The English is one way, the cheaper that applies: a graduate's degree statement, not the test as well
    // (route-gates:sponsor-application-needs, document:who-sits-the-english-test).
    expect(priceOf(view, "activity.degree-english")).toBeLessThan(priceOf(view, "activity.sit-english-test"));
    const fees = ["activity.request-verification", "activity.degree-english", "activity.tb-test", "activity.get-police-certificate", "activity.apply-uk-care"].reduce((sum, act) => sum + priceOf(view, act), 0);
    const { flight } = content.tuning.route;
    expect(target).toEqual({ route: CARE_ROUTE, funds: 0, fees, flight: kobo(view, flight.amount as number, flight.currency), total: fees + kobo(view, flight.amount as number, flight.currency) });
  });

  test("[wallet:passbook-against-plan-cost] [document:who-sits-the-english-test] [document:degree-english-statement] given the care route's English, met by the degree's statement or the test, when the passbook is read, then a life with no degree counts the test alone, and once either paper is asked for neither is ahead", () => {
    const game = planOn(nurse(), CARE_ROUTE);
    const graduate = passbook(game).target!.fees;
    const statement = priceOf(game.view(), "activity.degree-english");
    const sitting = priceOf(game.view(), "activity.sit-english-test");
    // Without the degree the statement is closed to the life, so the test is the English it needs.
    applyEffects(game, [{ type: "quality/add", quality: "quality.education-level", amount: -1 }]);
    expect(passbook(game).target!.fees).toBe(graduate - statement + sitting);
    game.accept({ type: "activity/now", activity: "activity.sit-english-test", param: null });
    expect(game.state.document["document.english-test"]?.state).toMatch(/pending|held/);
    expect(passbook(game).target!.fees).toBe(graduate - statement);
  });

  test("[wallet:passbook-against-plan-cost] [world:phone-holds-what-phones-hold] given the nurse's plan, when a paper is asked for, then its fee is no longer ahead", () => {
    const game = planOn(nurse(), CARE_ROUTE);
    const before = passbook(game).target!;
    const tb = priceOf(game.view(), "activity.tb-test");
    game.accept({ type: "activity/now", activity: "activity.tb-test", param: null });
    expect(game.state.document["document.tb-certificate"]?.state).toMatch(/pending|held/);
    const after = passbook(game).target!;
    expect(after.fees).toBe(before.fees - tb);
    expect(after.total).toBe(before.total - tb);
  });

  test("[wallet:passbook-against-plan-cost] [route-gates:departure-grants-status] given the Gulf as the plan, whose employer pays the flight, when the passbook is read, then no flight is in the target", () => {
    const game = planOn(nurse(), GULF_ROUTE);
    const target = passbook(game).target!;
    expect(target.flight).toBe(0);
    expect(target.total).toBe(target.funds + target.fees);
  });

  test("[wallet:passbook-against-plan-cost] [world:phone-holds-what-phones-hold] given the graduate's master's plan, when the passbook is read, then the funds to show are its checklist's, less the locked money and the family's support", () => {
    const game = replay("graduate-careful", 160);
    const view = game.view();
    const route = view.routes.find((each) => each.id === UK_ROUTE)!;
    expect(route.state).toBe("known");
    const need = route.checklist.find((item) => item.id === "funds")?.need ?? 0;
    expect(need).toBeGreaterThan(0);
    const locked = (Object.keys(view.pockets) as Currency[]).reduce((sum, currency) => sum + kobo(view, view.pockets[currency].locked, currency), 0);
    const support = route.support === null ? 0 : kobo(view, route.support.amount, route.support.currency);
    expect(passbook(game).target?.funds).toBe(Math.max(0, kobo(view, need, "GBP") - locked - support));
  });

  test("[wallet:passbook-against-plan-cost] [world:phone-holds-what-phones-hold] given a life abroad, or ended, or still in its prologue, when the view is read, then there is no passbook", () => {
    expect(start({ content, scenario: "scenario.prologue", seed: "passbook-prologue" }).view().passbook).toBeNull();
    const save = SAVES["graduate-abroad"]!;
    const abroad = start({ content, scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed });
    for (const { command, tick, sender } of save.commands) {
      if (abroad.state.place.where === "abroad") break;
      abroad.tick = tick;
      abroad.accept(command, sender);
    }
    expect(abroad.state.place.where).toBe("abroad");
    expect(abroad.view().passbook).toBeNull();
  });
});

describe("[wallet:savings-stamps] the stamps", () => {
  test("[wallet:savings-stamps] [moment:new-moments-join-same-way] given the nurse a little short of a million, when the month closes over it, then the stamp is told once, with its figure, and kept with its month", () => {
    const game = nurse();
    applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 50000000, reason: "gift" }]);
    expect(passbook(game).held).toBeGreaterThanOrEqual(content.tuning.wallet.stamps[0]!);
    const first = game.endTurn();
    const told = linesOf(first.lines, "line.passbook.stamped");
    expect(told).toHaveLength(1);
    expect(told[0]).toMatchObject({ params: { amount: { currency: "NGN", amount: content.tuning.wallet.stamps[0] } }, tone: "good", attention: true });
    const month = game.state.turn.month;
    expect(game.state.wallet.stamps).toEqual([{ at: content.tuning.wallet.stamps[0], month }]);
    expect(passbook(game).stamps[0]).toEqual({ at: content.tuning.wallet.stamps[0], month, target: false });
    const second = game.endTurn();
    expect(linesOf(second.lines, "line.passbook.stamped")).toEqual([]);
    expect(game.state.wallet.stamps).toHaveLength(1);
  });

  test("[wallet:savings-stamps] [moment:new-moments-join-same-way] given the money for the whole road held, when the month closes, then the road's own stamp is told with the way and its figure, after every fixed one it passed", () => {
    const game = planOn(nurse(), CARE_ROUTE);
    const [million, twoAndHalf] = content.tuning.wallet.stamps;
    // Health care's whole cost lies between the first two fixed figures: ₦50,000 over it is held, past the million and short of the two and a half.
    const before = passbook(game);
    expect(before.target!.total).toBeGreaterThan(million!);
    applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: before.target!.total - before.held + 5000000, reason: "gift" }]);
    const result = game.endTurn();
    const stamped = result.events.filter((event): event is BaseEvent & Extract<WalletEvent, { type: "wallet/stamped" }> => event.type === "wallet/stamped");
    expect(passbook(game).held).toBeLessThan(twoAndHalf!);
    expect(stamped.filter((event) => !event.target).map((event) => event.at)).toEqual([million]);
    expect(stamped.at(-1)).toMatchObject({ target: true, route: CARE_ROUTE });
    const ready = linesOf(result.lines, "line.passbook.ready");
    expect(ready).toHaveLength(1);
    expect(ready[0]!.params["route"]).toBe(CARE_ROUTE);
    const book = passbook(game);
    const last = book.stamps.at(-1)!;
    expect(last).toMatchObject({ target: true, month: game.state.turn.month });
    expect(ready[0]!.params["amount"]).toEqual({ currency: "NGN", amount: last.at });
    // A fixed figure past the road's own and never reached is no milestone on the way.
    expect(book.stamps.filter((stamp) => !stamp.target && stamp.month === null && stamp.at >= last.at)).toEqual([]);
    expect(linesOf(game.endTurn().lines, "line.passbook.ready")).toEqual([]);
  });

  test("[wallet:savings-stamps] [moment:new-moments-join-same-way] given a life in its prologue with money, when the prologue's steps pass, then nothing is stamped", () => {
    const game = start({ content, scenario: "scenario.prologue", seed: "passbook-prologue" });
    expect(game.state.prologue.open).toBe(true);
    expect(game.state.wallet.stamps).toBeUndefined();
  });
});

/** The month's own money in every currency, the road's own costs and what a month's net leaves out aside. */
function keptOf(events: readonly BaseEvent[]): Partial<Record<Currency, number>> {
  const kept: Partial<Record<Currency, number>> = {};
  for (const event of events as readonly WalletEvent[]) {
    if (event.type !== "wallet/credited" && event.type !== "wallet/debited") continue;
    if (NOT_THE_MONTHS.includes(event.reason) || ROAD_FEES.includes(event.reason)) continue;
    kept[event.currency] = (kept[event.currency] ?? 0) + (event.type === "wallet/credited" ? event.amount : -event.amount);
  }
  return kept;
}

function koboOf(view: Pick<PlayerView, "rates">, money: Partial<Record<Currency, number>>): number {
  return (Object.entries(money) as [Currency, number][]).reduce((sum, [currency, amount]) => sum + kobo(view, amount, currency), 0);
}

describe("[wallet:saving-pace] the pace", () => {
  test("[wallet:saving-pace] [wallet:months-kept-counted] given the nurse's months, when each closes, then the pace keeps its net for the road in every money at the official rate, the road's own fees aside, and reads the last three", () => {
    const game = planOn(nurse(), CARE_ROUTE);
    const kept: number[] = [];
    let month: BaseEvent[] = [];
    for (let at = 0; at < 5; at += 1) {
      // The second month pays the TB test: the target counted it, so the pace does not.
      if (at === 1) month.push(...game.accept({ type: "activity/now", activity: "activity.tb-test", param: null }).events);
      const world = game.view();
      const result = game.endTurn();
      month.push(...result.events);
      kept.push(koboOf(world, keptOf(month)));
      month = [];
      expect(game.state.wallet.nets).toEqual(kept.slice(-3));
      expect(passbook(game).pace).toBe(divFloor(kept.slice(-3).reduce((sum, each) => sum + each, 0), Math.min(3, kept.length)));
    }
  });

  test("[wallet:saving-pace] [wallet:months-kept-counted] given a pace and a target, when the passbook is read, then the months are the gap over the pace rounded up, none once it is held, and none to say with no pace above nothing", () => {
    const game = planOn(nurse(), CARE_ROUTE);
    expect(passbook(game).pace).toBeNull();
    expect(passbook(game).months).toBeNull();
    game.endTurn();
    const book = passbook(game);
    expect(book.pace).toBeGreaterThan(0);
    expect(book.months).toBe(divCeil(book.target!.total - book.held, book.pace!));
    // A month that spends more than it keeps leaves no pace to count on.
    applyEffects(game, [{ type: "money/take", currency: "NGN", pocket: "bank", amount: 60000000, reason: "social" }]);
    game.endTurn();
    expect(passbook(game).pace).toBeLessThanOrEqual(0);
    expect(passbook(game).months).toBeNull();
    applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 400000000, reason: "gift" }]);
    expect(passbook(game).months).toBe(0);
  });
});

describe("[wallet:roads-to-the-target] the roads to it", () => {
  test("[wallet:roads-to-the-target] [world:phone-holds-what-phones-hold] given the developer in the junior developer's job, when its roads are read, then the ladder's next rung is the mid dev job with what it still needs and what it adds a month", () => {
    const game = planOn(start({ content, scenario: "scenario.developer", seed: "passbook-z", worldSeed: "passbook-world" }), UK_ROUTE);
    const view = game.view();
    const ladder = road(game, "ladder")!;
    // The developer starts 18 months in, short of the mid-level rung's 24 across the developer jobs as of its tech.
    const months = { type: "activity/tenure", activities: ["activity.job-junior-developer", "activity.job-mid-developer", "activity.job-remote-developer"], months: 24 };
    expect(ladder).toMatchObject({ via: "activity.job-mid-developer", state: "shut", needs: [{ type: "quality/min", quality: "quality.tech", value: 60 }, months] });
    const mid = content.activity["activity.job-mid-developer"]!.pay!;
    expect(ladder.monthly).toBe(kobo(view, mid.amount as number, mid.currency) - kobo(view, view.job.pay!.amount, view.job.pay!.currency));
  });

  test("[wallet:roads-to-the-target] [activity:each-trade-climbs-its-ladder] given the nurse on the ward, when her ladder road is read, then it is the next rung of her own trade, the senior nursing officer, with the care it still asks, and not the bank", () => {
    const game = planOn(nurse(), CARE_ROUTE);
    expect(road(game, "ladder")).toMatchObject({ via: "activity.job-senior-nurse", state: "shut", needs: [{ type: "quality/min", quality: "quality.care", value: 70 }] });
  });

  test("[wallet:roads-to-the-target] [activity:side-job-holds-a-slot] given the nurse who can drive, when its roads are read, then the side job is the ride driving the life can take now; once held, it is taken and its months are the pace's", () => {
    const game = planOn(nurse(), CARE_ROUTE);
    game.endTurn();
    const side = road(game, "side")!;
    const pay = content.activity["activity.ride-driving"]!.pay!;
    expect(side).toMatchObject({ via: "activity.ride-driving", state: "open", needs: [], monthly: pay.amount });
    const book = passbook(game);
    expect(side.months).toBe(divCeil(book.target!.total - book.held, book.pace! + side.monthly));
    applyEffects(game, [{ type: "activity/start-job", job: "activity.ride-driving" }]);
    expect(game.state.activity.side).toBe("activity.ride-driving");
    expect(road(game, "side")).toMatchObject({ state: "taken", months: passbook(game).months });
  });

  test("[wallet:roads-to-the-target] [luck:savings-circle-holds-pot] given the street's circle, when it waits, stands open and runs, then its road says so, and it never moves the months: its pot is what is paid in", () => {
    const game = planOn(nurse(), CARE_ROUTE);
    game.endTurn();
    expect(road(game, "ajo")).toMatchObject({ via: "offer.join-ajo", state: "shut", needs: [], offer: null, monthly: 0, lump: 0, months: passbook(game).months });
    applyEffects(game, [{ type: "quality/add", quality: "quality.standing", amount: -40 }]);
    expect(road(game, "ajo")!.needs).toEqual([{ type: "quality/min", quality: "quality.standing", value: 40 }]);
    applyEffects(game, [{ type: "quality/add", quality: "quality.standing", amount: 40 }, { type: "offer/open", offer: "offer.join-ajo" }]);
    const open = road(game, "ajo")!;
    const instance = Object.entries(game.state.offer.items).find(([, item]) => item.entry === "offer.join-ajo")?.[0];
    expect(open).toMatchObject({ state: "open", offer: instance });
    game.accept({ type: "offer/choose", offer: instance!, choice: "join" });
    expect(road(game, "ajo")).toMatchObject({ state: "taken", months: passbook(game).months });
  });

  test("[wallet:roads-to-the-target] [activity:now-acts-and-month-acts] given the nurse at home with the house's means, when its family's road is read, then Papa's loan is open with what the house would lend; asked, it stands as his offer; taken, the money is held and the road is shut", () => {
    const game = planOn(nurse(), CARE_ROUTE);
    game.endTurn();
    const lend = (game.state.quality["quality.family-means"] ?? 0) * 5000000;
    const family = road(game, "family")!;
    const book = passbook(game);
    // The months are the gap left after the lump over the pace, and none once the lump covers the gap (wallet:saving-pace).
    const left = book.target!.total - book.held - lend;
    expect(family).toMatchObject({ via: "activity.ask-family-loan", state: "open", lump: lend, months: left <= 0 ? 0 : divCeil(left, book.pace!) });
    game.accept({ type: "activity/now", activity: "activity.ask-family-loan", param: null });
    const instance = Object.entries(game.state.offer.items).find(([, item]) => item.entry === "offer.family-loan")?.[0];
    expect(road(game, "family")).toMatchObject({ via: "offer.family-loan", state: "open", offer: instance, lump: lend });
    const held = passbook(game).held;
    game.accept({ type: "offer/choose", offer: instance!, choice: "take" });
    expect(passbook(game).held).toBe(held + lend);
    expect(road(game, "family")).toMatchObject({ via: "activity.ask-family-loan", state: "shut", needs: [{ type: "quality/max", quality: "quality.family-stake", value: 0 }] });
  });

  test("[wallet:roads-to-the-target] [luck:japa-luck-in-existing-systems] given the master's as the plan, when the roads are read, then the family's road is the family meeting and the scholarship round is a road; for health care there is no scholarship", () => {
    const graduate = replay("graduate-careful", 160);
    expect(road(graduate, "family")?.via).toBe("activity.family-meeting");
    expect(road(graduate, "scholarship")?.via).toBe("offer.scholarship-round");
    expect(road(planOn(nurse(), CARE_ROUTE), "scholarship")).toBeUndefined();
  });

  test("[wallet:roads-to-the-target] [world:phone-holds-what-phones-hold] given the nurse's roads, when the best is read, then it is the road not taken that reaches the target soonest, sooner than the pace alone", () => {
    const game = planOn(nurse(), CARE_ROUTE);
    game.endTurn();
    const book = passbook(game);
    const open = book.roads.filter((each) => each.state !== "taken" && each.months !== null);
    const soonest = Math.min(...open.map((each) => each.months!));
    expect(soonest).toBeLessThan(book.months!);
    expect(book.roads.find((each) => each.road === book.best)?.months).toBe(soonest);
    expect(book.roads.findIndex((each) => each.road === book.best)).toBe(book.roads.findIndex((each) => each.state !== "taken" && each.months === soonest));
  });
});

describe("the passbook on the recorded lives", () => {
  test("[engine:same-inputs-same-result] [engine:no-fractions-in-simulation] [engine:state-is-plain-data] given every recorded life, month by month, when its passbook is read, then it is the same on every read, its sums add up in whole kobo, and every stamp was reached at a close with the money held", () => {
    // Every slip is named with its life and month, so one list says them all.
    const problems: string[] = [];
    const say = (ok: boolean, what: string) => {
      if (!ok) problems.push(what);
    };
    let read = 0;
    for (const [name, save] of Object.entries(SAVES)) {
      const game = start({ content, scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed });
      for (const { command, tick, sender } of save.commands) {
        game.tick = tick;
        const before = game.state.place.where === "home" && !game.state.prologue.open ? game.view().passbook : null;
        const result = game.accept(command, sender);
        const at = `${name} month ${String(game.state.turn.month)}`;
        // Reached at a month's close, at home, with the passbook open.
        if (result.events.some((event) => event.type === "wallet/stamped")) say(command.type === "turn/end" && before !== null, `${at}: a stamp outside a close at home`);
        if (command.type !== "turn/end") continue;
        const view = game.view();
        const book = view.passbook;
        say(JSON.stringify(viewFor({ state: game.state, world: game.world(), content }).passbook) === JSON.stringify(book), `${at}: two reads differ`);
        if (book === null) {
          say(game.state.place.where !== "home" || game.state.turn.ended, `${at}: no passbook at home`);
          continue;
        }
        read += 1;
        const held = (Object.keys(view.pockets) as Currency[]).reduce((sum, currency) => sum + kobo(view, view.pockets[currency].bank + view.pockets[currency].cash, currency), 0);
        say(book.held === held, `${at}: held ${String(book.held)} is not the pockets' ${String(held)}`);
        say(book.target === null || book.target.total === book.target.funds + book.target.fees + book.target.flight, `${at}: the target's parts do not add up`);
        const figures = [book.held, book.pace ?? 0, book.months ?? 0, ...book.roads.flatMap((each) => [each.monthly, each.lump, each.months ?? 0])];
        say(figures.every((figure) => Number.isSafeInteger(figure)), `${at}: a figure is not a whole number`);
        say((game.state.wallet.nets ?? []).length <= 3, `${at}: more than three months kept for the pace`);
        say(book.stamps.every((stamp) => stamp.month === null || stamp.month <= view.month), `${at}: a stamp from a month to come`);
        // wallet:savings-stamps: the fixed stamps in their figures' order, and the target last.
        const fixedStamps = book.stamps.filter((stamp) => !stamp.target);
        say(fixedStamps.every((stamp, index) => index === 0 || fixedStamps[index - 1]!.at <= stamp.at), `${at}: the fixed stamps out of order`);
        say(book.stamps.findIndex((stamp) => stamp.target) === (book.stamps.some((stamp) => stamp.target) ? book.stamps.length - 1 : -1), `${at}: the target not last`);
        const gap = book.target === null ? null : book.target.total - book.held;
        const expected = gap === null ? null : gap <= 0 ? 0 : book.pace === null || book.pace <= 0 ? null : divCeil(gap, book.pace);
        say(book.months === expected, `${at}: months ${String(book.months)}, expected ${String(expected)}`);
      }
    }
    expect(read).toBeGreaterThan(100);
    expect(problems).toEqual([]);
  });

  test("[server:upgrade-state-is-pure] given a saved state from before the passbook, when it is carried to the content and read, then it loads, its pace is not yet known and nothing is stamped, and the next close starts both", () => {
    const game = nurse();
    game.endTurn();
    const old: State = { ...game.state, wallet: { ...game.state.wallet } };
    delete old.wallet.nets;
    delete old.wallet.stamps;
    delete old.wallet.paceNet;
    const carried = upgradeState(old, content, content);
    const view = viewFor({ state: carried, world: game.world(), content });
    expect(view.passbook?.pace).toBeNull();
    expect(view.passbook?.stamps.every((stamp) => stamp.month === null)).toBe(true);
    game.state = carried;
    game.endTurn();
    expect(game.state.wallet.nets).toHaveLength(1);
  });
});
