// A hostel room of your own (home.md R-HOME-001, 002, 008, 011): the fourth home, one small room
// off a shared corridor rented by the month at `tuning.home.hostelRentKobo`, about half the room in a compound's month
// of rent. A move to it needs one month's rent held and takes it; each month's end pays the month to come; there is no
// year's lump, which is why it is the cheap way out of the family house. A rent gone bad sends the character home.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp, divFloor } from "../engine/int";
import { checkInvariants } from "../engine/invariants";
import type { Accepted, BaseEvent, Effect, Id } from "../engine/types";
import { applyEffects } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { HomePlaceSchema } from "./home.schema";

const FAMILY = "place.family-house" as const;
const HOSTEL = "place.hostel-room" as const;
const RENT: Id<"obligation"> = "obligation.upkeep-hostel";
const FAMILY_UPKEEP: Id<"obligation"> = "obligation.upkeep";
const STANDING: Id<"quality"> = "quality.standing";
const { home } = content.tuning;
const MONTH = home.hostelRentKobo;

function ada(): Game {
  return start({ content, scenario: "scenario.ada", seed: "seed-1" });
}

/** Leaves exactly this much naira, all in the bank. */
function setNaira(game: Game, bank: number): void {
  const pocket = game.state.wallet.pockets.NGN;
  const effects: Effect[] = [];
  if (pocket.cash > 0) effects.push({ type: "money/take", currency: "NGN", pocket: "cash", amount: pocket.cash, reason: "mishap" });
  if (pocket.bank > 0) effects.push({ type: "money/take", currency: "NGN", pocket: "bank", amount: pocket.bank, reason: "mishap" });
  if (bank > 0) effects.push({ type: "money/add", currency: "NGN", pocket: "bank", amount: bank, reason: "gift" });
  applyEffects(game, effects);
}

function naira(game: Game): number {
  return game.state.wallet.pockets.NGN.cash + game.state.wallet.pockets.NGN.bank;
}

function month(game: Game): Accepted {
  if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
  return game.endTurn();
}

function eventsOf(result: { events: BaseEvent[] }, type: string): (BaseEvent & Record<string, unknown>)[] {
  return result.events.filter((event) => event.type === type) as (BaseEvent & Record<string, unknown>)[];
}

function openEntries(game: Game): string[] {
  return Object.values(game.state.obligation.items).map((item) => item.entry as string).sort();
}

/** Ada moved into the hostel with exactly a month's rent and `spare` more. */
function inTheHostel(spare = 0): Game {
  const game = ada();
  setNaira(game, MONTH + spare);
  const result = game.accept({ type: "home/move", to: HOSTEL });
  if (!("events" in result)) throw new Error(`The move was refused: ${JSON.stringify(result)}`);
  return game;
}

