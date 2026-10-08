import { content, text } from "@japacity/content";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { check } from "../engine/check";
import { bp, divFloor, mulDiv } from "../engine/int";
import { checkInvariants } from "../engine/invariants";
import type { Content, Currency, Effect, Id, ObligationType, ReadCtx, ReportLine, ReturnShape, State } from "../engine/types";
import { applyEffects, readyLife, toDecision, UK as UK_ROUTE } from "../route/route.journey";
import { legalCommands } from "../testing/legal";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { flown, offeredSeed, playMonths, recordingCloses } from "./place.journey";
import { appliesHere, bannedUntil, capitalBonus, fareHome, returnShape } from "./place.logic";

const UK: Id<"country"> = "country.uk";
const CANADA: Id<"country"> = "country.canada";

function at(where: State["place"]["where"], country: Id<"country"> | null): State {
  const game = start({ content });
  return { ...game.state, place: { ...game.state.place, where, country } };
}

describe("where an entry applies", () => {
  test("[R-PLACE-003] given entries for home, abroad, one country and anywhere, when the character is at home, abroad in two countries and on the road, then each applies only where its page says", () => {
    const home = at("home", null);
    const uk = at("abroad", UK);
    const canada = at("abroad", CANADA);
    const road = at("road", null);
    const homeEntry = { where: "home" as const };
    const unsaid = {};
    const abroadEntry = { where: "abroad" as const };
    const ukEntry = { where: "abroad" as const, country: UK };
    const anywhere = { where: "any" as const, country: UK };
    expect([home, uk, canada, road].map((state) => appliesHere(homeEntry, state))).toEqual([true, false, false, false]);
    expect([home, uk, canada, road].map((state) => appliesHere(unsaid, state))).toEqual([true, false, false, false]);
    expect([home, uk, canada, road].map((state) => appliesHere(abroadEntry, state))).toEqual([false, true, true, false]);
    expect([home, uk, canada, road].map((state) => appliesHere(ukEntry, state))).toEqual([false, true, false, false]);
    expect([home, uk, canada, road].map((state) => appliesHere(anywhere, state))).toEqual([true, true, true, true]);
  });

  test("[R-PLACE-003] given the real content, when every activity, offer and obligation is read at home, then the abroad ones do not apply and the home ones do", () => {
    const home = at("home", null);
    const entries = [...Object.values(content.activity), ...Object.values(content.offer), ...Object.values(content.obligation)];
    for (const entry of entries) {
      expect(appliesHere(entry, home)).toBe((entry.where ?? "home") !== "abroad");
    }
  });
});

const STANDING: Id<"quality"> = "quality.standing";
const DECEMBER: Id<"setpiece"> = "setpiece.december";
const SETTLED: Id<"status"> = "status.uk-settled";
const STUDENT: Id<"status"> = "status.uk-student";
const RESIDENT: Id<"status"> = "status.ca-resident";
const CURRENCIES: readonly Currency[] = ["NGN", "GBP", "USD", "CAD", "AED", "EUR"];
const tuning = content.tuning;
const brokeLine = tuning.place.brokeLine;
const capitalPer = tuning.return.capitalPer;
const ukFare = content.country[UK]!.fare;

function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

function placeLines(lines: ReportLine[]): ReportLine[] {
  return lines.filter((line) => line.key.startsWith("line.place."));
}

/** Empties every spendable pocket, then leaves the naira bank and the pound bank holding exactly these. */
function leave(game: Game, nairaBank: number, poundBank: number): void {
  const takes: Effect[] = CURRENCIES.flatMap((currency): Effect[] => {
    const pocket = game.state.wallet.pockets[currency];
    const held = pocket.bank + pocket.cash;
    return held === 0 ? [] : [{ type: "money/take", currency, pocket: "any", amount: held, reason: "mishap" }];
  });
  applyEffects(game, [
    ...takes,
    { type: "money/add", currency: "NGN", pocket: "bank", amount: nairaBank, reason: "gift" },
    { type: "money/add", currency: "GBP", pocket: "bank", amount: poundBank, reason: "gift" },
  ]);
}

