// Views for screen tests. The thin ones come from the real engine and the real
// content, so they follow the kinds as they land. The rich one is built by
// hand on top of a real view, so the screens for offers, routes and the
// interview can be exercised before the kinds that fill them exist.
import { content } from "@japacity/content";
import type { Authority, Command, Effect, Id, PlayerView, Rejection, Reply, ReportLine, Save, State } from "@japacity/sim";
import { newState, replay, standInWorld, step, viewFor } from "@japacity/sim";

// The recorded lives, the rule tests' game handle and its way of applying effects are the
// sim's own test tools; the package exports only its contract.
import { lifeSaves } from "../../../../../packages/sim/src/goldens/lives.data";
import { applyEffects } from "../../../../../packages/sim/src/route/route.journey";
import { start, type Game } from "../../../../../packages/sim/src/testing/play";

export const SCENARIOS = Object.keys(content.scenario) as Id<"scenario">[];

/** A new life's view, straight from the engine. */
export function engineView(scenario: Id<"scenario"> = SCENARIOS[0]!): PlayerView {
  const state = newState(scenario, "fixture-seed", content);
  return viewFor({ state, world: standInWorld("fixture-world", 0, content), content });
}

const ROUTE = "route.uk-masters" as const;

/** A life in the middle of an application: an offer letter, open offers, and the interview open. */
export function richView(): PlayerView {
  const base = engineView("scenario.tunde");
  const route = base.routes.find((entry) => entry.id === ROUTE);
  if (route === undefined) throw new Error("The content has no UK master's route.");
  const checklist = content.route[ROUTE]?.checklist ?? [];
  return {
    ...base,
    v: 12,
    month: 11,
    turns: { banked: 13, cap: base.turns.cap },
    japacity: { percent: 64, route: ROUTE },
    lastSlots: [{ activity: "activity.rest", param: null }],
    documents: [
      { id: "document.passport", state: "held", readyMonth: null, expiresMonth: 130, value: null },
      { id: "document.english-test", state: "held", readyMonth: null, expiresMonth: 35, value: 65 },
      { id: "document.transcript", state: "pending", readyMonth: 12, expiresMonth: null, value: null },
    ],
    routes: [
      {
        ...route,
        state: "known",
        percent: 64,
        window: "narrowing",
        checklist: checklist.map((item, index) => ({
          id: item.id,
          weight: item.weight,
          met: index < 5,
          have: item.partial ? 1_200_000 : null,
          need: item.partial ? 3_000_000 : null,
          earned: index < 5 ? item.weight : 0,
        })),
        schools: [
          { id: "school.northgate", state: "offer", readyMonth: 9, discount: 100_000 },
          { id: "school.ashby", state: "pending", readyMonth: 13, discount: 0 },
        ],
        school: null,
        funds: { heldMonths: 0, covered: false, shown: 1_200_000, required: 3_000_000 },
        unexplainedBp: 1200,
        refusals: 1,
        lastRefusal: { month: 6, reasons: ["funds", "history"] },
      },
    ],
    setpiece: {
      entry: "setpiece.credibility-interview",
      asked: 1,
      total: 3,
      question: { id: "who-pays", answers: ["own", "lender", "sponsor"], allowed: ["own", "lender", "sponsor"], weak: ["sponsor"] },
    },
    offers: [
      {
        id: "offer-7",
        entry: "offer.land-buyer",
        openedMonth: 10,
        expiresMonth: 12,
        terms: { price: 900_000_000 },
        signs: [],
        choices: [
          { id: "sell", allowed: true, pick: null },
          { id: "hold", allowed: true, pick: null },
        ],
      },
      {
        id: "offer-8",
        entry: "offer.held-funds-agent",
        openedMonth: 11,
        expiresMonth: 13,
        terms: { min: 200_000_000, max: 4_000_000_000 },
        signs: ["cash-only", "my-guy"],
        choices: [
          { id: "take", allowed: true, pick: { min: 200_000_000, max: 4_000_000_000 } },
          { id: "walk-away", allowed: true, pick: null },
        ],
      },
    ],
    obligations: [
      ...base.obligations,
      {
        id: "obligation-9",
        entry: "obligation.salary-loan",
        state: "grace",
        openedMonth: 4,
        amount: 0,
        principal: 120_000_000,
        outstanding: 80_000_000,
        monthsLeft: 8,
        missed: 1,
        bond: null,
        charged: 0,
        due: 12_400_000,
        car: null,
      },
    ],
    news: [
      { id: "news.uk-unis-recruit", stage: "in-force", since: 3, forYou: true },
      { id: "news.naira-float", stage: "rumour", since: 9, forYou: false },
    ],
    queued: [{ id: "queued-3", from: "NGN", to: "USD", paid: 50_000_000, readyMonth: 13 }],
    report: {
      month: 11,
      lines: [
        { key: "line.wallet.salary", params: { amount: 45_000_000 }, tone: "good", attention: false, counts: [] },
        { key: "line.test.not-written", params: {}, tone: "plain", attention: false, counts: [] },
        { key: "chapter.find-your-feet.close", params: {}, tone: "plain", attention: true, counts: [] },
      ],
      japacityBefore: 58,
      japacityAfter: 64,
      attention: true,
    },
  };
}

