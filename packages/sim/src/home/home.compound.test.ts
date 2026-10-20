// A room in a compound (home:compound-room-is-a-home, home:rent-default-returns-to-family; obligation:prepaid-entries-skip-first-charge; place.md
// place:departure-moves-abroad; prologue:front-door-three-screens), played through the harness on the real content. The year's rent is paid
// upfront with the fees, the room's own upkeep replaces the family's, and the next year's rent falls due twelve
// months on. A rent gone bad sends the character back to the family house; a flight lets the room go.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp } from "../engine/int";
import { checkInvariants } from "../engine/invariants";
import { applyOverlay } from "../engine/overlay";
import type { Accepted, BaseEvent, Content, Id } from "../engine/types";
import { applyEffects } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { answerPrologue, start } from "../testing/play";
import { setPockets } from "../testing/wallet";
import { eventsOf, naira, openObligations, restMonth } from "../testing/read";
import { compoundMoveIn } from "./home.logic";
import { FAMILY_UPKEEP, STANDING } from "../testing/ids";

const FAMILY = "place.family-house" as const;
const MAKOKO = "place.makoko" as const;
const COMPOUND = "place.compound-room" as const;
const RENT: Id<"obligation"> = "obligation.rent-compound";
const UPKEEP: Id<"obligation"> = "obligation.upkeep-compound";
const { home } = content.tuning;
const MOVE_IN = home.compound.rentYear + bp(home.compound.rentYear, home.compound.feesBp);
/** Ada's family upkeep, from her starting life (scenario.data.ts). */
const GRADUATE_UPKEEP = content.scenario["scenario.graduate"]!.obligations.find((owed) => owed.obligation === FAMILY_UPKEEP)!.amount;
/** No eviction from Makoko, so a draw on the water never muddies a month. */
const QUIET: Content = applyOverlay(content, { version: "test-compound-quiet", tuning: { home: { evictionBp: 0 } } });
/** Decision 0013 lives the living by hand at home; the tests that read the room's upkeep charge itself charge it whole. */
const CHARGED: Content = { ...QUIET, tuning: { ...QUIET.tuning, home: { ...QUIET.tuning.home, livingByHandBp: 0 } } };

function ada(base: Content = QUIET): Game {
  return start({ content: base, scenario: "scenario.graduate", seed: "seed-1" });
}

function charged(result: { events: BaseEvent[] }, entry: Id<"obligation">): number[] {
  return eventsOf(result, "obligation/charged")
    .filter((event) => event["entry"] === entry)
    .map((event) => event["total"] as number);
}

/** Ends months up to and including `last`, the rent held each time, and gives the months whose end charged the rent. */
function rentMonths(game: Game, last: number): number[] {
  const months: number[] = [];
  while (game.state.turn.month < last) {
    setPockets(game, { NGN: { cash: 0, bank: 5_000_000_00 } });
    const result = restMonth(game);
    if (charged(result, RENT).length > 0) months.push(game.state.turn.month);
  }
  return months;
}

/** Ends months until the year's rent first falls due, the rent held until then. */
function toRentDue(game: Game): void {
  while (game.state.turn.month < 11) restMonth(game);
}

/** Ada moved into the room in this month with plenty left. */
function inTheRoom(base: Content = QUIET): Game {
  const game = ada(base);
  setPockets(game, { NGN: { cash: 0, bank: 5_000_000_00 } });
  game.accept({ type: "home/move", to: COMPOUND });
  return game;
}

/** A life from sixteen through the shop counter, started three years past its path (three years worked, more saved), its home card answered `answer`. */
function fromSixteen(answer: string, before: (game: Game) => void = () => undefined): Game {
  const game = start({ content: QUIET, scenario: "scenario.prologue", seed: "seed-1" });
  answerPrologue(game, ["begin", "commercial", "work", "start-24", "save", "nowhere"]);
  before(game);
  game.accept({ type: "prologue/choose", step: "home", answer });
  return game;
}

function homeAnswer(game: Game, answer: string) {
  return game.view().prologue?.answers.find((candidate) => candidate.id === answer);
}