describe("the hostel as a home", () => {
  test("[R-HOME-001] given the home slice, when its places are read, then there are four homes, the hostel room among them, and it is a place of the city's homes", () => {
    expect(HomePlaceSchema.options).toEqual(["place.family-house", "place.makoko", "place.compound-room", HOSTEL]);
    expect(content.place[HOSTEL]).toMatchObject({ where: "home", nameKind: "stylised", scope: "interior" });
    expect(content.obligation[RENT]).toMatchObject({ type: "rent", currency: "NGN", amount: MONTH, sink: "rent", grace: 2 });
    expect(content.obligation[RENT]?.everyMonths).toBeUndefined();
  });

  test("[R-HOME-001] given the hostel's rent, when it is set against the room in a compound's, then it is a whole kobo figure about half the room's month of rent, the year divided by twelve", () => {
    expect(Number.isSafeInteger(MONTH)).toBe(true);
    const roomMonth = divFloor(home.compound.rentYear, 12);
    const half = divFloor(roomMonth, 2);
    expect(MONTH).toBeGreaterThanOrEqual(half - bp(half, 1500));
    expect(MONTH).toBeLessThanOrEqual(half + bp(half, 1500));
  });

  test("[R-HOME-002] [R-HOME-008] given Ada at the family house, when the home card's moves are read, then the hostel is offered at its rent a month with its first month taken now, shut short until a month's rent is held", () => {
    const game = ada();
    setNaira(game, MONTH - 1);
    const shut = game.view().home.moves.find((move) => move.to === HOSTEL);
    expect(shut).toEqual({ to: HOSTEL, monthly: { currency: "NGN", amount: MONTH }, now: MONTH, shut: "short" });
    game.expectRejected({ type: "home/move", to: HOSTEL }, "cannot-afford");
    setNaira(game, MONTH);
    expect(game.view().home.moves.find((move) => move.to === HOSTEL)?.shut).toBeNull();
  });

  test("[R-HOME-002] given Ada with exactly a month's rent, when she moves to the hostel, then the month is taken under rent, the hostel's rent opens by the month with no year's lump and the family's upkeep closes, and the card says the rent a month", () => {
    const game = ada();
    setNaira(game, MONTH);
    const result = game.accept({ type: "home/move", to: HOSTEL });
    if (!("events" in result)) throw new Error("Refused");
    expect(eventsOf(result, "wallet/debited").map((event) => [event["reason"], event["amount"]])).toEqual([["rent", MONTH]]);
    expect(naira(game)).toBe(0);
    expect(game.state.home).toMatchObject({ place: HOSTEL, guest: null });
    expect(openEntries(game)).toEqual([RENT]);
    expect(openEntries(game)).not.toContain("obligation.rent-compound");
    expect(game.view().home.rent).toEqual({ currency: "NGN", amount: MONTH });
    expect(game.view().home.roomRent).toBeNull();
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[R-HOME-002] given Ada in the hostel, when months end, then each month's end pays the month to come at the hostel's rent, never more", () => {
    const game = inTheHostel();
    for (let at = 0; at < 3; at += 1) {
      setNaira(game, 5_000_000_00);
      const result = month(game);
      const paid = eventsOf(result, "obligation/charged").filter((event) => event["entry"] === RENT).map((event) => event["total"]);
      expect(paid).toEqual([MONTH]);
      expect(game.state.home.place).toBe(HOSTEL);
    }
  });

  test("[R-HOME-011] given Ada in the hostel with nothing at the months' ends, when the rent is missed past its grace, then in the same month's clocks she is back at the family house: the family's upkeep reopens, the rent closes, the standing cost is paid and a line with attention says it", () => {
    const game = inTheHostel();
    const grace = content.obligation[RENT]!.grace;
    let last: Accepted | null = null;
    for (let miss = 0; miss <= grace; miss += 1) {
      expect(game.state.home.place).toBe(HOSTEL);
      setNaira(game, 0);
      last = month(game);
    }
    if (last === null) throw new Error("No month ran.");
    expect(eventsOf(last, "obligation/defaulted").map((event) => event["entry"])).toEqual([RENT]);
    expect(game.state.home).toMatchObject({ place: FAMILY, guest: null });
    expect(openEntries(game)).toEqual([FAMILY_UPKEEP]);
    expect(eventsOf(last, "home/moved")[0]).toMatchObject({ from: HOSTEL, to: FAMILY, putOut: true });
    expect(last.lines.find((line) => line.key === "line.home.put-out")).toMatchObject({ tone: "bad", attention: true, params: { place: FAMILY } });
    expect(eventsOf(last, "quality/changed").some((event) => event["quality"] === STANDING)).toBe(true);
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[R-HOME-011] given Ada's hostel rent missed but not yet past its grace, when the month ends, then she still lives in the hostel", () => {
    const game = inTheHostel();
    setNaira(game, 0);
    month(game);
    expect(game.state.home.place).toBe(HOSTEL);
    expect(openEntries(game)).toEqual([RENT]);
  });

  test("[R-OBLIGATION-014] given Ada in the hostel, when the water acts are read, then the drum is filled free from the tap and no water is bought", () => {
    const game = inTheHostel(1_000_000_00);
    const allowed = (id: string): boolean => game.view().activities.find((option) => option.id === id)?.allowed ?? false;
    expect([allowed("activity.fill-drum"), allowed("activity.fetch-water"), allowed("activity.cook-own")]).toEqual([true, false, true]);
  });
});