function standing(game: Game): number {
  return game.state.quality[STANDING] ?? 0;
}

/** Comes home by command: the standing it moved, the shape recorded and the lines. */
function comeHome(game: Game): { moved: number; shape: ReturnShape | undefined; lines: ReportLine[] } {
  const before = standing(game);
  const result = game.accept({ type: "return/home" });
  return { moved: standing(game) - before, shape: game.state.place.returns.at(-1)?.shape, lines: result.lines };
}

function openedThisMonth(game: Game): string[] {
  return Object.values(game.state.obligation.items)
    .filter((item) => item.openedMonth === game.state.turn.month)
    .map((item) => `${item.entry} ${String(item.amount)}`);
}

describe("a new character", () => {
  test("[R-PLACE-001] given a new life, when it starts, then the character is at home with no country, no move and no return on record", () => {
    const game = start({ content });
    expect(game.state.place).toEqual({ where: "home", country: null, movedMonth: 0, returns: [], heldAbroad: null });
    expect(game.view().place).toEqual({ where: "home", country: null, monthsHere: 0, returns: [], heldAbroad: null });
  });
});

describe("leaving", () => {
  test("[R-PLACE-002] [R-GATE-003] given Ada with a granted visa, when she departs, then she is abroad in the route's country from that month, the home upkeep and support close and the country's upkeep and room open", () => {
    const closed: ObligationType[] = [];
    const game = flown(content, { kinds: recordingCloses(closed) });
    expect(game.state.place).toMatchObject({ where: "abroad", country: UK, movedMonth: game.state.turn.month });
    expect(closed).toEqual(["upkeep", "support"]);
    const upkeep = content.obligation["obligation.upkeep-uk"]!.amount;
    const room = content.obligation["obligation.rent-room-uk"]!.amount;
    expect(openedThisMonth(game)).toEqual(expect.arrayContaining([`obligation.upkeep-uk ${String(upkeep)}`, `obligation.rent-room-uk ${String(room)}`]));
    expect(checkInvariants(game.state, game.content)).toEqual([]);
  });

  test("[R-PLACE-002] given a life with family support, when it departs, then the support opens again abroad at the remit factor", () => {
    const game = flown(content, { from: "scenario.zainab" });
    expect(openedThisMonth(game)).toContain(`obligation.home-support ${String(bp(60000 * 100, tuning.remit.abroadBp))}`);
  });

  test("[R-PLACE-002] given a departure, when its lines are read, then the arrival asks for attention and names the country; a move to the place already held does nothing", () => {
    const game = readyLife(content, { seed: offeredSeed(content), tuning: { refusalMinBp: 0, refusalMaxBp: 0 } });
    toDecision(game);
    const result = game.accept({ type: "route/depart", route: UK_ROUTE });
    expect(placeLines(result.lines)).toEqual([{ key: "line.place.arrived", params: { country: UK }, tone: "good", attention: true, counts: [] }]);
    const months = game.state.place.movedMonth;
    playMonths(game, 1);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: UK }]);
    expect(game.state.place.movedMonth).toBe(months);
  });

  test("[R-PLACE-002] [R-CHAPTER-002] given the send-off chapter current, when the character flies and the month ends, then the life goes on and the chapter closes in that month's chapter phase", () => {
    const game = flown(content);
    // The ready life skips the first chapters' play, so the send-off is made current by hand.
    game.state = { ...game.state, chapter: { current: "chapter.send-off", done: ["chapter.find-your-feet", "chapter.build-the-file", "chapter.decision-day"] } };
    expect(game.state.turn.ended).toBe(false);
    if (game.state.turn.banked < 1) game.grant(1);
    const result = game.endTurn();
    expect(game.state.chapter.done).toContain("chapter.send-off");
    expect(result.lines).toContainEqual(expect.objectContaining({ key: "line.chapter.closed", params: { chapter: "chapter.send-off" } }));
  });
});