describe("the numbers", () => {
  test("[home:compound-room-is-a-home] given the content, when the room's entries are read, then its rent is yearly and paid upfront, its upkeep is an upkeep at the tuning's charge, and the move-in is the year's rent with the fees on it", () => {
    expect(content.obligation[RENT]).toMatchObject({ type: "rent", currency: "NGN", everyMonths: 12, prepaid: true, amount: home.compound.rentYear, sink: "rent" });
    expect(content.obligation[UPKEEP]).toMatchObject({ type: "upkeep", currency: "NGN", amount: home.compound.upkeep, sink: "upkeep" });
    expect(content.obligation[UPKEEP]?.onMiss).toEqual(content.obligation[FAMILY_UPKEEP]?.onMiss);
    // The fees are a tenth each, the agent's and the agreement's: a fifth of the year's rent.
    expect(home.compound.feesBp).toBe(2000);
    expect(compoundMoveIn(home)).toBe(MOVE_IN);
    expect(MOVE_IN).toBe(420_000_00);
    // Its made-up spot in Ojuelegba (city:positions-rough-on-purpose) is its own, so the map and the fares read one position for it.
    expect(content.place[COMPOUND]).toMatchObject({ where: "home", city: "lagos", nameKind: "stylised", position: { latE3: 6513, lonE3: 3360 }, data: { source: "own" }, scope: "interior" });
  });
});

describe("moving into the room", () => {
  test("[home:compound-room-is-a-home] [home:move-home-once-a-month] given Ada at the family house with plenty, when she moves into the room, then the year's rent and the fees are taken at once under rent, the family's upkeep closes, the room's rent and upkeep open, and standing does not move", () => {
    const game = ada(CHARGED);
    setPockets(game, { NGN: { cash: 0, bank: 5_000_000_00 } });
    const standing = game.state.quality[STANDING];
    const result = game.accept({ type: "home/move", to: COMPOUND });
    const debits = eventsOf(result, "wallet/debited").map((event) => [event["amount"], event["reason"]]);
    expect(debits).toEqual([[MOVE_IN, "rent"]]);
    expect(naira(game)).toBe(5_000_000_00 - MOVE_IN);
    expect(openObligations(game)).toEqual([RENT, UPKEEP]);
    expect(game.state.home).toMatchObject({ place: COMPOUND, since: 0, moved: 0, guest: null });
    expect(game.state.quality[STANDING]).toBe(standing);
    expect(result.lines.map((line) => line.key)).toContain("line.home.moved");
    expect(game.view().home.rent).toEqual({ currency: "NGN", amount: home.compound.upkeep });
    expect(checkInvariants(game.state, CHARGED)).toEqual([]);
  });

  test("[home:compound-room-is-a-home] [home:moves-carry-cost-and-reason] given Ada one kobo short of the year's rent and fees, when the card is read and she moves, then the move is shut as short and refused with cannot-afford; with it exactly held it is open and taken", () => {
    const short = ada(CHARGED);
    setPockets(short, { NGN: { cash: 0, bank: MOVE_IN - 1 } });
    expect(short.view().home.moves.find((move) => move.to === COMPOUND)).toEqual({ to: COMPOUND, monthly: { currency: "NGN", amount: home.compound.upkeep }, now: MOVE_IN, shut: "short" });
    short.expectRejected({ type: "home/move", to: COMPOUND }, "cannot-afford");
    const exact = ada(CHARGED);
    setPockets(exact, { NGN: { cash: 0, bank: MOVE_IN } });
    expect(exact.view().home.moves.find((move) => move.to === COMPOUND)?.shut).toBeNull();
    exact.accept({ type: "home/move", to: COMPOUND });
    expect(naira(exact)).toBe(0);
  });

  test("[home:compound-room-is-a-home] given Ada in the room, when months pass, then the room's upkeep is charged each month in place of the family's, the move month included, and the year's rent nothing before month 12", () => {
    const game = inTheRoom();
    for (let at = 1; at < 12; at += 1) {
      const result = restMonth(game);
      expect(charged(result, UPKEEP)).toHaveLength(1);
      expect(charged(result, FAMILY_UPKEEP)).toEqual([]);
      expect(charged(result, RENT)).toEqual([]);
    }
    expect(game.state.turn.month).toBe(11);
    // Twelve months on from the move, the next year's rent is due, and the card's bill says so the month before.
    expect(game.view().obligations.find((owed) => owed.entry === RENT)?.due).toBe(home.compound.rentYear);
    expect(charged(restMonth(game), RENT)).toEqual([home.compound.rentYear]);
    expect(checkInvariants(game.state, QUIET)).toEqual([]);
  });

  test("[home:moves-carry-cost-and-reason] [home:compound-room-is-a-home] given Ada in the room, when the card is read, then it offers the family house at no cost now and Makoko at its first month, and shuts both the month she moved", () => {
    const game = inTheRoom(CHARGED);
    expect(game.view().home.moves).toEqual([
      { to: FAMILY, monthly: { currency: "NGN", amount: GRADUATE_UPKEEP }, now: 0, shut: "moved" },
      { to: MAKOKO, monthly: { currency: "NGN", amount: home.makokoUpkeep }, now: home.makokoUpkeep, shut: "moved" },
      // The fourth home, a hostel room by the month.
      { to: "place.hostel-room", monthly: { currency: "NGN", amount: home.hostelRentKobo }, now: home.hostelRentKobo, shut: "moved" },
    ]);
    restMonth(game);
    expect(game.view().home.moves.map((move) => move.shut)).toEqual([null, null, null]);
  });
});