export interface FakeAuthority extends Authority {
  sent: Command[];
  /** The next reply is this rejection, once. */
  rejectNext(rejection: Omit<Rejection, "ok">): void;
  /** The next accepted reply carries these lines, once. */
  linesNext(lines: ReportLine[]): void;
}

/** An authority that records what is sent and answers with the same view, or a rejection when told to. */
export function fakeAuthority(view: PlayerView): FakeAuthority {
  let pending: Rejection | null = null;
  let lines: ReportLine[] = [];
  const sent: Command[] = [];
  return {
    sent,
    rejectNext(rejection) {
      pending = { ok: false, ...rejection };
    },
    linesNext(next) {
      lines = next;
    },
    view: () => Promise.resolve(view),
    send(command): Promise<Reply> {
      sent.push(command);
      if (pending !== null) {
        const reply = pending;
        pending = null;
        return Promise.resolve(reply);
      }
      const reply: Reply = { ok: true, view, lines };
      lines = [];
      return Promise.resolve(reply);
    },
  };
}

/** A recorded life, played by the real engine on the real content. */
export function recordedSave(name: string): Save {
  const save = lifeSaves[name];
  if (save === undefined) throw new Error(`No recorded life ${name}.`);
  return save;
}

/** The world tick after a save's commands: one for each month ended. */
function tickOf(save: Save): number {
  return save.commands.filter(({ command }) => command.type === "turn/end").length;
}

/**
 * Ada's careful life, replayed up to the flight and then `months` months
 * abroad with the slots left empty, so the screens abroad are the engine's own.
 */
export function abroadView(months = 0): PlayerView {
  const save = recordedSave("ada-careful");
  const worldAt = (tick: number) => standInWorld(save.worldSeed, tick, content);
  let state: State = replay(save, content, worldAt).state;
  let tick = tickOf(save);
  for (let month = 0; month < months; month += 1) {
    const result = step(state, { type: "turn/end", slots: [], basedOn: state.v }, worldAt(tick), content, "player");
    if (!result.ok) throw new Error(`Month ${String(month)} abroad was rejected: ${result.code}`);
    state = result.state;
    tick += 1;
  }
  return viewFor({ state, world: worldAt(tick), content });
}

/**
 * A life a while abroad, built by hand on the engine's arrival: a sponsored
 * worker whose job has gone, a credit file, goals, a car on finance, a side
 * job, a send-off card and an era. For the parts whose kinds are stubs.
 */
/** R-CAR-007's figures as the sim's view would carry them for this car item, so fixtures and tests agree with the engine. */
export function carViewOf(owed: Omit<PlayerView["obligations"][number], "car">, month: number): NonNullable<PlayerView["obligations"][number]["car"]> {
  const entry = content.obligation[owed.entry];
  const car = entry?.car;
  if (entry === undefined || car === undefined) throw new Error(`${owed.entry} is not a car.`);
  const share = (amount: number, bp: number) => Math.floor((amount * bp) / 10_000);
  const paid = car.price - owed.outstanding;
  const third = share(car.price, car.courtThirdBp);
  const court = owed.missed > entry.grace && paid >= third;
  return {
    price: car.price,
    final: share(car.price, car.finalBp),
    third,
    half: share(car.price, car.handBackBp),
    resale: share(car.price, car.resaleBp),
    courtMonths: car.courtMonths,
    paid,
    interest: owed.amount,
    rateBp: owed.principal > 0 ? Math.floor((owed.amount * 10_000) / owed.principal) : 0,
    notice: owed.missed >= entry.grace,
    courtMonth: court ? month + entry.grace + 1 + car.courtMonths - owed.missed : null,
  };
}