describe("coming home", () => {
  test("[R-PLACE-004] given a character at home, when return/home is sent, then it is rejected", () => {
    const game = readyLife(content);
    const rejected = game.expectRejected({ type: "return/home" }, "not-legal");
    expect(rejected.ok).toBe(false);
  });

  test("[R-PLACE-004] given a student with nothing to pay the fare, when return/home is sent, then it is rejected; as an overstayer with nothing, it is accepted as an assisted return and no fare is paid", () => {
    const game = flown(content);
    leave(game, 0, 0);
    game.expectRejected({ type: "return/home" }, "cannot-afford");
    applyEffects(game, [{ type: "status/lose" }]);
    const back = comeHome(game);
    expect(back.shape).toBe("assisted");
    expect(game.state.wallet.totals.out.fare).toBeUndefined();
    expect(game.state.place).toMatchObject({ where: "home", country: null });
    expect(game.state.status.current).toBeNull();
  });

  test("[R-PLACE-004] [R-PLACE-005] given a student with money, when she comes home, then the fare is paid, every status closes and the return is recorded by choice", () => {
    const game = flown(content);
    leave(game, brokeLine, ukFare);
    const month = game.state.turn.month;
    const back = comeHome(game);
    expect(back.shape).toBe("by-choice");
    expect(game.state.place.returns).toEqual([{ month, shape: "by-choice", country: UK }]);
    expect(game.state.status.current).toBeNull();
    expect(game.state.wallet.totals.out.fare).toEqual({ GBP: ukFare });
    expect(back.lines).toContainEqual({ key: "line.status.closed", params: { status: STUDENT }, tone: "plain", attention: false, counts: [] });
    expect(placeLines(back.lines)).toEqual([{ key: "line.place.returned-by-choice", params: { country: UK }, tone: "plain", attention: true, counts: [] }]);
    expect(checkInvariants(game.state, game.content)).toEqual([]);
  });

  test("[R-PLACE-005] given a fare paid that leaves one kobo under the broke line, or exactly on it, when the character comes home, then the first is broke and the second by choice", () => {
    const under = flown(content);
    leave(under, brokeLine - 1, ukFare);
    expect(comeHome(under).shape).toBe("broke");
    const on = flown(content);
    leave(on, brokeLine, ukFare);
    expect(comeHome(on).shape).toBe("by-choice");
  });

  test("[R-PLACE-005] given a settled status at the moment of leaving, when the character comes home, then the return is with papers; a removal is removed whatever is held", () => {
    const papers = flown(content);
    applyEffects(papers, [{ type: "status/grant", status: SETTLED }]);
    leave(papers, brokeLine, ukFare);
    expect(comeHome(papers).shape).toBe("with-papers");
    const removed = flown(content);
    applyEffects(removed, [{ type: "status/grant", status: SETTLED }, { type: "status/remove" }]);
    expect(removed.state.place.returns.map((back) => back.shape)).toEqual(["removed"]);
  });

  test("[R-PLACE-005] given each case, when the shape is judged, then the first match wins in the page's order", () => {
    const game = flown(content);
    // As the fare has just been paid: what is left is one kobo under the line.
    leave(game, brokeLine - 1, 0);
    const read = readOf(game);
    expect(returnShape(read, false)).toBe("by-choice");
    expect(returnShape(read, true)).toBe("broke");
    const overstay: ReadCtx = { ...read, state: { ...read.state, status: { ...read.state.status, current: null } } };
    expect(returnShape(overstay, false)).toBe("assisted");
    expect(returnShape(overstay, true)).toBe("broke");
    const removed: ReadCtx = { ...overstay, state: { ...overstay.state, status: { current: null, removals: [{ country: UK, month: game.state.turn.month }] } } };
    expect(returnShape(removed, true)).toBe("removed");
  });

  test("[R-PLACE-006] given the pound pockets, when the fare is paid, then it is taken cash first from pounds under the reason fare", () => {
    const game = flown(content);
    leave(game, brokeLine, 0);
    applyEffects(game, [{ type: "money/add", currency: "GBP", pocket: "cash", amount: ukFare, reason: "gift" }]);
    expect(fareHome(readOf(game))).toEqual({ currency: "GBP", amount: ukFare });
    comeHome(game);
    expect(game.state.wallet.pockets.GBP.cash).toBe(0);
    expect(game.state.wallet.totals.out.fare).toEqual({ GBP: ukFare });
  });

  test("[R-PLACE-006] given December in the world, when the fare is read, then it is the fare times the December factor", () => {
    const game = flown(content, { vars: () => ({ "var.season-december": 1 }) });
    expect(fareHome(readOf(game))).toEqual({ currency: "GBP", amount: mulDiv(ukFare, content.country[UK]!.decemberFactorBp, 10000) });
    expect(fareHome(readOf(readyLife(content)))).toBeNull();
  });

  test("[R-PLACE-006] given no pounds and naira in the bank, when the fare is paid, then naira buys it at the official rate plus the charge; with the naira leg turned off, it cannot be paid", () => {
    const game = flown(content);
    leave(game, 1000000000, 0);
    comeHome(game);
    expect(game.state.wallet.totals.out.fare).toEqual({ GBP: ukFare });
    expect(game.state.wallet.totals.out["bank-charge"]?.NGN ?? 0).toBeGreaterThan(0);
    const strict: (used: Content) => Content = (used) => ({ ...used, tuning: { ...used.tuning, place: { ...used.tuning.place, fareFromNaira: false } } });
    const refused = flown(content, { change: strict });
    leave(refused, 1000000000, 0);
    refused.expectRejected({ type: "return/home" }, "cannot-afford");
  });

  test("[R-PLACE-007] [R-RETURN-002] given each shape with no capital, when the character comes home, then standing moves by the page's figure for it", () => {
    const shapes: [ReturnShape, (game: Game) => void][] = [
      ["by-choice", (game) => leave(game, brokeLine, ukFare)],
      ["broke", (game) => leave(game, brokeLine - 1, ukFare)],
      ["with-papers", (game) => {
        applyEffects(game, [{ type: "status/grant", status: SETTLED }]);
        leave(game, brokeLine, ukFare);
      }],
      ["assisted", (game) => {
        applyEffects(game, [{ type: "status/lose" }]);
        leave(game, 0, 0);
      }],
    ];
    for (const [shape, setUp] of shapes) {
      const game = flown(content);
      setUp(game);
      const back = comeHome(game);
      expect([back.shape, back.moved]).toEqual([shape, tuning.return.standing[shape]]);
    }
    const removed = flown(content);
    leave(removed, brokeLine, 0);
    const before = standing(removed);
    applyEffects(removed, [{ type: "status/remove" }]);
    expect(standing(removed) - before).toBe(tuning.return.standing.removed);
  });

  test("[R-RETURN-002] given naira in the bank one short of a step above the broke line, one step, and far past the cap, when the character comes home by choice, then standing gains 0, 1 and the cap", () => {
    for (const [bank, gain] of [
      [brokeLine + capitalPer - 1, 0],
      [brokeLine + capitalPer, 1],
      [brokeLine + capitalPer * 25, tuning.return.capitalCap],
    ] as const) {
      const game = flown(content);
      leave(game, bank, ukFare);
      expect(comeHome(game).moved).toBe(gain);
    }
  });

  test.prop([fc.integer({ min: 0, max: 100000000000 })])("[R-RETURN-002] given any naira in the bank, when the capital bonus is worked out, then it is the whole steps above the broke line, never below 0 nor above the cap", (bank) => {
    const game = start({ content });
    const read: ReadCtx = { ...readOf(game), state: { ...game.state, wallet: { ...game.state.wallet, pockets: { ...game.state.wallet.pockets, NGN: { bank, cash: 0, locked: 0 } } } } };
    const steps = bank <= brokeLine ? 0 : divFloor(bank - brokeLine, capitalPer);
    expect(capitalBonus(read)).toBe(Math.min(tuning.return.capitalCap, steps));
  });

  test("[R-PLACE-007] [R-RETURN-006] given a return, when it is made, then everything abroad closes and the home upkeep and support reopen at the starting life's amounts", () => {
    const closed: ObligationType[] = [];
    const game = flown(content, { from: "scenario.zainab", kinds: recordingCloses(closed) });
    closed.length = 0;
    comeHome(game);
    expect(closed).toEqual(["upkeep", "support", "rent", "phone", "surcharge", "tuition"]);
    expect(openedThisMonth(game)).toEqual(expect.arrayContaining([`obligation.upkeep ${String(130000 * 100)}`, `obligation.home-support ${String(60000 * 100)}`]));
  });
});