describe("water in the room (obligation:cooking-and-fetching-water)", () => {
  test("[obligation:cooking-and-fetching-water] [home:compound-room-is-a-home] given Ada in the room, when the month's choices are listed, then the drum filled from the yard is offered and the water seller's act is not, and cooking still is", () => {
    const game = inTheRoom();
    const allowed = (id: string) => game.view().activities.find((option) => option.id === id)?.allowed;
    expect([allowed("activity.fill-drum"), allowed("activity.fetch-water"), allowed("activity.cook-at-home")]).toEqual([true, false, true]);
    game.expectRejected({ type: "turn/end", slots: [{ activity: "activity.fetch-water", param: null }] }, "not-legal");
  });

  test("[obligation:cooking-and-fetching-water] [home:compound-room-is-a-home] given Ada in the room, when she fills the drum in a month, then the room's upkeep is charged whole, with no relief and no money line, as in a month she does not", () => {
    const there = inTheRoom(CHARGED);
    const twin = inTheRoom(CHARGED);
    restMonth(there);
    restMonth(twin);
    const played = there.endTurn([{ activity: "activity.fill-drum", param: null }]);
    const plain = twin.endTurn();
    expect(charged(played, UPKEEP)).toEqual(charged(plain, UPKEEP));
    expect(charged(played, UPKEEP)[0]).toBeGreaterThan(0);
    expect(eventsOf(played, "obligation/relieved")).toEqual([]);
    expect(played.lines.filter((line) => line.key.startsWith("line.obligation.relief."))).toEqual([]);
    expect(checkInvariants(there.state, CHARGED)).toEqual([]);
  });
});

describe("moving back", () => {
  test("[home:compound-room-is-a-home] [home:move-home-once-a-month] given Ada in the room, when she moves back to the family house, then the family's upkeep reopens at her starting life's charge, the rent closes with nothing given back, and the family talks", () => {
    const game = inTheRoom();
    restMonth(game);
    const standing = game.state.quality[STANDING]!;
    const before = naira(game);
    const result = game.accept({ type: "home/move", to: FAMILY });
    expect(openObligations(game)).toEqual([FAMILY_UPKEEP]);
    expect(Object.values(game.state.obligation.items)[0]?.amount).toBe(GRADUATE_UPKEEP);
    expect(game.state.quality[STANDING]).toBe(standing + home.returnStanding);
    expect(naira(game)).toBe(before);
    expect(eventsOf(result, "wallet/credited")).toEqual([]);
    expect(game.state.home).toMatchObject({ place: FAMILY, moved: 1 });
    expect(checkInvariants(game.state, QUIET)).toEqual([]);
  });

  test("[home:compound-room-is-a-home] given Ada in the room, when she moves on to Makoko, then the room's rent and upkeep close and Makoko's rent opens, taken as home:move-home-once-a-month takes it", () => {
    const game = inTheRoom();
    restMonth(game);
    game.accept({ type: "home/move", to: MAKOKO });
    expect(openObligations(game)).toEqual(["obligation.upkeep-makoko"]);
    expect(game.state.home.place).toBe(MAKOKO);
  });
});

