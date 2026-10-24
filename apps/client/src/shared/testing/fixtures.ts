// Views for screen tests. The thin ones come from the real engine and the real
// content, so they follow the kinds. The rich one is built by hand on top of
// a real view, so the screens for offers, routes and the interview are
// exercised without playing a life to an application.
import type { AccountView } from "@japacity/api";
import { content } from "@japacity/content";
import type { Authority, Command, Content, Currency, Effect, Id, PlayerView, Rejection, Reply, ReportLine, FlatSave } from "@japacity/sim";
import { newState, standInWorld, viewFor } from "@japacity/sim";
import { applyEffects, flownGraduate, type Game, lifeSaves, replayedGame, setPockets, start } from "@japacity/sim/testing";

const SCENARIOS = Object.keys(content.scenario) as Id<"scenario">[];

/** A new life's view, straight from the engine. */
export function engineView(scenario: Id<"scenario"> = SCENARIOS[0]!): PlayerView {
  const state = newState(scenario, "fixture-seed", content);
  return viewFor({ state, world: standInWorld("fixture-world", 0, content), content });
}

const ROUTE = "route.uk-masters" as const;

/** A life in the middle of an application: an offer letter, open offers, and the interview open. */
export function richView(): PlayerView {
  const base = engineView("scenario.banker");
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
      { id: "document.passport", state: "held", readyMonth: null, expiresMonth: 130, value: null, onItsWay: null },
      { id: "document.english-test", state: "held", readyMonth: null, expiresMonth: 35, value: 65, onItsWay: null },
      { id: "document.transcript", state: "pending", readyMonth: 12, expiresMonth: null, value: null, onItsWay: 12 },
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
      question: { id: "who-pays", answers: ["own", "lender", "sponsor"], allowed: ["own", "lender", "sponsor"], weak: ["sponsor"], followUp: false },
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
export function recordedSave(name: string): FlatSave {
  const save = lifeSaves[name];
  if (save === undefined) throw new Error(`No recorded life ${name}.`);
  return save;
}

/**
 * What the screens abroad are tested on, whichever seed the recorder picked:
 * dollars in the bank, no pounds, and naira enough at home for the fare.
 */
export const ABROAD_POCKETS = { GBP: 0, USD: 800_000, NGN: 500_000_000 } as const satisfies Partial<Record<Currency, number>>;

/** The graduate's careful life replayed up to and including the flight, with the pockets of `ABROAD_POCKETS`. */
export function abroadGame(): Game {
  const game = recordedGame("graduate-careful");
  setPockets(game, ABROAD_POCKETS);
  return game;
}

/**
 * The graduate landed and holding `status` (return:papers-return-keeps-status: the Graduate visa by default), with pounds for the fare and naira
 * well above the broke line, so the way home is a return with papers.
 */
export function keptStatusGame(status: Id<"status"> = "status.uk-graduate"): Game {
  const game = abroadGame();
  applyEffects(game, [{ type: "status/grant", status }]);
  setPockets(game, { GBP: 2_000_000, NGN: 5_000_000_000 });
  return game;
}

/** Plays `months` months with every slot resting, granting turns as needed. */
function playResting(game: Game, months: number): void {
  for (let month = 0; month < months; month += 1) {
    if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
    if (game.state.setpiece.open !== null) throw new Error("A set piece is open.");
    game.endTurn([]);
  }
}

/** `keptStatusGame` with `abroad` months lived on the status, gone home with it kept, and `months` played at home after. */
export function keptAtHomeGame(status: Id<"status"> = "status.uk-graduate", months = 0, abroad = 0): Game {
  const game = keptStatusGame(status);
  playResting(game, abroad);
  game.accept({ type: "return/home" });
  playResting(game, months);
  return game;
}

/** The money of each country abroad, for a life landed there. */
const MONEY_OF: Readonly<Record<string, Currency>> = { "country.uk": "GBP", "country.canada": "CAD", "country.uae": "AED", "country.italy": "EUR" };

/**
 * A new life landed in a country abroad through the place kind's own move (no recorded life flies to Calgary, Dubai or
 * Castel Volturno yet), with `amount` of the country's money in the bank and nothing else, so the screens abroad are the
 * engine's own in that country.
 */
export function landedGame(country: Id<"country">, amount = 500_000): Game {
  const game = start({ content, scenario: "scenario.graduate" });
  applyEffects(game, [{ type: "place/move", to: "abroad", country }]);
  const currency = MONEY_OF[country];
  if (currency === undefined) throw new Error(`No money for ${country}.`);
  setPockets(game, { NGN: 0, USD: 0, GBP: 0, CAD: 0, AED: 0, EUR: 0, [currency]: amount });
  return game;
}

/**
 * The graduate's careful life, replayed up to the flight and then `months` months
 * abroad with the slots left empty, so the screens abroad are the engine's own.
 */
export function abroadView(months = 0): PlayerView {
  const game = abroadGame();
  for (let month = 0; month < months; month += 1) game.endTurn([]);
  return game.view();
}

/**
 * The graduate flown as `abroadGame` flies it, on the goal journey's calendar: the
 * tick of the flight, in which the first month abroad is played, is December.
 */
export function decemberAbroadGame(): Game {
  const game = flownGraduate(content);
  setPockets(game, ABROAD_POCKETS);
  return game;
}

/** car:view-shows-car-terms's figures as the sim's view would carry them for this car item, so fixtures and tests agree with the engine. */
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

/**
 * A life a while abroad, built by hand on the engine's arrival: a sponsored
 * worker whose job has gone, a credit file, goals, a car on finance, a side
 * job, a send-off card and an era. For the parts whose kinds are stubs.
 */
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
    job: { id: null, months: 0, side: null, pay: null, sidePay: null },
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
      overstay: null,
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
export function newGame(scenario: Id<"scenario"> = "scenario.graduate", seed?: string): Game {
  return start(seed === undefined ? { scenario, content } : { scenario, seed, content });
}

/**
 * The content with none of the living at home lived by hand (`livingByHandBp` 0), so the whole of it is charged as the
 * month turns, where home:living-by-hand (decision 0013) leaves it all to be lived by hand. For the screens that tell
 * such a charge, its relief or its miss, which stand for whatever is charged; the simulation's own relief tests charge
 * it the same way.
 */
export const chargedLivingContent: Content = { ...content, tuning: { ...content.tuning, home: { ...content.tuning.home, livingByHandBp: 0 } } };

/** A new life on `chargedLivingContent`: its living at home is charged as the month turns. */
export function chargedLivingGame(scenario: Id<"scenario"> = "scenario.graduate", seed?: string): Game {
  return start(seed === undefined ? { scenario, content: chargedLivingContent } : { scenario, seed, content: chargedLivingContent });
}

/**
 * A recorded life replayed command by command into a game handle, so play can
 * go on from where it ends. `drop` leaves that many of its last commands unplayed.
 */
export function recordedGame(name: string, drop = 0): Game {
  const { game, commands } = replayedGame(name, content);
  for (const { command, sender } of commands.slice(0, commands.length - drop)) game.accept(command, sender);
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

/** The graduate flown into a December month and played on with empty slots until the December visit opens. */
export function decemberGame(): Game {
  const game = decemberAbroadGame();
  for (let month = 0; month < 12 && game.state.setpiece.open === null; month += 1) game.endTurn();
  if (game.state.setpiece.open?.entry !== "setpiece.december") throw new Error("The December visit did not open within a year abroad.");
  return game;
}

/** An authority over a game handle: the real engine answers every command the screen sends. */
export function gameAuthority(game: Game): Authority & { sent: Command[] } {
  const sent: Command[] = [];
  return {
    sent,
    view: () => Promise.resolve(game.view()),
    send(command): Promise<Reply> {
      sent.push(command);
      // The handle bases every command on its own state, as the local authority does.
      const result = game.send(command);
      if (!result.ok) return Promise.resolve(result);
      return Promise.resolve({ ok: true, view: game.view(), lines: result.lines });
    },
  };
}

/**
 * An account as `GET /api/account` answers its owner (account:guest-and-secured-states, account:guest-reminded-to-secure): a kept account with its email as
 * the way back in, or a guest with none. A test overrides what it is about.
 */
export function accountView(over: Partial<AccountView> = {}): AccountView {
  const state = over.state ?? "secured";
  const ways = state === "guest" ? { google: null, email: null, passkeys: 0 } : { google: null, email: "ada@example.com", passkeys: 0 };
  return { id: "account-1", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: "c-1", sendUsageCounts: true, admin: false, state, username: "ada_lagos", renameFrom: 0, ways, ...over };
}