describe("the sampler", () => {
  test("[R-PLACE-004] given a student with the fare and an overstayer with nothing, when the legal commands are sampled, then return/home is offered to both and accepted", () => {
    const student = flown(content);
    leave(student, 0, 155000);
    expect(legalCommands(student.view())).toContainEqual({ type: "return/home" });
    student.accept({ type: "return/home" });
    expect(legalCommands(student.view())).not.toContainEqual({ type: "return/home" });
    const overstayer = flown(content);
    applyEffects(overstayer, [{ type: "status/lose" }]);
    leave(overstayer, 0, 0);
    expect(legalCommands(overstayer.view())).toContainEqual({ type: "return/home" });
    overstayer.accept({ type: "return/home" });
  });
});

describe("removal and the ban", () => {
  test("[R-PLACE-008] given a removal from the UK, when the ban is read, then the UK's routes are banned for the removal months from that month and no other country is", () => {
    const game = flown(content);
    expect(bannedUntil(readOf(game), UK)).toBeNull();
    applyEffects(game, [{ type: "status/remove" }]);
    const month = game.state.turn.month;
    expect(bannedUntil(readOf(game), UK)).toBe(month + content.status["status.uk-overstayer"]!.banMonths);
    expect(bannedUntil(readOf(game), "country.canada")).toBeNull();
  });
});