describe("the year's rent paid upfront (obligation:prepaid-entries-skip-first-charge)", () => {
  test("[obligation:prepaid-entries-skip-first-charge] given the room's rent opened in month 0, when twenty-five months pass with the rent held, then it is charged in months 12 and 24 and in no other", () => {
    const game = inTheRoom();
    expect(rentMonths(game, 30)).toEqual([12, 24]);
  });

  test("[obligation:prepaid-entries-skip-first-charge] given the room's rent opened in a later month, when it is read, then its first charge falls twelve months after that month", () => {
    const game = ada();
    setPockets(game, { NGN: { cash: 0, bank: 5_000_000_00 } });
    for (let at = 0; at < 3; at += 1) restMonth(game);
    expect(game.state.turn.month).toBe(3);
    game.accept({ type: "home/move", to: COMPOUND });
    expect(rentMonths(game, 20)).toEqual([15]);
  });

  test("[obligation:prepaid-entries-skip-first-charge] [obligation:miss-applies-its-effects] given the year's rent due and not held, when it is missed, then it is asked for again the next month, and once paid the next falls twelve months after the opening year's", () => {
    const game = inTheRoom();
    toRentDue(game);
    setPockets(game, { NGN: { cash: 0, bank: 0 } });
    const missed = restMonth(game);
    expect(game.state.turn.month).toBe(12);
    expect(eventsOf(missed, "obligation/missed").filter((event) => event["entry"] === RENT)).toHaveLength(1);
    setPockets(game, { NGN: { cash: 0, bank: 5_000_000_00 } });
    expect(charged(restMonth(game), RENT)).toEqual([home.compound.rentYear]);
    expect(rentMonths(game, 26)).toEqual([24]);
  });
});

describe("the room's rent in the view", () => {
  test("[home:compound-room-is-a-home] given Ada in the room from month 0, when months pass with the rent held, then the view carries the year's rent, the fees paid on it and the months to the next year, counting down to 0 in the month whose end takes it, then 11 again", () => {
    const game = inTheRoom();
    const fees = bp(home.compound.rentYear, home.compound.feesBp);
    const seen: number[] = [];
    while (game.state.turn.month < 13) {
      const rent = game.view().home.roomRent;
      expect(rent).toMatchObject({ year: home.compound.rentYear, fees });
      seen.push(rent!.dueIn);
      setPockets(game, { NGN: { cash: 0, bank: 5_000_000_00 } });
      const result = restMonth(game);
      // The month whose end takes the rent is the month the view said 0.
      expect(charged(result, RENT).length > 0).toBe(rent!.dueIn === 0);
    }
    expect(seen).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 11]);
  });

  test("[home:compound-room-is-a-home] given the year's rent missed, when the view is read, then it is due again at this month's end", () => {
    const game = inTheRoom();
    toRentDue(game);
    setPockets(game, { NGN: { cash: 0, bank: 0 } });
    restMonth(game);
    expect(game.view().home.roomRent?.dueIn).toBe(0);
  });

  test("[home:compound-room-is-a-home] given Ada at the family house, and Ada moved back from the room, when the view is read, then no yearly rent is carried", () => {
    expect(ada().view().home.roomRent).toBeNull();
    const game = inTheRoom();
    restMonth(game);
    game.accept({ type: "home/move", to: FAMILY });
    expect(game.view().home.roomRent).toBeNull();
  });
});