export function richAbroadView(): PlayerView {
  const base = abroadView();
  const owed = {
    id: "obligation-40",
    entry: "obligation.car" as const,
    state: "grace" as const,
    openedMonth: 40,
    amount: 10_260,
    principal: 855_000,
    outstanding: 520_000,
    monthsLeft: 20,
    missed: 2,
    bond: null,
    charged: 0,
    due: 61_480,
  };
  const car: PlayerView["obligations"][number] = { ...owed, car: carViewOf(owed, 60) };
  return {
    ...base,
    v: base.v + 30,
    month: 60,
    job: { id: null, months: 0, side: null },
    locks: [{ slots: 1, untilMonth: 60, why: "side-job" }],
    place: { ...base.place, monthsHere: 25 },
    status: {
      entry: "status.uk-sponsored",
      monthsLeft: 20,
      clock: 2,
      lawfulMonths: 16,
      settleMonths: 60,
      work: "one-employer",
      nextStep: "status.next.settle",
      renew: { months: 24, currency: "GBP", fee: 186_500, surcharge: 207_000 },
    },
    credit: {
      mark: 24,
      onTime: 14,
      missed: 2,
      judgmentUntil: null,
      needs: [
        { id: "obligation.phone-uk", creditMin: 10 },
        { id: "obligation.rent-flat-uk", creditMin: 20 },
        { id: "obligation.car", creditMin: 30 },
      ],
    },
    goals: {
      open: [
        { id: "goal.own-door", items: [{ id: "0", met: true }, { id: "1", met: true }] },
        { id: "goal.clean-file", items: [{ id: "0", met: false }] },
      ],
      done: [{ id: "goal.first-car", month: 41 }],
    },
    obligations: [...base.obligations.filter((owed) => owed.entry !== "obligation.tuition"), car],
    pockets: { ...base.pockets, GBP: { bank: 180_000, cash: 2_000, locked: 0 } },
    era: { id: "era.hard-line", since: 50, until: 75, sinceMonth: 50, untilMonth: 75 },
    card: null,
    report: { month: 60, lines: [], japacityBefore: null, japacityAfter: null, attention: false },
  };
}

/** A new life as a game handle on the real content, for views a few commands or effects away. */
export function newGame(scenario: Id<"scenario"> = "scenario.ada"): Game {
  return start({ scenario, content });
}

/**
 * A recorded life replayed command by command into a game handle, so play can
 * go on from where it ends. `drop` leaves that many of its last commands unplayed.
 */
export function recordedGame(name: string, drop = 0): Game {
  const save = recordedSave(name);
  const game = start({ scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed, content });
  for (const { command, sender } of save.commands.slice(0, save.commands.length - drop)) game.accept(command, sender);
  return game;
}

/** Applies effects through the kinds that own them, as an offer's choice or a phase would, and returns the view. */
export function viewAfter(game: Game, effects: Effect[]): PlayerView {
  applyEffects(game, effects);
  return game.view();
}

/** Opens one offer by its entry, as the offer kind's roll would, and returns it from the view. */
export function openOffer(game: Game, offer: Id<"offer">): PlayerView["offers"][number] {
  const opened = viewAfter(game, [{ type: "offer/open", offer }]).offers.find((item) => item.entry === offer);
  if (opened === undefined) throw new Error(`${offer} did not open.`);
  return opened;
}

/** Ada's recorded life, flown and played on with empty slots until the December visit opens. */
export function decemberGame(): Game {
  const game = recordedGame("ada-careful");
  for (let month = 0; month < 12 && game.state.setpiece.open === null; month += 1) game.endTurn();
  if (game.state.setpiece.open?.entry !== "setpiece.december") throw new Error("The December visit did not open within a year abroad.");
  return game;
}