describe("the view and the record", () => {
  test("[R-PLACE-009] [R-RETURN-001] given two returns, when the view is read, then it shows where, the country, the months since the move and the record newest first", () => {
    const game = flown(content);
    playMonths(game, 2);
    expect(game.view().place).toMatchObject({ where: "abroad", country: UK, monthsHere: 2, returns: [] });
    comeHome(game);
    const first = game.state.turn.month;
    playMonths(game, 1);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: UK }, { type: "status/grant", status: STUDENT }, { type: "status/remove" }]);
    expect(game.view().place).toEqual({
      where: "home",
      country: null,
      monthsHere: 0,
      returns: [
        { month: first + 1, shape: "removed", country: UK },
        { month: first, shape: "by-choice", country: UK },
      ],
      heldAbroad: null,
    });
  });

  test("[R-RETURN-007] given a return, when the routes are read, then the departed route and its record are as they were", () => {
    const game = flown(content);
    const before = game.state.route;
    comeHome(game);
    expect(game.state.route).toEqual(before);
  });
});

describe("the token kept abroad", () => {
  test("[R-RETURN-004] given a return with papers, when it is recorded, then the settled status is kept as a token, and flying back to the UK uses it", () => {
    const game = flown(content);
    applyEffects(game, [{ type: "status/grant", status: SETTLED }]);
    comeHome(game);
    expect(game.state.place.heldAbroad).toEqual({ status: SETTLED, sinceMonth: game.state.turn.month });
    expect(game.view().place.heldAbroad).toBe(SETTLED);
    playMonths(game, 30);
    expect(game.state.place.heldAbroad?.status).toBe(SETTLED);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: UK }]);
    expect(game.state.place.heldAbroad).toBeNull();
  });

  test("[R-RETURN-004] given a Canadian resident's token, when 23 and then 24 months pass at home, then it is kept and then lapses", () => {
    const game = flown(content);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.canada" }, { type: "status/grant", status: RESIDENT }]);
    leave(game, 1000000000, 0);
    comeHome(game);
    expect(game.state.place.heldAbroad?.status).toBe(RESIDENT);
    playMonths(game, tuning.return.residentLapseMonths - 1);
    expect(game.state.place.heldAbroad?.status).toBe(RESIDENT);
    if (game.state.turn.banked < 1) game.grant(1);
    const result = game.endTurn();
    expect(game.state.place.heldAbroad).toBeNull();
    expect(placeLines(result.lines)).toEqual([
      { key: "line.place.token-lapsed", params: { status: RESIDENT, months: tuning.return.residentLapseMonths }, tone: "bad", attention: true, counts: [] },
    ]);
  });
});