describe("a rent gone bad (home:rent-default-returns-to-family)", () => {
  test("[home:rent-default-returns-to-family] given Ada in the room with nothing when the year's rent falls due, when it is missed past its grace, then in the same month's clocks she is back at the family house: the family's upkeep reopens, the rent closes, the standing cost is paid and a line with attention says it", () => {
    const game = inTheRoom();
    toRentDue(game);
    const grace = content.obligation[RENT]!.grace;
    let last: Accepted | null = null;
    for (let miss = 0; miss <= grace; miss += 1) {
      expect(game.state.home.place).toBe(COMPOUND);
      setPockets(game, { NGN: { cash: 0, bank: 0 } });
      last = restMonth(game);
    }
    if (last === null) throw new Error("No month ran.");
    expect(eventsOf(last, "obligation/defaulted").map((event) => event["entry"])).toEqual([RENT]);
    expect(game.state.home).toMatchObject({ place: FAMILY, guest: null });
    expect(openObligations(game)).toEqual([FAMILY_UPKEEP]);
    const moved = eventsOf(last, "home/moved");
    expect(moved).toHaveLength(1);
    expect(moved[0]).toMatchObject({ from: COMPOUND, to: FAMILY, putOut: true });
    const told = last.lines.find((line) => line.key === "line.home.put-out");
    expect(told).toMatchObject({ tone: "bad", attention: true, params: { place: FAMILY } });
    expect(last.lines.map((line) => line.key)).toContain("line.obligation.rent-lost");
    expect(last.lines.map((line) => line.key)).not.toContain("line.obligation.rent-default");
    expect(checkInvariants(game.state, QUIET)).toEqual([]);
  });

  test("[home:rent-default-returns-to-family] given Ada's room rent missed but not yet past its grace, when the month ends, then she still lives in the room", () => {
    const game = inTheRoom();
    toRentDue(game);
    setPockets(game, { NGN: { cash: 0, bank: 0 } });
    const result = restMonth(game);
    expect(eventsOf(result, "obligation/defaulted")).toEqual([]);
    expect(game.state.home.place).toBe(COMPOUND);
    expect(openObligations(game)).toEqual([RENT, UPKEEP]);
  });

  test("[home:rent-default-returns-to-family] given the standing cost of a move back, when Ada is put out, then her standing falls by the tuning's figure on top of the misses' own costs", () => {
    const game = inTheRoom();
    toRentDue(game);
    const twin = inTheRoom(applyOverlay(QUIET, { version: "test-compound-no-talk", tuning: { home: { returnStanding: 0 } } }));
    toRentDue(twin);
    for (let miss = 0; miss <= content.obligation[RENT]!.grace; miss += 1) {
      setPockets(game, { NGN: { cash: 0, bank: 0 } });
      setPockets(twin, { NGN: { cash: 0, bank: 0 } });
      restMonth(game);
      restMonth(twin);
    }
    expect(game.state.home.place).toBe(FAMILY);
    expect(twin.state.home.place).toBe(FAMILY);
    expect(game.state.quality[STANDING]! - twin.state.quality[STANDING]!).toBe(home.returnStanding);
  });
});

describe("a flight lets the room go (place:departure-moves-abroad)", () => {
  test("[place:departure-moves-abroad] [home:compound-room-is-a-home] [place:family-takes-you-back] given Ada in the room, when she flies, then the room's rent closes with its upkeep; when she comes home, the family house takes her back at its own charge", () => {
    const game = inTheRoom();
    restMonth(game);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    expect(openObligations(game).filter((entry) => entry === RENT || entry === UPKEEP || entry === FAMILY_UPKEEP)).toEqual([]);
    restMonth(game);
    applyEffects(game, [{ type: "place/move", to: "home", country: null }]);
    expect(openObligations(game)).toContain(FAMILY_UPKEEP);
    expect(openObligations(game)).not.toContain(RENT);
    expect(game.view().home.place).toBe(FAMILY);
    restMonth(game);
    expect(game.state.home).toMatchObject({ place: FAMILY, guest: null });
    expect(checkInvariants(game.state, QUIET)).toEqual([]);
  });
});

describe("a start in the room (prologue:front-door-three-screens)", () => {
  test("[prologue:front-door-three-screens] [home:home-slice-fields] [home:compound-room-is-a-home] [obligation:prepaid-entries-skip-first-charge] given a life from sixteen that answers the room, when the prologue closes, then the year and the fees are taken, it lives in the room with no move made, owes the room's rent and upkeep, and owes the rent again at month 12 and nothing before", () => {
    let held = 0;
    const game = fromSixteen("compound-room", (before) => {
      held = naira(before);
    });
    expect(held).toBeGreaterThanOrEqual(MOVE_IN + home.compound.upkeep);
    expect(naira(game)).toBe(held - MOVE_IN);
    expect(game.state.prologue.open).toBe(false);
    expect(game.state.home).toEqual({ place: COMPOUND, since: 0, guest: null, moved: null, evicted: null, hosting: null });
    expect(openObligations(game)).toEqual([RENT, UPKEEP]);
    expect(checkInvariants(game.state, QUIET)).toEqual([]);
    for (let at = 1; at < 12; at += 1) {
      setPockets(game, { NGN: { cash: 0, bank: 5_000_000_00 } });
      const result = restMonth(game);
      expect(charged(result, RENT)).toEqual([]);
      expect(charged(result, UPKEEP)).toHaveLength(1);
    }
    setPockets(game, { NGN: { cash: 0, bank: 5_000_000_00 } });
    expect(charged(restMonth(game), RENT)).toEqual([home.compound.rentYear]);
    expect(game.state.turn.month).toBe(12);
  });

  test("[prologue:front-door-three-screens] given the home card, when the life holds the year, the fees and a month of the room's living costs less one kobo, then the room is shut; with it exactly held it is open", () => {
    const need = MOVE_IN + home.compound.upkeep;
    const short = fromSixteenTo("home");
    holding(short, need - 1);
    expect(homeAnswer(short, "compound-room")?.allowed).toBe(false);
    short.expectRejected({ type: "prologue/choose", step: "home", answer: "compound-room" }, "not-legal");
    const exact = fromSixteenTo("home");
    holding(exact, need);
    expect(homeAnswer(exact, "compound-room")?.allowed).toBe(true);
    exact.accept({ type: "prologue/choose", step: "home", answer: "compound-room" });
    expect(naira(exact)).toBe(home.compound.upkeep);
  });

  test("[prologue:front-door-three-screens] given the home card, then it offers the family house, the room in a compound and Makoko, in that order, and the room's answer takes the year and the fees, opens the room's rent and upkeep and moves the life there", () => {
    const card = content.prologue["home"];
    // The hostel room is the card's fourth home (home.hostel.test.ts).
    expect(card?.answers.map((answer) => answer.id)).toEqual(["family-house", "compound-room", "hostel-room", "makoko"]);
    const room = card?.answers.find((answer) => answer.id === "compound-room");
    expect(room?.requires).toEqual([{ type: "money/can-pay", currency: "NGN", amount: MOVE_IN + home.compound.upkeep }]);
    expect(room?.effects).toEqual([
      { type: "money/take", currency: "NGN", pocket: "any", amount: MOVE_IN, reason: "rent" },
      { type: "obligation/open", obligation: RENT, amount: home.compound.rentYear },
      { type: "obligation/open", obligation: UPKEEP, amount: home.compound.upkeep },
      { type: "home/move", place: COMPOUND },
    ]);
  });
});

/**
 * The naira held set to exactly `amount` in the bank. Built by hand: while the prologue is open no command and no
 * effect moves money, and the edge of the home card's requirement is one kobo.
 */
function holding(game: Game, amount: number): void {
  const pockets = game.state.wallet.pockets;
  game.state = { ...game.state, wallet: { ...game.state.wallet, pockets: { ...pockets, NGN: { ...pockets.NGN, cash: 0, bank: amount } } } };
}

/** A life from sixteen through the shop counter, stopped at `step`. */
function fromSixteenTo(step: string): Game {
  const game = start({ content: QUIET, scenario: "scenario.prologue", seed: "seed-1" });
  for (const choice of ["begin", "commercial", "work", "start-21", "save", "nowhere"]) {
    if (game.state.prologue.step === step) break;
    const at = game.state.prologue.step;
    if (at === null) throw new Error(`The prologue closed before ${step}.`);
    game.accept({ type: "prologue/choose", step: at, answer: choice });
  }
  if (game.state.prologue.step !== step) throw new Error(`The prologue is at ${String(game.state.prologue.step)}, not ${step}.`);
  return game;
}