describe("December abroad", () => {
  test("[R-RETURN-005] given the December tick and a character abroad, when the month ends, then the December set piece opens with no route; at home, or out of December, it does not", () => {
    const december = flown(content, { vars: () => ({ "var.season-december": 1 }) });
    december.endTurn();
    expect(december.state.setpiece.open).toMatchObject({ entry: DECEMBER, route: null });
    const ordinary = flown(content);
    ordinary.endTurn();
    expect(ordinary.state.setpiece.open).toBeNull();
    const home = readyLife(content, { vars: () => ({ "var.season-december": 1 }) });
    home.endTurn();
    expect(home.state.setpiece.open).toBeNull();
  });
});

describe("requirements", () => {
  test("[R-PLACE-009] given a character abroad two months and then home after a return, when place/is, place/returned and place/months-here are judged, then each reads the place as it is", () => {
    const game = flown(content);
    const judge = (requirement: Parameters<typeof check>[1]) => check(readOf(game), requirement).met;
    expect(judge({ type: "place/is", where: "abroad" })).toBe(true);
    expect(judge({ type: "place/is", where: "abroad", country: UK })).toBe(true);
    expect(judge({ type: "place/is", where: "abroad", country: "country.canada" })).toBe(false);
    playMonths(game, 2);
    expect(judge({ type: "place/months-here", where: "abroad", months: 2 })).toBe(true);
    expect(judge({ type: "place/months-here", where: "abroad", months: 3 })).toBe(false);
    expect(judge({ type: "place/months-here", where: "home", months: 0 })).toBe(false);
    expect(judge({ type: "place/returned", shapes: ["by-choice", "with-papers"] })).toBe(false);
    comeHome(game);
    expect(judge({ type: "place/is", where: "home" })).toBe(true);
    expect(judge({ type: "place/returned", shapes: ["by-choice", "with-papers"] })).toBe(true);
    expect(judge({ type: "place/returned", shapes: ["removed"] })).toBe(false);
  });
});

describe("the place kind's words", () => {
  test("[R-ENGINE-014] given every line the place kind gives, when the words are looked up, then each has words naming only figures its line carries", () => {
    const params: Record<string, string[]> = {
      "line.place.arrived": ["country"],
      "line.place.on-road": [],
      "line.place.token-used": ["status"],
      "line.place.token-lapsed": ["status", "months"],
    };
    for (const shape of ["with-papers", "by-choice", "broke", "assisted", "removed"]) params[`line.place.returned-${shape}`] = ["country"];
    for (const [key, allowed] of Object.entries(params)) {
      expect((text[key] ?? "").trim()).not.toBe("");
      for (const match of (text[key] ?? "").matchAll(/\{([^}]+)\}/g)) expect(allowed).toContain(match[1]);
    }
  });
});
